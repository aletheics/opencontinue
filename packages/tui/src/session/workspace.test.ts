import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { workspaceInfo } from "./workspace.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function workspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-workspace-"))
  temporary.push(directory)
  return directory
}

describe("workspaceInfo", () => {
  it("reads the branch and workspace name", async () => {
    const directory = await workspace()
    await mkdir(path.join(directory, ".git"), { recursive: true })
    await writeFile(path.join(directory, ".git", "HEAD"), "ref: refs/heads/main\n")

    expect(workspaceInfo(directory)).toEqual({
      name: path.basename(directory),
      branch: "main",
    })
  })

  it("walks up and shortens detached HEAD", async () => {
    const directory = await workspace()
    const nested = path.join(directory, "packages", "app")
    await mkdir(path.join(directory, ".git"), { recursive: true })
    await mkdir(nested, { recursive: true })
    await writeFile(path.join(directory, ".git", "HEAD"), "0123456789abcdef\n")

    expect(workspaceInfo(nested)).toEqual({
      name: "app",
      branch: "0123456",
    })
  })

  it("returns no branch outside a repository", async () => {
    const directory = await workspace()
    expect(workspaceInfo(directory).branch).toBeNull()
  })
})
