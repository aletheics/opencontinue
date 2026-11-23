import { PRODUCT_NAME } from "./brand.js"
import { glyphs } from "./glyphs.js"
import { theme } from "./theme.js"
import type { Line, Span } from "./transcript/format/line.js"
import { graphemeWidth, graphemes, textWidth, truncateToWidth } from "./transcript/format/wrap.js"

/**
 * Middle-shorten a workspace path while keeping its root and final segment,
 * so a narrow terminal still identifies the project.
 */
export function truncatePathMiddle(path: string, width: number): string {
  if (textWidth(path) <= width) return path
  if (width <= 1) return "…"

  const lastSeparator = Math.max(path.lastIndexOf("\\"), path.lastIndexOf("/"))
  const root = path.match(/^[A-Za-z]:[\\/]|^\//)?.[0] ?? ""
  const basename = lastSeparator >= 0 ? path.slice(lastSeparator + 1) : path
  if (!basename) return truncateToWidth(path, width)

  const separator = path.includes("\\") ? "\\" : "/"
  const middle = path.slice(root.length, lastSeparator >= 0 ? lastSeparator : path.length)
  const segments = middle.split(/[\\/]+/).filter(Boolean)

  let prefix = root
  for (const segment of segments) {
    const candidate = `${prefix}${segment}${separator}…${basename}`
    if (textWidth(candidate) > width) break
    prefix += `${segment}${separator}`
  }

  const shortened = `${prefix}…${basename}`
  if (textWidth(shortened) <= width) return shortened

  const room = width - textWidth(root) - 1
  if (room <= 0) return truncateToWidth(path, width)

  const tailParts = graphemes(basename)
  let tail = ""
  let used = 0
  for (let index = tailParts.length - 1; index >= 0; index--) {
    const grapheme = tailParts[index] ?? ""
    const size = graphemeWidth(grapheme)
    if (used + size > room) break
    tail = `${grapheme}${tail}`
    used += size
  }
  return `${root}…${tail}`
}

/** Display label for a non-default reasoning effort. */
export function formatEffort(effort: string | undefined): string | undefined {
  if (!effort || effort === "auto") return undefined
  return `${effort.charAt(0).toUpperCase()}${effort.slice(1)}`
}

/**
 * Model metadata on one line: model label (including any context-window
 * suffix), effort, then provider. Secondary fields drop before the model is
 * clipped.
 */
export function headerInfo(
  model: string,
  effort: string | undefined,
  provider: string,
  width: number,
): string {
  const candidates: Array<Array<string | undefined>> = [
    [model, effort, provider],
    [model, provider],
    [model],
  ]

  for (const parts of candidates) {
    const line = parts.filter(Boolean).join(" · ")
    if (textWidth(line) <= width) return line
  }

  return truncateToWidth(model, width)
}

/**
 * Three startup header lines: identity/version, model metadata, workspace.
 * The layout is shared by the inline banner, fullscreen header, and the
 * expanded transcript so all three stay identical.
 */
export function headerLines(options: {
  version: string
  model: string
  effort?: string
  provider: string
  workspace: string
  columns: number
}): Line[] {
  const width = Math.max(1, options.columns)
  const base = `${glyphs.brand} ${PRODUCT_NAME}`
  const version = `v${options.version}`
  const showVersion = textWidth(`${base}  ${version}`) <= width

  const title: Span[] = [
    { text: glyphs.brand, color: theme.brand },
    { text: ` ${PRODUCT_NAME}`, color: theme.brand, bold: true },
  ]
  if (showVersion) {
    title.push({ text: `  ${version}`, color: theme.textMuted, dim: true })
  }

  return [
    { text: title.map((span) => span.text).join(""), spans: title },
    {
      text: headerInfo(options.model, options.effort, options.provider, width),
      color: theme.textSecondary,
    },
    {
      text: truncatePathMiddle(options.workspace, width),
      color: theme.textMuted,
    },
  ]
}
