import { describe, expect, it } from "vitest"

import { charWidth, textWidth, wrapPrefixed, wrapText } from "./wrap.js"

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

  it("measures CJK characters as two columns", () => {
    expect(charWidth("a")).toBe(1)
    expect(charWidth("你")).toBe(2)
    expect(charWidth("，")).toBe(2)
    expect(textWidth("hi你好")).toBe(6)
    expect(wrapText("你好你好你好", 10)).toEqual(["你好你好你", "好"])
    expect(wrapText("a你b好c你d好e你", 10)).toEqual(["a你b好c你d", "好e你"])
  })

  it("wraps prefixed CJK by display width", () => {
    expect(wrapPrefixed("- ", "你好你好你好你好", 14)).toEqual([
      "- 你好你好你好",
      "  你好",
    ])
  })
})
