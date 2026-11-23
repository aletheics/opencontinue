import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { listWorkspaceFiles } from "./files.js"

let workspace = ""

beforeEach(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), "opencontinue-files-"))
  await mkdir(path.join(workspace, "src"))
  await mkdir(path.join(workspace, "node_modules", "pkg"), { recursive: true })
  await writeFile(path.join(workspace, "README.md"), "readme")
  await writeFile(path.join(workspace, "src", "app.ts"), "app")
  await writeFile(path.join(workspace, "node_modules", "pkg", "index.js"), "ignored")
})

afterEach(async () => {
  await rm(workspace, { recursive: true, force: true })
})

describe("listWorkspaceFiles", () => {
  it("lists regular files and skips generated directories", async () => {
    await expect(listWorkspaceFiles(workspace)).resolves.toEqual([
      "README.md",
      "src/app.ts",
    ])
  })

  it("includes directories with a trailing slash when asked", async () => {
    await expect(
      listWorkspaceFiles(workspace, { includeDirectories: true }),
    ).resolves.toEqual(["node_modules/", "README.md", "src/", "src/app.ts"])
  })

  it("honors the limit", async () => {
    const files = await listWorkspaceFiles(workspace, { limit: 1 })
    expect(files).toEqual(["README.md"])
  })

  it("returns an empty list for a missing workspace", async () => {
    await expect(listWorkspaceFiles(path.join(workspace, "missing"))).resolves.toEqual([])
  })
})
