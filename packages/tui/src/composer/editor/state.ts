export type EditorState = {
  value: string
  cursor: number
}

export function clampCursor(value: string, cursor: number): number {
  return Math.max(0, Math.min(cursor, value.length))
}
