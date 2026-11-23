import { randomUUID } from "node:crypto"

import type { SessionStore } from "@opencontinue/core"
import type {
  PermissionMode,
  PermissionPolicy,
} from "@opencontinue/protocol"
import type {
  PermissionDecision,
  PermissionGate,
  Tool,
  ToolContext,
} from "@opencontinue/tools"

export type { PermissionMode, PermissionPolicy }

export const PERMISSION_MODES: readonly PermissionMode[] = [
  "plan",
  "confirm",
  "auto",
]

/**
 * Canonical modes are plan, confirm, and auto. Config files written before
 * the rename used readonly and ask; map them so existing projects keep working.
 */
export function normalizePermissionMode(value: unknown): PermissionMode | undefined {
  if (value === "plan" || value === "readonly") return "plan"
  if (value === "confirm" || value === "ask") return "confirm"
  if (value === "auto") return "auto"
  return undefined
}

const EMPTY_POLICY: PermissionPolicy = { allow: [], ask: [], deny: [] }

type Pending = {
  sessionId: string
  settle: (approved: boolean) => void
}

const HIGH_RISK_COMMAND: RegExp[] = [
  /(^|[;&|]\s*)(rm|rmdir|del|erase|unlink|shred)\s/i,
  /\b(mkfs(?:\.\w+)?|dd)\s/i,
  /\b(shutdown|reboot|poweroff|halt)\b/i,
  /\b(taskkill|pkill|killall)\b/i,
  /\b(sudo|doas|runas)\b/i,
  /\bgit\s+(reset\s+--hard|clean\s+-[a-z]*f|checkout\s+--\s+\.)/i,
  /\bgit\s+push\b[\s\S]*--force/i,
  /\b(chmod|chown)\s+-R\b/i,
  /\|\s*(sh|bash|zsh|pwsh|powershell|cmd)(\s|$)/i,
  /\b(curl|wget|iwr|Invoke-WebRequest)\b[\s\S]*\|\s*(sh|bash|iex|Invoke-Expression)\b/i,
  /\b(Invoke-Expression|iex)\b/i,
  /\bRemove-Item\b/i,
  /\bformat\s+[a-z]:/i,
  /:\(\)\s*\{\s*:\s*\|\s*:\s*&\s*\}\s*;\s*:/,
]

/** Conservative shell-command risk check used by Auto mode. */
export function isHighRiskCommand(command: string): boolean {
  return HIGH_RISK_COMMAND.some((pattern) => pattern.test(command))
}

function commandOf(input: unknown): string {
  if (typeof input !== "object" || input === null) return ""
  const command = (input as Record<string, unknown>).command
  return typeof command === "string" ? command : ""
}

export function permissionDetail(name: string, input: unknown): string {
  const value =
    typeof input === "object" && input !== null ? (input as Record<string, unknown>) : {}
  const text = (key: string): string | undefined =>
    typeof value[key] === "string" ? (value[key] as string) : undefined

  const detail =
    name === "bash"
      ? text("command")
      : text("path") ?? text("pattern") ?? text("query") ?? JSON.stringify(input)

  return (detail ?? "").replace(/\s+/g, " ").trim()
}

/**
 * Server-side permission broker.
 *
 * Precedence: deny > allow > explicit ask > capability/mode defaults.
 * `plan` is a hard read-only policy with no prompts. `confirm` emits a
 * durable `permission.requested` event for protected tools. `auto` allows
 * them unless the project explicitly asks.
 */
export class PermissionBroker implements PermissionGate {
  private readonly pending = new Map<string, Pending>()
  private readonly sessionAllow = new Map<string, Set<string>>()
  private mode: PermissionMode
  private policy: PermissionPolicy

  constructor(
    private readonly store: SessionStore,
    mode: PermissionMode,
    policy: PermissionPolicy = EMPTY_POLICY,
  ) {
    this.mode = mode
    this.policy = { ...policy }
  }

  setMode(mode: PermissionMode): void {
    this.mode = mode
  }

