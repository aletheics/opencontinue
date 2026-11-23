import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import type { Server as HttpServer } from "node:http"
import type { AddressInfo } from "node:net"
import os from "node:os"
import path from "node:path"

import { HttpSessionClient } from "@opencontinue/client"
import { createSessionStore } from "@opencontinue/core"
import { EchoProvider, type ChatProvider, type ChatRequest } from "@opencontinue/providers"
import { closeServer, startServer } from "@opencontinue/server"
import { afterEach, beforeEach, describe, expect, it } from "vitest"

const temporary: string[] = []
let home = ""
let previousHome: string | undefined

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "opencontinue-e2e-home-"))
  previousHome = process.env.OPENCONTINUE_HOME
  process.env.OPENCONTINUE_HOME = home
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.OPENCONTINUE_HOME
  else process.env.OPENCONTINUE_HOME = previousHome
  await rm(home, { recursive: true, force: true })
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function workspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-e2e-"))
  temporary.push(directory)
  return directory
}

class BlockingProvider implements ChatProvider {
  readonly id = "blocking"
  readonly model = "blocking"

  async listModels(): Promise<string[]> {
    return [this.model]
  }

  async *streamChat(request: ChatRequest): AsyncGenerator<never, void, unknown> {
    await new Promise<never>((_, reject) => {
      if (request.signal?.aborted) {
        reject(new Error("Aborted"))
        return
      }
      request.signal?.addEventListener("abort", () => reject(new Error("Aborted")), {
        once: true,
      })
    })
    yield* []
  }
}

describe("client/server e2e", () => {
  it("creates a session, streams one echo run, and lists it", async () => {
    const directory = await workspace()
    const store = createSessionStore({ workspace: directory })
    const running = startServer({
      store,
      provider: new EchoProvider(),
      port: 0,
      workspace: directory,
      permissionMode: "plan",
    })
    const server = running.server as unknown as HttpServer
    if (!server.listening) await once(server, "listening")
    const address = server.address() as AddressInfo
    const client = new HttpSessionClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      reconnectDelayMs: 20,
    })

    try {
      const session = await client.createSession("e2e")
      let output = ""

      const done = new Promise<void>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timed out waiting for run")), 5000)
        const subscription = client.subscribe(session.id, -1, (event) => {
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

      expect(output).toContain("Echo: hello")
      await expect(client.listSessions()).resolves.toHaveLength(1)
      await expect(client.getSession(session.id)).resolves.toMatchObject({
        id: session.id,
        lastSeq: expect.any(Number),
      })
    } finally {
      client.close()
      await closeServer(running.server)
      store.close()
    }
  }, 15000)

  it("reads and updates the permission mode over HTTP", async () => {
    const directory = await workspace()
    const store = createSessionStore({ workspace: directory })
    const running = startServer({
      store,
      provider: new EchoProvider(),
      port: 0,
      workspace: directory,
      permissionMode: "plan",
    })
    const server = running.server as unknown as HttpServer
    if (!server.listening) await once(server, "listening")
    const address = server.address() as AddressInfo
    const client = new HttpSessionClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
    })

    try {
      await expect(client.health()).resolves.toMatchObject({ permissionMode: "plan" })
      await client.setPermissionMode("auto")
      await expect(client.health()).resolves.toMatchObject({ permissionMode: "auto" })
      await client.setPermissionMode("confirm")
      await expect(client.health()).resolves.toMatchObject({
        permissionMode: "confirm",
        reasoningEffort: "auto",
        reasoningEfforts: [],
      })

      await client.setReasoningEffort("high")
      await expect(client.health()).resolves.toMatchObject({
        reasoningEffort: "high",
      })
    } finally {
      client.close()
      await closeServer(running.server)
      store.close()
    }
  }, 15000)

  it("aborts a running session through the HTTP contract", async () => {
    const directory = await workspace()
    const store = createSessionStore({ workspace: directory })
    const running = startServer({
      store,
      provider: new BlockingProvider(),
      port: 0,
      workspace: directory,
      permissionMode: "plan",
    })
    const server = running.server as unknown as HttpServer
    if (!server.listening) await once(server, "listening")
    const address = server.address() as AddressInfo
    const client = new HttpSessionClient({
      baseUrl: `http://127.0.0.1:${address.port}`,
      reconnectDelayMs: 20,
    })

    try {
      const session = await client.createSession("abort")
      const failed = new Promise<string>((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error("timed out")), 5000)
        const subscription = client.subscribe(session.id, -1, (event) => {
          if (event.type === "run.started") void client.abort(session.id)
          if (event.type === "run.failed") {
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
    } finally {
      client.close()
      await closeServer(running.server)
      store.close()
    }
  }, 15000)
})
