import type { PermissionMode } from "@opencontinue/protocol"

export type { PermissionMode }

/** User-facing name for the internal `confirm` mode. */
export function modeName(mode: PermissionMode): string {
  if (mode === "auto") return "Auto"
  if (mode === "plan") return "Plan"
  return "Manual"
}

export type PermissionPromptState = {
  requestId: string
  tool: string
  detail: string
  cwd?: string
  diff?: string
}
