import { mkdtemp, readFile, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { MemorySessionStore } from "@opencontinue/core"
import type { ChatMessage, ChatProvider } from "@opencontinue/providers"
import { ToolRegistry, type PermissionGate } from "@opencontinue/tools"

import { DEFAULT_SYSTEM_PROMPT, runAgent } from "./agent.js"

const allowAll: PermissionGate = {
  async authorize() {
    return true
  },
}

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(
    temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })),
  )
})

async function makeWorkspace(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-agent-"))
  temporary.push(directory)
  return directory
}

describe("default system prompt", () => {
  it("guides answer structure without forcing headings", () => {
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Shape the answer to the task")
    expect(DEFAULT_SYSTEM_PROMPT).toContain("simple questions directly")
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Do not force headings or tables")
    expect(DEFAULT_SYSTEM_PROMPT).toContain("Answer in the user's language")
  })
})

describe("runAgent", () => {
  it("streams provider text into the session", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "hi" })

    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        yield { type: "text", text: "Hello" }
        yield { type: "text", text: " world" }
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: allowAll,
      workspace,
    })

    expect(store.snapshot(session.id)?.messages).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "Hello world" },
    ])
    const types = store.events(session.id).map((event) => event.type)
    expect(types).toContain("run.started")
    expect(types).toContain("run.completed")
  })

  it("passes signed thinking blocks to the next tool step", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "write a.txt" })

    let step = 0
    const seen: ChatMessage[][] = []
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat(request) {
        seen.push(request.messages)
        step++
        if (step === 1) {
          yield {
            type: "thinking",
            block: { text: "plan the write", signature: "sig-1" },
          }
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "write",
              arguments: JSON.stringify({ path: "a.txt", content: "hello" }),
            },
          }
          return
        }
        yield { type: "text", text: "done" }
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: allowAll,
      workspace,
    })

    const assistant = seen[1]!.find(
      (message) => message.role === "assistant" && message.thinking?.length,
    )
    expect(assistant).toMatchObject({
      role: "assistant",
      thinking: [{ text: "plan the write", signature: "sig-1" }],
    })
    await expect(readFile(path.join(workspace, "a.txt"), "utf8")).resolves.toBe("hello")
  })

  it("executes a tool call and continues the conversation", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "write a.txt" })

    let step = 0
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        step++
        if (step === 1) {
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "write",
              arguments: JSON.stringify({ path: "a.txt", content: "hello" }),
            },
          }
          return
        }
        yield { type: "text", text: "done" }
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: allowAll,
      workspace,
    })

    expect(await readFile(path.join(workspace, "a.txt"), "utf8")).toBe("hello")
    const types = store.events(session.id).map((event) => event.type)
    expect(types).toContain("tool.started")
    expect(types).toContain("tool.completed")
    expect(store.snapshot(session.id)?.messages).toEqual([
      { role: "user", text: "write a.txt" },
      { role: "assistant", text: "done" },
    ])
  })

  it("reconstructs multi-step history across turns", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "write a.txt" })

    const seen: ChatMessage[][] = []
    let step = 0
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat(request) {
        seen.push(structuredClone(request.messages))
        step++
        if (step === 1) {
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "write",
              arguments: JSON.stringify({ path: "a.txt", content: "hello" }),
            },
          }
          return
        }
        if (step === 2) {
          yield { type: "text", text: "done" }
          return
        }
        yield { type: "text", text: "again done" }
      },
    }

    const run = () =>
      runAgent({
        store,
        sessionId: session.id,
        provider,
        tools: new ToolRegistry(),
        permissions: allowAll,
        workspace,
      })

    await run()
    store.append(session.id, { type: "message.user", text: "again" })
    await run()

    expect(seen.at(-1)).toEqual([
      { role: "user", content: "write a.txt" },
      {
        role: "assistant",
        content: "",
        toolCalls: [
          {
            id: "call_1",
            name: "write",
            arguments: JSON.stringify({ path: "a.txt", content: "hello" }),
          },
        ],
      },
      { role: "tool", toolCallId: "call_1", content: "Wrote 5 characters to a.txt" },
      { role: "assistant", content: "done" },
      { role: "user", content: "again" },
    ])
  })

  it("records a non-zero shell exit as a failed tool inside a completed run", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "fail" })

    const seen: ChatMessage[][] = []
    let step = 0
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat(request) {
        seen.push(structuredClone(request.messages))
        step++
        if (step === 1) {
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "bash",
              arguments: JSON.stringify({ command: 'node -e "process.exit(3)"' }),
            },
          }
          return
        }
        yield { type: "text", text: "the command failed" }
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: allowAll,
      workspace,
    })

    const events = store.events(session.id)
    expect(events.find((event) => event.type === "tool.completed")).toMatchObject({
      failed: true,
      exitCode: 3,
    })
    expect(events.some((event) => event.type === "run.completed")).toBe(true)
    expect(events.some((event) => event.type === "run.failed")).toBe(false)
    expect(seen[1]?.find((message) => message.role === "tool")).toMatchObject({
      content: expect.stringContaining("Exit code 3"),
    })
    expect(store.snapshot(session.id)?.messages.at(-1)).toEqual({
      role: "assistant",
      text: "the command failed",
    })
  })

  it("still completes the run after a denied tool and tells the model why", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "run it" })

    const seen: ChatMessage[][] = []
    let step = 0
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat(request) {
        seen.push(structuredClone(request.messages))
        step++
        if (step === 1) {
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "bash",
              arguments: JSON.stringify({ command: "echo hi" }),
            },
          }
          return
        }
        yield { type: "text", text: "not allowed" }
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: {
        async authorize() {
          return false
        },
      },
      workspace,
    })

    const events = store.events(session.id)
    expect(events.find((event) => event.type === "tool.failed")).toMatchObject({
      error: "Permission denied",
    })
    expect(events.some((event) => event.type === "run.completed")).toBe(true)
    expect(events.some((event) => event.type === "run.failed")).toBe(false)
    expect(seen[1]?.find((message) => message.role === "tool")).toMatchObject({
      content: "Error: Permission denied",
    })
  })

  it("records the broker authorization reason on completion", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "write a.txt" })

    let step = 0
    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        step++
        if (step === 1) {
          yield {
            type: "tool_call",
            call: {
              id: "call_1",
              name: "write",
              arguments: JSON.stringify({ path: "a.txt", content: "hello" }),
            },
          }
          return
        }
        yield { type: "text", text: "done" }
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: {
        async authorize() {
          return { approved: true, reason: "auto" }
        },
      },
      workspace,
    })

    expect(store.events(session.id).find((event) => event.type === "tool.completed")).toMatchObject(
      { authorization: "auto" },
    )
  })

  it("records a failed run", async () => {
    const workspace = await makeWorkspace()
    const store = new MemorySessionStore()
    const session = store.create()
    store.append(session.id, { type: "message.user", text: "hi" })

    const provider: ChatProvider = {
      id: "fake",
      model: "fake",
      async *streamChat() {
        throw new Error("boom")
      },
    }

    await runAgent({
      store,
      sessionId: session.id,
      provider,
      tools: new ToolRegistry(),
      permissions: allowAll,
      workspace,
    })

    const types = store.events(session.id).map((event) => event.type)
    expect(types).toContain("run.failed")
    expect(store.snapshot(session.id)?.messages.at(-1)?.text).toContain("boom")
  })
})
