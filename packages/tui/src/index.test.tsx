import { execFileSync } from "node:child_process"
import { once } from "node:events"
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises"
import http from "node:http"
import type { AddressInfo } from "node:net"
import os from "node:os"
import path from "node:path"

import { saveAuthConfig, saveProviderConfig } from "@opencontinue/config"
import { createSessionStore } from "@opencontinue/core"
import { EchoProvider } from "@opencontinue/providers"
import { closeServer, startServer } from "@opencontinue/server"
import { render } from "ink-testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

import { Transcript, TranscriptItem } from "./components/Transcript.js"
import { App } from "./index.js"

let home = ""
let previousHome: string | undefined
let previousInitCwd: string | undefined

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "opencontinue-tui-"))
  previousHome = process.env.OPENCONTINUE_HOME
  previousInitCwd = process.env.INIT_CWD
  process.env.OPENCONTINUE_HOME = home
  process.env.INIT_CWD = home
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.OPENCONTINUE_HOME
  else process.env.OPENCONTINUE_HOME = previousHome
  if (previousInitCwd === undefined) delete process.env.INIT_CWD
  else process.env.INIT_CWD = previousInitCwd
  await rm(home, { recursive: true, force: true })
})

function output(frames: string[]): string {
  return frames.join("\n").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

async function ready(lastFrame: () => string | undefined): Promise<void> {
  await vi.waitFor(() => expect(lastFrame()).toContain("Type a message…"), {
    timeout: 5000,
  })
  await new Promise((resolve) => setTimeout(resolve, 0))
}

async function fakeProvider(
  models: string[] = ["gpt-6.2"],
): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ data: models.map((id) => ({ id })) }))
      return
    }

    if (request.url === "/v1/chat/completions") {
      response.writeHead(200, { "content-type": "text/event-stream" })
      response.write(
        `data: ${JSON.stringify({ choices: [{ delta: { content: "hello from tui" } }] })}\n\n`,
      )
      response.end("data: [DONE]\n\n")
      return
    }

    response.writeHead(404)
    response.end()
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${address.port}/v1` }
}

async function fakeLineProvider(
  lines = 30,
): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer(async (request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ data: [{ id: "gpt-6.2" }] }))
      return
    }

    if (request.url === "/v1/chat/completions") {
      response.writeHead(200, { "content-type": "text/event-stream" })
      for (let index = 0; index < lines; index++) {
        response.write(
          `data: ${JSON.stringify({
            choices: [{ delta: { content: `line ${index}\n` } }],
          })}\n\n`,
        )
        await new Promise((resolve) => setTimeout(resolve, 5))
      }
      await new Promise((resolve) => setTimeout(resolve, 800))
      response.end("data: [DONE]\n\n")
      return
    }

    response.writeHead(404)
    response.end()
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${address.port}/v1` }
}

async function fakeTodoProvider(): Promise<{ server: http.Server; url: string }> {
  let chatCalls = 0
  const server = http.createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ data: [{ id: "gpt-6.2" }] }))
      return
    }

    if (request.url === "/v1/chat/completions") {
      chatCalls++
      response.writeHead(200, { "content-type": "text/event-stream" })
      if (chatCalls === 1) {
        response.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_todo",
                      function: {
                        name: "todo",
                        arguments: JSON.stringify({
                          todos: [
                            {
                              content: "Inspect the parser",
                              status: "completed",
                            },
                            {
                              content: "Fix the bug",
                              status: "in_progress",
                              activeForm: "Fixing the bug",
                            },
                          ],
                        }),
                      },
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        )
      } else {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "fixed" } }] })}\n\n`,
        )
      }
      response.end("data: [DONE]\n\n")
      return
    }

    response.writeHead(404)
    response.end()
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${address.port}/v1` }
}

async function fakeToolProvider(): Promise<{ server: http.Server; url: string }> {
  let chatCalls = 0
  const server = http.createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ data: [{ id: "gpt-6.2" }] }))
      return
    }

    if (request.url === "/v1/chat/completions") {
      chatCalls++
      response.writeHead(200, { "content-type": "text/event-stream" })
      if (chatCalls === 1) {
        response.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_1",
                      function: {
                        name: "bash",
                        arguments: JSON.stringify({ command: "echo hi" }),
                      },
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        )
      } else {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "done" } }] })}\n\n`,
        )
      }
      response.end("data: [DONE]\n\n")
      return
    }

    response.writeHead(404)
    response.end()
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${address.port}/v1` }
}

