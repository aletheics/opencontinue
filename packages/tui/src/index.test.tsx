import { once } from "node:events"
import { mkdtemp, rm } from "node:fs/promises"
import http from "node:http"
import type { AddressInfo } from "node:net"
import os from "node:os"
import path from "node:path"

import { saveAuthConfig, saveProviderConfig } from "@opencontinue/config"
import { render } from "ink-testing-library"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"

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

async function fakeProvider(): Promise<{ server: http.Server; url: string }> {
  const server = http.createServer((request, response) => {
    if (request.url === "/v1/models") {
      response.writeHead(200, { "content-type": "application/json" })
      response.end(JSON.stringify({ data: [{ id: "gpt-6.2" }] }))
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

describe("TUI", () => {
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

  it("runs the provider -> model -> chat loop", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      stdin.write("\r")
      await vi.waitFor(
        () => {
          expect(lastFrame()).toContain("Select a model")
        },
        { timeout: 5000 },
      )

      stdin.write("\r")
      await vi.waitFor(
        () => {
          expect(lastFrame()).toContain("model: gpt-6.2")
        },
        { timeout: 5000 },
      )

      stdin.write("hi")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("you> hi")
      })

      stdin.write("\r")
      await vi.waitFor(
        () => {
          expect(lastFrame()).toContain("hello from tui")
        },
        { timeout: 5000 },
      )

      const frame = lastFrame() ?? ""
      expect(frame.match(/OpenContinue/g)?.length ?? 0).toBe(1)
      expect(frame).toContain("Type a message…")
      expect(frame).toContain("/exit ·")
      expect(frame.split("\n").length).toBeLessThanOrEqual(24)

      await new Promise((resolve) => setTimeout(resolve, 0))
      stdin.write("/help")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("you> /help")
      })
      stdin.write("\r")
      await vi.waitFor(() => {
        expect(lastFrame()).toContain("show commands")
      })
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)

  it("keeps a fixed frame after repeated help output", async () => {
    const { server, url } = await fakeProvider()
    saveProviderConfig({ provider: "openai", baseUrl: url, model: "gpt-6.2" })
    saveAuthConfig({ keys: { openai: "test" } })

    const { stdin, lastFrame, unmount } = render(<App options={{ readonly: true }} />)

    try {
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("Select a model"), { timeout: 5000 })
      stdin.write("\r")
      await vi.waitFor(() => expect(lastFrame()).toContain("model: gpt-6.2"), { timeout: 5000 })

      for (let index = 0; index < 5; index++) {
        await new Promise((resolve) => setTimeout(resolve, 0))
        stdin.write("/help")
        await vi.waitFor(() => expect(lastFrame()).toContain("you> /help"))
        stdin.write("\r")
        await vi.waitFor(() => expect(lastFrame()).toContain("show commands"))
      }

      const frame = lastFrame() ?? ""
      const plain = frame.replace(/\x1b\[[0-9;]*m/g, "")
      expect(plain.split("\n").length).toBeLessThanOrEqual(24)
      expect(plain.match(/OpenContinue/g)?.length ?? 0).toBe(1)
      expect(plain).toContain("Type a message…")
      expect(plain).toContain("/exit ·")
      expect(plain).toContain("older lines · PgUp")

      const width = plain.split("\n")[0]?.length ?? 0
      for (const line of plain.split("\n")) {
        expect(line.length).toBeLessThanOrEqual(width)
      }
    } finally {
      unmount()
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }, 20000)
})
