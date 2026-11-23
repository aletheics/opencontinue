import { describe, expect, it } from "vitest"

import { wrapPrefixed, wrapText } from "./wrap.js"

describe("wrap", () => {
  it("wraps to the viewport width", () => {
    const lines = wrapText("x".repeat(120), 40)
    expect(lines).toHaveLength(3)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(40)
  })

  it("keeps explicit newlines and blank lines", () => {
    expect(wrapText("one\n\ntwo", 40)).toEqual(["one", "", "two"])
  })

  it("indents continuation lines", () => {
    expect(wrapPrefixed("❯ ", "abcdefghijklmno", 14)).toEqual([
      "❯ abcdefghijkl",
      "  mno",
    ])
  })
})
