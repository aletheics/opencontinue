import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import os from "node:os"
import path from "node:path"

import { MemorySessionStore } from "@opencontinue/core"
import type { ChatProvider } from "@opencontinue/providers"
import { runAgent } from "@opencontinue/runtime"
import { ToolRegistry, type PermissionGate } from "@opencontinue/tools"

const MAX_DIFF_CHARS = 120_000
const DEFAULT_TIMEOUT_MS = 5 * 60_000
const DEFAULT_CONCURRENCY = 4

const allowAll: PermissionGate = {
  async authorize() {
    return true
  },
}

export type CheckAgent = {
  name: string
  description: string
  file: string
  body: string
}

export type CheckStatus = "pass" | "fail" | "error"

export type CheckResult = {
  name: string
  agent: string
  status: CheckStatus
  output: string
  patch: string
  durationMs: number
  error?: string
}

export type CheckSummary = {
  total: number
  passed: number
  failed: number
  errored: number
}

export type RunChecksOptions = {
  repo: string
  base: string
  provider: ChatProvider
  agents?: string[]
  failFast?: boolean
  concurrency?: number
  timeoutMs?: number
}

export async function runGit(cwd: string, args: string[], input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn("git", args, { cwd, stdio: ["pipe", "pipe", "pipe"] })
    let stdout = ""
    let stderr = ""

    child.stdout.on("data", (chunk: Buffer) => {
      stdout += chunk.toString()
    })
    child.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString()
    })
    child.on("error", reject)
    child.on("close", (code) => {
      if (code === 0) resolve(stdout)
      else reject(new Error(`git ${args.join(" ")} failed (${code}): ${(stderr || stdout).trim()}`))
    })

    if (input !== undefined) child.stdin.write(input)
    child.stdin.end()
  })
}

