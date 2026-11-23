import { theme } from "../../theme.js"
import { lineFromSpans, parseInline, pushPrefixed, spanWidth, wrapSpans } from "./inline.js"
import type { Line, Span } from "./line.js"

export type TableAlignment = "left" | "center" | "right"

const CELL_GAP = 2
const MIN_COLUMN = 1
const MIN_READABLE_COLUMN = 8

function hasTablePipe(line: string): boolean {
  return line.includes("|")
}

/** Split a GFM table row, honoring escaped pipes and optional outer pipes. */
export function splitTableRow(row: string): string[] {
  let text = row.trim()
  if (text.startsWith("|")) text = text.slice(1)
  if (text.endsWith("|") && !text.endsWith("\\|")) text = text.slice(0, -1)

  const cells: string[] = []
  let cell = ""
  for (let index = 0; index < text.length; index++) {
    const char = text[index] ?? ""
    if (char === "\\" && text[index + 1] === "|") {
      cell += "|"
      index++
      continue
    }
    if (char === "|") {
      cells.push(cell.trim())
      cell = ""
      continue
    }
    cell += char
  }
  cells.push(cell.trim())
  return cells
}

/** A delimiter row such as `| --- | :---: | ---: |`. */
export function isTableDelimiterLine(row: string): boolean {
  if (!hasTablePipe(row)) return false
  const cells = splitTableRow(row)
  return cells.length > 0 && cells.every((cell) => /^:?-+:?$/.test(cell))
}

/** A header row immediately followed by a delimiter row starts a table. */
export function isTableStart(lines: string[], index: number): boolean {
  const header = lines[index]
  const delimiter = lines[index + 1]
  if (!header || !delimiter) return false
  return hasTablePipe(header) && isTableDelimiterLine(delimiter)
}

function alignmentOf(cell: string): TableAlignment {
  const left = cell.startsWith(":")
  const right = cell.endsWith(":")
  if (left && right) return "center"
  if (right) return "right"
  return "left"
}

function allocateWidths(natural: number[], available: number): number[] {
  const widths = natural.map(() => MIN_COLUMN)
  let remaining = Math.max(0, available - widths.length)

  while (remaining > 0) {
    let changed = false
    for (let index = 0; index < natural.length && remaining > 0; index++) {
      if (widths[index]! < natural[index]!) {
        widths[index] = widths[index]! + 1
        remaining--
        changed = true
      }
    }
    if (!changed) break
  }

  return widths
}

function padLine(
  spans: Span[],
  width: number,
  alignment: TableAlignment,
  trailing: boolean,
): Span[] {
  const padding = Math.max(0, width - spanWidth(spans))
  const left =
    alignment === "right" ? padding : alignment === "center" ? Math.floor(padding / 2) : 0
  const right = trailing ? padding - left : 0
  return [
    ...(left > 0 ? [{ text: " ".repeat(left) }] : []),
    ...spans,
    ...(right > 0 ? [{ text: " ".repeat(right) }] : []),
  ]
}

function renderRow(
  cells: Span[][],
  widths: number[],
  alignments: TableAlignment[],
  gap: number,
): Line[] {
  const wrapped = cells.map((spans, index) =>
    wrapSpans(spans, widths[index]!, { breakWords: true }),
  )
  const height = Math.max(1, ...wrapped.map((lines) => lines.length))
  const rendered: Line[] = []

  for (let row = 0; row < height; row++) {
    const spans: Span[] = []
    for (let index = 0; index < cells.length; index++) {
      const line = wrapped[index]![row] ?? []
      if (index > 0) spans.push({ text: " ".repeat(gap) })
      spans.push(...padLine(line, widths[index]!, alignments[index]!, index < cells.length - 1))
    }
    rendered.push(lineFromSpans(spans))
  }

  return rendered
}

/**
 * Narrow terminals lose the column grid: render each row as a key/value
 * record instead of splitting words into unreadable fragments.
 */
function renderVertical(header: string[], body: string[][], width: number): Line[] {
  const lines: Line[] = []
  const labelLimit = Math.max(4, Math.floor(width / 2))

  body.forEach((row, rowIndex) => {
    if (rowIndex > 0) lines.push({ text: "", color: theme.assistant })

    row.forEach((cell, index) => {
      const label = (header[index] ?? "").trim() || `Column ${index + 1}`
      const labelSpans = parseInline(label, {
        color: theme.textSecondary,
        bold: true,
      })
      const prefix: Span[] = [...labelSpans, { text: ": ", color: theme.textSecondary }]

      if (spanWidth(prefix) <= labelLimit) {
        pushPrefixed(lines, prefix, parseInline(cell), width)
        return
      }

      for (const spans of wrapSpans(prefix, Math.max(1, width))) {
        lines.push(lineFromSpans(spans))
      }
      for (const spans of wrapSpans(parseInline(cell), Math.max(1, width - 2))) {
        lines.push(lineFromSpans([{ text: "  " }, ...spans]))
      }
    })
  })

  return lines
}

/**
 * Render a GFM table as aligned text: a bold header, a dim rule, then the
 * body. Columns are measured in terminal cells, so CJK text aligns with
 * narrow text, and wide tables wrap cells instead of overflowing. When the
 * grid cannot keep every column readable, it becomes vertical records.
 */
export function formatTable(rows: string[], width: number): Line[] {
  const [headerRow, delimiterRow, ...bodyRows] = rows
  if (!headerRow || !delimiterRow) return []

  const header = splitTableRow(headerRow)
  const columns = header.length
  if (columns === 0) return []

  const alignments = splitTableRow(delimiterRow).slice(0, columns).map(alignmentOf)
  while (alignments.length < columns) alignments.push("left")

  const body = bodyRows.map((row) => {
    const cells = splitTableRow(row).slice(0, columns)
    while (cells.length < columns) cells.push("")
    return cells
  })

  const headerCells = header.map((cell) =>
    parseInline(cell, { color: theme.assistant, bold: true }),
  )
  const bodyCells = body.map((row) => row.map((cell) => parseInline(cell)))

  const natural = headerCells.map((cell, index) =>
    Math.max(spanWidth(cell), ...bodyCells.map((row) => spanWidth(row[index] ?? [])), MIN_COLUMN),
  )

  const safeWidth = Math.max(1, width)
  const gap = safeWidth >= columns * 4 ? CELL_GAP : 1
  const naturalTotal = natural.reduce((sum, size) => sum + size, 0) + gap * (columns - 1)
  const naturalWidths = naturalTotal <= safeWidth

  let widths = natural
  if (!naturalWidths) {
    const available = Math.max(columns, safeWidth - gap * (columns - 1))
    widths = allocateWidths(natural, available)

    if (body.length > 0 && widths.some((size) => size < MIN_READABLE_COLUMN)) {
      return renderVertical(header, body, safeWidth)
    }
  }

  const lines = renderRow(headerCells, widths, alignments, gap)
  lines.push({
    text: widths.map((size) => "─".repeat(size)).join(" ".repeat(gap)),
    color: theme.muted,
    dim: true,
  })

  for (const row of bodyCells) {
    lines.push(...renderRow(row, widths, alignments, gap))
  }

  return lines
}
