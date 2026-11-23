import { randomUUID } from "node:crypto"

import type { SessionStore } from "@opencontinue/core"
import type {
  PermissionMode,
  PermissionPolicy,
} from "@opencontinue/protocol"
import type { PermissionGate, Tool, ToolContext } from "@opencontinue/tools"

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
  resolve: (approved: boolean) => void
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

  getPolicy(): PermissionPolicy {
    return {
      allow: [...this.policy.allow],
      ask: [...this.policy.ask],
      deny: [...this.policy.deny],
    }
  }

  /** Remember a tool for the rest of this broker's session. */
  allowForSession(tool: string): void {
    if (this.policy.allow.includes(tool)) return
    this.policy = { ...this.policy, allow: [...this.policy.allow, tool] }
  }

  async authorize(tool: Tool, input: unknown, context: ToolContext): Promise<boolean> {
    if (this.policy.deny.includes(tool.name)) return false

    if (this.mode === "plan") {
      return tool.capability === "read" && !this.policy.ask.includes(tool.name)
    }

    if (this.policy.allow.includes(tool.name)) return true

    const explicitAsk = this.policy.ask.includes(tool.name)
    if (!explicitAsk && tool.capability === "read") return true
    if (this.mode === "auto" && !explicitAsk) return true

    return this.request(tool, input, context)
  }

  private async request(tool: Tool, input: unknown, context: ToolContext): Promise<boolean> {
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

    const requestId = randomUUID()
    const decision = new Promise<boolean>((resolve) => {
      const timer = setTimeout(() => {
        this.pending.delete(requestId)
        this.store.append(context.sessionId, {
          type: "permission.resolved",
          requestId,
          approved: false,
        })
        resolve(false)
      }, 5 * 60_000)

      this.pending.set(requestId, {
        sessionId: context.sessionId,
        resolve: (approved) => {
          clearTimeout(timer)
          resolve(approved)
        },
      })
    })

    this.store.append(context.sessionId, {
      type: "permission.requested",
      requestId,
      tool: tool.name,
      capability: tool.capability,
      input,
      detail,
      ...(diff === undefined ? {} : { diff }),
    })

    return decision
  }

  resolve(requestId: string, approved: boolean, sessionId?: string): boolean {
    const pending = this.pending.get(requestId)
    if (!pending) return false
    if (sessionId && pending.sessionId !== sessionId) return false

    this.pending.delete(requestId)
    this.store.append(pending.sessionId, { type: "permission.resolved", requestId, approved })
    pending.resolve(approved)
    return true
  }
}
