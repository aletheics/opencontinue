import type {
  SessionEvent,
  SessionId,
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
  | {
      type: "usage"
      runId: string
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
    }
  | { type: "tool.started"; runId: string; callId: string; name: string; input: unknown }
  | { type: "tool.completed"; runId: string; callId: string; output: string; diff?: string }
  | { type: "tool.failed"; runId: string; callId: string; error: string }
  | {
      type: "permission.requested"
      requestId: string
      tool: string
      capability: "read" | "write" | "execute"
      input: unknown
      detail?: string
      diff?: string
    }
  | { type: "permission.resolved"; requestId: string; approved: boolean }

export type SessionListener = (event: SessionEvent) => void

export type SessionExport = {
  version: 1
  session: {
    id: SessionId
    title: string
    createdAt: string
    updatedAt: string
  }
  events: SessionEvent[]
}

export interface SessionStore {
  create(title?: string): SessionRecord
  list(): SessionSummary[]
  get(id: SessionId): SessionRecord | undefined
  events(id: SessionId, after?: number): SessionEvent[]
  append(id: SessionId, draft: EventDraft): SessionEvent
  subscribe(id: SessionId, listener: SessionListener): () => void
  snapshot(id: SessionId): SessionSnapshot | undefined
  exportSession(id: SessionId): SessionExport | undefined
  importSession(data: SessionExport): SessionRecord
  recover(): void
  close(): void
}
