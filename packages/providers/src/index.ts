import { AnthropicProvider } from "./anthropic.js"
import { findProviderPreset } from "./catalog.js"

export { AnthropicProvider } from "./anthropic.js"
export { PROVIDER_PRESETS, type ProviderPreset } from "./catalog.js"

export {
  anthropicThinking,
  REASONING_EFFORTS,
  reasoningEffortsFor,
  type ReasoningEffort,
} from "./reasoning.js"

import {
  reasoningEffortsFor,
  type ReasoningEffort,
} from "./reasoning.js"

export type ChatRole = "system" | "user" | "assistant" | "tool"

export type ToolCall = {
  id: string
  name: string
  arguments: string
}

export type ToolDefinition = {
  name: string
  description: string
  parameters: unknown
}

export type AssistantThinkingBlock = {
  text: string
  /** Anthropic signature required to pass the block back on tool turns. */
  signature?: string
}

export type ChatMessage =
  | { role: "system" | "user"; content: string }
  | {
      role: "assistant"
      content: string
      toolCalls?: ToolCall[]
      thinking?: AssistantThinkingBlock[]
    }
  | { role: "tool"; content: string; toolCallId: string; name?: string }

export type ChatStreamEvent =
  | { type: "text"; text: string }
  | { type: "thinking"; block: AssistantThinkingBlock }
  | { type: "tool_call"; call: ToolCall }
  | {
      type: "usage"
      inputTokens?: number
      outputTokens?: number
      totalTokens?: number
    }

export type ChatRequest = {
  model: string
  messages: ChatMessage[]
  tools?: ToolDefinition[]
  signal?: AbortSignal
  /** Requested reasoning level; `auto` means omit provider parameters. */
  reasoningEffort?: ReasoningEffort
}

export interface ChatProvider {
  readonly id: string
  readonly model: string
  /** Levels this provider/model can honor. Empty or undefined hides the UI. */
  readonly reasoningEfforts?: readonly ReasoningEffort[]
  streamChat(request: ChatRequest): AsyncGenerator<ChatStreamEvent, void, unknown>
  listModels?(): Promise<string[]>
}

/**
 * Offline fallback. Useful for tests and for a first run without credentials.
 */
export class EchoProvider implements ChatProvider {
  readonly id = "echo"
  readonly model = "echo"
  readonly reasoningEfforts: readonly ReasoningEffort[] = []

  async listModels(): Promise<string[]> {
    return ["echo"]
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const user = [...request.messages].reverse().find((message) => message.role === "user")
    const reply = `Echo: ${user?.content ?? ""}`
    for (let index = 0; index < reply.length; index += 8) {
      if (request.signal?.aborted) {
        const error = new Error("Aborted")
        error.name = "AbortError"
        throw error
      }
      yield { type: "text", text: reply.slice(index, index + 8) }
    }
  }
}

/**
 * Minimal SSE parser for `text/event-stream` bodies.
 * Handles events split across chunks and CRLF input.
 */
export class SseParser {
  private buffer = ""

  push(chunk: string): string[] {
    this.buffer += chunk.replace(/\r\n/g, "\n")
    const events: string[] = []

    let boundary = this.buffer.indexOf("\n\n")
    while (boundary >= 0) {
      const block = this.buffer.slice(0, boundary)
      this.buffer = this.buffer.slice(boundary + 2)
      const data = this.dataFromBlock(block)
      if (data) events.push(data)
      boundary = this.buffer.indexOf("\n\n")
    }

    return events
  }

  flush(): string[] {
    const block = this.buffer
    this.buffer = ""
    const data = this.dataFromBlock(block)
    return data ? [data] : []
  }

  private dataFromBlock(block: string): string {
    return block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart())
      .join("\n")
  }
}

type OpenAIChunk = {
  choices?: Array<{
    delta?: {
      content?: string | null
      tool_calls?: Array<{
        index?: number
        id?: string
        function?: { name?: string; arguments?: string }
      }>
    }
    finish_reason?: string | null
  }>
  usage?: {
    prompt_tokens?: number
    completion_tokens?: number
    total_tokens?: number
  }
  error?: { message?: string }
}

