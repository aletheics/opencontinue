import {
  SessionEvent as SessionEventSchema,
  SessionId,
  type SessionEvent,
} from "@opencontinue/protocol"

import type { SessionExport } from "./types.js"

/** Parse one durable event; unknown or malformed shapes are rejected. */
export function parseSessionEvent(value: unknown): SessionEvent {
  const parsed = SessionEventSchema.safeParse(value)
  if (!parsed.success) {
    throw new Error(`Invalid session event: ${parsed.error.message}`)
  }
  return parsed.data
}

/** Validate an export before any row is written. */
export function parseSessionExport(value: SessionExport): SessionExport {
  if (value.version !== 1) {
    throw new Error(`Unsupported session export version: ${String(value.version)}`)
  }

  const session = value.session
  if (!SessionId.safeParse(session.id).success) {
    throw new Error(`Invalid session id: ${String(session.id)}`)
  }
  for (const [key, item] of [
    ["title", session.title],
    ["createdAt", session.createdAt],
    ["updatedAt", session.updatedAt],
  ] as const) {
    if (typeof item !== "string") {
      throw new Error(`Invalid session ${key}`)
    }
  }
  if (Number.isNaN(Date.parse(session.createdAt))) {
    throw new Error("Invalid session createdAt")
  }
  if (Number.isNaN(Date.parse(session.updatedAt))) {
    throw new Error("Invalid session updatedAt")
  }

  if (!Array.isArray(value.events) || value.events.length === 0) {
    throw new Error("Session export has no events")
  }

  const events = value.events.map(parseSessionEvent)
  events.forEach((event, index) => {
    if (event.seq !== index) {
      throw new Error(
        `Session export sequence must start at 0: expected ${index}, got ${event.seq}`,
      )
    }
  })
  if (events[0]?.type !== "session.created") {
    throw new Error("Session export must start with session.created")
  }

  return { ...value, events }
}
