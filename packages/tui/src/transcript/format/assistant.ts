import { theme } from "../../theme.js"
import type { Line, Span } from "./line.js"
import { lineFromSpans, parseInline, spanWidth, wrapSpans } from "./inline.js"
import { wrapText } from "./wrap.js"

function baseSpan(text: string, color: string = theme.assistant): Span {
  return { text, color }
}

function spansOf(line: Line): Span[] {
  if (line.spans?.length) return line.spans
  return [
    {
      text: line.text,
      color: line.color,
      dim: line.dim,
      bold: line.bold,
      italic: line.italic,
      underline: line.underline,
      strikethrough: line.strikethrough,
      backgroundColor: line.backgroundColor,
    },
  ]
}

function pushPrefixed(
  lines: Line[],
  prefix: Span[],
  content: Span[],
  width: number,
  fallbackColor: string = theme.assistant,
): void {
  const contentWidth = Math.max(1, width - spanWidth(prefix))
  const indent = " ".repeat(spanWidth(prefix))
  for (const [index, spans] of wrapSpans(content, contentWidth).entries()) {
    lines.push(
      lineFromSpans(
        index === 0
          ? [...prefix, ...spans]
          : [baseSpan(indent, fallbackColor), ...spans],
        fallbackColor,
      ),
    )
  }
}

/**
 * Markdown-style assistant output. Styling is line-level with inline spans
 * for code, bold, italic, strikethrough, and links.
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
      const content = parseInline(heading[2] ?? "", {
        color: theme.assistant,
        bold: true,
      })
      for (const spans of wrapSpans(content, Math.max(10, width))) {
        lines.push(lineFromSpans(spans))
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
      pushPrefixed(
        lines,
        [{ text: "▎ ", color: theme.muted, dim: true }],
        parseInline(quote[1] ?? "", { italic: true }),
        width,
      )
      continue
    }

    const task = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (task) {
      const box = task[2]?.toLowerCase() === "x" ? "[x]" : "[ ]"
      pushPrefixed(
        lines,
        [baseSpan(`${task[1] ?? ""}- ${box} `)],
        parseInline(task[3] ?? ""),
        width,
      )
      continue
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bullet) {
      pushPrefixed(
        lines,
        [baseSpan(`${bullet[1] ?? ""}- `)],
        parseInline(bullet[2] ?? ""),
        width,
      )
      continue
    }

    const numbered = line.match(/^(\s*)(\d+[.)])\s+(.*)$/)
    if (numbered) {
      pushPrefixed(
        lines,
        [baseSpan(`${numbered[1] ?? ""}${numbered[2]} `)],
        parseInline(numbered[3] ?? ""),
        width,
      )
      continue
    }

    for (const spans of wrapSpans(parseInline(line), Math.max(10, width))) {
      lines.push(lineFromSpans(spans))
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
    const content = spansOf(line)
    if (!dotted) {
      dotted = true
      return lineFromSpans([baseSpan("● "), ...content])
    }
    return lineFromSpans([baseSpan("  "), ...content])
  })
}
