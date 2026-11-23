import { describe, expect, it } from "vitest"

import { permissionDecision } from "./decision.js"

describe("permission decision", () => {
  it("asks in ask mode", () => {
    expect(permissionDecision("ask", "bash", new Set())).toBe("ask")
  })

  it("allows auto and denies readonly", () => {
    expect(permissionDecision("auto", "bash", new Set())).toBe("allow")
    expect(permissionDecision("readonly", "bash", new Set())).toBe("deny")
  })

  it("remembers a tool over the mode", () => {
    expect(permissionDecision("ask", "bash", new Set(["bash"]))).toBe("allow")
    expect(permissionDecision("readonly", "bash", new Set(["bash"]))).toBe("allow")
  })
})
