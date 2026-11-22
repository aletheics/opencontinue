import { describe, expect, it, vi } from "vitest"

import { toAnthropicMessages } from "./anthropic.js"
import { createProvider, OpenAICompatibleProvider, type ChatStreamEvent } from "./index.js"

function sseBody(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event))
      controller.close()
    },
  })
}

describe("createProvider", () => {
  it("falls back to echo when the default OpenAI endpoint has no key", () => {
    const selection = createProvider({ baseUrl: "https://api.openai.com/v1", model: "m" })
    expect(selection.provider.id).toBe("echo")
    expect(selection.fallback).toBe(true)
  })

  it("creates a provider for a local OpenAI-compatible endpoint", () => {
    const selection = createProvider({ baseUrl: "http://127.0.0.1:11434/v1", model: "m" })
    expect(selection.provider.id).toBe("openai-compatible")
    expect(selection.fallback).toBe(false)
  })

  it("maps provider presets", () => {
    expect(createProvider({ provider: "deepseek", apiKey: "k" }).provider).toMatchObject({
      id: "openai-compatible",
      model: "deepseek-chat",
    })
    expect(createProvider({ provider: "claude", apiKey: "k" }).provider).toMatchObject({
      id: "anthropic",
      model: "claude-sonnet-5-5",
    })
    expect(createProvider({ provider: "custom" }).provider.id).toBe("echo")
  })
})

describe("Anthropic messages", () => {
  it("converts assistant tool calls and tool results", () => {
    const converted = toAnthropicMessages([
      { role: "system", content: "rules" },
      { role: "user", content: "hi" },
      {
        role: "assistant",
        content: "",
        toolCalls: [{ id: "c1", name: "read", arguments: '{"path":"a"}' }],
      },
      { role: "tool", toolCallId: "c1", content: "file" },
      { role: "user", content: "next" },
    ])

    expect(converted.system).toBe("rules")
    expect(converted.messages).toEqual([
      { role: "user", content: [{ type: "text", text: "hi" }] },
      {
        role: "assistant",
        content: [{ type: "tool_use", id: "c1", name: "read", input: { path: "a" } }],
      },
      {
        role: "user",
        content: [
          { type: "tool_result", tool_use_id: "c1", content: "file" },
          { type: "text", text: "next" },
        ],
      },
    ])
  })
})

describe("OpenAICompatibleProvider", () => {
  it("streams text deltas and sends the expected request", async () => {
    const body = sseBody([
      'data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n',
      'data: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n',
    ])

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(body, { status: 200 }),
    )
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.test/v1/",
      apiKey: "test-key",
      model: "test-model",
      fetch: fetchMock as unknown as typeof fetch,
    })

    const text: string[] = []
    for await (const event of provider.streamChat({
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
    })) {
      if (event.type === "text") text.push(event.text)
    }

    expect(text.join("")).toBe("Hello")

    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe("https://example.test/v1/chat/completions")
    expect(call?.[1]?.headers).toMatchObject({ authorization: "Bearer test-key" })
  })

  it("accumulates streamed tool calls and sends tool definitions", async () => {
    const body = sseBody([
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"id":"call_1","function":{"name":"read","arguments":"{\\"path\\":"}}]}}]}\n\n',
      'data: {"choices":[{"delta":{"tool_calls":[{"index":0,"function":{"arguments":"\\"a.ts\\"}"}}]}}]}\n\n',
      "data: [DONE]\n\n",
    ])

    const fetchMock = vi.fn(
      async (_input: RequestInfo | URL, _init?: RequestInit) =>
        new Response(body, { status: 200 }),
    )
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch: fetchMock as unknown as typeof fetch,
    })

    const events: ChatStreamEvent[] = []
    for await (const event of provider.streamChat({
      model: "test-model",
      messages: [{ role: "user", content: "read a.ts" }],
      tools: [{ name: "read", description: "Read a file", parameters: { type: "object" } }],
    })) {
      events.push(event)
    }

    expect(events).toEqual([
      {
        type: "tool_call",
        call: { id: "call_1", name: "read", arguments: '{"path":"a.ts"}' },
      },
    ])

    const init = fetchMock.mock.calls[0]?.[1]
    const request = JSON.parse(String(init?.body)) as Record<string, unknown>
    expect(request.tool_choice).toBe("auto")
    expect(request.tools).toMatchObject([
      { type: "function", function: { name: "read", description: "Read a file" } },
    ])
  })

  it("lists models from an OpenAI-compatible endpoint", async () => {
    const fetchMock = vi.fn(
      async () =>
        new Response(JSON.stringify({ data: [{ id: "gpt-6.2" }, { id: "gpt-6.2-mini" }] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
    )
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      model: "gpt-6.2",
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(provider.listModels()).resolves.toEqual(["gpt-6.2", "gpt-6.2-mini"])
  })

  it("throws on non-2xx responses", async () => {
    const fetchMock = vi.fn(async () => new Response("unauthorized", { status: 401 }))
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(async () => {
      for await (const _event of provider.streamChat({
        model: "test-model",
        messages: [{ role: "user", content: "hi" }],
      })) {
        // Drain the generator so the request is executed.
      }
    }).rejects.toThrow(/401/)
  })
})
