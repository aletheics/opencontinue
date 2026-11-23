import { describe, expect, it } from "vitest"

import { formatPermissions } from "./format.js"

describe("permissions view", () => {
  it("formats the mode and rules", () => {
    const text = formatPermissions("confirm", {
      allow: ["read", "glob"],
      ask: ["write", "bash"],
      deny: ["edit"],
    })

    expect(text).toContain("◈ Permissions")
    expect(text).toContain("Mode    Manual")
    expect(text).toContain("Allow   read, glob")
    expect(text).toContain("Ask     write, bash")
    expect(text).toContain("Deny    edit")
  })

  it("marks empty rule lists", () => {
    const text = formatPermissions("plan")
    expect(text).toContain("Mode    Plan")
    expect(text).toContain("Allow   (none)")
    expect(text).toContain("Ask     (none)")
    expect(text).toContain("Deny    (none)")
  })
})
