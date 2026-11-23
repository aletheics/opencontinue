import type { PermissionGate, Tool, ToolContext } from "@opencontinue/tools"

export type PermissionMode = "ask" | "auto" | "readonly"

export type PermissionRequest = {
  tool: string
  detail: string
  diff?: string
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
 * Bridges async tool authorization to the TUI. Read-only tools pass; writes
 * and shell commands wait for y/n. `a` remembers a tool for this session.
 */
export class TuiPermissionGate implements PermissionGate {
  pending: PermissionRequest | null = null
  private listener: (() => void) | undefined
  private readonly allowed = new Set<string>()

  constructor(private mode: PermissionMode) {}

  setMode(mode: PermissionMode): void {
    this.mode = mode
  }

  onChange(listener: () => void): void {
    this.listener = listener
  }

  async authorize(tool: Tool, input: unknown, context?: ToolContext): Promise<boolean> {
    if (this.mode === "auto") return true
    if (tool.capability === "read") return true
    if (this.mode === "readonly") return false
    if (this.allowed.has(tool.name)) return true

    let detail = permissionDetail(tool.name, input)
    let diff: string | undefined
    if (tool.preview && context) {
      try {
        const preview = await tool.preview(input, context)
        if (preview.detail) detail = preview.detail
        diff = preview.diff
      } catch {
        // Keep the basic detail when a preview cannot be computed.
      }
    }

    return new Promise<boolean>((resolve) => {
      this.pending = { tool: tool.name, detail, diff, resolve }
      this.listener?.()
    })
  }

  answer(approved: boolean, remember = false): void {
    const pending = this.pending
    if (!pending) return
    this.pending = null
    if (approved && remember) this.allowed.add(pending.tool)
    pending.resolve(approved)
    this.listener?.()
  }
}
