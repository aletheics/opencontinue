#!/usr/bin/env node

import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { createInterface } from "node:readline/promises"
import { fileURLToPath } from "node:url"

import { Command } from "commander"

import { createSessionStore } from "@opencontinue/core"
import type { SessionEvent, SessionSnapshot, SessionSummary } from "@opencontinue/protocol"
import { closeServer, startServer } from "@opencontinue/server"

const envPath = fileURLToPath(new URL("../../../.env", import.meta.url))
if (existsSync(envPath)) loadEnvFile(envPath)

type PermissionMode = "ask" | "auto" | "readonly"
type PermissionRequestEvent = Extract<SessionEvent, { type: "permission.requested" }>

type ChatOptions = {
  print?: boolean
  url?: string
  port?: string
  resume?: string
  auto?: boolean
  readonly?: boolean
}

async function request<T>(baseUrl: string, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: { "content-type": "application/json" },
  })
  if (!response.ok) throw new Error(`${response.status} ${await response.text()}`)
  return (await response.json()) as T
}

class SessionClient {
  private lastSeq = -1
  private connected = false
  private pending: { resolve: () => void; reject: (error: Error) => void } | null = null
  private readonly abort = new AbortController()
  private readonly ready: Promise<void>
  private resolveReady: () => void = () => {}
  private rejectReady: (error: Error) => void = () => {}

  constructor(
    private readonly baseUrl: string,
    private readonly sessionId: string,
    private readonly onDelta: (text: string) => void,
    private readonly onPermission?: (event: PermissionRequestEvent) => void | Promise<void>,
  ) {
    this.ready = new Promise<void>((resolve, reject) => {
      this.resolveReady = resolve
      this.rejectReady = reject
    })
    this.ready.catch(() => {})
    void this.loop()
  }

