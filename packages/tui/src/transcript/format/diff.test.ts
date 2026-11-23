import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { diffStats, diffSummary, formatDiffLines } from "./diff.js"

describe("diff", () => {
  it("counts only content changes", () => {
    expect(diffStats(["--- a/a.ts", "+++ b/a.ts", "+new", "-old"].join("\n"))).toEqual({
      added: 1,
      removed: 1,
    })
  })

  it("colors additions, removals, and hunks", () => {
    const lines = formatDiffLines(
      ["--- a/a.ts", "+++ b/a.ts", "@@ -1 +1 @@", "-old", "+new"].join("\n"),
      60,
      false,
    )
    const plain = lines.map((line) => line.text)

    expect(plain.some((line) => line.includes("+new"))).toBe(true)
    expect(plain.some((line) => line.includes("-old"))).toBe(true)
    expect(plain.some((line) => line.includes("@@ -1 +1 @@"))).toBe(true)
    expect(lines.find((line) => line.text.includes("+new"))?.color).toBe(theme.diffAdd)
    expect(lines.find((line) => line.text.includes("-old"))?.color).toBe(theme.diffRemove)
    expect(lines.find((line) => line.text.includes("@@"))?.color).toBe(theme.diffHunk)
  })

  it("shows old and new line numbers in the gutter", () => {
    const lines = formatDiffLines(
      ["@@ -10,2 +10,3 @@", " context", "-removed", "+added", "+another"].join("\n"),
      80,
      true,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "       @@ -10,2 +10,3 @@",
      "10 10   context",
      "11     -removed",
      "   11  +added",
      "   12  +another",
    ])
  })

  it("drops file headers but keeps the hunk header", () => {
    const lines = formatDiffLines(
      [
        "Index: a.ts",
        "===================================================================",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "-old",
        "+new",
      ].join("\n"),
      60,
      true,
    )
    const plain = lines.map((line) => line.text)

    expect(plain.some((line) => line.includes("Index:"))).toBe(false)
    expect(plain.some((line) => line.includes("--- a/a.ts"))).toBe(false)
    expect(plain.some((line) => line.includes("+++ b/a.ts"))).toBe(false)
    expect(plain.some((line) => line.includes("@@ -1 +1 @@"))).toBe(true)
  })

  it("collapses long diffs with an expand hint", () => {
    const context = Array.from({ length: 10 }, (_, index) => ` context ${index}`)
    const lines = formatDiffLines(["@@ -1,10 +1,10 @@", ...context].join("\n"), 60, false)

    expect(lines).toHaveLength(5)
    expect(lines.at(-1)?.text).toContain("… +7 lines (ctrl+o to expand)")
  })

  it("summarizes added and removed lines", () => {
    expect(diffSummary("+new\n-old")).toBe("Added 1 line, removed 1 line")
    expect(diffSummary("+a\n+b")).toBe("Added 2 lines")
    expect(diffSummary("-a")).toBe("Removed 1 line")
    expect(diffSummary("+a\n+b\n-c")).toBe("Added 2 lines, removed 1 line")
    expect(diffSummary("context only")).toBeUndefined()
  })
})
