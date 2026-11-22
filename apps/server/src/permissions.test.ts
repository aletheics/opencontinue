import { describe, expect, it } from "vitest"
import { z } from "zod"

import { SessionStore } from "@opencontinue/core"
import type { Tool, ToolContext } from "@opencontinue/tools"

import { PermissionBroker, type PermissionPolicy } from "./permissions.js"

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

function setup(mode: "ask" | "auto" | "readonly", policy?: PermissionPolicy) {
  const store = new SessionStore()
  const session = store.create()
  const context: ToolContext = { workspace: process.cwd(), sessionId: session.id }
  return { store, session, context, broker: new PermissionBroker(store, mode, policy) }
}

describe("PermissionBroker", () => {
  it("allows read tools without asking", async () => {
    const { broker, context } = setup("ask")
    await expect(broker.authorize(readTool, {}, context)).resolves.toBe(true)
  })

  it("denies write tools in readonly mode", async () => {
    const { broker, context } = setup("readonly")
    await expect(broker.authorize(writeTool, {}, context)).resolves.toBe(false)
  })

  it("honors project allow and deny lists", async () => {
    const allowed = setup("ask", { allow: ["write"], ask: [], deny: [] })
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

  it("asks and resolves a write request", async () => {
    const { store, session, context, broker } = setup("ask")
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
