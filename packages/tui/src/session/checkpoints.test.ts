import { describe, expect, it } from "vitest"

import { formatCheckpoints } from "./checkpoints.js"

describe("checkpoint list", () => {
  it("shows the newest checkpoints first", () => {
    const text = formatCheckpoints([
      { seq: 4, at: "2026-01-01T15:00:00.000Z", status: "completed", durationMs: 3000 },
      { seq: 6, at: "2026-01-01T15:10:00.000Z", status: "failed" },
      { seq: 9, at: "2026-01-01T15:30:00.000Z", status: "interrupted" },
    ])

    expect(text).toContain("◆ Checkpoints · 3")
    expect(text.split("\n")[1]).toContain("interrupted")
    expect(text.split("\n")[2]).toContain("failed")
    expect(text.split("\n")[3]).toContain("completed")
    expect(text).toContain("3s")
    expect(text).not.toContain("event 9")
  })

  it("handles an empty session", () => {
    expect(formatCheckpoints([])).toBe("◆ No checkpoints yet.")
  })
})
