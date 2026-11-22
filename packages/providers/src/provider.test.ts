import { describe, expect, it, vi } from "vitest"

import { OpenAICompatibleProvider } from "./index.js"

describe("OpenAICompatibleProvider", () => {
  it("streams content deltas and sends the expected request", async () => {
    const encoder = new TextEncoder()
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"Hel"}}]}\n\n'))
        controller.enqueue(
          encoder.encode('data: {"choices":[{"delta":{"content":"lo"}}]}\n\ndata: [DONE]\n\n'),
        )
        controller.close()
      },
    })

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

    const chunks: string[] = []
    for await (const chunk of provider.streamChat({
      model: "test-model",
      messages: [{ role: "user", content: "hi" }],
    })) {
      chunks.push(chunk)
    }

    expect(chunks.join("")).toBe("Hello")

    const call = fetchMock.mock.calls[0]
    expect(call?.[0]).toBe("https://example.test/v1/chat/completions")
    expect(call?.[1]?.headers).toMatchObject({ authorization: "Bearer test-key" })
  })

  it("throws on non-2xx responses", async () => {
    const fetchMock = vi.fn(async () => new Response("unauthorized", { status: 401 }))
    const provider = new OpenAICompatibleProvider({
      baseUrl: "https://example.test/v1",
      model: "test-model",
      fetch: fetchMock as unknown as typeof fetch,
    })

    await expect(async () => {
      for await (const _chunk of provider.streamChat({
        model: "test-model",
        messages: [{ role: "user", content: "hi" }],
      })) {
        // Drain the generator so the request is executed.
      }
    }).rejects.toThrow(/401/)
  })
})
