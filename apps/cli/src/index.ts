#!/usr/bin/env node

import { createInterface } from "node:readline/promises"

import { Command } from "commander"

import { HttpSessionClient } from "@opencontinue/client"
import { resolveProviderSettings } from "@opencontinue/config"
import { createSessionStore } from "@opencontinue/core"
import type { PermissionMode, SessionEvent } from "@opencontinue/protocol"
import { createProvider } from "@opencontinue/providers"
import { closeServer, startServer } from "@opencontinue/server"

import {
  applyPatch,
  formatText,
  resolveBase,
  runChecks,
  summarizeResults,
} from "./checks.js"
import { doctorExitCode, formatDoctor, runDoctor } from "./doctor.js"
import { importCommand } from "./import.js"
import { configCommand, setupCommand } from "./setup.js"

type PermissionRequestEvent = Extract<SessionEvent, { type: "permission.requested" }>

type ChatOptions = {
  print?: boolean
  url?: string
  token?: string
  port?: string
  resume?: string
  auto?: boolean
  readonly?: boolean
  plan?: boolean
  fullscreen?: boolean
}

class ConversationClient {
  private pending: { resolve: () => void; reject: (error: Error) => void } | null = null
  private readonly subscription

  constructor(
    private readonly client: HttpSessionClient,
    private readonly sessionId: string,
    private readonly onDelta: (text: string) => void,
    private readonly onPermission?: (
      event: PermissionRequestEvent,
    ) => Promise<boolean> | boolean,
  ) {
    this.subscription = client.subscribe(sessionId, -1, (event) => this.handle(event))
  }

  private handle(event: SessionEvent): void {
    if (event.type === "message.assistant.delta") {
      this.onDelta(event.text)
      return
    }
    if (event.type === "tool.started") {
      this.onDelta(`\n[tool] ${event.name}\n`)
      return
    }
    if (event.type === "tool.failed") {
      this.onDelta(`[tool failed] ${event.error}\n`)
      return
    }
    if (event.type === "permission.requested") {
      void this.answerPermission(event)
      return
    }
    if (event.type === "run.completed") {
      this.onDelta("\n")
      this.pending?.resolve()
      this.pending = null
      return
    }
    if (event.type === "run.failed") {
      this.pending?.reject(new Error(event.error))
      this.pending = null
    }
  }

  private async answerPermission(event: PermissionRequestEvent): Promise<void> {
    let approved = false
    try {
      approved = (await this.onPermission?.(event)) ?? false
    } catch {
      approved = false
    }

    try {
      await this.client.resolvePermission(this.sessionId, event.requestId, approved)
    } catch {
      // The run fails closed if the decision cannot be delivered.
    }
  }

  async send(text: string): Promise<void> {
    await this.subscription.ready

    const pending = new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject }
    })
    pending.catch(() => {})

    try {
      await this.client.sendMessage(this.sessionId, text)
    } catch (error) {
      this.pending = null
      throw error
    }

    await pending
  }

  close(): void {
    this.subscription.close()
    this.client.close()
  }
}

function permissionMode(options: ChatOptions, headless = false): PermissionMode | undefined {
  if (options.auto) return "auto"
  if (options.plan || options.readonly) return "plan"
  return headless ? "plan" : undefined
}

async function withServer(
  options: ChatOptions,
  mode: PermissionMode | undefined,
  run: (baseUrl: string, token: string | undefined) => Promise<void>,
): Promise<void> {
  if (options.url) {
    await run(
      options.url.replace(/\/$/, ""),
      options.token ?? process.env.OPENCONTINUE_SERVER_TOKEN,
    )
    return
  }

  const port = Number(options.port ?? process.env.OPENCONTINUE_PORT ?? 8787)
  const workspace = process.env.INIT_CWD ?? process.cwd()
  const store = createSessionStore({ workspace })
  const running = startServer({ store, port, permissionMode: mode, workspace })
  console.log(`embedded server on http://127.0.0.1:${running.port}`)
  if (running.warning) console.warn(`provider: ${running.warning}`)
  else console.log(`provider: ${running.provider.id} (${running.provider.model})`)
  console.log(`permissions: ${running.permissionMode}`)
  try {
    await run(`http://127.0.0.1:${running.port}`, running.token)
  } finally {
    await closeServer(running.server)
    store.close()
  }
}

