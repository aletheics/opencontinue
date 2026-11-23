import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { SpinnerLine } from "./SpinnerLine.js"

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

describe("SpinnerLine", () => {
  it("shows a real label with elapsed time and tokens", () => {
    const { lastFrame } = render(
      <SpinnerLine
        label="Running command"
        state="active"
        elapsedMs={39_000}
        tokens={1_800}
        effort="High"
        columns={120}
        tip="Press ctrl+o to open the full transcript"
        pulse={false}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("◈ Running command · 39s · 1.8k tokens · High")
    expect(frame).toContain("⎿  Tip: Press ctrl+o to open the full transcript")
  })

  it("labels a delayed wait without calling it failed", () => {
    const { lastFrame } = render(
      <SpinnerLine
        label="Waiting for model"
        state="delayed"
        elapsedMs={12_000}
        tokens={0}
        columns={100}
        tip="tip"
        pulse={false}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("Waiting for model · still working")
    expect(frame).not.toContain("Failed")
  })

  it("labels a stalled wait with an explicit warning, not failure", () => {
    const { lastFrame } = render(
      <SpinnerLine
        label="Waiting for model"
        state="stalled"
        elapsedMs={45_000}
        tokens={0}
        columns={100}
        tip="tip"
        pulse={false}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("Still waiting — no recent activity · 45s")
    expect(frame).not.toContain("Failed")
  })

  it("drops metadata before clipping the label on narrow terminals", () => {
    const { lastFrame } = render(
      <SpinnerLine
        label="Responding"
        state="active"
        elapsedMs={12_000}
        tokens={1_800}
        effort="High"
        columns={24}
        tip="tip"
        pulse={false}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("◈ Responding · High")
    expect(frame).not.toContain("tokens")
  })
})
