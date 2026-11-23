import { theme } from "../../theme.js"
import { codeLanguageLabel, highlightCodeLine, type HighlightState } from "./highlight.js"
import type { Line, Span } from "./line.js"
import { lineFromSpans, parseInline, pushPrefixed, wrapSpans } from "./inline.js"
import { formatTable, isTableStart } from "./table.js"

function baseSpan(text: string, color: string | undefined = theme.assistant): Span {
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

type Block =
  | { kind: "code"; language: string; lines: string[] }
  | { kind: "table"; lines: string[] }
  | { kind: "heading"; level: number; text: string }
  | { kind: "list"; lines: string[] }
  | { kind: "quote"; lines: string[] }
  | { kind: "rule" }
  | { kind: "paragraph"; lines: string[] }

function isListLine(line: string): boolean {
  return /^\s*(?:[-*+]|\d+[.)])\s+/.test(line)
}

function fenceMatch(line: string): RegExpMatchArray | null {
  return line.match(/^\s*```\s*([\w.+-]*)\s*$/)
}

function isRule(line: string): boolean {
  return /^\s*([-*_])(\s*\1){2,}\s*$/.test(line)
}

function isBlockStart(lines: string[], index: number): boolean {
  const line = lines[index] ?? ""
  return (
    fenceMatch(line) !== null ||
    isTableStart(lines, index) ||
    /^\s{0,3}#{1,6}\s+/.test(line) ||
    isRule(line) ||
    /^\s*>/.test(line) ||
    isListLine(line)
  )
}

/**
 * Split markdown into top-level blocks. Blank lines are separators, not
 * content, so the renderer can give every block exactly one blank line.
 */
function parseBlocks(source: string): Block[] {
  const lines = source
    .replace(/\r\n/g, "\n")
    .split("\n")
    .map((line) => line.replace(/\t/g, "  "))
  const blocks: Block[] = []
  let index = 0

  while (index < lines.length) {
    const line = lines[index] ?? ""
    if (line.trim() === "") {
      index++
      continue
    }

    const fence = fenceMatch(line)
    if (fence) {
      const language = fence[1] ?? ""
      const code: string[] = []
      index++
      while (index < lines.length && !/^\s*```\s*$/.test(lines[index] ?? "")) {
        code.push(lines[index] ?? "")
        index++
      }
      if (index < lines.length) index++
      while (code.length > 0 && (code[0] ?? "").trim() === "") code.shift()
      while (code.length > 0 && (code.at(-1) ?? "").trim() === "") code.pop()
      blocks.push({ kind: "code", language, lines: code })
      continue
    }

    if (isTableStart(lines, index)) {
      const table = [lines[index]!, lines[index + 1]!]
      index += 2
      while (index < lines.length) {
        const row = lines[index] ?? ""
        if (row.trim() === "" || !row.includes("|")) break
        table.push(row)
        index++
      }
      blocks.push({ kind: "table", lines: table })
      continue
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/)
    if (heading) {
      blocks.push({
        kind: "heading",
        level: heading[1]?.length ?? 1,
        text: heading[2] ?? "",
      })
      index++
      continue
    }

    if (isRule(line)) {
      blocks.push({ kind: "rule" })
      index++
      continue
    }

    if (/^\s*>/.test(line)) {
      const quote: string[] = []
      while (index < lines.length && /^\s*>/.test(lines[index] ?? "")) {
        quote.push(lines[index] ?? "")
        index++
      }
      blocks.push({ kind: "quote", lines: quote })
      continue
    }

    if (isListLine(line)) {
      const list: string[] = []
      while (index < lines.length) {
        const current = lines[index] ?? ""
        if (current.trim() === "") break
        if (!isListLine(current) && !/^\s{2,}/.test(current)) break
        list.push(current)
        index++
      }
      blocks.push({ kind: "list", lines: list })
      continue
    }

    const paragraph: string[] = []
    while (index < lines.length) {
      if ((lines[index] ?? "").trim() === "") break
      if (isBlockStart(lines, index)) break
      paragraph.push(lines[index] ?? "")
      index++
    }
    blocks.push({ kind: "paragraph", lines: paragraph })
  }

  return blocks
}

function headingStyle(level: number): {
  color: string | undefined
  bold?: boolean
  dim?: boolean
} {
  if (level <= 2) return { color: theme.assistant, bold: true }
  if (level === 3) return { color: theme.assistant }
  if (level === 4) return { color: theme.textSecondary, bold: true }
  if (level === 5) return { color: theme.textSecondary }
  return { color: theme.textSecondary, dim: true }
}

function renderHeading(level: number, text: string, width: number): Line[] {
  const content = parseInline(text, headingStyle(level))
  return wrapSpans(content, Math.max(10, width)).map((spans) => lineFromSpans(spans))
}

function renderList(lines: string[], width: number): Line[] {
  const rendered: Line[] = []

  for (const line of lines) {
    const task = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (task) {
      const box = task[2]?.toLowerCase() === "x" ? "[x]" : "[ ]"
      pushPrefixed(
        rendered,
        [baseSpan(`${task[1] ?? ""}- ${box} `)],
        parseInline(task[3] ?? ""),
        width,
      )
      continue
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bullet) {
      pushPrefixed(
        rendered,
        [baseSpan(`${bullet[1] ?? ""}- `)],
        parseInline(bullet[2] ?? ""),
        width,
      )
      continue
    }

    const numbered = line.match(/^(\s*)(\d+[.)])\s+(.*)$/)
    if (numbered) {
      pushPrefixed(
        rendered,
        [baseSpan(`${numbered[1] ?? ""}${numbered[2]} `)],
        parseInline(numbered[3] ?? ""),
        width,
      )
      continue
    }

    for (const spans of wrapSpans(parseInline(line), Math.max(10, width))) {
      rendered.push(lineFromSpans(spans))
    }
  }

  return rendered
}

