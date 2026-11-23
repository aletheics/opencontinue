import {
  ClientHttpError,
  type OpenContinueClient,
  type SessionEventListener,
  type SessionSubscription,
} from "@opencontinue/client"
import type { SessionStore } from "@opencontinue/core"
import type {
  SessionEvent,
  SessionSnapshot,
  SessionSummary,
} from "@opencontinue/protocol"
import type { ChatProvider, ReasoningEffort } from "@opencontinue/providers"
import {
  DEFAULT_SYSTEM_PROMPT,
  loadProjectConfig,
  PermissionBroker,
  runAgent,
  type PermissionMode,
  type PermissionPolicy,
} from "@opencontinue/runtime"
import { ToolRegistry } from "@opencontinue/tools"

export type LocalClientOptions = {
  store: SessionStore
  provider: ChatProvider
  workspace: string
  systemPrompt?: string
  tools?: ToolRegistry
  permissionMode?: PermissionMode
  permissionPolicy?: PermissionPolicy
  reasoningEffort?: ReasoningEffort
}

/**
 * In-process implementation of the same session contract served over HTTP.
 * The caller owns the store; close only releases subscriptions.
 */
export class LocalSessionClient implements OpenContinueClient {
  readonly baseUrl = "local://"
  private readonly store: SessionStore
  private provider: ChatProvider
  private readonly workspace: string
  private readonly systemPrompt: string
  private readonly tools: ToolRegistry
  private readonly permissions: PermissionBroker
  private reasoningEffort: ReasoningEffort
  private readonly subscriptions = new Set<() => void>()
  private readonly activeRuns = new Map<string, AbortController>()
  private closed = false

  constructor(options: LocalClientOptions) {
    this.store = options.store
    this.provider = options.provider
    this.workspace = options.workspace
    this.tools = options.tools ?? new ToolRegistry()
    this.reasoningEffort = options.reasoningEffort ?? "auto"

    const project = loadProjectConfig(options.workspace)
    const base = options.systemPrompt ?? DEFAULT_SYSTEM_PROMPT
    this.systemPrompt = project.instructions
      ? `${base}\n\n${project.instructions}`
      : base
    this.permissions = new PermissionBroker(
      options.store,
      options.permissionMode ?? project.permissionMode ?? "confirm",
      options.permissionPolicy ?? {
        allow: project.allow,
        ask: project.ask,
        deny: project.deny,
      },
    )
  }

  setProvider(provider: ChatProvider): void {
    this.provider = provider
  }

  setPermissionMode(mode: PermissionMode): void {
    this.permissions.setMode(mode)
  }

  allowToolForSession(_sessionId: string, tool: string): void {
    this.permissions.allowForSession(tool)
  }

  async health(): Promise<{
    ok: boolean
    permissionMode?: PermissionMode
    permissions?: { allow: string[]; ask: string[]; deny: string[] }
    reasoningEffort?: ReasoningEffort
    reasoningEfforts?: readonly ReasoningEffort[]
  }> {
    return {
      ok: true,
      permissionMode: this.permissions.getMode(),
      permissions: this.permissions.getPolicy(),
      reasoningEffort: this.reasoningEffort,
      reasoningEfforts: this.provider.reasoningEfforts ?? [],
    }
  }

  setReasoningEffort(effort: ReasoningEffort): void {
    this.reasoningEffort = effort
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.store.list()
  }

  async createSession(title = "OpenContinue session"): Promise<SessionSnapshot> {
    const session = this.store.create(title)
    return this.snapshot(session.id)
  }

  async getSession(sessionId: string): Promise<SessionSnapshot> {
    return this.snapshot(sessionId)
  }

  async forkSession(
    sessionId: string,
    atSeq?: number,
    title?: string,
  ): Promise<SessionSnapshot> {
    const fork = this.store.fork(sessionId, atSeq, title)
    if (!fork) throw new ClientHttpError(404, "session not found")
    return this.snapshot(fork.id)
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    if (!this.store.get(sessionId)) throw new ClientHttpError(404, "session not found")

    if (this.activeRuns.has(sessionId)) {
      throw new ClientHttpError(409, "session is already running")
    }

    this.store.append(sessionId, { type: "message.user", text })
    const controller = new AbortController()
    this.activeRuns.set(sessionId, controller)
    void runAgent({
      store: this.store,
      sessionId,
      provider: this.provider,
      tools: this.tools,
      permissions: this.permissions,
      workspace: this.workspace,
      systemPrompt: this.systemPrompt,
      reasoningEffort: this.reasoningEffort,
      signal: controller.signal,
    }).finally(() => {
      if (this.activeRuns.get(sessionId) === controller) this.activeRuns.delete(sessionId)
    })
  }

  async abort(sessionId: string): Promise<void> {
    if (!this.store.get(sessionId)) throw new ClientHttpError(404, "session not found")
    this.activeRuns.get(sessionId)?.abort()
    this.activeRuns.delete(sessionId)
  }

  async resolvePermission(
    sessionId: string,
    requestId: string,
    approved: boolean,
  ): Promise<void> {
    if (!this.permissions.resolve(requestId, approved, sessionId)) {
      throw new ClientHttpError(404, "permission request not found")
    }
  }

  subscribe(
    sessionId: string,
    after: number,
    listener: SessionEventListener,
  ): SessionSubscription {
    if (this.closed) {
      return {
        ready: Promise.reject(new Error("Client is closed")),
        close: () => {},
      }
    }

    if (!this.store.get(sessionId)) {
      return {
        ready: Promise.reject(new ClientHttpError(404, "session not found")),
        close: () => {},
      }
    }

    let lastSeq = Math.max(-1, after)
    let closed = false
    const deliver = (event: SessionEvent) => {
      if (event.seq <= lastSeq) return
      lastSeq = event.seq
      listener(event)
    }

    for (const event of this.store.events(sessionId, lastSeq)) deliver(event)
    const unsubscribe = this.store.subscribe(sessionId, deliver)
    for (const event of this.store.events(sessionId, lastSeq)) deliver(event)

    const close = () => {
      if (closed) return
      closed = true
      unsubscribe()
      this.subscriptions.delete(close)
    }
    this.subscriptions.add(close)

    return { ready: Promise.resolve(), close }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    for (const close of this.subscriptions) close()
    this.subscriptions.clear()
    for (const controller of this.activeRuns.values()) controller.abort()
    this.activeRuns.clear()
  }

  private snapshot(sessionId: string): SessionSnapshot {
    const snapshot = this.store.snapshot(sessionId)
    if (!snapshot) throw new ClientHttpError(404, "session not found")
    return snapshot
  }
}

export function createLocalClient(options: LocalClientOptions): LocalSessionClient {
  return new LocalSessionClient(options)
}
