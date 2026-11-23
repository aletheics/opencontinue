import { Box, Text, useInput } from "ink"

import {
  backspace,
  deleteForward,
  deleteToLineEnd,
  deleteToLineStart,
  deleteWordBefore,
  inputView,
  insertText,
  moveHorizontal,
  moveToEnd,
  moveToLineEnd,
  moveToLineStart,
  moveToStart,
  moveVertical,
  type EditorState,
} from "../input.js"
import { theme } from "../theme.js"

export type InputProps = {
  value: string
  cursor: number
  width: number
  rows: number
  placeholder: string
  prefix?: string
  menuOpen: boolean
  onChange: (value: string, cursor: number) => void
  onSubmit: (value: string) => void
}

export function Input({
  value,
  cursor,
  width,
  rows,
  placeholder,
  prefix = "you> ",
  menuOpen,
  onChange,
  onSubmit,
}: InputProps) {
  const update = (next: EditorState) => {
    onChange(next.value, next.cursor)
  }
  const state = { value, cursor }

  useInput((character, key) => {
    if (key.upArrow || key.downArrow) {
      if (menuOpen || !value.includes("\n")) return
      update(moveVertical(state, key.upArrow ? -1 : 1))
      return
    }

    if (key.leftArrow) {
      update(moveHorizontal(state, -1))
      return
    }

    if (key.rightArrow) {
      update(moveHorizontal(state, 1))
      return
    }

    if (key.home) {
      update(key.ctrl ? moveToStart(state) : moveToLineStart(state))
      return
    }

    if (key.end) {
      update(key.ctrl ? moveToEnd(state) : moveToLineEnd(state))
      return
    }

    if (key.return) {
      if (character === "\n" || key.shift || key.meta || key.ctrl) {
        update(insertText(state, "\n"))
      } else {
        onSubmit(value)
      }
      return
    }

    if (key.backspace) {
      update(backspace(state))
      return
    }

    if (key.delete) {
      update(deleteForward(state))
      return
    }

    if (key.ctrl) {
      const name = character.toLowerCase()
      if (name === "a") {
        update(moveToLineStart(state))
        return
      }
      if (name === "e") {
        update(moveToLineEnd(state))
        return
      }
      if (name === "u") {
        update(deleteToLineStart(state))
        return
      }
      if (name === "w") {
        update(deleteWordBefore(state))
        return
      }
      if (name === "k") {
        update(deleteToLineEnd(state))
        return
      }
      return
    }

    if (key.meta || key.tab || key.escape) return
    if (character.length > 0 && !/[\r\n]/.test(character)) {
      update(insertText(state, character))
    }
  })

  const view = inputView(value, cursor, width, rows)
  const lineCount = Math.max(1, rows)

  if (value.length === 0) {
    const text = placeholder.slice(0, Math.max(1, width))
    return (
      <Box flexDirection="column" width={prefix.length + width} height={lineCount}>
        <Box flexDirection="row" height={1}>
          <Text color={theme.user}>{prefix}</Text>
          <Text dimColor>
            <Text inverse>{text[0] ?? " "}</Text>
            {text.slice(1)}
          </Text>
        </Box>
      </Box>
    )
  }

  return (
    <Box
      flexDirection="column"
      width={prefix.length + width}
      height={lineCount}
      overflow="hidden"
    >
      {view.lines.map((line, index) => {
        const globalLine = view.startLine + index
        const before = line.cursor >= 0 ? line.text.slice(0, line.cursor) : line.text
        const at =
          line.cursor >= 0
            ? line.cursor < line.text.length
              ? line.text[line.cursor] ?? " "
              : " "
            : ""
        const after =
          line.cursor >= 0 && line.cursor < line.text.length
            ? line.text.slice(line.cursor + 1)
            : ""

        return (
          <Box key={globalLine} flexDirection="row" height={1} overflow="hidden">
            <Text color={theme.user}>
              {globalLine === 0 ? prefix : " ".repeat(prefix.length)}
            </Text>
            <Text wrap="truncate">
              {before}
              {line.cursor >= 0 ? <Text inverse>{at}</Text> : null}
              {after}
            </Text>
          </Box>
        )
      })}
    </Box>
  )
}
