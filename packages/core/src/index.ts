import { randomUUID } from "node:crypto"

import type {
  SessionEvent,
  SessionId,
  SessionMessage,
  SessionSnapshot,
  SessionSummary,
} from "@opencontinue/protocol"

export type SessionRecord = {
  id: SessionId
  title: string
  createdAt: string
  updatedAt: string
  events: SessionEvent[]
}

export type EventDraft =
  | { type: "message.user"; text: string }
  | { type: "run.started"; runId: string }
  | { type: "message.assistant.delta"; runId: string; text: string }
  | { type: "run.completed"; runId: string }
  | { type: "run.failed"; runId: string; error: string }
  | { type: "tool.started"; runId: string; callId: string; name: string; input: unknown }
  | { type: "tool.completed"; runId: string; callId: string; output: string }
  | { type: "tool.failed"; runId: string; callId: string; error: string }
  | {
      type: "permission.requested"
      requestId: string
      tool: string
      capability: "read" | "write" | "execute"
      input: unknown
    }
  | { type: "permission.resolved"; requestId: string; approved: boolean }

export type SessionListener = (event: SessionEvent) => void

/**
 * In-memory event store.
 *
 * The interface is intentionally small: sessions are append-only event streams,
 * and every read is a projection. A SQLite-backed implementation can replace
 * this class without changing the server or clients.
 */
export class SessionStore {
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
      .map((session) => this.summary(session))
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
    const base = { sessionId: id, seq, at }

    let event: SessionEvent
    switch (draft.type) {
      case "message.user":
        event = { ...base, type: draft.type, text: draft.text }
        break
      case "run.started":
        event = { ...base, type: draft.type, runId: draft.runId }
        break
      case "message.assistant.delta":
        event = { ...base, type: draft.type, runId: draft.runId, text: draft.text }
        break
      case "run.completed":
        event = { ...base, type: draft.type, runId: draft.runId }
        break
      case "run.failed":
        event = { ...base, type: draft.type, runId: draft.runId, error: draft.error }
        break
      case "tool.started":
        event = {
          ...base,
          type: draft.type,
          runId: draft.runId,
          callId: draft.callId,
          name: draft.name,
          input: draft.input,
        }
        break
      case "tool.completed":
        event = {
          ...base,
          type: draft.type,
          runId: draft.runId,
          callId: draft.callId,
          output: draft.output,
        }
        break
      case "tool.failed":
        event = {
          ...base,
          type: draft.type,
          runId: draft.runId,
          callId: draft.callId,
          error: draft.error,
        }
        break
      case "permission.requested":
        event = {
          ...base,
          type: draft.type,
          requestId: draft.requestId,
          tool: draft.tool,
          capability: draft.capability,
          input: draft.input,
        }
        break
      case "permission.resolved":
        event = {
          ...base,
          type: draft.type,
          requestId: draft.requestId,
          approved: draft.approved,
        }
        break
    }

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
    if (!session) return undefined
    return {
      ...this.summary(session),
      messages: this.projectMessages(session.events),
    }
  }

  private summary(session: SessionRecord): SessionSummary {
    const last = session.events.at(-1)
    return {
      id: session.id,
      title: session.title,
      createdAt: session.createdAt,
      updatedAt: session.updatedAt,
      lastSeq: last?.seq ?? -1,
    }
  }

  private projectMessages(events: SessionEvent[]): SessionMessage[] {
    const messages: SessionMessage[] = []
    const assistants = new Map<string, SessionMessage>()

    for (const event of events) {
      if (event.type === "message.user") {
        messages.push({ role: "user", text: event.text })
        continue
      }
      if (event.type === "run.started") {
        const message: SessionMessage = { role: "assistant", text: "" }
        assistants.set(event.runId, message)
        messages.push(message)
        continue
      }
      if (event.type === "message.assistant.delta") {
        const message = assistants.get(event.runId)
        if (message) message.text += event.text
        continue
      }
      if (event.type === "run.failed") {
        const message = assistants.get(event.runId)
        if (message) message.text += `\n[run failed: ${event.error}]`
        else messages.push({ role: "assistant", text: `[run failed: ${event.error}]` })
      }
    }

    return messages
  }
}
