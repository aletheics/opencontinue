import { describe, expect, it } from "vitest"

import {
  activityLabel,
  activityTailParts,
  activityThresholds,
  displayActivityLabel,
  progressState,
  toolActivityLabel,
} from "./activity.js"

describe("activity state", () => {
  it("uses configurable delayed and stalled thresholds", () => {
    const thresholds = activityThresholds({
      OPENCONTINUE_DELAYED_MS: "100",
      OPENCONTINUE_STALLED_MS: "200",
    })
    expect(thresholds).toEqual({ delayedMs: 100, stalledMs: 200 })

    expect(progressState(99, false, thresholds)).toBe("active")
    expect(progressState(100, false, thresholds)).toBe("delayed")
    expect(progressState(100, true, thresholds)).toBe("active")
    expect(progressState(200, false, thresholds)).toBe("stalled")
  })

  it("never marks a long wait as failed", () => {
    const state = progressState(600_000, false)
    const label = displayActivityLabel("Waiting for model", state)
    expect(state).toBe("stalled")
    expect(label).toBe("Still waiting — no recent activity")
    expect(label).not.toContain("Failed")
  })

  it("derives labels from real tools and todo state", () => {
    expect(toolActivityLabel({ name: "read" })).toBe("Reading files")
    expect(toolActivityLabel({ name: "grep" })).toBe("Searching files")
    expect(toolActivityLabel({ name: "edit" })).toBe("Editing")
    expect(toolActivityLabel({ name: "bash" })).toBe("Running command")
    expect(
      activityLabel({ hasText: false, todoLabel: "Tracing login flow" }),
    ).toBe("Tracing login flow")
    expect(activityLabel({ hasText: false })).toBe("Waiting for model")
    expect(activityLabel({ hasText: true })).toBe("Responding")
    expect(
      activityLabel({ hasText: true, activeTool: { name: "read" } }),
    ).toBe("Reading files")
  })

  it("drops low-priority metadata on narrow widths", () => {
    expect(
      activityTailParts({
        label: "Responding",
        elapsedMs: 12_000,
        tokens: 1_800,
        effort: "High",
        width: 120,
      }),
    ).toEqual(["12s", "1.8k tokens", "High"])

    expect(
      activityTailParts({
        label: "Responding",
        elapsedMs: 12_000,
        tokens: 1_800,
        effort: "High",
        width: 24,
      }),
    ).toEqual(["High"])

    expect(
      activityTailParts({
        label: "Responding",
        elapsedMs: 12_000,
        tokens: 1_800,
        effort: "High",
        width: 14,
      }),
    ).toEqual([])
  })
})
