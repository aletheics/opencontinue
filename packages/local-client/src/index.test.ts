import { ClientHttpError } from "@opencontinue/client"
import { MemorySessionStore } from "@opencontinue/core"
import { EchoProvider, type ChatProvider, type ChatRequest } from "@opencontinue/providers"
import { describe, expect, it } from "vitest"

import { LocalSessionClient } from "./index.js"

class BlockingProvider implements ChatProvider {
  readonly id = "blocking"
  readonly model = "blocking"

  async listModels(): Promise<string[]> {
    return [this.model]
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<never, void, unknown> {
    await new Promise<never>((_, reject) => {
      const signal = request.signal
      if (signal?.aborted) {
        reject(new Error("Aborted"))
        return
      }
      signal?.addEventListener("abort", () => reject(new Error("Aborted")), { once: true })
    })
    yield* []
  }
}

function setup(): { store: MemorySessionStore; client: LocalSessionClient } {
  const store = new MemorySessionStore()
  const client = new LocalSessionClient({
    store,
    provider: new EchoProvider(),
    workspace: process.cwd(),
    permissionMode: "plan",
  })
  return { store, client }
}

describe("LocalSessionClient", () => {
  it("replays durable events and streams a live run", async () => {
    const { store, client } = setup()
    const session = await client.createSession("local")
    store.append(session.id, { type: "message.user", text: "before" })

    const seen: number[] = []
    let output = ""

    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out")), 3000)
      const subscription = client.subscribe(session.id, -1, (event) => {
        seen.push(event.seq)
        if (event.type === "message.assistant.delta") output += event.text
        if (event.type === "run.completed") {
          clearTimeout(timer)
          subscription.close()
          resolve()
        }
        if (event.type === "run.failed") {
          clearTimeout(timer)
          subscription.close()
          reject(new Error(event.error))
        }
      })
      void subscription.ready.catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
    })

    await client.sendMessage(session.id, "hello")
    await done

    expect(seen).toEqual([...new Set(seen)])
    expect(seen[0]).toBe(0)
    expect(output).toContain("Echo: hello")

    await expect(client.listSessions()).resolves.toHaveLength(1)
    await expect(client.getSession(session.id)).resolves.toMatchObject({ id: session.id })
    client.close()
  })

  it("aborts an active run through the client contract", async () => {
    const store = new MemorySessionStore()
    const client = new LocalSessionClient({
      store,
      provider: new BlockingProvider(),
      workspace: process.cwd(),
      permissionMode: "plan",
    })
    const session = await client.createSession("abort")
    const events: string[] = []
    let interrupted: boolean | undefined

    const failed = new Promise<string>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out")), 3000)
      const subscription = client.subscribe(session.id, -1, (event) => {
        events.push(event.type)
        if (event.type === "run.started") void client.abort(session.id)
        if (event.type === "run.failed") {
          interrupted = event.interrupted
          clearTimeout(timer)
          subscription.close()
          resolve(event.error)
        }
      })
      void subscription.ready.catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
    })

    await client.sendMessage(session.id, "block")
    await expect(failed).resolves.toMatch(/abort/i)
    expect(events).toContain("run.started")
    expect(events).toContain("run.failed")
    expect(interrupted).toBe(true)
    client.close()
  })

  it("rejects unknown sessions and permission requests", async () => {
    const { client } = setup()
    await expect(client.getSession("missing")).rejects.toBeInstanceOf(ClientHttpError)
    await expect(
      client.resolvePermission("missing", "request", true),
    ).rejects.toBeInstanceOf(ClientHttpError)
    client.close()
  })

  it("starts after a cursor", async () => {
    const { store, client } = setup()
    const session = await client.createSession("cursor")
    store.append(session.id, { type: "message.user", text: "zero" })
    store.append(session.id, { type: "message.user", text: "one" })

    const received: number[] = []
    const subscription = client.subscribe(session.id, 1, (event) => received.push(event.seq))
    await subscription.ready
    expect(received).toEqual([2])
    subscription.close()
    client.close()
  })
})
