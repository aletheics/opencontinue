import { describe, expect, it } from "vitest"

import { formatEffort, headerInfo, headerLines, truncatePathMiddle } from "./header.js"
import { textWidth, truncateToWidth } from "./transcript/format/wrap.js"

describe("header helpers", () => {
  it("orders model, effort, and provider", () => {
    const model = "deepseek-flash[1M]"

    expect(headerInfo(model, "High", "DeepSeek", 120)).toBe("deepseek-flash[1M] · High · DeepSeek")
    expect(headerInfo(model, "High", "DeepSeek", 30)).toBe("deepseek-flash[1M] · DeepSeek")
    expect(headerInfo(model, "High", "DeepSeek", 18)).toBe(model)
    expect(headerInfo(model, "High", "DeepSeek", 12)).toBe("deepseek-fl…")
  })

  it("formats only non-default effort", () => {
    expect(formatEffort("high")).toBe("High")
    expect(formatEffort("max")).toBe("Max")
    expect(formatEffort("auto")).toBeUndefined()
    expect(formatEffort(undefined)).toBeUndefined()
  })

  it("middle-shortens paths while keeping the root and basename", () => {
    const workspace = "D:\\soft\\vscodefiles\\opencontinue"

    expect(truncatePathMiddle(workspace, 40)).toBe(workspace)
    expect(truncatePathMiddle(workspace, 21)).toBe("D:\\soft\\…opencontinue")
    expect(truncatePathMiddle(workspace, 20)).toBe("D:\\…opencontinue")
    expect(textWidth(truncatePathMiddle("/work/opencontinue", 8))).toBe(8)
  })

  it("measures CJK cells", () => {
    expect(truncateToWidth("你好世界", 5)).toBe("你好…")
    const path = truncatePathMiddle("D:\\项目\\opencontinue", 12)
    expect(textWidth(path)).toBeLessThanOrEqual(12)
  })

  it("builds the three header lines at common widths", () => {
    for (const columns of [80, 100, 120]) {
      const lines = headerLines({
        version: "0.0.1",
        model: "deepseek-flash[1M]",
        effort: "High",
        provider: "DeepSeek",
        workspace: "D:\\soft\\vscodefiles\\opencontinue",
        columns,
      })

      expect(lines.map((line) => line.text)).toEqual([
        "◈ OpenContinue  v0.0.1",
        "deepseek-flash[1M] · High · DeepSeek",
        "D:\\soft\\vscodefiles\\opencontinue",
      ])
      for (const line of lines) expect(textWidth(line.text)).toBeLessThanOrEqual(columns)
    }
  })

  it("drops secondary fields before the model", () => {
    const lines = headerLines({
      version: "0.0.1",
      model: "deepseek-flash[1M]",
      effort: "High",
      provider: "DeepSeek",
      workspace: "/work/opencontinue",
      columns: 30,
    })

    expect(lines[1]?.text).toBe("deepseek-flash[1M] · DeepSeek")
    expect(lines[0]?.text).toBe("◈ OpenContinue  v0.0.1")
  })
})
