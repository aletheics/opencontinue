import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { FullscreenTranscript } from "./FullscreenTranscript.js"

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

const lines = Array.from({ length: 6 }, (_, index) => ({
  text: `line ${index}`,
}))

describe("FullscreenTranscript", () => {
  it("follows the tail", () => {
    const { lastFrame } = render(
      <FullscreenTranscript lines={lines} height={2} scrollFromBottom={0} />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("line 5")
    expect(frame).toContain("line 4")
    expect(frame).not.toContain("line 3")
  })

  it("windows older lines when scrolled up", () => {
    const { lastFrame } = render(
      <FullscreenTranscript lines={lines} height={2} scrollFromBottom={2} />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("line 2")
    expect(frame).toContain("line 3")
    expect(frame).not.toContain("line 5")
  })
})
