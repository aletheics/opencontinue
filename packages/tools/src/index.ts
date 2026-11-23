import { spawn } from "node:child_process"
import { promises as fs } from "node:fs"
import path from "node:path"

import type { ToolDefinition } from "@opencontinue/providers"
import { createTwoFilesPatch } from "diff"
import { z } from "zod"
import { zodToJsonSchema } from "zod-to-json-schema"

export * from "./files.js"

export type ToolCapability = "read" | "write" | "execute"

export type ToolContext = {
  workspace: string
  sessionId: string
  signal?: AbortSignal
}

export type ToolOutput =
  | string
  | {
      output: string
      diff?: string
      /** The tool ran but reported a domain failure, such as a non-zero shell exit. */
      failed?: boolean
      exitCode?: number | null
      timedOut?: boolean
    }

export type ToolPreview = {
  detail?: string
  diff?: string
}

export type Tool = {
  name: string
  description: string
  capability: ToolCapability
  input: z.ZodTypeAny
  execute(raw: unknown, context: ToolContext): Promise<ToolOutput>
  preview?(raw: unknown, context: ToolContext): Promise<ToolPreview>
}

/** Why a tool was allowed to run. `auto` is the only mode label the TUI shows. */
export type AuthorizationReason = "auto" | "allow" | "read" | "user"

export type PermissionDecision = {
  approved: boolean
  reason?: AuthorizationReason
}

export type ToolExecution =
  | {
      ok: true
      output: string
      diff?: string
      failed?: boolean
      exitCode?: number | null
      timedOut?: boolean
      authorization?: AuthorizationReason
    }
  | { ok: false; error: string }

export interface PermissionGate {
  authorize(
    tool: Tool,
    input: unknown,
    context: ToolContext,
  ): Promise<boolean | PermissionDecision>
}

const MAX_READ_LINES = 2000
const MAX_OUTPUT_CHARS = 50_000
const MAX_GLOB = 500
const MAX_GREP = 200
const MAX_SEARCH_FILE_BYTES = 512_000

function resolveInside(workspace: string, inputPath: string): string {
  const root = path.resolve(workspace)
  const target = path.resolve(root, inputPath)
  const relative = path.relative(root, target)
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error(`Path is outside the workspace: ${inputPath}`)
  }
  return target
}

