import { theme } from "../../theme.js"
import type { Line } from "./line.js"
import { wrapText } from "./wrap.js"

function pushPrefixed(
  lines: Line[],
  prefix: string,
  text: string,
  width: number,
  color: string = theme.assistant,
): void {
  const contentWidth = Math.max(10, width - prefix.length)
  wrapText(text, contentWidth).forEach((part, index) => {
    lines.push({
      text: `${index === 0 ? prefix : " ".repeat(prefix.length)}${part}`,
      color,
    })
  })
}

/**
 * Markdown-style assistant output. Styling is line-level because the renderer
 * is a line buffer, not a span tree.
 */
export function formatAssistantLines(text: string, width: number): Line[] {
  const lines: Line[] = []
  let codeLanguage = ""
  let inCode = false

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\t/g, "  ")
    const fence = line.match(/^\s*```\s*([\w.+-]*)\s*$/)

    if (fence) {
      if (inCode) {
        lines.push({ text: "└─", color: theme.muted, dim: true })
        inCode = false
      } else {
        codeLanguage = fence[1] ?? ""
        lines.push({
          text: `┌─ ${codeLanguage || "code"}`,
          color: theme.muted,
          dim: true,
        })
        inCode = true
      }
      continue
    }

    if (inCode) {
      for (const part of wrapText(
        line.length === 0 ? " " : line,
        Math.max(10, width - 2),
      )) {
        lines.push({ text: `│ ${part}`, color: theme.muted, dim: true })
      }
      continue
    }

    if (line.trim() === "") {
      lines.push({ text: "", color: theme.assistant })
      continue
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/)
    if (heading) {
      const markerWidth = (heading[1]?.length ?? 1) + 1
      for (const part of wrapText(
        heading[2] ?? "",
        Math.max(10, width - markerWidth),
      )) {
        lines.push({ text: part, color: theme.assistant, bold: true })
      }
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      lines.push({
        text: "---",
        color: theme.muted,
        dim: true,
      })
      continue
    }

    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      pushPrefixed(lines, "▎ ", quote[1] ?? "", width, theme.muted)
      continue
    }

    const task = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (task) {
      const box = task[2]?.toLowerCase() === "x" ? "[x]" : "[ ]"
      pushPrefixed(lines, `${task[1] ?? ""}- ${box} `, task[3] ?? "", width)
      continue
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bullet) {
      pushPrefixed(lines, `${bullet[1] ?? ""}- `, bullet[2] ?? "", width)
      continue
    }

    const numbered = line.match(/^(\s*)(\d+[.)])\s+(.*)$/)
    if (numbered) {
      pushPrefixed(
        lines,
        `${numbered[1] ?? ""}${numbered[2]} `,
        numbered[3] ?? "",
        width,
      )
      continue
    }

    for (const part of wrapText(line, width)) {
      lines.push({ text: part, color: theme.assistant })
    }
  }

  return lines
}

/**
 * Claude Code puts the whole markdown body in a two-column content area next
 * to the assistant dot: the first content line starts with `● ` and every
 * following line is indented by two spaces. Blank lines stay empty.
 */
export function assistantBlock(text: string, width: number): Line[] {
  const body = formatAssistantLines(text, Math.max(10, width - 2))
  let dotted = false

  return body.map((line) => {
    if (line.text.length === 0) return line
    if (!dotted) {
      dotted = true
      return { ...line, text: `● ${line.text}` }
    }
    return { ...line, text: `  ${line.text}` }
  })
}
