import type { TimelineItem } from "../../timeline.js"
import { describe, expect, it } from "vitest"

import { timelineLines } from "./lines.js"

describe("timeline lines", () => {
  it("renders user and assistant text as color-coded lines", () => {
    const items: TimelineItem[] = [
      { kind: "user", id: "u1", text: "hello" },
      { kind: "assistant", id: "a1", runId: "r1", text: "hi there" },
    ]
    const lines = timelineLines(items, 40, false)
    expect(lines.map((line) => line.text)).toEqual(["❯ hello", "● hi there"])
    expect(lines[0]?.color).toBe("white")
  })

  it("indents assistant continuation lines", () => {
    const lines = timelineLines(
      [{ kind: "assistant", id: "a1", runId: "r1", text: "first\n\nsecond" }],
      40,
      false,
    )
    expect(lines.map((line) => line.text)).toEqual(["● first", "", "  second"])
  })

  it("wraps user lines to the viewport width", () => {
    const lines = timelineLines(
      [{ kind: "user", id: "u1", text: "x".repeat(120) }],
      40,
      false,
    )
    expect(lines.length).toBeGreaterThan(1)
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(40)
  })

  it("keeps tool diffs", () => {
    const tool: TimelineItem = {
      kind: "tool",
      id: "t1",
      runId: "r1",
      name: "edit",
      input: { path: "src/app.ts" },
      status: "done",
      diff: ["--- a/src/app.ts", "+++ b/src/app.ts", "@@ -1 +1 @@", "-old", "+new"].join(
        "\n",
      ),
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

  it("skips usage items", () => {
    expect(
      timelineLines(
        [
          {
            kind: "usage",
            id: "u",
            inputTokens: 1,
            outputTokens: 2,
            totalTokens: 3,
          },
        ],
        40,
        false,
      ),
    ).toEqual([])
  })
})