  getMode(): PermissionMode {
    return this.mode
  }

  getPolicy(sessionId?: string): PermissionPolicy {
    const allow = [...this.policy.allow]
    if (sessionId) {
      for (const tool of this.sessionAllow.get(sessionId) ?? []) {
        if (!allow.includes(tool)) allow.push(tool)
      }
    }
    return {
      allow,
      ask: [...this.policy.ask],
      deny: [...this.policy.deny],
    }
  }

  /** Remember a tool for one session only. */
  allowForSession(sessionId: string, tool: string): void {
    const allowed = this.sessionAllow.get(sessionId) ?? new Set<string>()
    allowed.add(tool)
    this.sessionAllow.set(sessionId, allowed)
  }

  private allowedFor(sessionId: string, tool: string): boolean {
    return (
      this.policy.allow.includes(tool) ||
      this.sessionAllow.get(sessionId)?.has(tool) === true
    )
  }

  async authorize(
    tool: Tool,
    input: unknown,
    context: ToolContext,
  ): Promise<PermissionDecision> {
    if (context.signal?.aborted) return { approved: false }
    if (this.policy.deny.includes(tool.name)) return { approved: false }

    if (this.mode === "plan") {
      const approved =
        tool.capability === "read" && !this.policy.ask.includes(tool.name)
      return approved ? { approved, reason: "read" } : { approved: false }
    }

    if (this.allowedFor(context.sessionId, tool.name)) {
      return { approved: true, reason: "allow" }
    }

    const explicitAsk = this.policy.ask.includes(tool.name)
    if (!explicitAsk && tool.capability === "read") {
      return { approved: true, reason: "read" }
    }
    if (this.mode === "auto" && !explicitAsk) {
      const highRisk =
        tool.name === "bash" && isHighRiskCommand(commandOf(input))
      if (!highRisk) return { approved: true, reason: "auto" }

      const approved = await this.request(tool, input, context)
      return approved ? { approved: true, reason: "user" } : { approved: false }
    }

    const approved = await this.request(tool, input, context)
    return approved ? { approved: true, reason: "user" } : { approved: false }
  }

  private async request(tool: Tool, input: unknown, context: ToolContext): Promise<boolean> {
    if (context.signal?.aborted) return false

    let detail = permissionDetail(tool.name, input)
    let diff: string | undefined
    if (tool.preview) {
      try {
        const preview = await tool.preview(input, context)
        if (preview.detail) detail = preview.detail
        diff = preview.diff
      } catch {
        // Keep the basic detail when a preview cannot be computed.
      }
    }
    if (context.signal?.aborted) return false

    const requestId = randomUUID()
    this.store.append(context.sessionId, {
      type: "permission.requested",
      requestId,
      tool: tool.name,
      capability: tool.capability,
      input,
      detail,
      ...(diff === undefined ? {} : { diff }),
    })

    return await new Promise<boolean>((resolve) => {
      let settled = false
      let timer: ReturnType<typeof setTimeout> | undefined

      const onAbort = () => settle(false)
      const settle = (approved: boolean) => {
        if (settled) return
        settled = true
        if (timer) clearTimeout(timer)
        context.signal?.removeEventListener("abort", onAbort)
        this.pending.delete(requestId)
        this.store.append(context.sessionId, {
          type: "permission.resolved",
          requestId,
          approved,
        })
        resolve(approved)
      }

      timer = setTimeout(() => settle(false), 5 * 60_000)
      this.pending.set(requestId, {
        sessionId: context.sessionId,
        settle,
      })

      if (context.signal?.aborted) {
        settle(false)
        return
      }
      context.signal?.addEventListener("abort", onAbort, { once: true })
    })
  }

  resolve(requestId: string, approved: boolean, sessionId?: string): boolean {
    const pending = this.pending.get(requestId)
    if (!pending) return false
    if (sessionId && pending.sessionId !== sessionId) return false

    pending.settle(approved)
    return true
  }
}
