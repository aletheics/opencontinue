import { describe, expect, it } from "vitest"

import { MemorySessionStore } from "./index.js"

describe("MemorySessionStore", () => {
  it("projects user and assistant messages", () => {
    const store = new MemorySessionStore()
    const session = store.create("test")
    store.append(session.id, { type: "message.user", text: "hi" })
    store.append(session.id, { type: "run.started", runId: "r1" })
    store.append(session.id, { type: "message.assistant.delta", runId: "r1", text: "hello" })
    store.append(session.id, { type: "run.completed", runId: "r1" })

    expect(store.snapshot(session.id)?.messages).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ])
  })

  it("replays events after a sequence number", () => {
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "a" })
    store.append(session.id, { type: "message.user", text: "b" })

    expect(store.events(session.id, 1).map((event) => event.type)).toEqual(["message.user"])
  })

  it("notifies subscribers until they unsubscribe", () => {
    const store = new MemorySessionStore()
    const session = store.create()
    const seen: string[] = []
    const unsubscribe = store.subscribe(session.id, (event) => seen.push(event.type))

    store.append(session.id, { type: "message.user", text: "x" })
    unsubscribe()
    store.append(session.id, { type: "message.user", text: "y" })

    expect(seen).toEqual(["message.user"])
  })
})
