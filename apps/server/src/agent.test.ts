import { describe, expect, it } from "vitest"

import { SessionStore } from "@opencontinue/core"
import type { ChatProvider } from "@opencontinue/providers"

import { runAgent } from "./agent.js"

describe("runAgent", () => {
  it("streams provider chunks into the session", async () => {
    const store = new SessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "hi" })

    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        yield "Hello"
        yield " world"
      },
    }

    await runAgent({ store, sessionId: session.id, provider })

    expect(store.snapshot(session.id)?.messages).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "Hello world" },
    ])
    const types = store.events(session.id).map((event) => event.type)
    expect(types).toContain("run.started")
    expect(types).toContain("run.completed")
  })

  it("records a failed run", async () => {
    const store = new SessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "hi" })

    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        throw new Error("boom")
      },
    }

    await runAgent({ store, sessionId: session.id, provider })

    const types = store.events(session.id).map((event) => event.type)
    expect(types).toContain("run.failed")
    expect(store.snapshot(session.id)?.messages.at(-1)?.text).toContain("boom")
  })
})
