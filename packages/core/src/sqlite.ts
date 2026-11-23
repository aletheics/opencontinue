import { randomUUID } from "node:crypto"
import { mkdirSync } from "node:fs"
import { dirname } from "node:path"
import { DatabaseSync } from "node:sqlite"

import type { SessionEvent, SessionId, SessionSnapshot, SessionSummary } from "@opencontinue/protocol"

import { buildEvent, draftOf } from "./events.js"
import { snapshotOf, summarize } from "./projection.js"
import type {
  EventDraft,
  SessionExport,
  SessionListener,
  SessionRecord,
  SessionStore,
} from "./types.js"

type SessionRow = {
  id: string
  title: string
  created_at: string
  updated_at: string
  last_seq?: number
}

type EventRow = {
  payload: string
}

type VersionRow = {
  user_version: number
}

function asRow<T>(value: Record<string, unknown> | undefined): T | undefined {
  return value as T | undefined
}

function asRows<T>(values: Record<string, unknown>[]): T[] {
  return values as T[]
}

/**
 * SQLite-backed event store.
 *
 * Uses the built-in `node:sqlite` module (Node 22.5+), WAL mode, and a single
 * append-only events table. Interrupted runs are closed with a `run.failed`
 * event when the database is opened.
 */
export class SqliteSessionStore implements SessionStore {
  private readonly db: DatabaseSync
  private readonly listeners = new Map<SessionId, Set<SessionListener>>()
  private closed = false

