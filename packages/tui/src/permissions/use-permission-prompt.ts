import type { OpenContinueClient } from "@opencontinue/client"
import type { SessionEvent } from "@opencontinue/protocol"
import { useRef, useState } from "react"

import { permissionDecision } from "./decision.js"
import type { PermissionMode, PermissionPromptState } from "./types.js"

export type PermissionControllerOptions = {
  getClient: () => OpenContinueClient | null
  getSessionId: () => string | null
  getMode: () => PermissionMode
}

export function usePermissionPrompt({
  getClient,
  getSessionId,
  getMode,
}: PermissionControllerOptions) {
  const [permission, setPermission] = useState<PermissionPromptState | null>(null)
  const allowedToolsRef = useRef<Set<string>>(new Set())

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
    if (approved && remember) allowedToolsRef.current.add(request.tool)
    resolve(request.requestId, approved)
    setPermission(null)
  }

  const handleRequest = (
    event: Extract<SessionEvent, { type: "permission.requested" }>,
  ): void => {
    const decision = permissionDecision(
      getMode(),
      event.tool,
      allowedToolsRef.current,
    )
    if (decision === "allow") {
      resolve(event.requestId, true)
      return
    }
    if (decision === "deny") {
      resolve(event.requestId, false)
      return
    }

    setPermission({
      requestId: event.requestId,
      tool: event.tool,
      detail: event.detail ?? JSON.stringify(event.input).slice(0, 200),
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
    allowedToolsRef.current = new Set()
    setPermission(null)
  }

  return { permission, answer, handleRequest, handleResolved, reset }
}