function truncate(text: string, max = MAX_OUTPUT_CHARS): string {
  if (text.length <= max) return text
  return `${text.slice(0, max)}\n...(truncated ${text.length - max} chars)`
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

const readInput = z.object({
  path: z.string().describe("File or directory to read"),
  offset: z.number().int().positive().optional().describe("1-based line to start reading"),
  limit: z.number().int().positive().max(MAX_READ_LINES).optional().describe("Maximum lines to read"),
})

export const readTool: Tool = {
  name: "read",
  description: "Read a file or list a directory inside the workspace. Prefer this over cat/ls.",
  capability: "read",
  input: readInput,
  async execute(raw, context) {
    const { path: inputPath, offset = 1, limit = MAX_READ_LINES } = readInput.parse(raw)
    const target = resolveInside(context.workspace, inputPath)
    const stat = await fs.stat(target)

    if (stat.isDirectory()) {
      const entries = await fs.readdir(target, { withFileTypes: true })
      return (
        entries
          .sort((left, right) => left.name.localeCompare(right.name))
          .slice(0, limit)
          .map((entry) => `${entry.isDirectory() ? "dir " : "file"} ${entry.name}`)
          .join("\n") || "(empty directory)"
      )
    }

    const content = await fs.readFile(target, "utf8")
    const lines = content.split(/\r?\n/)
    const start = Math.max(0, offset - 1)
    const selected = lines.slice(start, start + limit)
    return truncate(selected.map((line, index) => `${start + index + 1}: ${line}`).join("\n")) || "(empty file)"
  },
}

const writeInput = z.object({
  path: z.string().describe("File to create or overwrite"),
  content: z.string().describe("New file content"),
})

export const writeTool: Tool = {
  name: "write",
  description: "Create or overwrite a file inside the workspace.",
  capability: "write",
  input: writeInput,
  async preview(raw, context) {
    const { path: inputPath, content } = writeInput.parse(raw)
    const target = resolveInside(context.workspace, inputPath)
    const before = await fs.readFile(target, "utf8").catch(() => "")
    const diff = createTwoFilesPatch(inputPath, inputPath, before, content, "", "")
    return { detail: inputPath, diff: diff.trim() ? diff : undefined }
  },
  async execute(raw, context) {
    const { path: inputPath, content } = writeInput.parse(raw)
    const target = resolveInside(context.workspace, inputPath)
    const before = await fs.readFile(target, "utf8").catch(() => "")
    await fs.mkdir(path.dirname(target), { recursive: true })
    await fs.writeFile(target, content, "utf8")
    const diff = createTwoFilesPatch(inputPath, inputPath, before, content, "", "")
    return {
      output: `Wrote ${content.length} characters to ${inputPath}`,
      diff: diff.trim() ? diff : undefined,
    }
  },
}

const editInput = z.object({
  path: z.string().describe("File to edit"),
  oldString: z.string().describe("Exact text to replace"),
  newString: z.string().describe("Replacement text"),
  replaceAll: z.boolean().optional().describe("Replace every occurrence instead of requiring a unique match"),
})

export const editTool: Tool = {
  name: "edit",
  description:
    "Replace an exact string in a file. By default oldString must appear exactly once; set replaceAll to override.",
  capability: "write",
  input: editInput,
  async preview(raw, context) {
    const { path: inputPath, oldString, newString, replaceAll = false } = editInput.parse(raw)
    if (!oldString || oldString === newString) return { detail: inputPath }

    const target = resolveInside(context.workspace, inputPath)
    const content = await fs.readFile(target, "utf8")
    const count = content.split(oldString).length - 1
    if (count === 0 || (count > 1 && !replaceAll)) return { detail: inputPath }

    const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString)
    const diff = createTwoFilesPatch(inputPath, inputPath, content, updated, "", "")
    return { detail: inputPath, diff: diff.trim() ? diff : undefined }
  },
  async execute(raw, context) {
    const { path: inputPath, oldString, newString, replaceAll = false } = editInput.parse(raw)
    if (!oldString) throw new Error("oldString must not be empty")
    if (oldString === newString) throw new Error("oldString and newString must differ")

    const target = resolveInside(context.workspace, inputPath)
    const content = await fs.readFile(target, "utf8")
    const count = content.split(oldString).length - 1
    if (count === 0) throw new Error(`oldString not found in ${inputPath}`)
    if (count > 1 && !replaceAll) {
      throw new Error(`oldString appears ${count} times in ${inputPath}; make it unique or set replaceAll`)
    }

    const updated = replaceAll ? content.split(oldString).join(newString) : content.replace(oldString, newString)
    await fs.writeFile(target, updated, "utf8")
    const diff = createTwoFilesPatch(inputPath, inputPath, content, updated, "", "")
    return {
      output: `Replaced ${replaceAll ? count : 1} occurrence(s) in ${inputPath}`,
      diff: diff.trim() ? diff : undefined,
    }
  },
}

const globInput = z.object({
  pattern: z.string().describe('Glob pattern, for example "**/*.ts"'),
  path: z.string().optional().describe("Directory to search, defaults to the workspace root"),
  limit: z.number().int().positive().max(MAX_GLOB).optional().describe("Maximum number of paths"),
})

export const globTool: Tool = {
  name: "glob",
  description: "Find files by glob pattern inside the workspace.",
  capability: "read",
  input: globInput,
  async execute(raw, context) {
    const { pattern, path: searchPath = ".", limit = MAX_GLOB } = globInput.parse(raw)
    const root = resolveInside(context.workspace, searchPath)
    const results: string[] = []

    for await (const entry of fs.glob(pattern, {
      cwd: root,
      exclude: ["**/node_modules/**", "**/.git/**"],
    })) {
      results.push(String(entry))
      if (results.length >= limit) break
    }

    results.sort()
    return results.length ? results.join("\n") : "No files found"
  },
}

