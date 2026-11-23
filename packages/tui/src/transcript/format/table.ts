import { theme } from "../../theme.js"
import { lineFromSpans, parseInline, spanWidth, wrapSpans } from "./inline.js"
import type { Line, Span } from "./line.js"

export type TableAlignment = "left" | "center" | "right"

const CELL_GAP = 2
const MIN_COLUMN = 1

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
 * Render a GFM table as aligned text: a bold header, a dim rule, then the
 * body. Columns are measured in terminal cells, so CJK text aligns with
 * narrow text, and wide tables wrap cells instead of overflowing.
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

  const gap = width >= columns * 4 ? CELL_GAP : 1
  const available = Math.max(columns, Math.max(1, width) - gap * (columns - 1))
  const widths = allocateWidths(natural, available)

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
