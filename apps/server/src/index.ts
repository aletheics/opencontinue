import { serve, type ServerType } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"

import { SessionStore } from "@opencontinue/core"
import {
  CreateSessionRequest,
  SendMessageRequest,
  type SessionEvent,
} from "@opencontinue/protocol"
import { createProviderFromEnv, type ChatProvider } from "@opencontinue/providers"

import { DEFAULT_SYSTEM_PROMPT, runAgent } from "./agent.js"

export type StartServerOptions = {
  store?: SessionStore
  port?: number
  hostname?: string
  provider?: ChatProvider
  systemPrompt?: string
}

export type RunningServer = {
  app: Hono
  store: SessionStore
  server: ServerType
  port: number
  provider: ChatProvider
  warning?: string
}

export function createApp(
  store: SessionStore,
  provider: ChatProvider,
  systemPrompt: string,
): Hono {
  const app = new Hono()

  app.use("*", cors())

  app.get("/health", (c) => c.json({ ok: true }))

  app.post("/v1/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateSessionRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

    const session = store.create(parsed.data.title)
    return c.json(store.snapshot(session.id), 201)
  })

  app.get("/v1/sessions", (c) => c.json(store.list()))

  app.get("/v1/sessions/:id", (c) => {
    const snapshot = store.snapshot(c.req.param("id"))
    if (!snapshot) return c.json({ error: "session not found" }, 404)
    return c.json(snapshot)
  })

  app.post("/v1/sessions/:id/messages", async (c) => {
    const sessionId = c.req.param("id")
    if (!store.get(sessionId)) return c.json({ error: "session not found" }, 404)

    const body = await c.req.json().catch(() => ({}))
    const parsed = SendMessageRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

    store.append(sessionId, { type: "message.user", text: parsed.data.text })
    void runAgent({ store, sessionId, provider, systemPrompt })
    return c.json({ accepted: true }, 202)
  })

  app.get("/v1/sessions/:id/events", async (c) => {
    const sessionId = c.req.param("id")
    if (!store.get(sessionId)) return c.json({ error: "session not found" }, 404)

    const rawAfter = Number(c.req.query("after") ?? "-1")
    const after = Number.isFinite(rawAfter) ? rawAfter : -1

    return streamSSE(c, async (stream) => {
      let closed = false
      let resolveDone: () => void = () => {}
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })

      const send = async (event: SessionEvent) => {
        if (closed) return
        await stream.writeSSE({
          event: "session",
          id: String(event.seq),
          data: JSON.stringify(event),
        })
      }

      for (const event of store.events(sessionId, after)) await send(event)

      const unsubscribe = store.subscribe(sessionId, (event) => {
        void send(event)
      })

      stream.onAbort(() => {
        closed = true
        unsubscribe()
        resolveDone()
      })

      await done
    })
  })

  return app
}

export function startServer(options: StartServerOptions = {}): RunningServer {
  const store = options.store ?? new SessionStore()
  const selection = options.provider
    ? { provider: options.provider, warning: undefined }
    : createProviderFromEnv()
  const systemPrompt =
    options.systemPrompt ?? process.env.OPENCONTINUE_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT

  const app = createApp(store, selection.provider, systemPrompt)
  const port = options.port ?? Number(process.env.OPENCONTINUE_PORT ?? 8787)
  const server = serve({
    fetch: app.fetch,
    port,
    hostname: options.hostname ?? "127.0.0.1",
  })

  return {
    app,
    store,
    server,
    port,
    provider: selection.provider,
    warning: selection.warning,
  }
}

export async function closeServer(server: ServerType): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