const grepInput = z.object({
  pattern: z.string().min(1).describe("Literal text or regular expression"),
  path: z.string().optional().describe("File or directory to search"),
  include: z.string().optional().describe('Glob filter, for example "*.ts"'),
  literal: z.boolean().optional().describe("Treat pattern as literal text"),
  caseSensitive: z.boolean().optional().describe("Use case-sensitive matching (default true)"),
  limit: z.number().int().positive().max(MAX_GREP).optional().describe("Maximum matching lines"),
})

export const grepTool: Tool = {
  name: "grep",
  description: "Search file contents inside the workspace and return matching paths and line numbers.",
  capability: "read",
  input: grepInput,
  async execute(raw, context) {
    const {
      pattern,
      path: searchPath = ".",
      include,
      literal = false,
      caseSensitive = true,
      limit = MAX_GREP,
    } = grepInput.parse(raw)

    const root = resolveInside(context.workspace, searchPath)
    const stat = await fs.stat(root)

    const matcher = (() => {
      if (literal) {
        const needle = caseSensitive ? pattern : pattern.toLowerCase()
        return (line: string) => (caseSensitive ? line : line.toLowerCase()).includes(needle)
      }
      let regex: RegExp
      try {
        regex = new RegExp(pattern, caseSensitive ? "" : "i")
      } catch (error) {
        throw new Error(`Invalid regular expression: ${messageOf(error)}`)
      }
      return (line: string) => regex.test(line)
    })()

    const files: string[] = []
    if (stat.isFile()) {
      files.push(root)
    } else {
      const globPattern = include ? (include.includes("/") ? include : `**/${include}`) : "**/*"
      for await (const entry of fs.glob(globPattern, {
        cwd: root,
        exclude: ["**/node_modules/**", "**/.git/**"],
      })) {
        files.push(path.resolve(root, String(entry)))
      }
    }

    const matches: string[] = []
    for (const file of files) {
      if (matches.length >= limit) break
      try {
        const info = await fs.stat(file)
        if (!info.isFile() || info.size > MAX_SEARCH_FILE_BYTES) continue
        const content = await fs.readFile(file, "utf8")
        if (content.includes("\0")) continue
        const lines = content.split(/\r?\n/)
        for (let index = 0; index < lines.length && matches.length < limit; index++) {
          const line = lines[index] ?? ""
          if (matcher(line)) {
            matches.push(`${path.relative(context.workspace, file)}:${index + 1}: ${line}`)
          }
        }
      } catch {
        // Unreadable files are skipped.
      }
    }

    return matches.length ? matches.join("\n") : "No matches found"
  },
}

const bashInput = z.object({
  command: z.string().min(1).describe("Shell command to run"),
  cwd: z.string().optional().describe("Working directory, defaults to the workspace root"),
  timeoutMs: z.number().int().positive().max(600_000).optional().describe("Timeout in milliseconds"),
})

const todoStatus = z.enum(["pending", "in_progress", "completed"])

const todoInput = z.object({
  todos: z
    .array(
      z.object({
        content: z.string().min(1).describe("Imperative task description"),
        status: todoStatus.describe("pending, in_progress, or completed"),
        activeForm: z
          .string()
          .optional()
          .describe("Present-continuous label shown while in progress"),
      }),
    )
    .max(12)
    .describe("The complete task list, in order; replace it on every update"),
})

export const todoTool: Tool = {
  name: "todo",
  description:
    "Maintain a short task list for multi-step work. Call with the complete list whenever a task starts, finishes, or changes. Use three or more meaningful steps; skip it for simple questions. Keep at most one task in_progress.",
  capability: "read",
  input: todoInput,
  async execute(raw) {
    const { todos } = todoInput.parse(raw)
    const active = todos.filter((todo) => todo.status === "in_progress").length
    if (active > 1) {
      throw new Error("Only one todo may be in_progress")
    }

    const done = todos.filter((todo) => todo.status === "completed").length
    return `${done}/${todos.length} complete`
  },
}

