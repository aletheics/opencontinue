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
        ...(draft.failed === undefined ? {} : { failed: draft.failed }),
        ...(draft.exitCode === undefined ? {} : { exitCode: draft.exitCode }),
        ...(draft.timedOut === undefined ? {} : { timedOut: draft.timedOut }),
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
        ...(draft.detail === undefined ? {} : { detail: draft.detail }),
        ...(draft.diff === undefined ? {} : { diff: draft.diff }),
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

/** Strip the event envelope so an event can be replayed into another session. */
export function draftOf(event: SessionEvent): EventDraft | null {
  switch (event.type) {
    case "session.created":
      return null
    case "message.user":
      return { type: event.type, text: event.text }
    case "run.started":
      return { type: event.type, runId: event.runId }
    case "message.assistant.delta":
      return { type: event.type, runId: event.runId, text: event.text }
    case "run.completed":
      return { type: event.type, runId: event.runId }
    case "run.failed":
      return { type: event.type, runId: event.runId, error: event.error }
    case "usage":
      return {
        type: event.type,
        runId: event.runId,
        ...(event.inputTokens === undefined ? {} : { inputTokens: event.inputTokens }),
        ...(event.outputTokens === undefined ? {} : { outputTokens: event.outputTokens }),
        ...(event.totalTokens === undefined ? {} : { totalTokens: event.totalTokens }),
      }
    case "tool.started":
      return {
        type: event.type,
        runId: event.runId,
        callId: event.callId,
        name: event.name,
        input: event.input,
      }
    case "tool.completed":
      return {
        type: event.type,
        runId: event.runId,
        callId: event.callId,
        output: event.output,
        ...(event.diff === undefined ? {} : { diff: event.diff }),
        ...(event.failed === undefined ? {} : { failed: event.failed }),
        ...(event.exitCode === undefined ? {} : { exitCode: event.exitCode }),
        ...(event.timedOut === undefined ? {} : { timedOut: event.timedOut }),
      }
    case "tool.failed":
      return {
        type: event.type,
        runId: event.runId,
        callId: event.callId,
        error: event.error,
      }
    case "permission.requested":
      return {
        type: event.type,
        requestId: event.requestId,
        tool: event.tool,
        capability: event.capability,
        input: event.input,
        ...(event.detail === undefined ? {} : { detail: event.detail }),
        ...(event.diff === undefined ? {} : { diff: event.diff }),
      }
    case "permission.resolved":
      return {
        type: event.type,
        requestId: event.requestId,
        approved: event.approved,
      }
  }
}
