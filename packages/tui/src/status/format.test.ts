import { describe, expect, it } from "vitest"

import { formatDuration, formatTokens } from "./format.js"

describe("status format", () => {
  it("formats token counts", () => {
    expect(formatTokens(999)).toBe("999")
    expect(formatTokens(1500)).toBe("1.5k")
  })

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0s")
    expect(formatDuration(59_400)).toBe("59s")
    expect(formatDuration(61_000)).toBe("1m 1s")
    expect(formatDuration(3_600_000 + 120_000)).toBe("1h 2m")
  })
})
