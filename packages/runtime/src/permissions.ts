import { randomUUID } from "node:crypto"

import type { SessionStore } from "@opencontinue/core"
import type { PermissionGate, Tool, ToolContext } from "@opencontinue/tools"

export type PermissionMode = "ask" | "auto" | "readonly"

export type PermissionPolicy = {
  allow: string[]
  ask: string[]
  deny: string[]
}

const EMPTY_POLICY: PermissionPolicy = { allow: [], ask: [], deny: [] }

type Pending = {
  sessionId: string
  resolve: (approved: boolean) => void
}

/**
 * Server-side permission broker.
 *
 * Precedence: deny > allow > explicit ask > capability/mode defaults.
 * In `ask` mode it emits a durable `permission.requested` event and waits
 * for a client decision.
 */
export class PermissionBroker implements PermissionGate {
  private readonly pending = new Map<string, Pending>()

  constructor(
    private readonly store: SessionStore,
    private readonly mode: PermissionMode,
    private readonly policy: PermissionPolicy = EMPTY_POLICY,
  ) {}

  async authorize(tool: Tool, input: unknown, context: ToolContext): Promise<boolean> {
    if (this.policy.deny.includes(tool.name)) return false
    if (this.policy.allow.includes(tool.name)) return true

    const explicitAsk = this.policy.ask.includes(tool.name)
    if (!explicitAsk && tool.capability === "read") return true
    if (this.mode === "readonly") return false
    if (this.mode === "auto" && !explicitAsk) return true

    return this.request(tool, input, context)
  }

  private request(tool: Tool, input: unknown, context: ToolContext): Promise<boolean> {
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
