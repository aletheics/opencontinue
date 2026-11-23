export type RunToolResult = {
  name: string
  status: "running" | "done" | "failed"
  input: unknown
  diff?: string
  error?: string
}

function stringField(value: unknown, key: string): string | undefined {
  if (typeof value !== "object" || value === null) return undefined
  const field = (value as Record<string, unknown>)[key]
  return typeof field === "string" ? field : undefined
}

/**
 * Evidence-based turn summary. Counts only what the tools actually reported:
 * successfully written/edited paths and bash commands (with failures).
 */
export function summarizeRun(tools: RunToolResult[]): string | undefined {
  const files = new Set<string>()
  let commands = 0
  let failedCommands = 0

  for (const tool of tools) {
    if (tool.name === "write" || tool.name === "edit") {
      if (tool.status !== "done") continue
      const path = stringField(tool.input, "path")
      if (path) files.add(path)
      continue
    }
    if (tool.name === "bash") {
      commands++
      if (tool.status === "failed") failedCommands++
    }
  }

  const parts: string[] = []
  if (files.size > 0) {
    parts.push(
      `${files.size} file${files.size === 1 ? "" : "s"} changed`,
    )
  }
  if (commands > 0) {
    const failed =
      failedCommands > 0 ? ` (${failedCommands} failed)` : ""
    parts.push(`${commands} command${commands === 1 ? "" : "s"}${failed}`)
  }

  return parts.length > 0 ? parts.join(" · ") : undefined
}
