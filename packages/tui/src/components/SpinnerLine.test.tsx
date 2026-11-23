import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { spinnerFrames } from "../status/spinner.js"
import { SpinnerLine } from "./SpinnerLine.js"

const frames = spinnerFrames("win32")

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

describe("SpinnerLine", () => {
  it("shows the verb and tip without timer or tokens early in a run", () => {
    const { lastFrame } = render(
      <SpinnerLine
        verb="Scampering"
        tip="Press esc to interrupt the current run"
        elapsedMs={1_000}
        tokens={500}
        stalled={0}
        columns={100}
        frames={frames}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("Scampering…")
    expect(frame).toContain("⎿  Tip: Press esc to interrupt the current run")
    expect(frame).not.toContain("tokens")
    expect(frame).not.toContain("(1s")
  })

  it("reveals elapsed time and tokens after 30 seconds", () => {
    const { lastFrame } = render(
      <SpinnerLine
        verb="Topsy-turvying"
        tip="Press ctrl+o to open the full transcript"
        elapsedMs={39_000}
        tokens={1_800}
        stalled={0}
        columns={120}
        frames={frames}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("Topsy-turvying…")
    expect(frame).toContain("(39s · ↓ 1.8k tokens)")
  })

  it("drops the token count before the timer on narrow terminals", () => {
    const { lastFrame } = render(
      <SpinnerLine
        verb="Scampering"
        tip="Press esc to interrupt the current run"
        elapsedMs={39_000}
        tokens={1_800}
        stalled={0}
        columns={30}
        frames={frames}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("(39s)")
    expect(frame).not.toContain("tokens")
  })

  it("keeps the verb visible while stalled", () => {
    const { lastFrame } = render(
      <SpinnerLine
        verb="Scampering"
        tip="Press esc to interrupt the current run"
        elapsedMs={9_000}
        tokens={0}
        stalled={1}
        columns={100}
        frames={frames}
      />,
    )

    expect(plain(lastFrame())).toContain("Scampering…")
  })
})
