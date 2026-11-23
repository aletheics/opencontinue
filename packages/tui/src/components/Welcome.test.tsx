import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import {
  BANNER_MARK,
  bannerTextWidth,
  modelLines,
  truncateLine,
  Welcome,
} from "./Welcome.js"

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

describe("Welcome", () => {
  it("renders the condensed Claude-style banner", () => {
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

    expect(frame).toContain("OpenContinue")
    expect(frame).toContain("v0.0.1")
    expect(frame).toContain("deepseek-flash[1M] · DeepSeek")
    expect(frame).toContain("D:\\soft\\vscodefiles\\opencontinue")
    expect(frame).not.toContain("Welcome to")
    expect(frame).toContain("▄█████▄")
    expect(frame).toContain("▀█████▀")
    for (const line of BANNER_MARK) {
      expect(line).toHaveLength(9)
    }
  })

  it("splits the model and provider on narrow terminals", () => {
    const lines = modelLines(
      "a-very-long-model-name",
      "a-very-long-provider-name",
      20,
    )
    expect(lines).toHaveLength(2)
    expect(lines[0]).toBe("a-very-long-model-n…")
    expect(lines[1]).toBe("a-very-long-provide…")

    const { lastFrame } = render(
      <Welcome
        version="1.2.3-beta.9-very-long"
        model="a-very-long-model-name"
        provider="a-very-long-provider-name"
        workspace={"D:\\soft\\vscodefiles\\opencontinue"}
        columns={20}
      />,
    )
    const frame = plain(lastFrame())
    expect(frame).toContain("a-very-long-model-n…")
    expect(frame).toContain("a-very-long-provide…")
    expect(frame).toContain("v1.2.3…")
  })

  it("keeps the info column inside the terminal", () => {
    expect(bannerTextWidth(10)).toBe(20)
    expect(bannerTextWidth(80)).toBe(65)
    expect(truncateLine("abcdef", 4)).toBe("abc…")
    expect(truncateLine("abcd", 4)).toBe("abcd")
    expect(truncateLine("abcd", 0)).toBe("")
  })
})
