import { describe, expect, it } from "vitest"

import { getGlyphs } from "./glyphs.js"

describe("glyphs", () => {
  it("uses Unicode symbols by default", () => {
    const set = getGlyphs({})
    expect(set.brand).toBe("◈")
    expect(set.ready).toBe("·")
    expect(set.tool).toBe("↳")
    expect(set.done).toBe("✓")
    expect(set.failed).toBe("×")
    expect(set.interrupted).toBe("■")
    expect(set.approval).toBe("?")
    expect(set.checkpoint).toBe("◆")
    expect(set.pending).toBe("○")
    expect(set.active).toBe("▸")
    expect(set.plan).toBe("◎")
    expect(set.confirm).toBe("◈")
    expect(set.auto).toBe("⟳")
  })

  it("falls back to ASCII when requested", () => {
    const set = getGlyphs({ OPENCONTINUE_ASCII: "1" })
    expect(set.brand).toBe("O")
    expect(set.ready).toBe(".")
    expect(set.tool).toBe(">")
    expect(set.done).toBe("+")
    expect(set.failed).toBe("x")
    expect(set.interrupted).toBe("=")
    expect(set.approval).toBe("!")
    expect(set.checkpoint).toBe("*")
    expect(set.pending).toBe("o")
    expect(set.active).toBe(">")
    expect(set.plan).toBe("o")
    expect(set.confirm).toBe("C")
    expect(set.auto).toBe("A")
  })
})
