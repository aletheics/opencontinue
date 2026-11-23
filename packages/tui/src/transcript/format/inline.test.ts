import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { lineFromSpans, parseInline, spanText, wrapSpans } from "./inline.js"

describe("inline markdown", () => {
  it("parses code, bold, italic, strikethrough, and links", () => {
    const spans = parseInline(
      "run `typecheck` and **ship** it, *carefully*, ~~later~~ [docs](https://example.com)",
    )

    expect(spanText(spans)).toBe(
      "run typecheck and ship it, carefully, later docs (https://example.com)",
    )
    expect(spans.find((span) => span.text === "typecheck")?.color).toBe(theme.inlineCode)
    expect(spans.find((span) => span.text === "ship")?.bold).toBe(true)
    expect(spans.find((span) => span.text === "carefully")?.italic).toBe(true)
    expect(spans.find((span) => span.text === "later")?.strikethrough).toBe(true)
    expect(spans.find((span) => span.text === "docs")?.underline).toBe(true)
    expect(spans.find((span) => span.text === "https://example.com")?.dim).toBe(true)
  })

  it("middle-shortens long link destinations", () => {
    const url = `https://example.com/${"a".repeat(80)}`
    const text = spanText(parseInline(`[docs](${url})`))

    expect(text.startsWith("docs (https://example.com/")).toBe(true)
    expect(text.endsWith(")")).toBe(true)
    expect(text).toContain("…")
    expect(text.length).toBeLessThan(url.length + 10)
  })

  it("does not repeat a link destination equal to its label", () => {
    expect(spanText(parseInline("[https://example.com](https://example.com)"))).toBe(
      "https://example.com",
    )
  })

  it("wraps styled spans by display width", () => {
    const wrapped = wrapSpans(parseInline("`abcdefghij`"), 4)
    expect(wrapped.map(spanText)).toEqual(["abcd", "efgh", "ij"])
    for (const line of wrapped) {
      for (const span of line) expect(span.color).toBe(theme.inlineCode)
    }
  })

  it("wraps emoji sequences as single graphemes", () => {
    const family = "👨‍👩‍👧‍👦"
    const wrapped = wrapSpans(parseInline(`${family}${family}🚀`), 2)

    expect(wrapped.map(spanText)).toEqual([family, family, "🚀"])
  })

  it("wraps styled spans at spaces before splitting a word", () => {
    const wrapped = wrapSpans(parseInline("**hello world**"), 6)
    expect(wrapped.map(spanText)).toEqual(["hello", "world"])
    for (const line of wrapped) {
      for (const span of line) expect(span.bold).toBe(true)
    }
  })

  it("collapses uniform spans and keeps mixed spans", () => {
    const plain = lineFromSpans(parseInline("hello"))
    expect(plain.spans).toBeUndefined()
    expect(plain.color).toBe(theme.assistant)

    const mixed = lineFromSpans(parseInline("a `b`"))
    expect(mixed.text).toBe("a b")
    expect(mixed.spans).toHaveLength(2)
  })
})
