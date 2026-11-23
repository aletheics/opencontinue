import { charWidth, textWidth } from "./transcript/format/wrap.js"

export function workspaceName(path: string): string {
  const parts = path.split(/[\\/]+/).filter(Boolean)
  return parts.at(-1) ?? path
}

export function truncateToWidth(text: string, width: number): string {
  if (textWidth(text) <= width) return text
  if (width <= 1) return "…"

  let result = ""
  let used = 0
  for (const char of text) {
    const size = charWidth(char)
    if (used + size > width - 1) break
    result += char
    used += size
  }
  return `${result}…`
}

/**
 * Compact header metadata: model and provider first, then the workspace
 * basename, then the branch. Lower-priority fields are dropped before the
 * line is truncated.
 */
export function headerMeta(
  model: string,
  provider: string,
  workspace: string,
  branch: string | undefined,
  width: number,
): string {
  const name = workspaceName(workspace)
  const candidates: Array<Array<string | undefined>> = [
    [model, provider, name, branch],
    [model, provider, name],
    [model, provider],
    [model],
  ]

  for (const parts of candidates) {
    const line = parts.filter(Boolean).join(" · ")
    if (textWidth(line) <= width) return line
  }

  return truncateToWidth([model, provider].filter(Boolean).join(" · "), width)
}
