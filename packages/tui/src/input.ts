export type EditorState = {
  value: string
  cursor: number
}

export type LineInfo = {
  line: number
  column: number
  lineStart: number
  lineEnd: number
  lineCount: number
}

export function clampCursor(value: string, cursor: number): number {
  return Math.max(0, Math.min(cursor, value.length))
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

export type ViewLine = {
  text: string
  cursor: number
}

export type InputView = {
  startLine: number
  lines: ViewLine[]
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

export function insertText(state: EditorState, text: string): EditorState {
  const cursor = clampCursor(state.value, state.cursor)
  return {
    value: state.value.slice(0, cursor) + text + state.value.slice(cursor),
    cursor: cursor + text.length,
  }
}

export function backspace(state: EditorState): EditorState {
  const cursor = clampCursor(state.value, state.cursor)
  if (cursor === 0) return { ...state, cursor }
  return {
    value: state.value.slice(0, cursor - 1) + state.value.slice(cursor),
    cursor: cursor - 1,
  }
}

export function deleteForward(state: EditorState): EditorState {
  const cursor = clampCursor(state.value, state.cursor)
  if (cursor >= state.value.length) return { ...state, cursor }
  return {
    value: state.value.slice(0, cursor) + state.value.slice(cursor + 1),
    cursor,
  }
}

export function moveHorizontal(state: EditorState, delta: number): EditorState {
  return { ...state, cursor: clampCursor(state.value, state.cursor + delta) }
}

export function moveVertical(state: EditorState, delta: number): EditorState {
  const info = lineInfo(state.value, state.cursor)
  if (info.lineCount === 1) return { ...state, cursor: info.lineStart + info.column }

  const lines = state.value.split("\n")
  const targetLine = Math.max(0, Math.min(lines.length - 1, info.line + delta))
  let targetStart = 0
  for (let index = 0; index < targetLine; index++) {
    targetStart += (lines[index]?.length ?? 0) + 1
  }
  return {
    value: state.value,
    cursor: targetStart + Math.min(info.column, lines[targetLine]?.length ?? 0),
  }
}

export function moveToLineStart(state: EditorState): EditorState {
  const info = lineInfo(state.value, state.cursor)
  return { ...state, cursor: info.lineStart }
}

export function moveToLineEnd(state: EditorState): EditorState {
  const info = lineInfo(state.value, state.cursor)
  return { ...state, cursor: info.lineEnd }
}

export function moveToStart(state: EditorState): EditorState {
  return { ...state, cursor: 0 }
}

export function moveToEnd(state: EditorState): EditorState {
  return { ...state, cursor: state.value.length }
}

export function deleteWordBefore(state: EditorState): EditorState {
  const cursor = clampCursor(state.value, state.cursor)
  let start = cursor
  while (start > 0 && /\s/.test(state.value[start - 1] ?? "")) start--
  while (start > 0 && !/\s/.test(state.value[start - 1] ?? "")) start--
  if (start === cursor) return { ...state, cursor }
  return {
    value: state.value.slice(0, start) + state.value.slice(cursor),
    cursor: start,
  }
}

export function deleteToLineStart(state: EditorState): EditorState {
  const info = lineInfo(state.value, state.cursor)
  const cursor = clampCursor(state.value, state.cursor)
  return {
    value: state.value.slice(0, info.lineStart) + state.value.slice(cursor),
    cursor: info.lineStart,
  }
}

export function deleteToLineEnd(state: EditorState): EditorState {
  const info = lineInfo(state.value, state.cursor)
  const end = info.lineEnd < state.value.length ? info.lineEnd + 1 : info.lineEnd
  return {
    value: state.value.slice(0, state.cursor) + state.value.slice(end),
    cursor: state.cursor,
  }
}
