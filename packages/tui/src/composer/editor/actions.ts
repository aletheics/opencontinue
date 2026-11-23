import { clampCursor, type EditorState } from "./state.js"
import { lineInfo } from "./view.js"

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