export const bashTool: Tool = {
  name: "bash",
  description: "Run a shell command inside the workspace and return combined stdout/stderr.",
  capability: "execute",
  input: bashInput,
  async execute(raw, context) {
    const { command, cwd = ".", timeoutMs = 120_000 } = bashInput.parse(raw)
    const workdir = resolveInside(context.workspace, cwd)

    return await new Promise<ToolOutput>((resolve, reject) => {
      const child = spawn(command, {
        shell: true,
        cwd: workdir,
        env: { ...process.env, OPENCONTINUE_SESSION_ID: context.sessionId },
      })

      let output = ""
      let timedOut = false
      const append = (chunk: Buffer) => {
        output = truncate(output + chunk.toString())
      }

      child.stdout?.on("data", append)
      child.stderr?.on("data", append)

      const timer = setTimeout(() => {
        timedOut = true
        child.kill()
      }, timeoutMs)

      const abort = () => child.kill()
      context.signal?.addEventListener("abort", abort, { once: true })

      child.on("error", (error) => {
        clearTimeout(timer)
        context.signal?.removeEventListener("abort", abort)
        reject(error)
      })

      child.on("close", (code) => {
        clearTimeout(timer)
        context.signal?.removeEventListener("abort", abort)
        const failed = code !== 0 || timedOut
        resolve({
          output: [
            output.trimEnd(),
            failed
              ? `Exit code ${code ?? "null"}${timedOut ? " (timed out)" : ""}`
              : "",
          ]
            .filter(Boolean)
            .join("\n"),
          failed,
          exitCode: code,
          timedOut,
        })
      })
    })
  },
}

export class ToolRegistry {
  private readonly tools = new Map<string, Tool>()

  constructor(
    tools: Tool[] = [
      readTool,
      writeTool,
      editTool,
      globTool,
      grepTool,
      bashTool,
      todoTool,
    ],
  ) {
    for (const tool of tools) this.tools.set(tool.name, tool)
  }

  list(): Tool[] {
    return [...this.tools.values()]
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  definitions(): ToolDefinition[] {
    return this.list().map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: zodToJsonSchema(tool.input, { $refStrategy: "none" }),
    }))
  }

  async execute(
    name: string,
    rawArguments: string,
    context: ToolContext,
    gate?: PermissionGate,
  ): Promise<ToolExecution> {
    const tool = this.tools.get(name)
    if (!tool) return { ok: false, error: `Unknown tool: ${name}` }

    let raw: unknown
    try {
      raw = JSON.parse(rawArguments || "{}")
    } catch {
      return { ok: false, error: "Tool arguments must be valid JSON" }
    }

    const parsed = tool.input.safeParse(raw)
    if (!parsed.success) {
      return { ok: false, error: `Invalid arguments: ${parsed.error.message}` }
    }

    let authorization: AuthorizationReason | undefined
    if (gate) {
      const decision = await gate.authorize(tool, parsed.data, context)
      const approved =
        typeof decision === "boolean" ? decision : decision.approved
      if (!approved) return { ok: false, error: "Permission denied" }
      authorization =
        typeof decision === "boolean" ? undefined : decision.reason
    }

    try {
      const result = await tool.execute(parsed.data, context)
      if (typeof result === "string") {
        return {
          ok: true,
          output: result,
          ...(authorization === undefined ? {} : { authorization }),
        }
      }
      return {
        ok: true,
        output: result.output,
        ...(result.diff === undefined ? {} : { diff: result.diff }),
        ...(result.failed ? { failed: true } : {}),
        ...(result.exitCode === undefined ? {} : { exitCode: result.exitCode }),
        ...(result.timedOut ? { timedOut: true } : {}),
        ...(authorization === undefined ? {} : { authorization }),
      }
    } catch (error) {
      return { ok: false, error: messageOf(error) }
    }
  }
}
