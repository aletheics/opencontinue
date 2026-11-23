import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import type { ChatProvider } from "@opencontinue/providers"
import { afterEach, describe, expect, it } from "vitest"

import {
  capturePatch,
  createCheckWorkspace,
  discoverAgents,
  parseAgentFile,
  runChecks,
  runGit,
  runProcess,
} from "./checks.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function makeRepo(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-checks-"))
  temporary.push(directory)
  await runGit(directory, ["init", "-b", "main"])
  await runGit(directory, ["config", "user.name", "Test"])
  await runGit(directory, ["config", "user.email", "test@example.com"])
  await writeFile(path.join(directory, "a.txt"), "hello\n")
  await runGit(directory, ["add", "-A"])
  await runGit(directory, ["commit", "-m", "init"])
  return directory
}

describe("checks", () => {
  it("parses agent frontmatter", () => {
    const agent = parseAgentFile(
      "reviewer.md",
      "---\ndescription: Review code\nmode: subagent\n---\n\nFind bugs.",
    )
    expect(agent.name).toBe("reviewer")
    expect(agent.description).toBe("Review code")
    expect(agent.body).toBe("Find bugs.")
  })

  it("discovers agents from .opencontinue", async () => {
    const repo = await makeRepo()
    await mkdir(path.join(repo, ".opencontinue/agent"), { recursive: true })
    await writeFile(
      path.join(repo, ".opencontinue/agent/security.md"),
      "---\ndescription: Security review\nmode: subagent\n---\nCheck secrets.",
    )

    const agents = await discoverAgents(repo)
    expect(agents).toHaveLength(1)
    expect(agents[0]).toMatchObject({ name: "security", description: "Security review" })
  })

  it("times out and aborts a hanging process", async () => {
    const repo = await makeRepo()

    await expect(
      runProcess("node", ["-e", "setTimeout(()=>{}, 1000)"], {
        cwd: repo,
        timeoutMs: 30,
      }),
    ).rejects.toThrow(/timed out/)

    const controller = new AbortController()
    const pending = runProcess("node", ["-e", "setTimeout(()=>{}, 1000)"], {
      cwd: repo,
      signal: controller.signal,
      timeoutMs: 5_000,
    })
    setTimeout(() => controller.abort(), 30)
    await expect(pending).rejects.toThrow(/aborted/)
  }, 10_000)

  it("creates an isolated worktree and captures agent edits", async () => {
    const repo = await makeRepo()
    await writeFile(path.join(repo, "a.txt"), "changed\n")

    const workspace = await createCheckWorkspace(repo, "HEAD")
    await writeFile(path.join(workspace.dir, "a.txt"), "fixed\n")
    const patch = await capturePatch(workspace.dir)

    expect(patch).toContain("-changed")
    expect(patch).toContain("+fixed")
    await workspace.cleanup()
  })

  it("runs a check and returns a patch", async () => {
    const repo = await makeRepo()
    await mkdir(path.join(repo, ".opencontinue/agent"), { recursive: true })
    await writeFile(
      path.join(repo, ".opencontinue/agent/reviewer.md"),
      "---\ndescription: Review code\nmode: subagent\n---\nFix issues.",
    )
    await writeFile(path.join(repo, "a.txt"), "changed\n")

    let calls = 0
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        calls++
        if (calls === 1) {
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "write",
              arguments: JSON.stringify({ path: "a.txt", content: "fixed\n" }),
            },
          }
          return
        }
        yield { type: "text", text: "fixed" }
      },
    }

    const results = await runChecks({ repo, base: "HEAD", provider, failFast: true })

    expect(results).toHaveLength(1)
    expect(results[0]?.status).toBe("fail")
    expect(results[0]?.patch).toContain("+fixed")
  })
})
