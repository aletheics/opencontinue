import { render } from "ink-testing-library"
import { describe, expect, it } from "vitest"

import { textWidth } from "../transcript/format/wrap.js"
import { Welcome } from "./Welcome.js"

function plain(frame: string | undefined): string {
  return (frame ?? "").replace(/\x1b\[[0-9;?]*[ -/]*[@-~]/g, "")
}

function renderAt(columns: number, workspace = "D:\\soft\\vscodefiles\\opencontinue") {
  return render(
    <Welcome
      version="0.0.1"
      model="deepseek-flash[1M]"
      effort="High"
      provider="DeepSeek"
      workspace={workspace}
      columns={columns}
    />,
  )
}

describe("Welcome", () => {
  it("renders three lines at 80, 100, and 120 columns", () => {
    for (const columns of [80, 100, 120]) {
      const view = renderAt(columns)
      const lines = plain(view.lastFrame()).split("\n")

      expect(lines).toEqual([
        "◈ OpenContinue  v0.0.1",
        "deepseek-flash[1M] · High · DeepSeek",
        "D:\\soft\\vscodefiles\\opencontinue",
      ])
      for (const line of lines) {
        expect(textWidth(line)).toBeLessThanOrEqual(columns)
      }
      view.unmount()
    }
  })

  it("drops effort and provider on a narrow terminal", () => {
    const view = renderAt(30)
    const lines = plain(view.lastFrame()).split("\n")

    expect(lines[1]).toBe("deepseek-flash[1M] · DeepSeek")
    expect(lines).not.toContain("The open continuum")
    view.unmount()
  })

  it("middle-shortens a long workspace path", () => {
    const view = renderAt(40, "D:\\soft\\vscodefiles\\opencontinue\\very-long-project-name")
    const lines = plain(view.lastFrame()).split("\n")

    expect(lines[2]).toContain("…")
    expect(lines[2]?.endsWith("very-long-project-name")).toBe(true)
    for (const line of lines) expect(textWidth(line)).toBeLessThanOrEqual(40)
    view.unmount()
  })
})
