import { describe, expect, it } from "vitest"

import { historyIndexAfterMove, searchHistory } from "./history.js"

describe("input history", () => {
  it("returns newest first", () => {
    expect(searchHistory(["one", "two", "three"], "")).toEqual([
      "three",
      "two",
      "one",
    ])
  })

  it("filters case-insensitively", () => {
    expect(searchHistory(["Alpha", "beta", "alphabet"], "ALP")).toEqual([
      "alphabet",
      "Alpha",
    ])
  })

  it("caps the result set", () => {
    expect(searchHistory(["a", "b", "c"], "", 2)).toEqual(["c", "b"])
  })

  it("moves and wraps the history cursor", () => {
    expect(historyIndexAfterMove(-1, -1, 3)).toBe(2)
    expect(historyIndexAfterMove(2, -1, 3)).toBe(1)
    expect(historyIndexAfterMove(0, -1, 3)).toBe(0)
    expect(historyIndexAfterMove(2, 1, 3)).toBe(-1)
    expect(historyIndexAfterMove(-1, 1, 3)).toBe(-1)
  })
})
