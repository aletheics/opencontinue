#!/usr/bin/env node

import { createInterface } from "node:readline/promises"

import { Command } from "commander"

import { SessionStore } from "@opencontinue/core"
import type { SessionEvent, SessionSnapshot, SessionSummary } from "@opencontinue/protocol"
import { closeServer, startServer } from "@opencontinue/server"

type ChatOptions = {
  print?: boolean
  url?: string
  port?: string
  resume?: string
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

async function withServer(
  options: ChatOptions,
  run: (baseUrl: string) => Promise<void>,
): Promise<void> {
  if (options.url) {
    await run(options.url.replace(/\/$/, ""))
    return
  }

  const port = Number(options.port ?? process.env.OPENCONTINUE_PORT ?? 8787)
  const running = startServer({ store: new SessionStore(), port })
  console.log(`embedded server on http://127.0.0.1:${running.port}`)
  try {
    await run(`http://127.0.0.1:${running.port}`)
  } finally {
    await closeServer(running.server)
  }
}

async function chat(options: ChatOptions): Promise<void> {
  await withServer(options, async (baseUrl) => {
    let sessionId = options.resume
    if (!sessionId) {
      const created = await request<SessionSnapshot>(baseUrl, "/v1/sessions", {
        method: "POST",
        body: "{}",
      })
      sessionId = created.id
    }

    const client = new SessionClient(baseUrl, sessionId, (text) => process.stdout.write(text))
    const rl = createInterface({ input: process.stdin, output: process.stdout })

    console.log(`OpenContinue session ${sessionId}`)
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

  await withServer(options, async (baseUrl) => {
    const created = await request<SessionSnapshot>(baseUrl, "/v1/sessions", {
      method: "POST",
      body: "{}",
    })
    let output = ""
    const client = new SessionClient(baseUrl, created.id, (text) => {
      output += text
    })
    try {
      await client.send(prompt)
    } finally {
      client.close()
    }
    process.stdout.write(output.endsWith("\n") ? output : `${output}\n`)
  })
}

async function serveCommand(options: { port?: string }): Promise<void> {
  const port = Number(options.port ?? process.env.OPENCONTINUE_PORT ?? 8787)
  const running = startServer({ store: new SessionStore(), port })
  console.log(`opencontinue server listening on http://127.0.0.1:${running.port}`)

  const shutdown = async () => {
    console.log("\nShutting down...")
    await closeServer(running.server)
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
  .action(async (prompt: string | undefined, options: ChatOptions) => {
    if (options.print || prompt) await printOnce(prompt ?? "", options)
    else await chat(options)
  })

program
  .command("serve")
  .description("Start the HTTP/SSE server")
  .option("--port <port>", "Port to listen on", "8787")
  .action(serveCommand)

program
  .command("sessions")
  .description("List sessions from a running server")
  .option("--url <url>", "Server URL", "http://127.0.0.1:8787")
  .action(sessionsCommand)

try {
  await program.parseAsync(process.argv)
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error))
  process.exit(1)
}
