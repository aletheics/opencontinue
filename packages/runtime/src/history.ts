import type { SessionEvent } from "@opencontinue/protocol"
import type { ChatMessage, ToolCall } from "@opencontinue/providers"

type AssistantMessage = Extract<ChatMessage, { role: "assistant" }>

/**
 * Rebuild the model-visible conversation from the durable event log.
 * A tool completion closes the current assistant step; text after it belongs
 * to the next assistant message.
 */
export function projectHistory(events: SessionEvent[]): ChatMessage[] {
  const messages: ChatMessage[] = []
  const current = new Map<string, AssistantMessage>()

  const assistantFor = (runId: string): AssistantMessage => {
    let assistant = current.get(runId)
    if (!assistant) {
      assistant = { role: "assistant", content: "" }
      current.set(runId, assistant)
      messages.push(assistant)
    }
    return assistant
  }

  for (const event of events) {
    if (event.type === "message.user") {
      messages.push({ role: "user", content: event.text })
      continue
    }
    if (event.type === "run.started") {
      current.delete(event.runId)
      assistantFor(event.runId)
      continue
    }
    if (event.type === "message.assistant.delta") {
      assistantFor(event.runId).content += event.text
      continue
    }
    if (event.type === "tool.started") {
      const call: ToolCall = {
        id: event.callId,
        name: event.name,
        arguments: JSON.stringify(event.input),
      }
      const assistant = assistantFor(event.runId)
      assistant.toolCalls ??= []
      assistant.toolCalls.push(call)
      continue
    }
    if (event.type === "tool.completed") {
      messages.push({ role: "tool", toolCallId: event.callId, content: event.output })
      current.delete(event.runId)
      continue
    }
    if (event.type === "tool.failed") {
      messages.push({ role: "tool", toolCallId: event.callId, content: `Error: ${event.error}` })
      current.delete(event.runId)
    }
  }

  return messages.filter(
    (message) =>
      !(message.role === "assistant" && message.content === "" && (message.toolCalls?.length ?? 0) === 0),
  )
}
