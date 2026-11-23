import { describe, expect, it } from "vitest"

import {
  pickSpinnerVerb,
  SPINNER_VERBS,
  spinnerColor,
  stallIntensity,
} from "./spinner.js"

describe("spinner", () => {
  it("picks a verb pair", () => {
    expect(pickSpinnerVerb(0)).toEqual(SPINNER_VERBS[0])
    expect(pickSpinnerVerb(0.999)).toEqual(SPINNER_VERBS.at(-1))
  })

  it("stalls only after three seconds without output", () => {
    expect(stallIntensity(2_999, false)).toBe(0)
    expect(stallIntensity(4_000, false)).toBeCloseTo(0.5)
    expect(stallIntensity(9_000, false)).toBe(1)
    expect(stallIntensity(9_000, true)).toBe(0)
  })

  it("moves from yellow to red", () => {
    expect(spinnerColor(0)).toBe("yellow")
    expect(spinnerColor(0.49)).toBe("yellow")
    expect(spinnerColor(0.5)).toBe("red")
    expect(spinnerColor(1)).toBe("red")
  })
})
