import { MemorySessionStore } from "@opencontinue/core"
import { describe, expect, it } from "vitest"

import { followSession } from "./event-stream.js"

describe("followSession", () => {
  it("delivers an event appended during replay exactly once", async () => {
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "one" })
    store.append(session.id, { type: "message.user", text: "two" })

    const original = store.events.bind(store)
    let injected = false
    store.events = (id, after) => {
      const events = original(id, after)
      if (!injected) {
        injected = true
        store.append(id, { type: "message.user", text: "during replay" })
      }
      return events
    }

    const received: number[] = []
    const unsubscribe = await followSession(store, session.id, -1, (event) => {
      received.push(event.seq)
    })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).toEqual([0, 1, 2, 3])

    unsubscribe()
    store.append(session.id, { type: "message.user", text: "after close" })
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(received).toEqual([0, 1, 2, 3])
  })

  it("continues after the replay cursor without duplicates", async () => {
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "one" })
    store.append(session.id, { type: "message.user", text: "two" })

    const received: number[] = []
    const unsubscribe = await followSession(store, session.id, 1, (event) => {
      received.push(event.seq)
    })

    store.append(session.id, { type: "message.user", text: "live" })
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(received).toEqual([2, 3])
    unsubscribe()
  })
})