  constructor(private readonly path: string) {
    if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true })
    this.db = new DatabaseSync(path)
    this.db.exec("PRAGMA journal_mode = WAL")
    this.db.exec("PRAGMA foreign_keys = ON")
    this.migrate()
    this.recover()
  }

  create(title = "Untitled session"): SessionRecord {
    const id = randomUUID()
    const at = new Date().toISOString()
    const event: SessionEvent = {
      type: "session.created",
      sessionId: id,
      seq: 0,
      at,
      title,
    }

    this.transaction(() => {
      this.db
        .prepare("INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(id, title, at, at)
      this.insertEvent(event)
    })

    return { id, title, createdAt: at, updatedAt: at, events: [event] }
  }

  list(): SessionSummary[] {
    const rows = asRows<SessionRow>(
      this.db
        .prepare(
          `SELECT s.id, s.title, s.created_at, s.updated_at, COALESCE(MAX(e.seq), -1) AS last_seq
           FROM sessions s
           LEFT JOIN events e ON e.session_id = s.id
           GROUP BY s.id
           ORDER BY s.updated_at DESC`,
        )
        .all(),
    )

    return rows.map((row) => ({
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      lastSeq: Number(row.last_seq ?? -1),
    }))
  }

  get(id: SessionId): SessionRecord | undefined {
    const row = asRow<SessionRow>(
      this.db
        .prepare("SELECT id, title, created_at, updated_at FROM sessions WHERE id = ?")
        .get(id),
    )
    if (!row) return undefined

    return {
      id: row.id,
      title: row.title,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      events: this.events(id),
    }
  }

  events(id: SessionId, after = -1): SessionEvent[] {
    const rows = asRows<EventRow>(
      this.db
        .prepare("SELECT payload FROM events WHERE session_id = ? AND seq > ? ORDER BY seq ASC")
        .all(id, after),
    )
    return rows.map((row) => JSON.parse(row.payload) as SessionEvent)
  }

  append(id: SessionId, draft: EventDraft): SessionEvent {
    const event = this.transaction(() => {
      const exists = this.db.prepare("SELECT 1 AS ok FROM sessions WHERE id = ?").get(id)
      if (!exists) throw new Error(`Session not found: ${id}`)

      const next = asRow<{ next: number }>(
        this.db
          .prepare("SELECT COALESCE(MAX(seq), -1) + 1 AS next FROM events WHERE session_id = ?")
          .get(id),
      )
      const seq = Number(next?.next ?? 0)
      const at = new Date().toISOString()
      const built = buildEvent(id, seq, at, draft)

      this.insertEvent(built)
      this.db.prepare("UPDATE sessions SET updated_at = ? WHERE id = ?").run(at, id)
      return built
    })

    for (const listener of this.listeners.get(id) ?? []) listener(event)
    return event
  }

  subscribe(id: SessionId, listener: SessionListener): () => void {
    const existing = this.listeners.get(id) ?? new Set<SessionListener>()
    existing.add(listener)
    this.listeners.set(id, existing)
    return () => {
      existing.delete(listener)
      if (existing.size === 0) this.listeners.delete(id)
    }
  }

  snapshot(id: SessionId): SessionSnapshot | undefined {
    const session = this.get(id)
    return session ? snapshotOf(session) : undefined
  }

  exportSession(id: SessionId): SessionExport | undefined {
    const session = this.get(id)
    if (!session) return undefined
    return {
      version: 1,
      session: {
        id: session.id,
        title: session.title,
        createdAt: session.createdAt,
        updatedAt: session.updatedAt,
      },
      events: session.events,
    }
  }

  importSession(data: SessionExport): SessionRecord {
    if (this.get(data.session.id)) throw new Error(`Session already exists: ${data.session.id}`)

    this.transaction(() => {
      this.db
        .prepare("INSERT INTO sessions (id, title, created_at, updated_at) VALUES (?, ?, ?, ?)")
        .run(
          data.session.id,
          data.session.title,
          data.session.createdAt,
          data.session.updatedAt,
        )
      for (const event of data.events) {
        this.insertEvent({ ...event, sessionId: data.session.id })
      }
    })

    const imported = this.get(data.session.id)
    if (!imported) throw new Error(`Failed to import session: ${data.session.id}`)
    return imported
  }

  fork(
    id: SessionId,
    atSeq?: number,
    title?: string,
  ): SessionRecord | undefined {
    const source = this.get(id)
    if (!source) return undefined

    const record = this.create(title ?? `${source.title} (fork)`)
    const limit = atSeq ?? Number.POSITIVE_INFINITY
    for (const event of source.events) {
      if (event.seq > limit) break
      const draft = draftOf(event)
      if (draft) this.append(record.id, draft)
    }
    return this.get(record.id)
  }

  recover(): void {
    for (const session of this.list()) {
      const openRuns = new Map<string, boolean>()
      const pendingPermissions = new Map<string, boolean>()

      for (const event of this.events(session.id)) {
        if (event.type === "run.started") openRuns.set(event.runId, true)
        else if (event.type === "run.completed" || event.type === "run.failed") {
          openRuns.set(event.runId, false)
        } else if (event.type === "permission.requested") {
          pendingPermissions.set(event.requestId, true)
        } else if (event.type === "permission.resolved") {
          pendingPermissions.delete(event.requestId)
        }
      }

      // A prompt cannot be answered after a restart. Close it before the run
      // failure so replay clears the card instead of showing a stale request.
      for (const requestId of pendingPermissions.keys()) {
        this.append(session.id, {
          type: "permission.resolved",
          requestId,
          approved: false,
        })
      }

      for (const [runId, running] of openRuns) {
        if (running) {
          this.append(session.id, {
            type: "run.failed",
            runId,
            error: "Recovered after restart",
          })
        }
      }
    }
  }

  close(): void {
    if (this.closed) return
    this.db.close()
    this.closed = true
  }

  private insertEvent(event: SessionEvent): void {
    this.db
      .prepare(
        "INSERT INTO events (session_id, seq, type, at, payload) VALUES (?, ?, ?, ?, ?)",
      )
      .run(event.sessionId, event.seq, event.type, event.at, JSON.stringify(event))
  }

  private migrate(): void {
    const row = asRow<VersionRow>(this.db.prepare("PRAGMA user_version").get())
    const version = Number(row?.user_version ?? 0)
    if (version >= 1) return

    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS events (
        session_id TEXT NOT NULL,
        seq INTEGER NOT NULL,
        type TEXT NOT NULL,
        at TEXT NOT NULL,
        payload TEXT NOT NULL,
        PRIMARY KEY (session_id, seq),
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
      PRAGMA user_version = 1;
    `)
  }

  private transaction<T>(fn: () => T): T {
    this.db.exec("BEGIN IMMEDIATE")
    try {
      const result = fn()
      this.db.exec("COMMIT")
      return result
    } catch (error) {
      try {
        this.db.exec("ROLLBACK")
      } catch {
        // Ignore rollback failures and surface the original error.
      }
      throw error
    }
  }
}
