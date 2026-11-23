import type { PermissionMode } from "@opencontinue/protocol"

export type { PermissionMode }

export type PermissionPromptState = {
  requestId: string
  tool: string
  detail: string
  cwd?: string
  diff?: string
}