async function fakeWriteProvider(): Promise<{ server: http.Server; url: string }> {
  let chatCalls = 0
  const server = http.createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ data: [{ id: "gpt-6.2" }] }))
      return
    }

    if (request.url === "/v1/chat/completions") {
      chatCalls++
      response.writeHead(200, { "content-type": "text/event-stream" })
      if (chatCalls === 1) {
        response.write(
          `data: ${JSON.stringify({
            choices: [
              {
                delta: {
                  tool_calls: [
                    {
                      index: 0,
                      id: "call_1",
                      function: {
                        name: "write",
                        arguments: JSON.stringify({ path: "note.txt", content: "hello\n" }),
                      },
                    },
                  ],
                },
              },
            ],
          })}\n\n`,
        )
      } else {
        response.write(
          `data: ${JSON.stringify({ choices: [{ delta: { content: "done" } }] })}\n\n`,
        )
      }
      response.end("data: [DONE]\n\n")
      return
    }

    response.writeHead(404)
    response.end()
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  const address = server.address() as AddressInfo
  return { server, url: `http://127.0.0.1:${address.port}/v1` }
}

describe("TUI", () => {
  it("renders OpenContinue transcript blocks", () => {
    const tool = render(
      <TranscriptItem
        item={{
          kind: "tool",
          id: "tool:1",
          runId: "run:1",
          name: "bash",
          input: { command: "echo hi" },
          status: "done",
          output: Array.from({ length: 8 }, (_, index) => `line ${index}`).join("\n"),
        }}
        columns={80}
        expanded={false}
        leading={false}
        permissionMode="auto"
      />,
    )
    const toolFrame = tool.lastFrame() ?? ""
    expect(toolFrame).toContain("↳ Bash(echo hi)")
    expect(toolFrame).toContain("⎿")
    expect(toolFrame).toContain("ctrl+o to expand")
    expect(toolFrame).toContain("Allowed by auto mode")
    expect(toolFrame).not.toContain("╭")
    tool.unmount()

    const user = render(
      <TranscriptItem
        item={{ kind: "user", id: "user:1", text: "fix the bug" }}
        columns={80}
        expanded={false}
        leading={false}
      />,
    )
    expect(user.lastFrame() ?? "").toContain("› fix the bug")
    user.unmount()

    const assistant = render(
      <TranscriptItem
        item={{ kind: "assistant", id: "a1", runId: "r1", text: "first\n\nsecond" }}
        columns={40}
        expanded={false}
        leading={false}
      />,
    )
    const assistantFrame = assistant.lastFrame() ?? ""
    expect(assistantFrame).toContain("● first")
    expect(assistantFrame).toContain("  second")
    assistant.unmount()

    const empty = render(
      <TranscriptItem
        item={{
          kind: "tool",
          id: "tool:2",
          runId: "run:1",
          name: "bash",
          input: { command: "true" },
          status: "done",
        }}
        columns={80}
        expanded={false}
        leading={false}
        permissionMode="auto"
        workspace={"D:\\work"}
      />,
    )
    const emptyFrame = empty.lastFrame() ?? ""
    expect(emptyFrame).toContain("(No output)")
    expect(emptyFrame).toContain("(timeout 2m)")
    empty.unmount()
  })

  it("clips a long live assistant response to the viewport", () => {
    const text = Array.from({ length: 10 }, (_, index) => `line ${index}`).join(
      "\n",
    )
    const view = render(
      <Transcript
        items={[{ kind: "assistant", id: "a1", runId: "r1", text }]}
        columns={40}
        expanded={false}
        leading={false}
        maxLines={4}
      />,
    )
    const frame = view.lastFrame() ?? ""
    expect(frame).toContain("earlier lines")
    expect(frame).toContain("line 9")
    expect(frame).not.toContain("line 1")
    view.unmount()
  })

  it("shows providers before asking for a key", () => {
    const { lastFrame, unmount } = render(<App options={{ readonly: true }} />)
    const frame = lastFrame() ?? ""

    expect(frame).toContain("Select a provider")
    expect(frame).toContain("OpenAI (GPT)")
    expect(frame).toContain("DeepSeek")
    expect(frame).toContain("Kimi (Moonshot)")
    expect(frame).toContain("Claude (Anthropic)")
    expect(frame).toContain("OpenRouter")
    expect(frame).not.toContain("API key")

    unmount()
  })

  it("asks for the selected provider's key", async () => {
    saveProviderConfig({ provider: "deepseek" })
    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("› DeepSeek")
    })

    stdin.write("\r")

    await vi.waitFor(() => {
      expect(lastFrame()).toContain("DeepSeek API key")
    })

    unmount()
  })

  it("filters providers by typed query", async () => {
    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    stdin.write("deepinfra")
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select a provider · /deepinfra/ (1/1)")
    })
    expect(lastFrame()).toContain("DeepInfra")
    expect(lastFrame()).not.toContain("OpenAI (GPT)")

    stdin.write("\u001b")
    await vi.waitFor(() => {
      expect(lastFrame()).toContain("Select a provider (")
    })
    expect(lastFrame()).toContain("OpenAI (GPT)")

    unmount()
  })

  it("filters models by typed query", async () => {
    const { server, url } = await fakeProvider(["gpt-6.2", "deepseek-chat"])
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      await ready(lastFrame)
      stdin.write("/model")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /model"))
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("Select a provider"))
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("Select a model"), {
        timeout: 5000,
      })

      stdin.write("deep")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("Select a model · OpenAI (GPT) · /deep/ (1/1)")
      })
      expect(lastFrame()).toContain("deepseek-chat")
      expect(lastFrame()).not.toContain("› gpt-6.2")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  })

  it("resumes a previous session from the slash command", async () => {
    const seed = createSessionStore({ workspace: home })
    const previous = seed.create("Previous work")
    seed.append(previous.id, { type: "message.user", text: "remember this" })
    seed.close()

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/resume")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /resume"))
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("Resume a session"))
      expect(lastFrame()).toContain("Previous work")

      stdin.write("previous")
      await vi.waitFor(() => expect(lastFrame()).toContain("/previous/"))
      stdin.write("\r")
      await vi.waitFor(() => expect(output(frames)).toContain("› remember this"), {
        timeout: 5000,
      })
      expect(output(frames)).toContain("Restored session")
      expect(output(frames)).toContain("1 event")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("labels generic sessions from their first message", async () => {
    const seed = createSessionStore({ workspace: home })
    const previous = seed.create()
    seed.append(previous.id, { type: "message.user", text: "fix the parser" })
    seed.close()

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/resume")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /resume"))
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("Resume a session"))
      expect(lastFrame()).toContain("fix the parser")

      stdin.write("parser")
      await vi.waitFor(() => expect(lastFrame()).toContain("/parser/"))
      stdin.write("\r")
      await vi.waitFor(() => expect(output(frames)).toContain("› fix the parser"), {
        timeout: 5000,
      })
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("previews file diffs in the permission dialog", async () => {
    await writeFile(path.join(home, "note.txt"), "old\n")

    const { server, url } = await fakeWriteProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("change it")
      await vi.waitFor(() => expect(lastFrame()).toContain("› change it"))
      stdin.write("\r")

      await vi.waitFor(() => expect(lastFrame()).toContain("? Permission required"), {
        timeout: 5000,
      })
      expect(lastFrame()).toContain("note.txt")
      expect(lastFrame()).toContain("-old")
      expect(lastFrame()).toContain("+hello")

      stdin.write("n")
      await vi.waitFor(() => expect(output(frames)).toContain("done"), { timeout: 5000 })
      await expect(readFile(path.join(home, "note.txt"), "utf8")).resolves.toBe("old\n")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("shows a permission dialog and remembers the tool", async () => {
    const { server, url } = await fakeToolProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("run it")
      await vi.waitFor(() => expect(lastFrame()).toContain("› run it"))

      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("? Permission required"), {
        timeout: 5000,
      })
      expect(lastFrame()).toContain("echo hi")
      expect(lastFrame()).toContain("Working directory:")
      expect(lastFrame()).toContain("Always allow this tool for this session")

      stdin.write("a")
      await vi.waitFor(() => expect(output(frames)).toContain("done"), { timeout: 5000 })
      expect(output(frames)).toContain("Bash(echo hi)")
      expect(output(frames)).toContain("hi")
      expect(output(frames)).toContain("1 command")
      expect(output(frames)).toContain("◆ Checkpoint saved")

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/checkpoints")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /checkpoints"))
      stdin.write("\r")
      await vi.waitFor(() =>
        expect(output(frames)).toContain("◆ Checkpoints · 1"),
      )
      expect(output(frames)).toContain("completed")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("filters and completes slash commands", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/re")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("/resume")
      })
      expect(lastFrame()).not.toContain("show commands")

      stdin.write("\t")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /resume"))

      stdin.write("\u001b")
      await ready(lastFrame)
      expect(lastFrame()).not.toContain("/resume — resume a session")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("shows the workspace and git branch in the status line", async () => {
    await mkdir(path.join(home, ".git"), { recursive: true })
    await writeFile(path.join(home, ".git", "HEAD"), "ref: refs/heads/main\n")

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      await ready(lastFrame)
      expect(lastFrame()).toContain(path.basename(home))
      expect(lastFrame()).toContain("main")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("completes @file mentions", async () => {
    await mkdir(path.join(home, "src"), { recursive: true })
    await writeFile(path.join(home, "src", "app.ts"), "export const app = 1\n")

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("look @ap")
      await vi.waitFor(() => expect(lastFrame()).toContain("+ src/app.ts"), {
        timeout: 5000,
      })

      stdin.write("\t")
      await vi.waitFor(() =>
        expect(lastFrame()).toContain("› look @src/app.ts"),
      )
      expect(lastFrame()).not.toContain("+ src/app.ts")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("shows directories in @file completion", async () => {
    await mkdir(path.join(home, "src"), { recursive: true })
    await writeFile(path.join(home, "src", "app.ts"), "export const app = 1\n")

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("@")
      await vi.waitFor(() =>
        expect(lastFrame()).toContain(`+ src${path.sep}`),
      )

      stdin.write("\t")
      await vi.waitFor(() => expect(lastFrame()).toContain("› @src/"))
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("persists the selected mode across launches", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const first = render(<App options={{}} />)
    try {
      await ready(first.lastFrame)
      expect(first.lastFrame()).toContain("◈ Confirm")

      first.stdin.write("/mode")
      await vi.waitFor(() => expect(first.lastFrame()).toContain("› /mode"))
      first.stdin.write("\r")
      await vi.waitFor(() => expect(first.lastFrame()).toContain("⟳ Auto"))
    } finally {
      first.unmount()
    }

    const second = render(<App options={{}} />)
    try {
      await ready(second.lastFrame)
      expect(second.lastFrame()).toContain("⟳ Auto")
    } finally {
      second.unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("shows the model's todo list above the prompt", async () => {
    const { server, url } = await fakeTodoProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)
      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("fix it")
      await vi.waitFor(() => expect(lastFrame()).toContain("› fix it"))
      stdin.write("\r")

      await vi.waitFor(() => expect(lastFrame()).toContain("Tasks · 1/2"), {
        timeout: 5000,
      })
      expect(lastFrame()).toContain("✓ Inspect the parser")
      expect(lastFrame()).toContain("▸ Fixing the bug")
      expect(output(frames)).not.toContain("Todo(")

      await vi.waitFor(() => expect(output(frames)).toContain("fixed"), {
        timeout: 5000,
      })
      expect(lastFrame()).toContain("Tasks · 1/2")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("shows the effective permission rules with /permissions", async () => {
    await mkdir(path.join(home, ".opencontinue"), { recursive: true })
    await writeFile(
      path.join(home, ".opencontinue", "opencontinue.json"),
      JSON.stringify({
        permissions: {
          mode: "confirm",
          allow: ["read", "glob"],
          ask: ["write", "bash"],
          deny: ["rm"],
        },
      }),
    )

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)
      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/permissions")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /permissions"))
      stdin.write("\r")

      await vi.waitFor(() =>
        expect(output(frames)).toContain("◈ Permissions"),
      )
      expect(output(frames)).toContain("Mode    Confirm")
      expect(output(frames)).toContain("Allow   read, glob")
      expect(output(frames)).toContain("Ask     write, bash")
      expect(output(frames)).toContain("Deny    rm")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("forks the conversation from a checkpoint with /rewind", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)
      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("hi")
      await vi.waitFor(() => expect(lastFrame()).toContain("› hi"))
      stdin.write("\r")
      await vi.waitFor(() => expect(output(frames)).toContain("hello from tui"), {
        timeout: 5000,
      })
      await vi.waitFor(() => expect(output(frames)).toContain("Checkpoint saved"))

      stdin.write("/rewind")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /rewind"))
      stdin.write("\r")
      await vi.waitFor(() =>
        expect(lastFrame()).toContain("Fork from a checkpoint"),
      )
      stdin.write("\r")

      await vi.waitFor(() =>
        expect(output(frames)).toContain("Forked session"),
      )
      expect(output(frames)).toContain("working tree unchanged")
      await vi.waitFor(() => expect(lastFrame()).toContain("hello from tui"))
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 25000)

  it("shows working tree changes with /diff", async () => {
    const git = (args: string[]) =>
      execFileSync("git", args, { cwd: home, stdio: "ignore" })
    git(["init"])
    await writeFile(path.join(home, "note.txt"), "old\n")
    git(["add", "note.txt"])
    git([
      "-c",
      "user.email=test@example.com",
      "-c",
      "user.name=Test",
      "commit",
      "-m",
      "init",
    ])
    await writeFile(path.join(home, "note.txt"), "new\n")

    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)
      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/diff")
      await vi.waitFor(() => expect(lastFrame()).toContain("› /diff"))
      stdin.write("\r")

      await vi.waitFor(() => expect(output(frames)).toContain("M note.txt"), {
        timeout: 5000,
      })
      expect(output(frames)).toContain("1 file changed")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("cycles and persists reasoning effort when supported", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const first = render(<App options={{}} />)
    try {
      await ready(first.lastFrame)
      await new Promise((resolve) => setTimeout(resolve, 100))
      expect(first.lastFrame()).not.toContain("Reasoning:")

      for (const expected of ["Low", "Medium", "High", null, "Low"]) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        first.stdin.write("/reasoning")
        await vi.waitFor(() => expect(first.lastFrame()).toContain("› /reasoning"))
        first.stdin.write("\r")
        await vi.waitFor(() => {
          if (expected === null) {
            expect(first.lastFrame()).not.toContain("Reasoning:")
          } else {
            expect(first.lastFrame()).toContain(`Reasoning: ${expected}`)
          }
        })
      }
    } finally {
      first.unmount()
    }

    const second = render(<App options={{}} />)
    try {
      await ready(second.lastFrame)
      await vi.waitFor(() =>
        expect(second.lastFrame()).toContain("Reasoning: Low"),
      )
    } finally {
      second.unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 25000)

  it("commits streamed lines to scrollback instead of hiding them", async () => {
    const { server, url } = await fakeLineProvider(30)
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("stream")
      await vi.waitFor(() => expect(lastFrame()).toContain("› stream"))
      stdin.write("\r")

      await vi.waitFor(() => expect(lastFrame()).toContain("● line 0"), {
        timeout: 5000,
      })
      expect(output(frames)).not.toContain("Completed in")
      expect(lastFrame()).not.toContain("● line 1")

      await vi.waitFor(() => expect(output(frames)).toContain("line 29"), {
        timeout: 5000,
      })
      await vi.waitFor(() => expect(output(frames)).toContain("Completed in"), {
        timeout: 5000,
      })
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("cycles Plan, Confirm, and Auto and shows the active mode", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(<App options={{}} />)

    try {
      await ready(lastFrame)
      expect(lastFrame()).toContain("◈ Confirm")

      for (const expected of ["⟳ Auto", "◎ Plan", "◈ Confirm"]) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        stdin.write("/mode")
        await vi.waitFor(() => expect(lastFrame()).toContain("› /mode"))
        stdin.write("\r")
        await vi.waitFor(() => expect(lastFrame()).toContain(expected))
      }

      stdin.write("?")
      await vi.waitFor(() => expect(output(frames)).toContain("show commands"))
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("searches input history with ctrl+r", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)

      for (const [index, text] of ["alpha", "beta"].entries()) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        stdin.write(text)
        await vi.waitFor(() => expect(lastFrame()).toContain(`› ${text}`))
        stdin.write("\r")
        await vi.waitFor(() => {
          const count = output(frames).match(/hello from tui/g)?.length ?? 0
          expect(count).toBeGreaterThanOrEqual(index + 1)
        }, { timeout: 5000 })
      }

      await vi.waitFor(() => {
        const count = output(frames).match(/Completed in/g)?.length ?? 0
        expect(count).toBeGreaterThanOrEqual(2)
      })

      stdin.write("\u0012")
      await vi.waitFor(() => expect(lastFrame()).toContain("History"))
      expect(lastFrame()).toContain("beta")

      stdin.write("bet")
      await vi.waitFor(() => expect(lastFrame()).toContain("History · /bet/"))
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).not.toContain("History · /bet/"))

      stdin.write("!")
      await vi.waitFor(() => expect(lastFrame()).toContain("› beta!"))
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("runs the provider -> model -> chat loop", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)
      expect(output(frames)).toContain("◈ OpenContinue")
      expect(output(frames)).toContain("v0.0.1")
      expect(output(frames)).toContain("Model")
      expect(output(frames)).toContain("gpt-6.2")
      expect(output(frames)).toContain("Provider")
      expect(output(frames)).toContain("OpenAI (GPT)")
      expect(output(frames)).toContain(home)
      expect(output(frames)).not.toContain("Welcome to OpenContinue")
      expect(lastFrame()).toContain("Plan")

      stdin.write("hi")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("› hi")
      })

      stdin.write("\r")
      await vi.waitFor(
        () => {
          expect(output(frames)).toContain("hello from tui")
        },
        { timeout: 5000 },
      )

      const frame = lastFrame() ?? ""
      expect(frame).toContain("Type a message…")
      expect(frame).toContain("Plan")
      expect(frame.split("\n").length).toBeLessThanOrEqual(24)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/help")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("› /help")
      })
      stdin.write("\r")
      await vi.waitFor(() => {
        expect(output(frames)).toContain("show commands")
      })
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("opens the expanded transcript with ctrl+o", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("hello")
      await vi.waitFor(() => expect(lastFrame()).toContain("› hello"))
      stdin.write("\r")
      await vi.waitFor(() => expect(output(frames)).toContain("hello from tui"), {
        timeout: 5000,
      })

      stdin.write("\u000f")
      await vi.waitFor(() => expect(lastFrame()).toContain("Transcript ·"))
      stdin.write("\u000f")
      await vi.waitFor(() => expect(lastFrame()).not.toContain("Transcript ·"))
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("runs against a remote server with --url", async () => {
    const store = createSessionStore({ workspace: home })
    const running = startServer({
      store,
      provider: new EchoProvider(),
      port: 0,
      workspace: home,
      permissionMode: "plan",
    })
    const server = running.server as unknown as http.Server
    if (!server.listening) await once(server, "listening")
    const address = server.address() as AddressInfo

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ url: `http://127.0.0.1:${address.port}` }} />,
    )

    try {
      await ready(lastFrame)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("hello")
      await vi.waitFor(() => expect(lastFrame()).toContain("› hello"))
      stdin.write("\r")
      await vi.waitFor(() => expect(output(frames)).toContain("Echo: hello"), {
        timeout: 5000,
      })
    } finally {
      unmount()
      await closeServer(running.server)
      store.close()
    }
  }, 20000)

  it("does not garble repeated help output", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, frames, unmount } = render(
      <App options={{ readonly: true }} />,
    )

    try {
      await ready(lastFrame)

      for (let index = 0; index < 5; index++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        stdin.write("/help")
        await vi.waitFor(() => expect(lastFrame()).toContain("› /help"))
        stdin.write("\r")
        await vi.waitFor(() => {
          const count = output(frames).match(/show commands/g)?.length ?? 0
          expect(count).toBeGreaterThanOrEqual(index + 1)
        })
      }

      const frame = lastFrame() ?? ""
      expect(frame).toContain("Type a message…")
      expect(output(frames)).not.toContain("/help/help")
      expect(output(frames)).not.toContain("› /help/help")
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)
})
