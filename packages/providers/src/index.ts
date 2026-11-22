export type ChatRole = "system" | "user" | "assistant"

export type ChatMessage = {
  role: ChatRole
  content: string
}

export type ChatRequest = {
  model: string
  messages: ChatMessage[]
  signal?: AbortSignal
}

export interface ChatProvider {
  readonly id: string
  readonly model: string
  streamChat(request: ChatRequest): AsyncGenerator<string, void, unknown>
}

/**
 * Offline fallback. Useful for tests and for a first run without credentials.
 */
export class EchoProvider implements ChatProvider {
  readonly id = "echo"
  readonly model = "echo"

  async *streamChat(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const user = [...request.messages].reverse().find((message) => message.role === "user")
    const reply = `Echo: ${user?.content ?? ""}`
    for (let index = 0; index < reply.length; index += 8) {
      if (request.signal?.aborted) {
        const error = new Error("Aborted")
        error.name = "AbortError"
        throw error
      }
      yield reply.slice(index, index + 8)
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
  choices?: Array<{ delta?: { content?: string | null } }>
  error?: { message?: string }
}

export type OpenAICompatibleOptions = {
  baseUrl: string
  model: string
  apiKey?: string
  headers?: Record<string, string>
  fetch?: typeof fetch
}

/**
 * Works with OpenAI, DeepSeek, Ollama, vLLM, LM Studio, and any other
 * server that implements the OpenAI chat completions streaming shape.
 */
export class OpenAICompatibleProvider implements ChatProvider {
  readonly id = "openai-compatible"
  readonly model: string
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
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<string, void, unknown> {
    const response = await this.fetchImpl(`${this.baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(this.apiKey ? { authorization: `Bearer ${this.apiKey}` } : {}),
        ...this.headers,
      },
      body: JSON.stringify({
        model: request.model || this.model,
        messages: request.messages,
        stream: true,
      }),
      signal: request.signal,
    })

    if (!response.ok) {
      const body = await response.text()
      throw new Error(`Provider request failed (${response.status}): ${body.slice(0, 500)}`)
    }
    if (!response.body) throw new Error("Provider returned an empty response body")

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    const parser = new SseParser()

    const extract = (data: string): string | undefined => {
      const chunk = JSON.parse(data) as OpenAIChunk
      if (chunk.error?.message) throw new Error(`Provider error: ${chunk.error.message}`)
      const content = chunk.choices?.[0]?.delta?.content
      return typeof content === "string" && content.length > 0 ? content : undefined
    }

    for (;;) {
      const { value, done } = await reader.read()
      if (done) break
      for (const data of parser.push(decoder.decode(value, { stream: true }))) {
        if (data === "[DONE]") return
        const content = extract(data)
        if (content) yield content
      }
    }

    for (const data of parser.flush()) {
      if (data === "[DONE]") return
      const content = extract(data)
      if (content) yield content
    }
  }
}

export type ProviderSelection = {
  provider: ChatProvider
  fallback: boolean
  warning?: string
}

/**
 * Environment-first provider selection:
 *
 *   OPENCONTINUE_PROVIDER=openai-compatible | ollama | echo
 *   OPENCONTINUE_BASE_URL=https://api.deepseek.com/v1
 *   OPENCONTINUE_API_KEY=...
 *   OPENCONTINUE_MODEL=deepseek-chat
 *
 * With no configuration, the server falls back to echo so a fresh checkout
 * can still exercise the event stream and clients.
 */
export function createProviderFromEnv(env: NodeJS.ProcessEnv = process.env): ProviderSelection {
  const kind = (env.OPENCONTINUE_PROVIDER ?? "").toLowerCase()

  if (kind === "echo") {
    return {
      provider: new EchoProvider(),
      fallback: true,
      warning: "OPENCONTINUE_PROVIDER=echo",
    }
  }

  if (kind && kind !== "openai-compatible" && kind !== "ollama") {
    return {
      provider: new EchoProvider(),
      fallback: true,
      warning: `Unknown OPENCONTINUE_PROVIDER="${kind}"; using echo.`,
    }
  }

  const ollama = kind === "ollama"
  const baseUrl =
    env.OPENCONTINUE_BASE_URL ??
    (ollama ? "http://127.0.0.1:11434/v1" : (env.OPENAI_BASE_URL ?? "https://api.openai.com/v1"))
  const apiKey = env.OPENCONTINUE_API_KEY ?? env.OPENAI_API_KEY
  const model =
    env.OPENCONTINUE_MODEL ??
    env.OPENAI_MODEL ??
    (ollama ? "qwen2.5-coder:7b" : "gpt-4o-mini")

  if (!apiKey && baseUrl.includes("api.openai.com")) {
    return {
      provider: new EchoProvider(),
      fallback: true,
      warning:
        "No API key configured; using echo. Set OPENCONTINUE_API_KEY, or OPENCONTINUE_BASE_URL for a local provider.",
    }
  }

  return {
    provider: new OpenAICompatibleProvider({ baseUrl, apiKey, model }),
    fallback: false,
  }
}
