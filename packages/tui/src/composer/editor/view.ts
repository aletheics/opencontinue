import { clampCursor } from "./state.js"

export type LineInfo = {
  line: number
  column: number
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
    lineStart,
    lineEnd,
    lineCount: value.split("\n").length,
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
      const globalLine = startLine + index
      const current = globalLine === info.line
      const start = current ? Math.max(0, info.column - safeWidth + 1) : 0
      const text = line.slice(start, start + safeWidth)
      return {
        text,
        cursor: current ? Math.min(info.column - start, text.length) : -1,
      }
    })

  return { startLine, lines }
}
