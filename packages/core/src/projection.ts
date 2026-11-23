import type { SessionEvent, SessionMessage, SessionSnapshot, SessionSummary } from "@opencontinue/protocol"

import type { SessionRecord } from "./types.js"

export function projectMessages(events: SessionEvent[]): SessionMessage[] {
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
      const label = event.interrupted ? "run interrupted" : "run failed"
      const message = assistants.get(event.runId)
      if (message) message.text += `\n[${label}: ${event.error}]`
      else messages.push({ role: "assistant", text: `[${label}: ${event.error}]` })
    }
  }

  return messages
}

export function summarize(session: SessionRecord): SessionSummary {
  const last = session.events.at(-1)
  return {
    id: session.id,
    title: session.title,
    createdAt: session.createdAt,
    updatedAt: session.updatedAt,
    lastSeq: last?.seq ?? -1,
  }
}

export function snapshotOf(session: SessionRecord): SessionSnapshot {
  return {
    ...summarize(session),
    messages: projectMessages(session.events),
  }
}
