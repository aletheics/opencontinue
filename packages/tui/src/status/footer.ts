import { glyphs } from "../glyphs.js"
import type { PermissionMode } from "../permissions/types.js"
import { charWidth, textWidth } from "../transcript/format/wrap.js"

function modeLabel(mode: PermissionMode): string {
  const glyph =
    mode === "plan" ? glyphs.plan : mode === "auto" ? glyphs.auto : glyphs.confirm
  return `${glyph} ${mode.charAt(0).toUpperCase()}${mode.slice(1)}`
}

function truncateToWidth(text: string, width: number): string {
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

export type FooterLayout = {
  left: string
  right: string
}

/**
 * Compact footer: mode first, then branch and interrupt hint. Reasoning is
 * shown only when non-default; help only while idle. Low-priority fields are
 * dropped before the mode is ever clipped.
 */
export function footerLayout(options: {
  mode: PermissionMode
  branch?: string
  reasoning?: string
  busy: boolean
  columns: number
}): FooterLayout {
  let left = modeLabel(options.mode)
  if (options.branch) left += ` · ${options.branch}`
  if (options.busy) left += " · esc to interrupt"

  const rightParts: string[] = []
  if (options.reasoning && !options.busy) rightParts.push(options.reasoning)
  if (!options.busy) rightParts.push(`${glyphs.approval} help`)

  const fits = () => {
    const rightWidth = rightParts.length > 0 ? textWidth(rightParts.join(" · ")) + 2 : 0
    return textWidth(left) + rightWidth <= options.columns
  }

  while (rightParts.length > 0 && !fits()) rightParts.pop()
  if (!fits()) left = truncateToWidth(left, options.columns)

  return { left, right: rightParts.join(" · ") }
}