export function parseAgentFile(file: string, content: string): CheckAgent {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/)
  const frontmatter = match?.[1] ?? ""
  const body = match ? content.slice(match[0].length) : content
  const description =
    frontmatter
      .split(/\r?\n/)
      .find((line) => line.startsWith("description:"))
      ?.slice("description:".length)
      .trim()
      .replace(/^["']|["']$/g, "") ?? ""

  return {
    name: path.basename(file, path.extname(file)).replace(/[-_]/g, " "),
    description,
    file,
    body: body.trim(),
  }
}

export async function discoverAgents(repo: string): Promise<CheckAgent[]> {
  const directories = [".opencontinue/agent", ".continue/agents", ".continue/checks"]
  const agents: CheckAgent[] = []

  for (const directory of directories) {
    const full = path.join(repo, directory)
    let entries: string[]
    try {
      entries = await fs.readdir(full)
    } catch {
      continue
    }

    for (const entry of entries.filter((name) => name.endsWith(".md")).sort()) {
      const file = path.join(full, entry)
      agents.push(parseAgentFile(file, await fs.readFile(file, "utf8")))
    }
  }

  return agents
}

async function loadExplicitAgents(repo: string, values: string[]): Promise<CheckAgent[]> {
  const files: string[] = []

  for (const value of values) {
    const full = path.resolve(repo, value)
    const stat = await fs.stat(full).catch(() => undefined)
    if (stat?.isDirectory()) {
      const entries = (await fs.readdir(full)).filter((entry) => entry.endsWith(".md"))
      files.push(...entries.map((entry) => path.join(full, entry)))
      continue
    }
    if (stat?.isFile()) {
      files.push(full)
      continue
    }
    throw new Error(`Agent not found: ${value}`)
  }

  return Promise.all(
    files.map(async (file) => parseAgentFile(file, await fs.readFile(file, "utf8"))),
  )
}

export async function resolveBase(repo: string, base: string): Promise<string> {
  for (const candidate of [base, `origin/${base}`]) {
    try {
      await runGit(repo, ["rev-parse", "--verify", candidate])
      return candidate
    } catch {
      // Try the next candidate.
    }
  }
  throw new Error(`Base ref not found: ${base}`)
}

export async function collectDiff(
  repo: string,
  base: string,
): Promise<{ diff: string; files: string[] }> {
  const diff = await runGit(repo, ["diff", "--no-color", base])
  const files = (await runGit(repo, ["diff", "--name-only", base]))
    .split(/\r?\n/)
    .filter(Boolean)
  return { diff, files }
}

export type CheckWorkspace = {
  dir: string
  cleanup: () => Promise<void>
}

export async function createCheckWorkspace(repo: string, base: string): Promise<CheckWorkspace> {
  const root = (await runGit(repo, ["rev-parse", "--show-toplevel"])).trim()
  await runGit(root, ["rev-parse", "--verify", base])

  const parent = await fs.mkdtemp(path.join(os.tmpdir(), "opencontinue-check-"))
  const dir = path.join(parent, "worktree")
  let added = false

  const cleanup = async () => {
    if (added) await runGit(root, ["worktree", "remove", "--force", dir]).catch(() => {})
    await fs.rm(parent, { recursive: true, force: true })
  }

  try {
    await runGit(root, ["worktree", "add", "--detach", dir, "HEAD"])
    added = true

    const dirty = await runGit(root, ["diff", "HEAD", "--binary"])
    if (dirty.trim()) await runGit(dir, ["apply", "--binary", "-"], dirty)

    const untracked = (await runGit(root, ["ls-files", "--others", "--exclude-standard"]))
      .split(/\r?\n/)
      .filter(Boolean)

    for (const relative of untracked) {
      const source = path.join(root, relative)
      const target = path.join(dir, relative)
      if (!isInside(root, source)) continue
      const stat = await fs.stat(source).catch(() => undefined)
      if (!stat?.isFile()) continue
      await fs.mkdir(path.dirname(target), { recursive: true })
      await fs.copyFile(source, target)
    }

    const status = await runGit(dir, ["status", "--porcelain"])
    if (status.trim()) {
      await runGit(dir, ["add", "-A"])
      await runGit(dir, [
        "-c",
        "user.name=opencontinue",
        "-c",
        "user.email=opencontinue@local",
        "commit",
        "-m",
        "check baseline",
        "--no-verify",
      ])
    }

    return { dir, cleanup }
  } catch (error) {
    await cleanup()
    throw error
  }
}

export async function capturePatch(dir: string): Promise<string> {
  await runGit(dir, ["add", "-A"])
  return runGit(dir, ["diff", "--cached", "--binary"])
}

export async function applyPatch(repo: string, patch: string): Promise<void> {
  if (!patch.trim()) return
  await runGit(repo, ["apply", "--binary", "-"], patch)
}

function buildPrompt(agent: CheckAgent, base: string, diff: string, files: string[]): string {
  const truncated =
    diff.length > MAX_DIFF_CHARS ? `${diff.slice(0, MAX_DIFF_CHARS)}\n\n[diff truncated]` : diff

  return [
    `You are running the "${agent.name}" check on the current changes.`,
    agent.description ? `Description: ${agent.description}` : "",
    agent.body,
    `Base: ${base}`,
    files.length ? `Changed files:\n${files.join("\n")}` : "Changed files: none",
    "Diff:",
    "```diff",
    truncated || "(no diff)",
    "```",
    "Rules:",
    "- Work only inside the provided workspace.",
    "- If you find a problem, edit files to fix it and explain briefly.",
    "- If there is no problem, reply PASS and do not edit.",
  ]
    .filter(Boolean)
    .join("\n\n")
}

async function runOne(
  agent: CheckAgent,
  options: RunChecksOptions,
  diff: string,
  files: string[],
): Promise<CheckResult> {
  const started = Date.now()
  let workspace: CheckWorkspace | undefined
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), options.timeoutMs ?? DEFAULT_TIMEOUT_MS)

  try {
    workspace = await createCheckWorkspace(options.repo, options.base)

    const store = new MemorySessionStore()
    const session = store.create(agent.name)
    store.append(session.id, {
      type: "message.user",
      text: buildPrompt(agent, options.base, diff, files),
    })

    await runAgent({
      store,
      sessionId: session.id,
      provider: options.provider,
      tools: new ToolRegistry(),
      permissions: allowAll,
      workspace: workspace.dir,
      systemPrompt: "You are OpenContinue running a source-controlled check.",
      signal: controller.signal,
    })

    const failed = store.events(session.id).find((event) => event.type === "run.failed")
    const snapshot = store.snapshot(session.id)
    const output = (snapshot?.messages ?? [])
      .filter((message) => message.role === "assistant")
      .map((message) => message.text)
      .join("\n")
      .trim()
    const patch = await capturePatch(workspace.dir)

    if (failed?.type === "run.failed") {
      return {
        name: agent.name,
        agent: agent.file,
        status: "error",
        output,
        patch: "",
        durationMs: Date.now() - started,
        error: failed.error,
      }
    }

    return {
      name: agent.name,
      agent: agent.file,
      status: patch.trim() ? "fail" : "pass",
      output,
      patch,
      durationMs: Date.now() - started,
    }
  } catch (error) {
    return {
      name: agent.name,
      agent: agent.file,
      status: "error",
      output: "",
      patch: "",
      durationMs: Date.now() - started,
      error: error instanceof Error ? error.message : String(error),
    }
  } finally {
    clearTimeout(timer)
    await workspace?.cleanup()
  }
}

