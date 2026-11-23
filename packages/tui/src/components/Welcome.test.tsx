import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { Welcome } from "./Welcome.js"

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

describe("Welcome", () => {
  it("renders the two-line compact header", () => {
    const { lastFrame } = render(
      <Welcome
        version="0.0.1"
        model="deepseek-flash[1M]"
        provider="DeepSeek"
        workspace={"D:\\soft\\vscodefiles\\opencontinue"}
        branch="main"
        columns={80}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("◈ OpenContinue")
    expect(frame).toContain("v0.0.1")
    expect(frame).toContain(
      "deepseek-flash[1M] · DeepSeek · opencontinue · main",
    )
    expect(frame).not.toContain("The open continuum")
    expect(frame).not.toContain("Model")
    expect(frame).not.toContain("D:\\soft\\vscodefiles")
  })

  it("drops low-priority metadata on narrow terminals", () => {
    const { lastFrame } = render(
      <Welcome
        version="0.0.1"
        model="deepseek-flash[1M]"
        provider="DeepSeek"
        workspace={"D:\\soft\\vscodefiles\\opencontinue"}
        branch="feature/long-branch"
        columns={30}
      />,
    )

    expect(plain(lastFrame())).toContain("deepseek-flash[1M] · DeepSeek")
  })
})
