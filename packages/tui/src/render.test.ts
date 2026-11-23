import { describe, expect, it } from "vitest"

import { diffStats, timelineLines } from "./render.js"
import type { TimelineItem } from "./timeline.js"

const user: TimelineItem = { kind: "user", id: "u1", text: "hello" }
const assistant: TimelineItem = {
  kind: "assistant",
  id: "a1",
  runId: "r1",
  text: "hi there",
}

describe("timelineLines", () => {
  it("renders user and assistant text as color-coded lines", () => {
    const lines = timelineLines([user, assistant], 40, false)
    expect(lines.map((line) => line.text)).toEqual(["❯ hello", "hi there"])
    expect(lines[0]?.color).toBe("white")
  })

  it("wraps long lines to the viewport width", () => {
    const lines = timelineLines(
      [{ kind: "user", id: "u1", text: "x".repeat(120) }],
      40,
      false,
    )
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(40)
  })

  it("renders headings, lists, quotes, and fenced code", () => {
    const text = [
      "# Title",
      "",
      "- first",
      "1. second",
      "> quote",
      "```ts",
      "const x = 1",
      "```",
    ].join("\n")
    const lines = timelineLines(
      [{ kind: "assistant", id: "a1", runId: "r1", text }],
      40,
      false,
    )
    const plain = lines.map((line) => line.text)
    expect(plain).toContain("Title")
    expect(lines.find((line) => line.text === "Title")?.bold).toBe(true)
    expect(plain).toContain("• first")
    expect(plain).toContain("1. second")
    expect(plain).toContain("│ quote")
    expect(plain).toContain("┌─ ts")
    expect(plain).toContain("│ const x = 1")
    expect(plain).toContain("└─")
  })

  it("keeps markdown literal inside a code fence", () => {
    const text = ["```", "# not a heading", "- not a bullet", "```"].join("\n")
    const lines = timelineLines(
      [{ kind: "assistant", id: "a1", runId: "r1", text }],
      40,
      false,
    )
    const plain = lines.map((line) => line.text)
    expect(plain).toContain("│ # not a heading")
    expect(plain).toContain("│ - not a bullet")
    expect(plain).not.toContain("• not a bullet")
  })

  it("wraps a list item under its marker", () => {
    const lines = timelineLines(
      [{ kind: "assistant", id: "a1", runId: "r1", text: `- ${"word ".repeat(20)}` }],
      30,
      false,
    )
    expect(lines[0]?.text.startsWith("• word")).toBe(true)
    expect(lines[1]?.text.startsWith("  ")).toBe(true)
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(30)
  })

  it("keeps diff lines and their stats", () => {
    const tool: TimelineItem = {
      kind: "tool",
      id: "t1",
      runId: "r1",
      name: "edit",
      input: { path: "src/app.ts" },
      status: "done",
      diff: ["--- a/src/app.ts", "+++ b/src/app.ts", "@@ -1 +1 @@", "-old", "+new"].join("\n"),
    }
    const lines = timelineLines([tool], 60, false)
    expect(lines[0]?.text).toContain("Edit(src/app.ts)")
    expect(
      lines.some((line) => line.text.endsWith("+new") && line.color === "green"),
    ).toBe(true)
    expect(
      lines.some((line) => line.text.endsWith("-old") && line.color === "red"),
    ).toBe(true)
  })

  it("collapses tool output until expanded", () => {
    const output = Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")
    const tool: TimelineItem = {
      kind: "tool",
      id: "t1",
      runId: "r1",
      name: "read",
      input: { path: "src/app.ts" },
      status: "done",
      output,
    }
    const collapsed = timelineLines([tool], 60, false)
    const expanded = timelineLines([tool], 60, true)
    expect(collapsed.length).toBeLessThan(expanded.length)
    expect(collapsed.some((line) => line.text.includes("ctrl+o to expand"))).toBe(true)
  })

  it("skips usage items", () => {
    const lines = timelineLines(
      [{ kind: "usage", id: "u", inputTokens: 1, outputTokens: 2, totalTokens: 3 }],
      40,
      false,
    )
    expect(lines).toEqual([])
  })
})

describe("diffStats", () => {
  it("ignores file headers", () => {
    expect(diffStats(["--- a/a.ts", "+++ b/a.ts", "+new", "-old"].join("\n"))).toEqual({
      added: 1,
      removed: 1,
    })
  })
})
