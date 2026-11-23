import { describe, expect, it } from "vitest"

import { createTheme } from "./theme.js"

describe("theme", () => {
  it("uses Copper colors by default", () => {
    const theme = createTheme({})
    expect(theme.brand).toBe("#D99A75")
    expect(theme.success).toBe("#7EBB91")
    expect(theme.error).toBe("#D9767C")
  })

  it("removes colors when NO_COLOR or FORCE_COLOR=0 is set", () => {
    for (const env of [{ NO_COLOR: "1" }, { NO_COLOR: "" }, { FORCE_COLOR: "0" }]) {
      const theme = createTheme(env)
      expect(Object.values(theme).every((value) => value === undefined)).toBe(
        true,
      )
    }
  })
})