export type OpenAICompatibleOptions = {
  baseUrl: string
  model: string
  apiKey?: string
  headers?: Record<string, string>
  fetch?: typeof fetch
  reasoningEfforts?: readonly ReasoningEffort[]
}

function toOpenAIMessage(message: ChatMessage): Record<string, unknown> {
  if (message.role === "tool") {
    return {
      role: "tool",
      tool_call_id: message.toolCallId,
      content: message.content,
    }
  }
  if (message.role === "assistant") {
    return {
      role: "assistant",
      content: message.content || null,
      ...(message.toolCalls?.length
        ? {
            tool_calls: message.toolCalls.map((call) => ({
              id: call.id,
              type: "function",
              function: { name: call.name, arguments: call.arguments },
            })),
          }
        : {}),
    }
  }
  return { role: message.role, content: message.content }
}

/**
 * Works with OpenAI, DeepSeek, Ollama, vLLM, LM Studio, and any other
 * server that implements the OpenAI chat completions streaming shape.
 */
export class OpenAICompatibleProvider implements ChatProvider {
  readonly id = "openai-compatible"
  readonly model: string
  readonly reasoningEfforts: readonly ReasoningEffort[]
  private readonly baseUrl: string
  private readonly apiKey: string | undefined
  private readonly headers: Record<string, string>
  private readonly fetchImpl: typeof fetch

