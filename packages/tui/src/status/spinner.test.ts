import { describe, expect, it } from "vitest"

import {
  glimmerIndex,
  isShimmerChar,
  pickCompletionVerb,
  pickSpinnerTip,
  pickSpinnerVerb,
  SPINNER_TIPS,
  SPINNER_VERBS,
  spinnerFrames,
  spinnerGlyph,
  stallIntensity,
  stallTint,
  TURN_COMPLETION_VERBS,
  visibleStatusParts,
} from "./spinner.js"

describe("spinner", () => {
  it("picks a verb, completion verb, and tip", () => {
    expect(pickSpinnerVerb(0)).toBe(SPINNER_VERBS[0])
    expect(pickSpinnerVerb(0.999)).toBe(SPINNER_VERBS.at(-1))
    expect(SPINNER_VERBS).toContain("Scampering")
    expect(SPINNER_VERBS).toContain("Topsy-turvying")
    expect(SPINNER_VERBS).toContain("Churning")

    expect(pickCompletionVerb(0)).toBe("Baked")
    expect(pickCompletionVerb(0.999)).toBe("Worked")
    expect(TURN_COMPLETION_VERBS).toContain("Churned")

    expect(pickSpinnerTip(0)).toBe(SPINNER_TIPS[0])
    expect(pickSpinnerTip(0.999)).toBe(SPINNER_TIPS.at(-1))
  })

  it("uses platform-specific glyphs and a forward-then-back cycle", () => {
    expect(spinnerFrames("darwin")).toEqual([
      "·",
      "✢",
      "✳",
      "✶",
      "✻",
      "✽",
      "✽",
      "✻",
      "✶",
      "✳",
      "✢",
      "·",
    ])
    expect(spinnerFrames("win32")).toEqual([
      "·",
      "✢",
      "*",
      "✶",
      "✻",
      "✽",
      "✽",
      "✻",
      "✶",
      "*",
      "✢",
      "·",
    ])

    const frames = spinnerFrames("win32")
    expect(spinnerGlyph(0, frames)).toBe("·")
    expect(spinnerGlyph(120, frames)).toBe("✢")
    expect(spinnerGlyph(600, frames)).toBe("✽")
    expect(spinnerGlyph(720, frames)).toBe("✽")
    expect(spinnerGlyph(840, frames)).toBe("✻")
  })

  it("stalls only after three seconds without output", () => {
    expect(stallIntensity(2_999, false)).toBe(0)
    expect(stallIntensity(4_000, false)).toBeCloseTo(0.5)
    expect(stallIntensity(9_000, false)).toBe(1)
    expect(stallIntensity(9_000, true)).toBe(0)
  })

  it("fades the spinner from Claude orange to error red", () => {
    expect(stallTint(0)).toBe("rgb(215,119,87)")
    expect(stallTint(0.5)).toBe("rgb(193,81,75)")
    expect(stallTint(1)).toBe("rgb(171,43,63)")
  })

  it("sweeps a shimmer highlight across the message", () => {
    expect(glimmerIndex(10, 0)).toBe(20)
    expect(glimmerIndex(10, 200)).toBe(19)
    expect(glimmerIndex(10, 6_000)).toBe(20)
    expect(isShimmerChar(10, 11)).toBe(true)
    expect(isShimmerChar(10, 13)).toBe(false)
  })

  it("hides the timer and tokens for the first 30 seconds", () => {
    expect(visibleStatusParts(30_000, 1_000, 100)).toEqual([])
    expect(visibleStatusParts(39_000, 1_800, 100)).toEqual([
      "39s",
      "↓ 1.8k tokens",
    ])
    expect(visibleStatusParts(39_000, 1_800, 8)).toEqual(["39s"])
    expect(visibleStatusParts(39_000, 1_800, 4)).toEqual([])
  })
})
