import type { OpenContinueClient } from "@opencontinue/client"
import type { SessionEvent } from "@opencontinue/protocol"
import { useState } from "react"

import type { PermissionPromptState } from "./types.js"

export type PermissionControllerOptions = {
  getClient: () => OpenContinueClient | null
  getSessionId: () => string | null
  getWorkspace?: () => string
}

/**
 * The runtime broker owns authorization. When it decides a request needs
 * approval it emits permission.requested; this controller only presents that
 * request and returns the user's answer.
 */
export function usePermissionPrompt({
  getClient,
  getSessionId,
  getWorkspace,
}: PermissionControllerOptions) {
  const [permission, setPermission] = useState<PermissionPromptState | null>(null)

  const resolve = (requestId: string, approved: boolean): void => {
    const client = getClient()
    const sessionId = getSessionId()
    if (client && sessionId) {
      void client.resolvePermission(sessionId, requestId, approved).catch(() => {})
    }
  }

  const answer = (approved: boolean, remember = false): void => {
    const request = permission
    if (!request) return
    if (approved && remember) {
      const client = getClient()
      const sessionId = getSessionId()
      if (client && sessionId) {
        void client.allowToolForSession?.(sessionId, request.tool)
      }
    }
    resolve(request.requestId, approved)
    setPermission(null)
  }

  const handleRequest = (
    event: Extract<SessionEvent, { type: "permission.requested" }>,
  ): void => {
    const input =
      typeof event.input === "object" && event.input !== null
        ? (event.input as Record<string, unknown>)
        : {}
    const cwd =
      event.tool === "bash"
        ? typeof input.cwd === "string"
          ? input.cwd
          : getWorkspace?.()
        : undefined

    setPermission({
      requestId: event.requestId,
      tool: event.tool,
      detail: event.detail ?? JSON.stringify(event.input).slice(0, 200),
      cwd,
      diff: event.diff,
    })
  }

  const handleResolved = (
    event: Extract<SessionEvent, { type: "permission.resolved" }>,
  ): void => {
    setPermission((current) =>
      current?.requestId === event.requestId ? null : current,
    )
  }

  const reset = (): void => {
    setPermission(null)
  }

  return { permission, answer, handleRequest, handleResolved, reset }
}
