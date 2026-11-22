import Anthropic from "@anthropic-ai/sdk"
import type {
  ContentBlockParam,
  MessageParam,
  Tool,
  ToolResultBlockParam,
} from "@anthropic-ai/sdk/resources/messages"

import type {
  ChatMessage,
  ChatProvider,
  ChatRequest,
  ChatStreamEvent,
} from "./index.js"

export type AnthropicOptions = {
  apiKey: string
  baseUrl?: string
  model: string
}

function parseArguments(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

export function toAnthropicMessages(messages: ChatMessage[]): {
  system?: string
  messages: MessageParam[]
} {
  const system: string[] = []
  const result: MessageParam[] = []

  const pushUserBlock = (block: ContentBlockParam) => {
    const last = result.at(-1)
    if (last?.role === "user") {
      if (Array.isArray(last.content)) last.content.push(block)
      else last.content = [{ type: "text", text: last.content }, block]
      return
    }
    result.push({ role: "user", content: [block] })
  }

  for (const message of messages) {
    if (message.role === "system") {
      system.push(message.content)
      continue
    }

    if (message.role === "user") {
      pushUserBlock({ type: "text", text: message.content })
      continue
    }

    if (message.role === "assistant") {
      const content: ContentBlockParam[] = []
      if (message.content) content.push({ type: "text", text: message.content })
      for (const call of message.toolCalls ?? []) {
        content.push({
          type: "tool_use",
          id: call.id,
          name: call.name,
          input: parseArguments(call.arguments),
        })
      }

      if (content.length > 0) {
        const last = result.at(-1)
        if (last?.role === "assistant" && Array.isArray(last.content)) {
          last.content.push(...content)
        } else {
          result.push({ role: "assistant", content })
        }
      }
      continue
    }

    if (message.role === "tool") {
      const block: ToolResultBlockParam = {
        type: "tool_result",
        tool_use_id: message.toolCallId,
        content: message.content,
      }
      pushUserBlock(block)
    }
  }

  return {
    system: system.length > 0 ? system.join("\n\n") : undefined,
    messages: result,
  }
}

export class AnthropicProvider implements ChatProvider {
  readonly id = "anthropic"
  readonly model: string
  private readonly client: Anthropic

  constructor(options: AnthropicOptions) {
    this.model = options.model
    const baseURL = options.baseUrl?.replace(/\/v1\/?$/, "")
    this.client = new Anthropic({
      apiKey: options.apiKey,
      ...(baseURL ? { baseURL } : {}),
    })
  }

  async listModels(): Promise<string[]> {
    try {
      const page = await this.client.models.list({ limit: 100 })
      return page.data.map((model) => model.id)
    } catch {
      return [this.model]
    }
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const { system, messages } = toAnthropicMessages(request.messages)
    const tools: Tool[] =
      request.tools?.map((tool) => ({
        name: tool.name,
        description: tool.description,
        input_schema: tool.parameters as Tool["input_schema"],
      })) ?? []

    const stream = this.client.messages.stream(
      {
        model: request.model || this.model,
        max_tokens: 8192,
        ...(system ? { system } : {}),
        messages,
        ...(tools.length > 0 ? { tools } : {}),
      },
      request.signal ? { signal: request.signal } : undefined,
    )

    const toolBlocks = new Map<number, { id: string; name: string; json: string }>()
    let inputTokens = 0
    let outputTokens = 0

    for await (const event of stream) {
      if (event.type === "message_start") {
        inputTokens = event.message.usage.input_tokens
        continue
      }

      if (event.type === "message_delta") {
        outputTokens = event.usage.output_tokens
        continue
      }

      if (event.type === "content_block_start" && event.content_block.type === "tool_use") {
        toolBlocks.set(event.index, {
          id: event.content_block.id,
          name: event.content_block.name,
          json: "",
        })
        continue
      }

      if (event.type === "content_block_delta") {
        if (event.delta.type === "text_delta") {
          yield { type: "text", text: event.delta.text }
        } else if (event.delta.type === "input_json_delta") {
          const block = toolBlocks.get(event.index)
          if (block) block.json += event.delta.partial_json
        }
      }
    }

    for (const block of toolBlocks.values()) {
      yield {
        type: "tool_call",
        call: {
          id: block.id,
          name: block.name,
          arguments: block.json || "{}",
        },
      }
    }

    if (inputTokens > 0 || outputTokens > 0) {
      yield {
        type: "usage",
        inputTokens,
        outputTokens,
        totalTokens: inputTokens + outputTokens,
      }
    }
  }
}
