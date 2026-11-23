export type PermissionMode = "ask" | "auto" | "readonly"

export type PermissionPromptState = {
  requestId: string
  tool: string
  detail: string
  diff?: string
}
