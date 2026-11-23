import { describe, expect, it } from "vitest"

import { pickSpinnerTip, SPINNER_TIPS } from "./spinner.js"

describe("spinner tips", () => {
  it("picks a tip", () => {
    expect(pickSpinnerTip(0)).toBe(SPINNER_TIPS[0])
    expect(pickSpinnerTip(0.999)).toBe(SPINNER_TIPS.at(-1))
  })
})
