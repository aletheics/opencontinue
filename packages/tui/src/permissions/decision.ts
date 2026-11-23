import type { PermissionMode } from "./types.js"

export type PermissionDecision = "allow" | "deny" | "ask"

/**
 * Tool names remembered with `a` win over the session mode.
 */
export function permissionDecision(
  mode: PermissionMode,
  tool: string,
  allowedTools: ReadonlySet<string>,
): PermissionDecision {
  if (allowedTools.has(tool)) return "allow"
  if (mode === "auto") return "allow"
  if (mode === "readonly") return "deny"
  return "ask"
}