  private async loop(): Promise<void> {
    while (!this.abort.signal.aborted) {
      try {
        const response = await fetch(
          `${this.baseUrl}/v1/sessions/${this.sessionId}/events?after=${this.lastSeq}`,
          {
            signal: this.abort.signal,
            headers: { accept: "text/event-stream" },
          },
        )
        if (!response.ok || !response.body) {
          throw new Error(`SSE failed: ${response.status} ${await response.text()}`)
        }

        this.connected = true
        this.resolveReady()

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let boundary = buffer.indexOf("\n\n")
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            const data = block
              .split("\n")
              .filter((line) => line.startsWith("data:"))
              .map((line) => line.slice(5).trim())
              .join("\n")
            if (data) this.handle(JSON.parse(data) as SessionEvent)
            boundary = buffer.indexOf("\n\n")
          }
        }
      } catch (error) {
        if (this.abort.signal.aborted) return
        const failure = error instanceof Error ? error : new Error(String(error))

        if (!this.connected) {
          this.rejectReady(failure)
          return
        }

        this.pending?.reject(failure)
        this.pending = null
        await new Promise((resolve) => setTimeout(resolve, 500))
      }
    }
  }

  private handle(event: SessionEvent): void {
    if (event.seq <= this.lastSeq) return
    this.lastSeq = event.seq

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
      void this.onPermission?.(event)
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

  async send(text: string): Promise<void> {
    await this.ready
    const done = new Promise<void>((resolve, reject) => {
      this.pending = { resolve, reject }
    })
    await request(this.baseUrl, `/v1/sessions/${this.sessionId}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    })
    await done
  }

  close(): void {
    this.abort.abort()
  }
}

function permissionMode(options: ChatOptions, headless = false): PermissionMode | undefined {
  if (options.auto) return "auto"
  if (options.readonly) return "readonly"
  return headless ? "readonly" : undefined
}

async function withServer(
  options: ChatOptions,
  mode: PermissionMode | undefined,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  if (options.url) {
    await run(options.url.replace(/\/$/, ""))
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
    await run(`http://127.0.0.1:${running.port}`)
  } finally {
    await closeServer(running.server)
    store.close()
  }
}

async function chat(options: ChatOptions): Promise<void> {
  await withServer(options, permissionMode(options), async (baseUrl) => {
    let sessionId = options.resume
    if (!sessionId) {
      const created = await request<SessionSnapshot>(baseUrl, "/v1/sessions", {
        method: "POST",
        body: "{}",
      })
      sessionId = created.id
    }
    const activeSessionId = sessionId

    const rl = createInterface({ input: process.stdin, output: process.stdout })
    const client = new SessionClient(
      baseUrl,
      activeSessionId,
      (text) => process.stdout.write(text),
      async (event) => {
        const answer = await rl.question(
          `\n[permission] ${event.tool} ${JSON.stringify(event.input)}\nAllow? [y/N] `,
        )
        try {
          await request(
            baseUrl,
            `/v1/sessions/${activeSessionId}/permissions/${event.requestId}`,
            {
              method: "POST",
              body: JSON.stringify({ approved: /^y/i.test(answer.trim()) }),
            },
          )
        } catch {
          // The run will fail closed if the decision cannot be delivered.
        }
      },
    )

    console.log(`OpenContinue session ${activeSessionId}`)
    console.log("Type /exit to quit.\n")

    try {
      for (;;) {
        const line = (await rl.question("you> ")).trim()
        if (!line) continue
        if (line === "/exit" || line === "/quit") break

        process.stdout.write("ai> ")
        try {
          await client.send(line)
        } catch (error) {
          console.error(`\nerror: ${error instanceof Error ? error.message : String(error)}`)
        }
      }
    } finally {
      rl.close()
      client.close()
    }
  })
}

async function printOnce(prompt: string, options: ChatOptions): Promise<void> {
  if (!prompt.trim()) throw new Error("A prompt is required with --print")

  await withServer(options, permissionMode(options, true), async (baseUrl) => {
    const created = await request<SessionSnapshot>(baseUrl, "/v1/sessions", {
      method: "POST",
      body: "{}",
    })
    let output = ""
    const client = new SessionClient(
      baseUrl,
      created.id,
      (text) => {
        output += text
      },
      async (event) => {
        await request(baseUrl, `/v1/sessions/${created.id}/permissions/${event.requestId}`, {
          method: "POST",
          body: JSON.stringify({ approved: false }),
        }).catch(() => {})
      },
    )
    try {
      await client.send(prompt)
    } finally {
      client.close()
    }
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`)
  })
}

async function serveCommand(options: {
  port?: string
  auto?: boolean
  readonly?: boolean
}): Promise<void> {
  if (options.auto && options.readonly) throw new Error("--auto and --readonly cannot be combined")

  const port = Number(options.port ?? process.env.OPENCONTINUE_PORT ?? 8787)
  const mode: PermissionMode | undefined = options.auto
    ? "auto"
    : options.readonly
      ? "readonly"
      : undefined
  const workspace = process.env.INIT_CWD ?? process.cwd()
  const store = createSessionStore({ workspace })
  const running = startServer({ store, port, permissionMode: mode, workspace })
  console.log(`opencontinue server listening on http://127.0.0.1:${running.port}`)
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

async function sessionsCommand(options: { url?: string }): Promise<void> {
  const baseUrl = (options.url ?? "http://127.0.0.1:8787").replace(/\/$/, "")
  const sessions = await request<SessionSummary[]>(baseUrl, "/v1/sessions")
  if (sessions.length === 0) {
    console.log("No sessions.")
    return
  }
  for (const session of sessions) {
    console.log(`${session.id}  ${session.title}  ${session.updatedAt}`)
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
  .option("--port <port>", "Port for the embedded server", "8787")
  .option("--resume <id>", "Resume an existing session")
  .option("--auto", "Allow write and shell tools without approval")
  .option("--readonly", "Deny write and shell tools")
  .action(async (prompt: string | undefined, options: ChatOptions) => {
    if (options.auto && options.readonly) throw new Error("--auto and --readonly cannot be combined")
    if (options.print || prompt) await printOnce(prompt ?? "", options)
    else await chat(options)
  })

program
  .command("serve")
  .description("Start the HTTP/SSE server")
  .addHelpText("after", "\nGlobal flags: --port <port>, --auto, --readonly")
  .action(() =>
    serveCommand({
      port: String(program.opts().port ?? "8787"),
      auto: Boolean(program.opts().auto),
      readonly: Boolean(program.opts().readonly),
    }),
  )

program
  .command("sessions")
  .description("List sessions from a running server")
  .option("--url <url>", "Server URL", "http://127.0.0.1:8787")
  .action((options: { url?: string }) =>
    sessionsCommand({ url: String(program.opts().url ?? options.url) }),
  )

try {
  await program.parseAsync(process.argv)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
