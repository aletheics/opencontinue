import { describe, expect, it } from "vitest"

import { summarizeRun } from "./summary.js"

describe("run summary", () => {
  it("counts changed files and commands", () => {
    expect(
      summarizeRun([
        { name: "write", status: "done", input: { path: "a.ts" }, diff: "+a" },
        { name: "edit", status: "done", input: { path: "b.ts" }, diff: "+b" },
        { name: "write", status: "done", input: { path: "a.ts" }, diff: "+a" },
        { name: "bash", status: "done", input: { command: "npm test" } },
        { name: "bash", status: "failed", input: { command: "tsc" } },
        { name: "todo", status: "done", input: { todos: [] } },
      ]),
    ).toBe("2 files changed · 2 commands (1 failed)")
  })

  it("handles singular and empty runs", () => {
    expect(
      summarizeRun([
        { name: "edit", status: "done", input: { path: "a.ts" }, diff: "+a" },
        { name: "bash", status: "done", input: { command: "git status" } },
      ]),
    ).toBe("1 file changed · 1 command")
    expect(summarizeRun([])).toBeUndefined()
    expect(
      summarizeRun([
        { name: "write", status: "failed", input: { path: "a.ts" } },
      ]),
    ).toBeUndefined()
  })
})