async function chat(options: ChatOptions): Promise<void> {
  await withServer(options, permissionMode(options), async (baseUrl, token) => {
    const sessionClient = new HttpSessionClient({ baseUrl, token })
    const sessionId = options.resume ?? (await sessionClient.createSession()).id

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const conversation = new ConversationClient(
      sessionClient,
      sessionId,
      (text) => process.stdout.write(text),
      async (event) => {
        const answer = await rl.question(
          `\n[permission] ${event.tool} ${JSON.stringify(event.input)}\nAllow? [y/N] `,
        )
        return /^y/i.test(answer.trim())
      },
    )

    console.log(`OpenContinue session ${sessionId}`)
    console.log("Type /exit to quit.\n")

    try {
      for (;;) {
        const line = (await rl.question("you> ")).trim()
        if (!line) continue
        if (line === "/exit" || line === "/quit") break

        process.stdout.write("ai> ")
        try {
          await conversation.send(line)
        } catch (error) {
          console.error(`\nerror: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } finally {
      rl.close()
      conversation.close()
    }
  })
}

async function printOnce(prompt: string, options: ChatOptions): Promise<void> {
  if (!prompt.trim()) throw new Error("A prompt is required with --print")

  await withServer(options, permissionMode(options, true), async (baseUrl, token) => {
    const sessionClient = new HttpSessionClient({ baseUrl, token })
    const created = await sessionClient.createSession()
    let output = ""
    const conversation = new ConversationClient(
      sessionClient,
      created.id,
      (text) => {
        output += text
      },
      () => false,
    )
    try {
      await conversation.send(prompt)
    } finally {
      conversation.close()
    }
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`)
  })
}

async function serveCommand(options: {
  port?: string
  token?: string
  auto?: boolean
  readonly?: boolean
  plan?: boolean
}): Promise<void> {
  if (options.auto && (options.readonly || options.plan)) {
    throw new Error("--auto cannot be combined with --plan or --readonly")
  }

  const port = Number(options.port ?? process.env.OPENCONTINUE_PORT ?? 8787)
  const mode: PermissionMode | undefined = options.auto
    ? "auto"
    : options.plan || options.readonly
      ? "plan"
      : undefined
  const workspace = process.env.INIT_CWD ?? process.cwd()
  const store = createSessionStore({ workspace })
  const running = startServer({
    store,
    port,
    permissionMode: mode,
    workspace,
    token: options.token,
  })
  console.log(`opencontinue server listening on http://127.0.0.1:${running.port}`)
  console.log(`auth token: ${running.token}`)
  if (running.warning) console.warn(`provider: ${running.warning}`)
  else console.log(`provider: ${running.provider.id} (${running.provider.model})`)
  console.log(`workspace: ${running.workspace}`)
  console.log(`permissions: ${running.permissionMode}`)

  const shutdown = async () => {
    console.log("\nShutting down...")
    await closeServer(running.server)
    store.close()
    process.exit(0)
  }
  process.on("SIGINT", () => void shutdown())
  process.on("SIGTERM", () => void shutdown())

  await new Promise<void>(() => {})
}

type CheckCommandOptions = {
  base?: string
  format?: string
  patch?: boolean
  fix?: boolean
  failFast?: boolean
  agent?: string[]
  concurrency?: string
  timeout?: string
}

function collect(value: string, previous: string[] = []): string[] {
  return [...previous, value]
}

async function checkCommand(options: CheckCommandOptions): Promise<void> {
  const repo = process.env.INIT_CWD ?? process.cwd()
  const base = await resolveBase(repo, options.base ?? "main")
  const selection = createProvider(resolveProviderSettings())

  if (selection.provider.id === "echo") {
    console.error("No model provider configured. Set OPENCONTINUE_API_KEY or OPENCONTINUE_BASE_URL.")
    process.exitCode = 2
    return
  }
  if (selection.warning) console.warn(`provider: ${selection.warning}`)

  const results = await runChecks({
    repo,
    base,
    provider: selection.provider,
    agents: options.agent,
    failFast: options.failFast,
    concurrency: Number(options.concurrency ?? 4),
    timeoutMs: Number(options.timeout ?? 300) * 1000,
  })
  const summary = summarizeResults(results)

  if (options.fix) {
    const patch = results
      .filter((result) => result.patch)
      .map((result) => result.patch)
      .join("\n")
    if (patch.trim()) await applyPatch(repo, patch)
  }

  if (options.format === "json") {
    console.log(JSON.stringify({ checks: results, summary }, null, 2))
  } else {
    console.log(formatText(results))
    if (options.patch) {
      for (const result of results) {
        if (result.patch) console.log(`\n# ${result.name}\n${result.patch.trimEnd()}`)
      }
    }
  }

  if (summary.failed > 0 || summary.errored > 0) process.exitCode = 1
}

async function startTui(options: {
  auto?: boolean
  readonly?: boolean
  plan?: boolean
  resume?: string
  url?: string
  token?: string
  fullscreen?: boolean
}): Promise<void> {
  if (options.auto && (options.readonly || options.plan)) {
    throw new Error("--auto cannot be combined with --plan or --readonly")
  }
  if (!process.stdin.isTTY) {
    throw new Error("TUI requires a TTY. Use `opencontinue -p \"...\"` or `--url` in non-interactive environments.")
  }
  const { runTui } = await import("@opencontinue/tui")
  await runTui(options)
}

async function sessionsCommand(options: {
  url?: string
  token?: string
}): Promise<void> {
  const client = new HttpSessionClient({
    baseUrl: options.url ?? "http://127.0.0.1:8787",
    token: options.token ?? process.env.OPENCONTINUE_SERVER_TOKEN,
  })
  try {
    const sessions = await client.listSessions()
    if (sessions.length === 0) {
      console.log("No sessions.")
      return
    }
    for (const session of sessions) {
      console.log(`${session.id}  ${session.title}  ${session.updatedAt}`)
    }
  } finally {
    client.close()
  }
}

const program = new Command()
program
  .name("opencontinue")
  .description("The open continuum for AI-assisted engineering.")
  .version("0.0.1")

program
  .argument("[prompt]", "Prompt to run once (headless)")
  .option("-p, --print", "Run once and print the result")
  .option("--url <url>", "Connect to a running server")
  .option("--token <token>", "Bearer token for a remote server")
  .option("--port <port>", "Port for the embedded server", "8787")
  .option("--resume <id>", "Resume an existing session")
  .option("--auto", "Auto mode: allow write and shell tools without approval")
  .option("--plan", "Plan mode: read and analyze only; deny write and shell tools")
  .option("--readonly", "Alias for --plan")
  .option("--fullscreen", "Use the fullscreen TUI renderer")
  .action(async (prompt: string | undefined, options: ChatOptions) => {
    if (options.auto && (options.plan || options.readonly)) {
      throw new Error("--auto cannot be combined with --plan or --readonly")
    }
    if (options.print || prompt) await printOnce(prompt ?? "", options)
    else if (process.stdin.isTTY) {
      await startTui({
        auto: options.auto,
        plan: options.plan || options.readonly,
        resume: options.resume,
        url: options.url,
        token: options.token,
        fullscreen: options.fullscreen,
      })
    } else await chat(options)
  })

program
  .command("serve")
  .description("Start the HTTP/SSE server")
  .addHelpText("after", "\nGlobal flags: --port <port>, --auto, --plan, --readonly, --fullscreen")
  .action(() =>
    serveCommand({
      port: String(program.opts().port ?? "8787"),
      token: program.opts().token as string | undefined,
      auto: Boolean(program.opts().auto),
      plan: Boolean(program.opts().plan),
      readonly: Boolean(program.opts().readonly),
    }),
  )

program
  .command("tui")
  .description("Start the terminal UI")
  .action(() =>
    startTui({
      auto: Boolean(program.opts().auto),
      plan: Boolean(program.opts().plan || program.opts().readonly),
      resume: program.opts().resume as string | undefined,
      url: program.opts().url as string | undefined,
      token: program.opts().token as string | undefined,
      fullscreen: Boolean(program.opts().fullscreen),
    }),
  )

program
  .command("setup")
  .description("Configure the provider and API key")
  .action(setupCommand)

program
  .command("config")
  .description("Show provider configuration")
  .action(configCommand)

program
  .command("import <source>")
  .description("Import provider settings from Continue or OpenCode")
  .option("--path <path>", "Config file path")
  .option("--yes", "Apply without confirmation")
  .action(importCommand)

program
  .command("check")
  .description("Run source-controlled checks against a base ref")
  .option("--base <ref>", "Base git ref", "main")
  .option("--format <format>", "Output format: text or json", "text")
  .option("--patch", "Print patches")
  .option("--fix", "Apply patches to the working tree")
  .option("--fail-fast", "Stop after the first failing check")
  .option("--agent <path>", "Agent file or directory (repeatable)", collect, [])
  .option("--concurrency <n>", "Parallel checks", "4")
  .option("--timeout <seconds>", "Per-check timeout", "300")
  .action((options: CheckCommandOptions) =>
    checkCommand({
      ...options,
      format: String(program.opts().format ?? options.format ?? "text"),
    }),
  )

program
  .command("doctor")
  .description("Check Node, workspace, provider, auth, sessions, and server")
  .option("--json", "Print machine-readable checks")
  .option("--network", "Check the provider model list over the network")
  .option("--url <url>", "Also check a running server")
  .option("--token <token>", "Bearer token for the server check")
  .action(
    async (options: {
      json?: boolean
      network?: boolean
      url?: string
      token?: string
    }) => {
      const checks = await runDoctor({
        workspace: process.env.INIT_CWD ?? process.cwd(),
        url: options.url ? String(program.opts().url ?? options.url) : undefined,
        token:
          options.token ??
          (program.opts().token as string | undefined) ??
          process.env.OPENCONTINUE_SERVER_TOKEN,
        network: options.network,
      })
      console.log(
        options.json ? JSON.stringify({ checks }, null, 2) : formatDoctor(checks),
      )
      process.exitCode = doctorExitCode(checks)
    },
  )

program
  .command("sessions")
  .description("List sessions from a running server")
  .option("--url <url>", "Server URL", "http://127.0.0.1:8787")
  .option("--token <token>", "Bearer token for the server")
  .action((options: { url?: string; token?: string }) =>
    sessionsCommand({
      url: String(program.opts().url ?? options.url),
      token:
        options.token ??
        (program.opts().token as string | undefined) ??
        process.env.OPENCONTINUE_SERVER_TOKEN,
    }),
  )

try {
  await program.parseAsync(process.argv)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