  constructor(options: OpenAICompatibleOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, "")
    this.model = options.model
    this.apiKey = options.apiKey
    this.headers = options.headers ?? {}
    this.fetchImpl = options.fetch ?? fetch
    this.reasoningEfforts = options.reasoningEfforts ?? []
  }

  async listModels(): Promise<string[]> {
    const response = await this.fetchImpl(`${this.baseUrl}/models`, {
      headers: {
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...this.headers,
      },
    })
    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Model list failed (${response.status}): ${text.slice(0, 500)}`)
    }
    const data = (await response.json()) as { data?: Array<{ id?: string }> }
    return (data.data ?? [])
      .map((model) => model.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0)
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<ChatStreamEvent, void, unknown> {
    const body: Record<string, unknown> = {
      model: request.model || this.model,
      messages: request.messages.map(toOpenAIMessage),
      stream: true,
      ...(this.baseUrl.includes("api.openai.com") || this.baseUrl.includes("api.deepseek.com")
        ? { stream_options: { include_usage: true } }
        : {}),
    }
    if (
      request.reasoningEffort &&
      request.reasoningEffort !== "auto" &&
      this.reasoningEfforts.includes(request.reasoningEffort)
    ) {
      body.reasoning_effort = request.reasoningEffort
    }

    if (request.tools?.length) {
      body.tools = request.tools.map((tool) => ({
        type: "function",
        function: {
          name: tool.name,
          description: tool.description,
          parameters: tool.parameters,
        },
      }))
      body.tool_choice = "auto"
    }

    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...this.headers,
      },
      body: JSON.stringify(body),
      signal: request.signal,
    })

    if (!response.ok) {
      const text = await response.text()
      throw new Error(`Provider request failed (${response.status}): ${text.slice(0, 500)}`)
    }
    if (!response.body) throw new Error("Provider returned an empty response body")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parser = new SseParser()
    const pendingCalls = new Map<number, { id?: string; name: string; arguments: string }>()
    let usage: OpenAIChunk["usage"]

    const consume = (data: string): string | undefined => {
      const chunk = JSON.parse(data) as OpenAIChunk
      if (chunk.error?.message) throw new Error(`Provider error: ${chunk.error.message}`)
      if (chunk.usage) usage = chunk.usage

      const delta = chunk.choices?.[0]?.delta
      for (const call of delta?.tool_calls ?? []) {
        const index = call.index ?? 0
        const current = pendingCalls.get(index) ?? { name: "", arguments: "" }
        if (call.id) current.id = call.id
        if (call.function?.name) current.name += call.function.name
        if (call.function?.arguments) current.arguments += call.function.arguments
        pendingCalls.set(index, current)
      }

      const content = delta?.content
      return typeof content === "string" && content.length > 0 ? content : undefined
    }

    let done = false
    while (!done) {
      const { value, done: streamDone } = await reader.read()
      if (streamDone) break
      for (const data of parser.push(decoder.decode(value, { stream: true }))) {
        if (data === "[DONE]") {
          done = true
          break
        }
        const text = consume(data)
        if (text) yield { type: "text", text }
      }
    }

    if (!done) {
      for (const data of parser.flush()) {
        if (data === "[DONE]") break
        const text = consume(data)
        if (text) yield { type: "text", text }
      }
    }

    const calls = [...pendingCalls.entries()].sort((left, right) => left[0] - right[0])
    for (const [index, call] of calls) {
      if (!call.name) continue
      yield {
        type: "tool_call",
        call: {
          id: call.id ?? `call_${index}`,
          name: call.name,
          arguments: call.arguments,
        },
      }
    }

    if (usage) {
      yield {
        type: "usage",
        inputTokens: usage.prompt_tokens,
        outputTokens: usage.completion_tokens,
        totalTokens: usage.total_tokens,
      }
    }
  }
}

export type ProviderSelection = {
  provider: ChatProvider
  fallback: boolean
  warning?: string
}

export type ProviderSettings = {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
}

export async function listModels(settings: ProviderSettings): Promise<string[]> {
  const selection = createProvider(settings)
  const provider = selection.provider
  if (provider.listModels) return provider.listModels()
  return [provider.model]
}

export function createProvider(settings: ProviderSettings = {}): ProviderSelection {
  const kind = (settings.provider ?? "").toLowerCase()
  const preset = findProviderPreset(kind)
  const transport =
    preset?.transport ??
    (kind === "anthropic"
      ? "anthropic"
      : kind === "ollama"
        ? "ollama"
        : kind === "echo"
          ? "echo"
          : "openai-compatible")

  if (transport === "echo") {
    return {
      provider: new EchoProvider(),
      fallback: true,
      warning: "provider=echo",
    }
  }

  if (preset?.askBaseUrl && !settings.baseUrl) {
    return {
      provider: new EchoProvider(),
      fallback: true,
      warning: "Base URL is required for a custom provider.",
    }
  }

  const baseUrl =
    settings.baseUrl ??
    preset?.baseUrl ??
    (transport === "ollama"
      ? "http://127.0.0.1:11434/v1"
      : transport === "anthropic"
        ? "https://api.anthropic.com"
        : "https://api.openai.com/v1")
  const model =
    settings.model ??
    preset?.defaultModel ??
    (transport === "ollama"
      ? "qwen2.5-coder:7b"
      : transport === "anthropic"
        ? "claude-sonnet-5-5"
        : "gpt-6.2")

  if (transport === "anthropic") {
    if (!settings.apiKey) {
      return {
        provider: new EchoProvider(),
        fallback: true,
        warning: "No API key configured; run `opencontinue setup` or select a provider in the TUI.",
      }
    }
    return {
      provider: new AnthropicProvider({ apiKey: settings.apiKey, baseUrl, model }),
      fallback: false,
    }
  }

  if (!settings.apiKey && baseUrl.includes("api.openai.com")) {
    return {
      provider: new EchoProvider(),
      fallback: true,
      warning:
        "No API key configured; using echo. Run `opencontinue setup` or set OPENCONTINUE_API_KEY.",
    }
  }

  return {
    provider: new OpenAICompatibleProvider({
      baseUrl,
      apiKey: settings.apiKey,
      model,
      reasoningEfforts: reasoningEffortsFor(kind, model),
    }),
    fallback: false,
  }
}

/**
 * Environment-first selection for CI and containers. The CLI normally resolves
 * settings from `~/.opencontinue` first, with environment variables overriding.
 */
export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderSelection {
  return createProvider({
    provider: env.OPENCONTINUE_PROVIDER ?? env.OPENAI_PROVIDER,
    baseUrl: env.OPENCONTINUE_BASE_URL ?? env.OPENAI_BASE_URL,
    apiKey: env.OPENCONTINUE_API_KEY ?? env.OPENAI_API_KEY,
    model: env.OPENCONTINUE_MODEL ?? env.OPENAI_MODEL,
  })
}
