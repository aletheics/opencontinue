import { describe, expect, it } from "vitest"

import {
  formatClock,
  formatDuration,
  formatNumber,
  formatTokens,
} from "./format.js"

describe("status format", () => {
  it("formats token counts", () => {
    expect(formatTokens(999)).toBe("999")
    expect(formatTokens(1500)).toBe("1.5k")
  })

  it("formats compact numbers with one decimal", () => {
    expect(formatNumber(999)).toBe("999")
    expect(formatNumber(1_000)).toBe("1.0k")
    expect(formatNumber(1_500)).toBe("1.5k")
    expect(formatNumber(45_500)).toBe("45.5k")
    expect(formatNumber(1_200_000)).toBe("1.2m")
  })

  it("formats a local clock", () => {
    expect(formatClock(new Date(2026, 0, 1, 16, 1))).toBe("16:01")
  })

  it("formats durations", () => {
    expect(formatDuration(0)).toBe("0s")
    expect(formatDuration(500)).toBe("0.5s")
    expect(formatDuration(59_400)).toBe("59s")
    expect(formatDuration(61_000)).toBe("1m 1s")
    expect(formatDuration(3_600_000 + 120_000)).toBe("1h 2m 0s")
    expect(formatDuration(120_000, { hideTrailingZeros: true })).toBe("2m")
    expect(
      formatDuration(3_600_000 + 120_000, { hideTrailingZeros: true }),
    ).toBe("1h 2m")
    expect(formatDuration(90_000, { hideTrailingZeros: true })).toBe("1m 30s")
  })
})
