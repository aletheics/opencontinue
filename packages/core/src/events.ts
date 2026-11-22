import type { SessionEvent } from "@opencontinue/protocol"

import type { EventDraft } from "./types.js"

export function buildEvent(
  sessionId: string,
  seq: number,
  at: string,
  draft: EventDraft,
): SessionEvent {
  const base = { sessionId, seq, at }

  switch (draft.type) {
    case "message.user":
      return { ...base, type: draft.type, text: draft.text }
    case "run.started":
      return { ...base, type: draft.type, runId: draft.runId }
    case "message.assistant.delta":
      return { ...base, type: draft.type, runId: draft.runId, text: draft.text }
    case "run.completed":
      return { ...base, type: draft.type, runId: draft.runId }
    case "run.failed":
      return { ...base, type: draft.type, runId: draft.runId, error: draft.error }
    case "usage":
      return {
        ...base,
        type: draft.type,
        runId: draft.runId,
        ...(draft.inputTokens === undefined ? {} : { inputTokens: draft.inputTokens }),
        ...(draft.outputTokens === undefined ? {} : { outputTokens: draft.outputTokens }),
        ...(draft.totalTokens === undefined ? {} : { totalTokens: draft.totalTokens }),
      }
    case "tool.started":
      return {
        ...base,
        type: draft.type,
        runId: draft.runId,
        callId: draft.callId,
        name: draft.name,
        input: draft.input,
      }
    case "tool.completed":
      return {
        ...base,
        type: draft.type,
        runId: draft.runId,
        callId: draft.callId,
        output: draft.output,
        ...(draft.diff === undefined ? {} : { diff: draft.diff }),
      }
    case "tool.failed":
      return {
        ...base,
        type: draft.type,
        runId: draft.runId,
        callId: draft.callId,
        error: draft.error,
      }
    case "permission.requested":
      return {
        ...base,
        type: draft.type,
        requestId: draft.requestId,
        tool: draft.tool,
        capability: draft.capability,
        input: draft.input,
      }
    case "permission.resolved":
      return {
        ...base,
        type: draft.type,
        requestId: draft.requestId,
        approved: draft.approved,
      }
  }
}
