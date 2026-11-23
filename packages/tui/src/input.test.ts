import { describe, expect, it } from "vitest"

import {
  backspace,
  deleteForward,
  deleteToLineEnd,
  deleteToLineStart,
  deleteWordBefore,
  inputView,
  insertText,
  lineInfo,
  moveHorizontal,
  moveToLineEnd,
  moveToLineStart,
  moveVertical,
} from "./input.js"

describe("editor", () => {
  it("inserts at the cursor", () => {
    expect(insertText({ value: "ac", cursor: 1 }, "b")).toEqual({
      value: "abc",
      cursor: 2,
    })
    expect(insertText({ value: "a", cursor: 1 }, "\n")).toEqual({
      value: "a\n",
      cursor: 2,
    })
  })

  it("deletes backward and forward", () => {
    expect(backspace({ value: "abc", cursor: 2 })).toEqual({ value: "ac", cursor: 1 })
    expect(deleteForward({ value: "abc", cursor: 1 })).toEqual({ value: "ac", cursor: 1 })
    expect(backspace({ value: "abc", cursor: 0 })).toEqual({ value: "abc", cursor: 0 })
    expect(deleteForward({ value: "abc", cursor: 3 })).toEqual({ value: "abc", cursor: 3 })
  })

  it("moves horizontally and clamps", () => {
    expect(moveHorizontal({ value: "abc", cursor: 1 }, 1).cursor).toBe(2)
    expect(moveHorizontal({ value: "abc", cursor: 0 }, -1).cursor).toBe(0)
    expect(moveHorizontal({ value: "abc", cursor: 3 }, 1).cursor).toBe(3)
  })

  it("moves vertically while preserving the column", () => {
    const state = { value: "long line\nx\nthird", cursor: 15 }
    const up = moveVertical(state, -1)
    expect(up).toEqual({ value: state.value, cursor: 11 })
    expect(moveVertical(up, -1)).toEqual({ value: state.value, cursor: 1 })
    expect(moveVertical({ value: "a\nb", cursor: 0 }, 1)).toEqual({
      value: "a\nb",
      cursor: 2,
    })
  })

  it("finds line boundaries", () => {
    expect(lineInfo("one\ntwo", 5)).toMatchObject({
      line: 1,
      column: 1,
      lineStart: 4,
      lineEnd: 7,
      lineCount: 2,
    })
    expect(moveToLineStart({ value: "one\ntwo", cursor: 6 }).cursor).toBe(4)
    expect(moveToLineEnd({ value: "one\ntwo", cursor: 4 }).cursor).toBe(7)
  })

  it("scrolls horizontally to keep the cursor visible", () => {
    const view = inputView("abcdefghij", 10, 5, 1)
    expect(view.lines).toEqual([{ text: "ghij", cursor: 4 }])
    expect(inputView("abc", 1, 5, 1).lines).toEqual([{ text: "abc", cursor: 1 }])
  })

  it("windows multiline input around the cursor", () => {
    const view = inputView("a\nb\nc\nd", 5, 10, 2)
    expect(view.startLine).toBe(1)
    expect(view.lines).toEqual([
      { text: "b", cursor: -1 },
      { text: "c", cursor: 1 },
    ])
  })

  it("deletes words and line ranges", () => {
    expect(deleteWordBefore({ value: "one two", cursor: 7 })).toEqual({
      value: "one ",
      cursor: 4,
    })
    expect(deleteWordBefore({ value: "one two  ", cursor: 9 })).toEqual({
      value: "one ",
      cursor: 4,
    })
    expect(deleteToLineStart({ value: "one\ntwo", cursor: 6 })).toEqual({
      value: "one\no",
      cursor: 4,
    })
    expect(deleteToLineEnd({ value: "one\ntwo", cursor: 0 })).toEqual({
      value: "two",
      cursor: 0,
    })
    expect(deleteToLineEnd({ value: "one\ntwo", cursor: 4 })).toEqual({
      value: "one\n",
      cursor: 4,
    })
  })
})
