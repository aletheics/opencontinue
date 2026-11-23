import { glyphs } from "../glyphs.js"
import { modeName, type PermissionMode } from "../permissions/types.js"
import { theme } from "../theme.js"
import { textWidth, truncateToWidth } from "../transcript/format/wrap.js"

export function modeLabel(mode: PermissionMode): string {
  const glyph = mode === "auto" ? glyphs.auto : mode === "plan" ? glyphs.plan : glyphs.confirm
  return `${glyph} ${modeName(mode)}`
}

/** Auto is warm gold, Plan is soft blue, Manual stays neutral. */
export function modeTint(mode: PermissionMode): string | undefined {
  if (mode === "auto") return theme.tool
  if (mode === "plan") return theme.info
  return theme.textSecondary
}

export type FooterLayout = {
  left: string
  right: string
}

/**
 * Status bar: mode on the left; branch and help on the right. Help drops
 * first, then branch, then the mode is clipped, so narrow terminals never
 * wrap or collide.
 */
export function footerLayout(options: {
  mode: PermissionMode
  branch?: string
  columns: number
}): FooterLayout {
  const left = modeLabel(options.mode)
  const rightParts = [options.branch, `${glyphs.approval} help`].filter((part): part is string =>
    Boolean(part),
  )

  const right = () => rightParts.join(" · ")
  const fits = () => textWidth(left) + 2 + textWidth(right()) <= options.columns

  while (rightParts.length > 0 && !fits()) rightParts.pop()

  const safeRight = right()
  if (safeRight) return { left, right: safeRight }

  return {
    left: truncateToWidth(left, Math.max(1, options.columns)),
    right: "",
  }
}
