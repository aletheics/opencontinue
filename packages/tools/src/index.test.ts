import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import {
  ToolRegistry,
  editTool,
  globTool,
  grepTool,
  readTool,
  writeTool,
  type ToolContext,
} from "./index.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function makeWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-tools-"))
  temporary.push(directory)
  return directory
}

function context(workspace: string): ToolContext {
  return { workspace, sessionId: "test-session" }
}

describe("tools", () => {
  it("reads and edits files inside the workspace", async () => {
    const workspace = await makeWorkspace()
    await writeFile(path.join(workspace, "a.ts"), "const x = 1\nconst y = 2\n")

    expect(await readTool.execute({ path: "a.ts" }, context(workspace))).toContain("1: const x = 1")

    const edited = await editTool.execute(
      { path: "a.ts", oldString: "const y = 2", newString: "const y = 3" },
      context(workspace),
    )
    expect(typeof edited === "string" ? edited : edited.output).toContain("Replaced 1")
    if (typeof edited !== "string") expect(edited.diff).toContain("-const y = 2")

    const written = await writeTool.execute(
      { path: "b.ts", content: "hello\n" },
      context(workspace),
    )
    if (typeof written !== "string") expect(written.diff).toContain("+hello")

    expect(await readTool.execute({ path: "a.ts" }, context(workspace))).toContain("const y = 3")
  })

  it("previews write and edit diffs without changing files", async () => {
    const workspace = await makeWorkspace()
    await writeFile(path.join(workspace, "a.ts"), "const x = 1\nconst y = 2\n")

    const writePreview = await writeTool.preview!(
      { path: "b.ts", content: "hello\n" },
      context(workspace),
    )
    expect(writePreview.detail).toBe("b.ts")
    expect(writePreview.diff).toContain("+hello")

    const editPreview = await editTool.preview!(
      { path: "a.ts", oldString: "const y = 2", newString: "const y = 3" },
      context(workspace),
    )
    expect(editPreview.detail).toBe("a.ts")
    expect(editPreview.diff).toContain("+const y = 3")
    expect(await readTool.execute({ path: "a.ts" }, context(workspace))).toContain("const y = 2")

    const missing = await editTool.preview!(
      { path: "a.ts", oldString: "nope", newString: "x" },
      context(workspace),
    )
    expect(missing.diff).toBeUndefined()
  })

  it("refuses paths outside the workspace", async () => {
    const workspace = await makeWorkspace()
    await expect(readTool.execute({ path: "../outside.txt" }, context(workspace))).rejects.toThrow(
      /outside the workspace/,
    )
  })

  it("finds files and greps contents", async () => {
    const workspace = await makeWorkspace()
    await writeFile(path.join(workspace, "a.ts"), "export const needle = 1\n")
    await writeFile(path.join(workspace, "b.md"), "nothing\n")

    expect(await globTool.execute({ pattern: "**/*.ts" }, context(workspace))).toContain("a.ts")
    expect(await grepTool.execute({ pattern: "needle" }, context(workspace))).toContain("a.ts:1")
  })

  it("enforces the permission gate", async () => {
    const workspace = await makeWorkspace()
    const registry = new ToolRegistry()
    let asked = false

    const result = await registry.execute(
      "write",
      JSON.stringify({ path: "a.txt", content: "x" }),
      context(workspace),
      {
        async authorize() {
          asked = true
          return false
        },
      },
    )

    expect(asked).toBe(true)
    expect(result.ok).toBe(false)
    expect(result.ok === false ? result.error : "").toContain("Permission denied")
  })

  it("exposes JSON schemas for providers", () => {
    const registry = new ToolRegistry()
    const names = registry.definitions().map((definition) => definition.name)
    expect(names).toEqual(["read", "write", "edit", "glob", "grep", "bash"])
  })
})
