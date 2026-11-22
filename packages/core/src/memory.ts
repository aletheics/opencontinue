import { randomUUID } from "node:crypto"

import type { SessionEvent, SessionId, SessionSnapshot, SessionSummary } from "@opencontinue/protocol"

import { buildEvent } from "./events.js"
import { snapshotOf, summarize } from "./projection.js"
import type {
  EventDraft,
  SessionExport,
  SessionListener,
  SessionRecord,
  SessionStore,
} from "./types.js"

/**
 * In-memory event store. Used by tests and by embedders that do not need
 * persistence.
 */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<SessionId, SessionRecord>()
  private readonly listeners = new Map<SessionId, Set<SessionListener>>()

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
    const record: SessionRecord = {
      id,
      title,
      createdAt: at,
      updatedAt: at,
      events: [event],
    }
    this.sessions.set(id, record)
    return record
  }

  list(): SessionSummary[] {
    return [...this.sessions.values()]
      .map((session) => summarize(session))
      .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))
  }

  get(id: SessionId): SessionRecord | undefined {
    return this.sessions.get(id)
  }

  events(id: SessionId, after = -1): SessionEvent[] {
    const session = this.sessions.get(id)
    if (!session) return []
    return session.events.filter((event) => event.seq > after)
  }

  append(id: SessionId, draft: EventDraft): SessionEvent {
    const session = this.sessions.get(id)
    if (!session) throw new Error(`Session not found: ${id}`)

    const seq = session.events.length
    const at = new Date().toISOString()
    const event = buildEvent(id, seq, at, draft)

    session.events.push(event)
    session.updatedAt = at
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
    const session = this.sessions.get(id)
    return session ? snapshotOf(session) : undefined
  }

  exportSession(id: SessionId): SessionExport | undefined {
    const session = this.sessions.get(id)
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
    if (this.sessions.has(data.session.id)) {
      throw new Error(`Session already exists: ${data.session.id}`)
    }
    const events = data.events.map((event) => ({ ...event, sessionId: data.session.id }))
    const record: SessionRecord = {
      ...data.session,
      events,
    }
    this.sessions.set(record.id, record)
    return record
  }

  recover(): void {
    // Nothing to recover in memory.
  }

  close(): void {
    // Nothing to close in memory.
  }
}
