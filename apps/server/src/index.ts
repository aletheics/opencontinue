import { serve, type ServerType } from "@hono/node-server"
import { Hono } from "hono"
import { cors } from "hono/cors"
import { streamSSE } from "hono/streaming"

import { createSessionStore, type SessionStore } from "@opencontinue/core"
import {
  CreateSessionRequest,
  PermissionDecisionRequest,
  PermissionMode as PermissionModeSchema,
  SendMessageRequest,
  type SessionEvent,
} from "@opencontinue/protocol"
import {
  resolveProviderSettings,
  saveProviderConfig,
} from "@opencontinue/config"
import { createProvider, type ChatProvider } from "@opencontinue/providers"
import {
  DEFAULT_SYSTEM_PROMPT,
  loadProjectConfig,
  PermissionBroker,
  runAgent,
  type PermissionMode,
} from "@opencontinue/runtime"
import { ToolRegistry } from "@opencontinue/tools"

export type StartServerOptions = {
  store?: SessionStore
  port?: number
  hostname?: string
  provider?: ChatProvider
  systemPrompt?: string
  tools?: ToolRegistry
  permissionMode?: PermissionMode
  workspace?: string
}

export type RunningServer = {
  app: Hono
  store: SessionStore
  server: ServerType
  port: number
  provider: ChatProvider
  permissionMode: PermissionMode
  workspace: string
  warning?: string
}

export function createApp(
  store: SessionStore,
  provider: ChatProvider,
  systemPrompt: string,
  tools: ToolRegistry,
  permissions: PermissionBroker,
  workspace: string,
): Hono {
  const app = new Hono()
  const activeRuns = new Map<string, AbortController>()

  app.use("*", cors())

  app.get("/health", (c) =>
    c.json({ ok: true, permissionMode: permissions.getMode() }),
  )

  app.post("/v1/permission-mode", async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const mode =
      typeof body === "object" && body !== null
        ? (body as { mode?: unknown }).mode
        : undefined
    const parsed = PermissionModeSchema.safeParse(mode)
    if (!parsed.success) return c.json({ error: "invalid permission mode" }, 400)

    permissions.setMode(parsed.data)
    saveProviderConfig({ permissionMode: parsed.data })
    return c.json({ mode: permissions.getMode() })
  })

  app.post("/v1/sessions/:id/permissions/allow", async (c) => {
    const sessionId = c.req.param("id")
    if (!store.get(sessionId)) return c.json({ error: "session not found" }, 404)

    const body = await c.req.json().catch(() => ({}))
    const tool =
      typeof body === "object" && body !== null
        ? (body as { tool?: unknown }).tool
        : undefined
    if (typeof tool !== "string" || tool.length === 0) {
      return c.json({ error: "tool is required" }, 400)
    }

    permissions.allowForSession(tool)
    return c.json({ ok: true })
  })

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

    if (activeRuns.has(sessionId)) {
      return c.json({ error: "session is already running" }, 409)
    }

    store.append(sessionId, { type: "message.user", text: parsed.data.text })
    const controller = new AbortController()
    activeRuns.set(sessionId, controller)
    void runAgent({
      store,
      sessionId,
      provider,
      systemPrompt,
      tools,
      permissions,
      workspace,
      signal: controller.signal,
    }).finally(() => {
      if (activeRuns.get(sessionId) === controller) activeRuns.delete(sessionId)
    })
    return c.json({ accepted: true }, 202)
  })

  app.post("/v1/sessions/:id/abort", (c) => {
    const sessionId = c.req.param("id")
    if (!store.get(sessionId)) return c.json({ error: "session not found" }, 404)

    const controller = activeRuns.get(sessionId)
    if (!controller) return c.json({ aborted: false })
    controller.abort()
    activeRuns.delete(sessionId)
    return c.json({ aborted: true })
  })

  app.post("/v1/sessions/:id/permissions/:requestId", async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = PermissionDecisionRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

    const resolved = permissions.resolve(
      c.req.param("requestId"),
      parsed.data.approved,
      c.req.param("id"),
    )
    if (!resolved) return c.json({ error: "permission request not found" }, 404)
    return c.json({ ok: true })
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
  const workspace = options.workspace ?? process.cwd()
  const store = options.store ?? createSessionStore({ workspace })
  const selection = options.provider
    ? { provider: options.provider, warning: undefined }
    : createProvider(resolveProviderSettings())
  const project = loadProjectConfig(workspace)
  const baseSystemPrompt =
    options.systemPrompt ?? process.env.OPENCONTINUE_SYSTEM_PROMPT ?? DEFAULT_SYSTEM_PROMPT
  const systemPrompt = project.instructions
    ? `${baseSystemPrompt}\n\n${project.instructions}`
    : baseSystemPrompt
  const tools = options.tools ?? new ToolRegistry()
  const settings = resolveProviderSettings()
  const permissionMode =
    options.permissionMode ??
    settings.permissionMode ??
    project.permissionMode ??
    "confirm"
  const permissions = new PermissionBroker(store, permissionMode, project)

  const app = createApp(store, selection.provider, systemPrompt, tools, permissions, workspace)
  const port = options.port ?? Number(process.env.OPENCONTINUE_PORT ?? 8787)
  const server = serve({
    fetch: app.fetch,
    port,
    hostname: options.hostname ?? "127.0.0.1",
  })
  const address = server.address()
  const boundPort = typeof address === "object" && address !== null ? address.port : port

  return {
    app,
    store,
    server,
    port: boundPort,
    provider: selection.provider,
    permissionMode,
    workspace,
    warning: selection.warning,
  }
}

export {
  DEFAULT_SYSTEM_PROMPT,
  runAgent,
  PermissionBroker,
  loadProjectConfig,
  type PermissionMode,
} from "@opencontinue/runtime"

export async function closeServer(server: ServerType): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()))
  })
}
