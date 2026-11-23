import { describe, expect, it } from "vitest"

import { isPrintableInput } from "./keys.js"

describe("printable input", () => {
  it("accepts text and space", () => {
    expect(isPrintableInput("a", {})).toBe(true)
    expect(isPrintableInput(" ", {})).toBe(true)
  })

  it("rejects control keys and shortcuts", () => {
    expect(isPrintableInput("\r", {})).toBe(false)
    expect(isPrintableInput("\n", {})).toBe(false)
    expect(isPrintableInput("\t", {})).toBe(false)
    expect(isPrintableInput("a", { ctrl: true })).toBe(false)
    expect(isPrintableInput("a", { meta: true })).toBe(false)
    expect(isPrintableInput("", {})).toBe(false)
  })
})
