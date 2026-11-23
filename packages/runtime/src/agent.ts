import { randomUUID } from "node:crypto"

import type { SessionStore } from "@opencontinue/core"
import type {
  ChatMessage,
  ChatProvider,
  ReasoningEffort,
  ToolCall,
} from "@opencontinue/providers"
import type { PermissionGate, ToolRegistry } from "@opencontinue/tools"

import { projectHistory } from "./history.js"

export const DEFAULT_SYSTEM_PROMPT =
  "You are OpenContinue, a concise coding assistant. Be concrete. Use the available tools when they help. For multi-step work with three or more meaningful steps, maintain a short task list with the todo tool and update it as items start and finish. Skip the todo list for simple questions. Answer in the user's language."

const DEFAULT_MAX_STEPS = 12

export type RunAgentOptions = {
  store: SessionStore
  sessionId: string
  provider: ChatProvider
  tools: ToolRegistry
  permissions: PermissionGate
  workspace: string
  systemPrompt?: string
  signal?: AbortSignal
  maxSteps?: number
  reasoningEffort?: ReasoningEffort
}

/**
 * One run: rebuild history, stream the model, execute tool calls, repeat until
 * the model answers without tools. Every step is durable in the event log.
 */
export async function runAgent(options: RunAgentOptions): Promise<void> {
  const { store, sessionId, provider, tools, permissions, workspace, systemPrompt, signal } = options

  const history = projectHistory(store.events(sessionId))
  if (systemPrompt) history.unshift({ role: "system", content: systemPrompt })

  const runId = randomUUID()

  try {
    store.append(sessionId, { type: "run.started", runId })

    const maxSteps = options.maxSteps ?? DEFAULT_MAX_STEPS
    let finished = false

    for (let step = 0; step < maxSteps; step++) {
      let text = ""
      const calls: ToolCall[] = []

      for await (const event of provider.streamChat({
        model: provider.model,
        messages: history,
        tools: tools.definitions(),
        signal,
        reasoningEffort: options.reasoningEffort,
      })) {
        if (event.type === "text") {
          text += event.text
          store.append(sessionId, { type: "message.assistant.delta", runId, text: event.text })
        } else if (event.type === "tool_call") {
          calls.push(event.call)
        } else {
          store.append(sessionId, {
            type: "usage",
            runId,
            inputTokens: event.inputTokens,
            outputTokens: event.outputTokens,
            totalTokens: event.totalTokens,
          })
        }
      }

      if (text === "" && calls.length === 0) {
        store.append(sessionId, { type: "message.assistant.delta", runId, text: "(empty response)" })
      }

      const assistant: ChatMessage = {
        role: "assistant",
        content: text,
        ...(calls.length ? { toolCalls: calls } : {}),
      }
      history.push(assistant)

      if (calls.length === 0) {
        finished = true
        break
      }

      for (const call of calls) {
        store.append(sessionId, {
          type: "tool.started",
          runId,
          callId: call.id,
          name: call.name,
          input: parseArguments(call.arguments),
        })
      }

      for (const call of calls) {
        const result = await tools.execute(
          call.name,
          call.arguments,
          { workspace, sessionId, signal },
          permissions,
        )

        if (result.ok) {
          store.append(sessionId, {
            type: "tool.completed",
            runId,
            callId: call.id,
            output: result.output,
            ...(result.diff === undefined ? {} : { diff: result.diff }),
          })
          history.push({ role: "tool", toolCallId: call.id, content: result.output })
        } else {
          store.append(sessionId, {
            type: "tool.failed",
            runId,
            callId: call.id,
            error: result.error,
          })
          history.push({ role: "tool", toolCallId: call.id, content: `Error: ${result.error}` })
        }
      }
    }

    if (!finished) throw new Error("Maximum tool steps reached")
    store.append(sessionId, { type: "run.completed", runId })
  } catch (error) {
    store.append(sessionId, {
      type: "run.failed",
      runId,
      error: error instanceof Error ? error.message : String(error),
    })
  }
}

function parseArguments(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return value
  }
}
