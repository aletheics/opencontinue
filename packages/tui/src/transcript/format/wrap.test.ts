import { describe, expect, it } from "vitest"

import {
  charWidth,
  graphemeWidth,
  graphemes,
  textWidth,
  truncateMiddle,
  wrapPrefixed,
  wrapText,
} from "./wrap.js"

describe("wrap", () => {
  it("wraps to the viewport width", () => {
    const lines = wrapText("x".repeat(120), 40)
    expect(lines).toHaveLength(3)
    for (const line of lines) expect(line.length).toBeLessThanOrEqual(40)
  })

  it("keeps explicit newlines and blank lines", () => {
    expect(wrapText("one\n\ntwo", 40)).toEqual(["one", "", "two"])
  })

  it("breaks at spaces before splitting a word", () => {
    expect(wrapText("alpha beta gamma", 12)).toEqual(["alpha beta", "gamma"])
    expect(wrapText("abcdefghijkl", 10)).toEqual(["abcdefghij", "kl"])
    expect(wrapText("abcdefghijkl mnop", 10)).toEqual(["abcdefghij", "kl mnop"])
  })

  it("indents continuation lines", () => {
    expect(wrapPrefixed("› ", "abcdefghijklmno", 14)).toEqual(["› abcdefghijkl", "  mno"])
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
    expect(wrapPrefixed("- ", "你好你好你好你好", 14)).toEqual(["- 你好你好你好", "  你好"])
  })

  it("counts emoji sequences as one grapheme", () => {
    const family = "👨‍👩‍👧‍👦"

    expect(graphemes(family)).toHaveLength(1)
    expect(graphemes("🇨🇳")).toHaveLength(1)
    expect(graphemeWidth(family)).toBe(2)
    expect(graphemeWidth("🚀")).toBe(2)
    expect(graphemeWidth("🇨🇳")).toBe(2)
    expect(graphemeWidth("👍🏽")).toBe(2)
    expect(graphemeWidth("❤️")).toBe(2)
    expect(graphemeWidth("é")).toBe(1)
    expect(textWidth(`${family}🚀`)).toBe(4)
  })

  it("does not split emoji sequences when wrapping", () => {
    const family = "👨‍👩‍👧‍👦"
    const lines = wrapText(family.repeat(6), 10)

    expect(lines).toEqual([family.repeat(5), family])
  })

  it("shortens from the middle without splitting graphemes", () => {
    expect(truncateMiddle("abcdefghij", 5)).toBe("ab…ij")
    const family = "👨‍👩‍👧‍👦"
    const shortened = truncateMiddle(`${family}${"a".repeat(40)}${family}`, 12)
    expect(textWidth(shortened)).toBeLessThanOrEqual(12)
    expect(shortened).toContain("…")
    expect(shortened.startsWith(family)).toBe(true)
    expect(shortened.endsWith(family)).toBe(true)
  })
})