export async function runChecks(options: RunChecksOptions): Promise<CheckResult[]> {
  const root = (await runGit(options.repo, ["rev-parse", "--show-toplevel"])).trim()
  const agents = options.agents?.length
    ? await loadExplicitAgents(root, options.agents)
    : await discoverAgents(root)

  if (agents.length === 0) {
    throw new Error("No checks found. Add .opencontinue/agent/*.md or pass --agent.")
  }

  const { diff, files } = await collectDiff(root, options.base)
  if (!diff.trim()) throw new Error(`No changes detected against ${options.base}`)

  const resolved = { ...options, repo: root }

  if (options.failFast) {
    const results: CheckResult[] = []
    for (const agent of agents) {
      const result = await runOne(agent, resolved, diff, files)
      results.push(result)
      if (result.status !== "pass") break
    }
    return results
  }

  const concurrency = Math.max(
    1,
    Math.min(options.concurrency ?? DEFAULT_CONCURRENCY, agents.length),
  )
  const results = new Array<CheckResult>(agents.length)
  let next = 0

  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      for (;;) {
        const index = next++
        if (index >= agents.length) return
        results[index] = await runOne(agents[index]!, resolved, diff, files)
      }
    }),
  )

  return results
}

export function summarizeResults(results: CheckResult[]): CheckSummary {
  return {
    total: results.length,
    passed: results.filter((result) => result.status === "pass").length,
    failed: results.filter((result) => result.status === "fail").length,
    errored: results.filter((result) => result.status === "error").length,
  }
}

export function formatText(results: CheckResult[]): string {
  const summary = summarizeResults(results)
  const lines = [
    `checks: ${summary.total}  pass: ${summary.passed}  fail: ${summary.failed}  error: ${summary.errored}`,
    "",
    "Check".padEnd(24) + "Status".padEnd(10) + "Time",
    "-".repeat(44),
  ]

  for (const result of results) {
    lines.push(
      result.name.padEnd(24) +
        result.status.padEnd(10) +
        `${(result.durationMs / 1000).toFixed(1)}s`,
    )
  }

  for (const result of results.filter((item) => item.status !== "pass")) {
    lines.push("", `=== ${result.name} (${result.status}) ===`)
    if (result.error) lines.push(`error: ${result.error}`)
    if (result.output) lines.push(result.output)
    if (result.patch) lines.push("", result.patch.trimEnd())
  }

  return lines.join("\n")
}

function isInside(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}
