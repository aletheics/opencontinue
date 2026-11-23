import type { ToolTimelineItem } from "../../timeline.js"
import { describe, expect, it } from "vitest"

import { formatToolOutputLines, toolHeaderLines } from "./tool.js"

function tool(overrides: Partial<ToolTimelineItem> = {}): ToolTimelineItem {
  return {
    kind: "tool",
    id: "t1",
    runId: "r1",
    name: "read",
    input: { path: "src/app.ts" },
    status: "done",
    ...overrides,
  }
}

describe("tool formatting", () => {
  it("renders a Claude-style header with args", () => {
    expect(toolHeaderLines(tool(), 60)).toEqual(["● Read(src/app.ts)"])
    expect(
      toolHeaderLines(tool({ name: "bash", input: { command: "echo hi" } }), 60),
    ).toEqual(["● Bash(echo hi)"])
  })

  it("collapses output until expanded", () => {
    const output = Array.from({ length: 20 }, (_, index) => `line ${index}`).join(
      "\n",
    )
    const collapsed = formatToolOutputLines(output, 60, false)
    const expanded = formatToolOutputLines(output, 60, true)
    expect(collapsed.length).toBeLessThan(expanded.length)
    expect(collapsed.some((line) => line.text.includes("ctrl+o to expand"))).toBe(
      true,
    )
  })
})
