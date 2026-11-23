import { describe, expect, it, vi } from "vitest"
import { z } from "zod"

import { MemorySessionStore } from "@opencontinue/core"
import type { Tool, ToolContext } from "@opencontinue/tools"

import {
  normalizePermissionMode,
  permissionDetail,
  PermissionBroker,
  type PermissionPolicy,
} from "./permissions.js"

const writeTool: Tool = {
  name: "write",
  description: "write",
  capability: "write",
  input: z.object({}),
  async execute() {
    return ""
  },
}

const readTool: Tool = {
  name: "read",
  description: "read",
  capability: "read",
  input: z.object({}),
  async execute() {
    return ""
  },
}

const previewTool: Tool = {
  name: "write",
  description: "write",
  capability: "write",
  input: z.object({ path: z.string() }),
  async execute() {
    return ""
  },
  async preview(input) {
    return {
      detail: (input as { path: string }).path,
      diff: "@@ -1 +1 @@\n-old\n+new",
    }
  },
}

function setup(mode: "plan" | "confirm" | "auto", policy?: PermissionPolicy) {
  const store = new MemorySessionStore()
  const session = store.create()
  const context: ToolContext = { workspace: process.cwd(), sessionId: session.id }
  return { store, session, context, broker: new PermissionBroker(store, mode, policy) }
}

describe("PermissionBroker", () => {
  it("allows read tools without asking", async () => {
    const { broker, context } = setup("confirm")
    await expect(broker.authorize(readTool, {}, context)).resolves.toBe(true)
  })

  it("denies write tools in plan mode without prompting", async () => {
    const { store, session, broker, context } = setup("plan")
    await expect(broker.authorize(writeTool, {}, context)).resolves.toBe(false)
    expect(
      store.events(session.id).some((event) => event.type === "permission.requested"),
    ).toBe(false)
  })

  it("normalizes legacy mode names", () => {
    expect(normalizePermissionMode("readonly")).toBe("plan")
    expect(normalizePermissionMode("ask")).toBe("confirm")
    expect(normalizePermissionMode("auto")).toBe("auto")
    expect(normalizePermissionMode("unknown")).toBeUndefined()
  })

  it("changes policy when the mode changes", async () => {
    const { store, session, broker, context } = setup("confirm")
    broker.setMode("auto")
    await expect(broker.authorize(writeTool, {}, context)).resolves.toBe(true)

    broker.setMode("plan")
    await expect(broker.authorize(writeTool, {}, context)).resolves.toBe(false)
    expect(
      store.events(session.id).some((event) => event.type === "permission.requested"),
    ).toBe(false)
  })

  it("remembers a tool for the session", async () => {
    const { broker, context } = setup("confirm")
    broker.allowForSession("write")
    await expect(broker.authorize(writeTool, {}, context)).resolves.toBe(true)
  })

  it("honors project allow and deny lists", async () => {
    const allowed = setup("confirm", { allow: ["write"], ask: [], deny: [] })
    await expect(allowed.broker.authorize(writeTool, {}, allowed.context)).resolves.toBe(true)

    const denied = setup("auto", { allow: [], ask: [], deny: ["read"] })
    await expect(denied.broker.authorize(readTool, {}, denied.context)).resolves.toBe(false)
  })

  it("allows an explicit ask list to override auto mode", async () => {
    const { store, session, context, broker } = setup("auto", {
      allow: [],
      ask: ["read"],
      deny: [],
    })
    const pending = broker.authorize(readTool, {}, context)
    const request = store
      .events(session.id)
      .find((event) => event.type === "permission.requested")
    if (request?.type !== "permission.requested") throw new Error("request missing")

    expect(broker.resolve(request.requestId, true)).toBe(true)
    await expect(pending).resolves.toBe(true)
  })

  it("describes and previews a permission request", async () => {
    expect(permissionDetail("bash", { command: "npm   test" })).toBe("npm test")
    expect(permissionDetail("write", { path: "a.txt" })).toBe("a.txt")

    const { store, session, context, broker } = setup("confirm")
    const pending = broker.authorize(previewTool, { path: "a.txt" }, context)

    await vi.waitFor(() => {
      const request = store
        .events(session.id)
        .find((event) => event.type === "permission.requested")
      expect(request).toMatchObject({
        type: "permission.requested",
        tool: "write",
        detail: "a.txt",
        diff: expect.stringContaining("+new"),
      })
    })

    const request = store
      .events(session.id)
      .find((event) => event.type === "permission.requested")
    if (request?.type !== "permission.requested") throw new Error("request missing")
    expect(broker.resolve(request.requestId, true)).toBe(true)
    await expect(pending).resolves.toBe(true)
  })

  it("asks and resolves a write request", async () => {
    const { store, session, context, broker } = setup("confirm")
    const pending = broker.authorize(writeTool, { path: "a.txt" }, context)

    const request = store
      .events(session.id)
      .find((event) => event.type === "permission.requested")
    expect(request).toMatchObject({ tool: "write", capability: "write" })
    if (request?.type !== "permission.requested") throw new Error("request missing")

    expect(broker.resolve(request.requestId, true)).toBe(true)
    await expect(pending).resolves.toBe(true)
    expect(store.events(session.id).some((event) => event.type === "permission.resolved")).toBe(true)
  })
})
