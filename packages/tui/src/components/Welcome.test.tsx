import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { shortenPath, Welcome } from "./Welcome.js"

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

describe("Welcome", () => {
  it("renders the OpenContinue brand header", () => {
    const { lastFrame } = render(
      <Welcome
        version="0.0.1"
        model="deepseek-flash[1M]"
        provider="DeepSeek"
        workspace={"D:\\soft\\vscodefiles\\opencontinue"}
        columns={80}
      />,
    )
    const frame = plain(lastFrame())

    expect(frame).toContain("◈ OpenContinue")
    expect(frame).toContain("v0.0.1")
    expect(frame).toContain("The open continuum for AI-assisted engineering.")
    expect(frame).toContain("Model")
    expect(frame).toContain("deepseek-flash[1M]")
    expect(frame).toContain("Provider")
    expect(frame).toContain("DeepSeek")
    expect(frame).toContain("Workspace")
    expect(frame).toContain("D:\\soft\\vscodefiles\\opencontinue")
    expect(frame).toContain("· Ready. What are we building today?")
    expect(frame).not.toContain("Welcome to")
    expect(frame).not.toContain("▄█████▄")
  })

  it("shortens a long workspace path from the middle", () => {
    expect(shortenPath("abcdefghij", 6)).toBe("abc…ij")
    expect(shortenPath("short", 20)).toBe("short")
    expect(shortenPath("abcdef", 1)).toBe("…")
  })
})
