import { describe, expect, it } from "vitest"

import { formatAssistantLines } from "./assistant.js"
import { textWidth } from "./wrap.js"

/**
 * One corpus that exercises every markdown feature the editorial system
 * promises. It is a width and content guard, not a pixel-perfect snapshot.
 */
const CORPUS = [
  "# Project report",
  "",
  "A paragraph with **bold**, *italic*, ~~strike~~, and `code`.",
  "",
  "See [docs](https://example.com).",
  "",
  "## Findings",
  "",
  "### Details",
  "",
  "#### Deeper",
  "",
  "##### More",
  "",
  "###### Deepest",
  "",
  "1. first",
  "2. second",
  "   - nested A",
  "   - nested B",
  "",
  "- [x] done",
  "- [ ] todo",
  "",
  "> A quote.",
  "",
  "---",
  "",
  "| Name | Value |",
  "| --- | ---: |",
  "| 中文 | 42 |",
  "",
  "```ts",
  "const answer = 42",
  "```",
  "",
  "```diff",
  "-old",
  "+new",
  "```",
].join("\n")

describe("editorial corpus", () => {
  for (const columns of [60, 80, 120]) {
    it(`renders every feature within ${columns} columns`, () => {
      const lines = formatAssistantLines(CORPUS, columns)
      const plain = lines.map((line) => line.text).join("\n")

      for (const expected of [
        "Project report",
        "A paragraph with bold, italic, strike, and code.",
        "See docs (https://example.com).",
        "Findings",
        "Details",
        "Deeper",
        "More",
        "Deepest",
        "1. first",
        "2. second",
        "nested A",
        "- [x] done",
        "- [ ] todo",
        "A quote.",
        "Name",
        "中文",
        "const answer = 42",
        "-old",
        "+new",
      ]) {
        expect(plain).toContain(expected)
      }

      for (const line of lines) {
        expect(textWidth(line.text)).toBeLessThanOrEqual(columns)
      }
    })
  }

  it("does not collapse a whole answer into one text block", () => {
    const lines = formatAssistantLines(CORPUS, 80)
    const blanks = lines.filter((line) => line.text === "").length

    expect(blanks).toBeGreaterThan(5)
  })
})
