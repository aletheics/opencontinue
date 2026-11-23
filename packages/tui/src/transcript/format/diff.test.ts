import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { diffStats, formatDiffLines } from "./diff.js"

describe("diff", () => {
  it("counts only content changes", () => {
    expect(
      diffStats(["--- a/a.ts", "+++ b/a.ts", "+new", "-old"].join("\n")),
    ).toEqual({ added: 1, removed: 1 })
  })

  it("colors additions, removals, and hunks", () => {
    const lines = formatDiffLines(
      ["--- a/a.ts", "+++ b/a.ts", "@@ -1 +1 @@", "-old", "+new"].join("\n"),
      60,
      false,
    )
    const plain = lines.map((line) => line.text)
    expect(plain).toContain("+new")
    expect(plain).toContain("-old")
    expect(plain).toContain("@@ -1 +1 @@")
    expect(lines.find((line) => line.text === "+new")?.color).toBe(
      theme.diffAdd,
    )
    expect(lines.find((line) => line.text === "-old")?.color).toBe(
      theme.diffRemove,
    )
  })
})
