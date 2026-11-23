import { bashTool, readTool, writeTool } from "@opencontinue/tools"
import { describe, expect, it } from "vitest"

import { permissionDetail, TuiPermissionGate } from "./permission-gate.js"

describe("permissionDetail", () => {
  it("shows the command for bash", () => {
    expect(permissionDetail("bash", { command: "npm   test\n-- --run" })).toBe(
      `npm test -- --run`,
    )
  })

  it("shows a path for file tools", () => {
    expect(permissionDetail("write", { path: "src/app.ts", content: "x" })).toBe(
      "src/app.ts",
    )
  })

  it("falls back to compact JSON", () => {
    expect(permissionDetail("custom", { a: 1 })).toBe(`{"a":1}`)
  })
})

describe("TuiPermissionGate", () => {
  it("allows read-only tools and auto mode", async () => {
    const gate = new TuiPermissionGate("ask")
    await expect(gate.authorize(readTool, { path: "a.ts" })).resolves.toBe(true)

    gate.setMode("auto")
    await expect(
      gate.authorize(writeTool, { path: "a.ts", content: "x" }),
    ).resolves.toBe(true)
  })

  it("denies writes in readonly mode", async () => {
    const gate = new TuiPermissionGate("readonly")
    await expect(
      gate.authorize(writeTool, { path: "a.ts", content: "x" }),
    ).resolves.toBe(false)
  })

  it("waits for an answer in ask mode", async () => {
    const gate = new TuiPermissionGate("ask")
    const changes: number[] = []
    gate.onChange(() => changes.push(1))

    const pending = gate.authorize(bashTool, { command: "npm test" })
    expect(gate.pending?.tool).toBe("bash")
    expect(gate.pending?.detail).toBe("npm test")
    expect(changes).toHaveLength(1)

    gate.answer(false)
    await expect(pending).resolves.toBe(false)
    expect(gate.pending).toBeNull()
    expect(changes).toHaveLength(2)
  })

  it("remembers a tool after allow-for-session", async () => {
    const gate = new TuiPermissionGate("ask")

    const first = gate.authorize(bashTool, { command: "npm test" })
    gate.answer(true, true)
    await expect(first).resolves.toBe(true)

    await expect(gate.authorize(bashTool, { command: "npm run build" })).resolves.toBe(
      true,
    )
    expect(gate.pending).toBeNull()
  })
})
