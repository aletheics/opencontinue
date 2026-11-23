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
    expect(lines.map((line) => line.text)).toEqual(["you> hello", "hi there"])
    expect(lines[0]?.color).toBe("green")
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
    expect(lines[0]?.text).toContain("Edit src/app.ts")
    expect(lines[0]?.text).toContain("+1 -1")
    expect(lines.some((line) => line.text === "+new" && line.color === "green")).toBe(true)
    expect(lines.some((line) => line.text === "-old" && line.color === "red")).toBe(true)
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
    expect(collapsed.some((line) => line.text.includes("more lines"))).toBe(true)
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
