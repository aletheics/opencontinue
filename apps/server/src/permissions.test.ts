import { describe, expect, it } from "vitest"
import { z } from "zod"

import { SessionStore } from "@opencontinue/core"
import type { Tool, ToolContext } from "@opencontinue/tools"

import { PermissionBroker } from "./permissions.js"

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

function setup(mode: "ask" | "auto" | "readonly") {
  const store = new SessionStore()
  const session = store.create()
  const context: ToolContext = { workspace: process.cwd(), sessionId: session.id }
  return { store, session, context, broker: new PermissionBroker(store, mode) }
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
