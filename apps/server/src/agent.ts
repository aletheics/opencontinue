import { randomUUID } from "node:crypto"

import type { SessionStore } from "@opencontinue/core"
import type { ChatMessage, ChatProvider } from "@opencontinue/providers"

export const DEFAULT_SYSTEM_PROMPT =
  "You are OpenContinue, a concise coding assistant. Be concrete. Answer in the user's language."

export type RunAgentOptions = {
  store: SessionStore
  sessionId: string
  provider: ChatProvider
  systemPrompt?: string
  signal?: AbortSignal
}

/**
 * One run: take the current session projection, stream the provider response,
 * and append every delta as a durable event. Tool calls will join this loop in
 * the next milestone.
 */
export async function runAgent(options: RunAgentOptions): Promise<void> {
  const { store, sessionId, provider, systemPrompt, signal } = options

  const snapshot = store.snapshot(sessionId)
  if (!snapshot) throw new Error(`Session not found: ${sessionId}`)

  const messages: ChatMessage[] = []
  if (systemPrompt) messages.push({ role: "system", content: systemPrompt })
  for (const message of snapshot.messages) {
    messages.push({ role: message.role, content: message.text })
  }

  const runId = randomUUID()

  try {
    store.append(sessionId, { type: "run.started", runId })

    let produced = false
    for await (const chunk of provider.streamChat({
      model: provider.model,
      messages,
      signal,
    })) {
      produced = true
      store.append(sessionId, { type: "message.assistant.delta", runId, text: chunk })
    }

    if (!produced) {
      store.append(sessionId, { type: "message.assistant.delta", runId, text: "(empty response)" })
    }

    store.append(sessionId, { type: "run.completed", runId })
  } catch (error) {
    store.append(sessionId, {
      type: "run.failed",
      runId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}
