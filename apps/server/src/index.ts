import { serve, type ServerType } from "@hono/node-server"
import { Hono } from "hono"
import { streamSSE } from "hono/streaming"

import { createSessionStore, type SessionStore } from "@opencontinue/core"
import {
  CreateSessionRequest,
  ForkSessionRequest,
  PermissionDecisionRequest,
  PermissionMode as PermissionModeSchema,
  ReasoningEffort as ReasoningEffortSchema,
  SendMessageRequest,
  type ReasoningEffort,
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
import { listWorkspaceFiles, ToolRegistry } from "@opencontinue/tools"

import { followSession } from "./event-stream.js"
import {
  bearerAuthorized,
  originAllowed,
  resolveServerToken,
} from "./security.js"

export type StartServerOptions = {
  store?: SessionStore
  port?: number
  hostname?: string
  provider?: ChatProvider
  systemPrompt?: string
  tools?: ToolRegistry
  permissionMode?: PermissionMode
  reasoningEffort?: ReasoningEffort
  workspace?: string
  /** Fixed local bearer token; otherwise generated for this process. */
  token?: string
  /** Exact browser origins allowed in addition to same-host requests. */
  cors?: string[]
}

export type RunningServer = {
  app: Hono
  store: SessionStore
  server: ServerType
  port: number
  provider: ChatProvider
  permissionMode: PermissionMode
  reasoningEffort: ReasoningEffort
  workspace: string
  token: string
  warning?: string
}

export function createApp(
  store: SessionStore,
  provider: ChatProvider,
  systemPrompt: string,
  tools: ToolRegistry,
  permissions: PermissionBroker,
  workspace: string,
  reasoning: { effort: ReasoningEffort },
  security: { token: string; cors?: readonly string[] },
): Hono {
  const app = new Hono()
  const activeRuns = new Map<string, AbortController>()
  const allowedOrigins = security.cors ?? []

  app.use("*", async (c, next) => {
    const origin = c.req.header("origin")
    if (!originAllowed(origin, c.req.header("host"), allowedOrigins)) {
      return c.json({ error: "origin not allowed" }, 403)
    }

    if (origin) {
      c.header("access-control-allow-origin", origin)
      c.header("vary", "Origin")
    }

    if (c.req.method === "OPTIONS") {
      c.header("access-control-allow-methods", "GET,POST,OPTIONS")
      c.header("access-control-allow-headers", "authorization,content-type")
      c.header("access-control-max-age", "600")
      return c.body(null, 204)
    }

    if (!bearerAuthorized(c.req.header("authorization"), security.token)) {
      return c.json({ error: "unauthorized" }, 401)
    }

    await next()
  })

  app.get("/health", (c) =>
    c.json({
      ok: true,
      permissionMode: permissions.getMode(),
      permissions: permissions.getPolicy(c.req.query("sessionId")),
      reasoningEffort: reasoning.effort,
      reasoningEfforts: provider.reasoningEfforts ?? [],
    }),
  )

  app.post("/v1/reasoning", async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const effort =
      typeof body === "object" && body !== null
        ? (body as { effort?: unknown }).effort
        : undefined
    const parsed = ReasoningEffortSchema.safeParse(effort)
    if (!parsed.success) return c.json({ error: "invalid reasoning effort" }, 400)

    reasoning.effort = parsed.data
    saveProviderConfig({ reasoningEffort: parsed.data })
    return c.json({ effort: reasoning.effort })
  })

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

    permissions.allowForSession(sessionId, tool)
    return c.json({ ok: true })
  })

  app.get("/v1/workspace/files", async (c) => {
    const rawLimit = Number(c.req.query("limit") ?? "2000")
    const limit = Number.isFinite(rawLimit)
      ? Math.min(5_000, Math.max(1, Math.trunc(rawLimit)))
      : 2_000
    const files = await listWorkspaceFiles(workspace, {
      limit,
      includeDirectories: c.req.query("directories") === "1",
    })
    return c.json({ files })
  })

  app.post("/v1/sessions", async (c) => {
    const body = await c.req.json().catch(() => ({}))
    const parsed = CreateSessionRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

    const session = store.create(parsed.data.title)
    return c.json(store.snapshot(session.id), 201)
  })

  app.post("/v1/sessions/:id/fork", async (c) => {
    const sessionId = c.req.param("id")
    if (!store.get(sessionId)) return c.json({ error: "session not found" }, 404)

    const body = await c.req.json().catch(() => ({}))
    const parsed = ForkSessionRequest.safeParse(body)
    if (!parsed.success) return c.json({ error: parsed.error.flatten() }, 400)

    const fork = store.fork(sessionId, parsed.data.atSeq, parsed.data.title)
    if (!fork) return c.json({ error: "session not found" }, 404)
    return c.json(store.snapshot(fork.id), 201)
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
      reasoningEffort: reasoning.effort,
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

    c.header("cache-control", "no-cache, no-transform")
    c.header("x-accel-buffering", "no")

    return streamSSE(c, async (stream) => {
      let closed = false
      let unsubscribe: (() => void) | undefined
      let resolveDone: () => void = () => {}
      let chain = Promise.resolve()
      const done = new Promise<void>((resolve) => {
        resolveDone = resolve
      })

      const write = (payload: string): void => {
        chain = chain
          .then(async () => {
            if (closed) return
            await stream.write(payload)
          })
          .catch(() => {})
      }

      const send = (event: SessionEvent): void => {
        write(
          `event: session\nid: ${event.seq}\ndata: ${JSON.stringify(event)}\n\n`,
        )
      }

      const heartbeat = setInterval(() => {
        write(": heartbeat\n\n")
      }, 15_000)

      stream.onAbort(() => {
        closed = true
        clearInterval(heartbeat)
        unsubscribe?.()
        resolveDone()
      })

      try {
        unsubscribe = await followSession(store, sessionId, after, send)
      } catch {
        closed = true
        clearInterval(heartbeat)
        resolveDone()
        return
      }

      if (closed) {
        unsubscribe()
        return
      }

      await done
      clearInterval(heartbeat)
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
  const reasoning = {
    effort: options.reasoningEffort ?? settings.reasoningEffort ?? "auto",
  }
  const token = resolveServerToken(options.token)
  const app = createApp(
    store,
    selection.provider,
    systemPrompt,
    tools,
    permissions,
    workspace,
    reasoning,
    { token, cors: options.cors },
  )
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
    reasoningEffort: reasoning.effort,
    workspace,
    token,
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
