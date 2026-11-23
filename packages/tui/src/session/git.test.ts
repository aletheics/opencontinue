import { execFileSync } from "node:child_process"
import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { formatWorkspaceDiff, workspaceDiff } from "./git.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) =>
      rm(directory, { recursive: true, force: true }),
    ),
  )
})

async function gitWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-git-"))
  temporary.push(directory)
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: directory, stdio: "ignore" })
  run(["init"])
  await writeFile(path.join(directory, "a.ts"), "const x = 1\n")
  run(["add", "."])
  run([
    "-c",
    "user.email=test@example.com",
    "-c",
    "user.name=Test",
    "commit",
    "-m",
    "init",
  ])
  return directory
}

describe("workspace diff", () => {
  it("shows modified files and a stat", async () => {
    const workspace = await gitWorkspace()
    await writeFile(path.join(workspace, "a.ts"), "const x = 2\n")

    const diff = await workspaceDiff(workspace)
    expect(diff.status).toContain("M a.ts")
    expect(diff.stat).toContain("a.ts")

    const text = formatWorkspaceDiff(diff)
    expect(text).toContain("M a.ts")
    expect(text).toContain("1 file changed")
  })

  it("reports a clean tree", async () => {
    const workspace = await gitWorkspace()
    expect(formatWorkspaceDiff(await workspaceDiff(workspace))).toBe(
      "No working tree changes.",
    )
  })
})
