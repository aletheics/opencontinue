import type { ToolTimelineItem } from "../../timeline.js"
import { describe, expect, it } from "vitest"

import { formatToolOutputLines, toolHeaderLines, toolNotes } from "./tool.js"

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
  it("renders a tool header with args", () => {
    expect(toolHeaderLines(tool(), 60)).toEqual(["↳ Read(src/app.ts)"])
    expect(toolHeaderLines(tool({ name: "bash", input: { command: "echo hi" } }), 60)).toEqual([
      "↳ Bash(echo hi)",
    ])
    expect(toolHeaderLines(tool({ name: "edit", input: { path: "src/app.ts" } }), 60)).toEqual([
      "↳ Update(src/app.ts)",
    ])
  })

  it("collapses output until expanded", () => {
    const output = Array.from({ length: 20 }, (_, index) => `line ${index}`).join("\n")
    const collapsed = formatToolOutputLines(output, 60, false)
    const expanded = formatToolOutputLines(output, 60, true)
    expect(collapsed.length).toBeLessThan(expanded.length)
    expect(collapsed.some((line) => line.text.includes("ctrl+o to expand"))).toBe(true)
    expect(collapsed[0]?.spans?.[0]?.dim).toBe(true)
    expect(collapsed[0]?.spans?.[1]?.dim).toBeUndefined()
  })

  it("indents wrapped tool headers by two spaces", () => {
    const lines = toolHeaderLines(tool({ name: "bash", input: { command: "x".repeat(120) } }), 40)
    expect(lines.length).toBeGreaterThan(1)
    expect(lines[1]?.startsWith("  ")).toBe(true)
    expect(lines[1]?.startsWith("●")).toBe(false)
  })

  it("adds bash timeout and cwd reset notes", () => {
    expect(toolNotes(tool({ name: "bash", input: { command: "echo hi" } }), "/work")).toEqual([
      "(timeout 2m)",
    ])

    expect(
      toolNotes(
        tool({
          name: "bash",
          input: { command: "cd /tmp && echo hi", timeoutMs: 180_000 },
        }),
        "D:\\work",
      ),
    ).toEqual(["Shell cwd was reset to D:\\work", "(timeout 3m)"])

    expect(toolNotes(tool())).toEqual([])
  })
})
