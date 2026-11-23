import { describe, expect, it } from "vitest"

import { MemorySessionStore } from "./index.js"
import type { SessionExport } from "./types.js"

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

  it("forks a session through a sequence without touching the source", () => {
    const store = new MemorySessionStore()
    const session = store.create("source")
    store.append(session.id, { type: "message.user", text: "first" })
    store.append(session.id, { type: "run.started", runId: "r1" })
    store.append(session.id, {
      type: "message.assistant.delta",
      runId: "r1",
      text: "answer",
    })
    store.append(session.id, { type: "run.completed", runId: "r1" })

    const fork = store.fork(session.id, 1)
    expect(fork?.id).not.toBe(session.id)
    expect(fork?.title).toBe("source (fork)")
    expect(store.snapshot(fork!.id)?.messages).toEqual([
      { role: "user", text: "first" },
    ])
    expect(store.get(session.id)?.events).toHaveLength(5)
    expect(store.fork("missing", 1)).toBeUndefined()
  })

  it("rejects a malformed import", () => {
    const store = new MemorySessionStore()
    const session = store.create("exported")
    store.append(session.id, { type: "message.user", text: "hi" })
    const exported = store.exportSession(session.id)!

    const broken = {
      ...exported,
      events: [
        ...exported.events,
        {
          type: "message.user",
          sessionId: session.id,
          seq: 5,
          at: new Date().toISOString(),
          text: "gap",
        },
      ],
    }

    expect(() => store.importSession(broken as SessionExport)).toThrow(
      /sequence must start at 0/,
    )
    expect(store.list()).toHaveLength(1)
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