function renderQuote(lines: string[], width: number): Line[] {
  const rendered: Line[] = []

  for (const line of lines) {
    const quote = line.match(/^\s*>\s?(.*)$/)
    pushPrefixed(
      rendered,
      [{ text: "▎ ", color: theme.muted, dim: true }],
      parseInline(quote?.[1] ?? "", { italic: true }),
      width,
    )
  }

  return rendered
}

function renderCode(language: string, lines: string[], width: number): Line[] {
  const rendered: Line[] = []
  const rule: Span = { text: "▎ ", color: theme.borderSubtle }
  const label = codeLanguageLabel(language)

  if (label) {
    rendered.push(lineFromSpans([rule, { text: label, color: theme.textMuted, dim: true }]))
  }

  const contentWidth = Math.max(1, width - 2)
  let highlightState: HighlightState = { inBlockComment: false }

  for (const line of lines) {
    if (line.length === 0) {
      rendered.push(lineFromSpans([rule]))
      continue
    }
    const highlighted = highlightCodeLine(line, language, highlightState)
    highlightState = highlighted.state
    for (const spans of wrapSpans(highlighted.spans, contentWidth, {
      breakWords: false,
    })) {
      rendered.push(lineFromSpans([rule, ...spans]))
    }
  }

  return rendered
}

const CJK_EDGE = /[　-〿぀-ヿ㐀-䶿一-鿿豈-﫿＀-￯]/

function joinsWithoutSpace(left: string, right: string): boolean {
  const before = left.at(-1) ?? ""
  const after = right.charAt(0)
  return CJK_EDGE.test(before) && CJK_EDGE.test(after)
}

/**
 * Markdown soft line breaks join a paragraph into one flowing line. A
 * trailing backslash or two spaces keeps an intentional hard break.
 */
function joinParagraph(lines: string[]): string[] {
  const paragraphs: string[] = []
  let current = ""

  const flush = () => {
    if (!current) return
    paragraphs.push(current)
    current = ""
  }

  for (const raw of lines) {
    const hardBreak = /\\\s*$/.test(raw) || /\s{2,}$/.test(raw)
    let line = raw.trim()
    if (line.endsWith("\\")) line = line.slice(0, -1).trimEnd()
    if (!line) continue

    if (!current) current = line
    else current += `${joinsWithoutSpace(current, line) ? "" : " "}${line}`
    if (hardBreak) flush()
  }

  flush()
  return paragraphs
}

function renderBlock(block: Block, width: number): Line[] {
  switch (block.kind) {
    case "heading":
      return renderHeading(block.level, block.text, width)
    case "list":
      return renderList(block.lines, width)
    case "quote":
      return renderQuote(block.lines, width)
    case "code":
      return renderCode(block.language, block.lines, width)
    case "table":
      return formatTable(block.lines, width)
    case "rule":
      return [
        {
          text: "─".repeat(Math.max(1, width)),
          color: theme.borderSubtle,
          dim: true,
        },
      ]
    case "paragraph":
      return joinParagraph(block.lines).flatMap((paragraph) =>
        wrapSpans(parseInline(paragraph), Math.max(10, width)).map((spans) => lineFromSpans(spans)),
      )
  }
}

/**
 * Markdown-style assistant output. Top-level blocks are separated by exactly
 * one blank line, so headings, lists, tables, and code stay readable.
 */
export function formatAssistantLines(text: string, width: number): Line[] {
  const normalized = text.replace(/\r\n/g, "\n")
  const rendered = parseBlocks(normalized)
    .map((block) => renderBlock(block, Math.max(10, width)))
    .filter((lines) => lines.length > 0)

  const result: Line[] = []
  for (const lines of rendered) {
    if (result.length > 0) result.push({ text: "", color: theme.assistant })
    result.push(...lines)
  }

  // Streaming commits chunks at paragraph boundaries; keep one trailing blank
  // line so the next chunk stays separated without reprinting extra blanks.
  const endsWithBlank = normalized.split("\n").at(-1)?.trim() === ""
  if (endsWithBlank && result.length > 0) {
    result.push({ text: "", color: theme.assistant })
  }
  return result
}

/**
 * Claude Code puts the whole markdown body in a two-column content area next
 * to the assistant dot: the first content line starts with `● ` and every
 * following line is indented by two spaces. Blank lines stay empty.
 */
export function assistantBlock(
  text: string,
  width: number,
  options: { dotted?: boolean } = {},
): Line[] {
  const body = formatAssistantLines(text, Math.max(10, width - 2))
  const dotted = options.dotted ?? true
  let first = true

  return body.map((line) => {
    if (line.text.length === 0) return line
    const content = spansOf(line)
    if (!dotted) {
      return lineFromSpans([baseSpan("  "), ...content])
    }
    if (first) {
      first = false
      return lineFromSpans([baseSpan("● "), ...content])
    }
    return lineFromSpans([baseSpan("  "), ...content])
  })
}
