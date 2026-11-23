import { charWidth, textWidth } from "../../transcript/format/wrap.js"
import { clampCursor } from "./state.js"

export type LineInfo = {
  line: number
  column: number
  columnWidth: number
  lineStart: number
  lineEnd: number
  lineCount: number
}

export type ViewLine = {
  text: string
  cursor: number
}

export type InputView = {
  startLine: number
  lines: ViewLine[]
}

export function lineInfo(value: string, cursor: number): LineInfo {
  const safe = clampCursor(value, cursor)
  const before = value.slice(0, safe)
  const line = before.split("\n").length - 1
  const lineStart = before.lastIndexOf("\n") + 1
  const nextBreak = value.indexOf("\n", safe)
  const lineEnd = nextBreak === -1 ? value.length : nextBreak
  return {
    line,
    column: safe - lineStart,
    columnWidth: textWidth(before.slice(lineStart)),
    lineStart,
    lineEnd,
    lineCount: value.split("\n").length,
  }
}

/**
 * Render one row of the input using display-cell width, so CJK text scrolls
 * and truncates on the same boundary the terminal uses.
 */
function windowLine(
  line: string,
  cursorColumn: number,
  current: boolean,
  width: number,
): ViewLine {
  let start = 0
  if (current && textWidth(line.slice(0, cursorColumn)) >= width) {
    let used = 0
    start = cursorColumn
    while (start > 0) {
      const size = charWidth(line[start - 1] ?? "")
      if (used + size > width - 1) break
      used += size
      start--
    }
  }

  let text = ""
  let used = 0
  for (let index = start; index < line.length; index++) {
    const char = line[index] ?? ""
    const size = charWidth(char)
    if (used + size > width) break
    text += char
    used += size
  }

  return {
    text,
    cursor: current ? cursorColumn - start : -1,
  }
}

export function inputView(
  value: string,
  cursor: number,
  width: number,
  rows: number,
): InputView {
  const info = lineInfo(value, cursor)
  const rowCount = Math.max(1, rows)
  const safeWidth = Math.max(1, width)
  const startLine = Math.max(
    0,
    Math.min(info.line - rowCount + 1, Math.max(0, info.lineCount - rowCount)),
  )
  const lines = value
    .split("\n")
    .slice(startLine, startLine + rowCount)
    .map((line, index) => {
      const current = startLine + index === info.line
      return windowLine(line, info.column, current, safeWidth)
    })

  return { startLine, lines }
}
