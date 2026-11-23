import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { lineFromSpans, parseInline, spanText, wrapSpans } from "./inline.js"

describe("inline markdown", () => {
  it("parses code, bold, italic, strikethrough, and links", () => {
    const spans = parseInline(
      "run `typecheck` and **ship** it, *carefully*, ~~later~~ [docs](https://example.com)",
    )

    expect(spanText(spans)).toBe(
      "run typecheck and ship it, carefully, later docs",
    )
    expect(
      spans.find((span) => span.text === "typecheck")?.color,
    ).toBe(theme.inlineCode)
    expect(spans.find((span) => span.text === "ship")?.bold).toBe(true)
    expect(spans.find((span) => span.text === "carefully")?.italic).toBe(true)
    expect(spans.find((span) => span.text === "later")?.strikethrough).toBe(true)
    expect(spans.find((span) => span.text === "docs")?.underline).toBe(true)
  })

  it("wraps styled spans by display width", () => {
    const wrapped = wrapSpans(parseInline("`abcdefghij`"), 4)
    expect(wrapped.map(spanText)).toEqual(["abcd", "efgh", "ij"])
    for (const line of wrapped) {
      for (const span of line) expect(span.color).toBe(theme.inlineCode)
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
