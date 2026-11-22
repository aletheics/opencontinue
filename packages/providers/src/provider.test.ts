import { describe, expect, it, vi } from "vitest"

import { OpenAICompatibleProvider, type ChatStreamEvent } from "./index.js"

function sseBody(events: string[]): ReadableStream<Uint8Array> {
  const encoder = new TextEncoder()
  return new ReadableStream<Uint8Array>({
    start(controller) {
      for (const event of events) controller.enqueue(encoder.encode(event))
      controller.close()
    },
  })
}

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
