import { describe, expect, it } from "vitest"

import { inputView, lineInfo } from "./view.js"

describe("editor view", () => {
  it("finds line boundaries", () => {
    expect(lineInfo("one\ntwo", 5)).toMatchObject({
      line: 1,
      column: 1,
      lineStart: 4,
      lineEnd: 7,
      lineCount: 2,
    })
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
})
