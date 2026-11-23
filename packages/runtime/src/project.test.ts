import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { loadProjectConfig } from "./project.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function makeWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-project-"))
  temporary.push(directory)
  return directory
}

describe("loadProjectConfig", () => {
  it("loads the permission mode and instruction files", async () => {
    const workspace = await makeWorkspace()
    await mkdir(path.join(workspace, ".opencontinue"), { recursive: true })
    await writeFile(
      path.join(workspace, ".opencontinue", "opencontinue.json"),
      JSON.stringify({
        permissions: { mode: "readonly" },
        instructions: [".opencontinue/AGENTS.md"],
      }),
    )
    await writeFile(path.join(workspace, ".opencontinue", "AGENTS.md"), "runtime rules")

    const config = loadProjectConfig(workspace)

    expect(config.permissionMode).toBe("plan")
    expect(config.allow).toEqual([])
    expect(config.ask).toEqual([])
    expect(config.deny).toEqual([])
    expect(config.instructions).toBe("runtime rules")
  })

  it("accepts UTF-8 BOM in project config and instructions", async () => {
    const workspace = await makeWorkspace()
    await mkdir(path.join(workspace, ".opencontinue"), { recursive: true })
    const bom = String.fromCharCode(0xfeff)
    await writeFile(
      path.join(workspace, ".opencontinue", "opencontinue.json"),
      bom + JSON.stringify({ permissions: { mode: "auto" } }),
    )
    await writeFile(
      path.join(workspace, ".opencontinue", "AGENTS.md"),
      `${bom}project rules`,
    )

    const config = loadProjectConfig(workspace)

    expect(config.permissionMode).toBe("auto")
    expect(config.instructions).toBe("project rules")
  })

  it("falls back to .opencontinue/AGENTS.md and ignores malformed config", async () => {
    const workspace = await makeWorkspace()
    await mkdir(path.join(workspace, ".opencontinue"), { recursive: true })
    await writeFile(path.join(workspace, ".opencontinue", "opencontinue.json"), "{ bad")
    await writeFile(path.join(workspace, ".opencontinue", "AGENTS.md"), "default rules")

    const config = loadProjectConfig(workspace)

    expect(config.permissionMode).toBeUndefined()
    expect(config.instructions).toBe("default rules")
  })

  it("ignores instruction paths outside the workspace", async () => {
    const workspace = await makeWorkspace()
    await mkdir(path.join(workspace, ".opencontinue"), { recursive: true })
    await writeFile(
      path.join(workspace, ".opencontinue", "opencontinue.json"),
      JSON.stringify({ instructions: ["../../outside.md"] }),
    )

    const config = loadProjectConfig(workspace)

    expect(config.instructions).toBe("")
  })
})
