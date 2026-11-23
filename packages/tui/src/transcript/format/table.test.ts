import { describe, expect, it } from "vitest"

import { formatTable, isTableDelimiterLine, splitTableRow } from "./table.js"
import { textWidth } from "./wrap.js"

describe("table formatting", () => {
  it("splits rows with optional outer pipes and escaped pipes", () => {
    expect(splitTableRow("| a | b |")).toEqual(["a", "b"])
    expect(splitTableRow("a | b")).toEqual(["a", "b"])
    expect(splitTableRow("| a \\| b | c |")).toEqual(["a | b", "c"])
  })

  it("recognizes delimiter rows", () => {
    expect(isTableDelimiterLine("| --- | :---: | ---: |")).toBe(true)
    expect(isTableDelimiterLine("--- | ---")).toBe(true)
    expect(isTableDelimiterLine("| --- | text |")).toBe(false)
    expect(isTableDelimiterLine("---")).toBe(false)
  })

  it("aligns cells left, center, and right", () => {
    const lines = formatTable(
      ["| A | B | C |", "| :--- | :---: | ---: |", "| left | center | right |"],
      40,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "A       B         C",
      "────  ──────  ─────",
      "left  center  right",
    ])
    expect(lines[0]?.spans?.some((span) => span.bold)).toBe(true)
    expect(lines[1]).toMatchObject({ dim: true })
  })

  it("keeps the grid at 60, 80, and 120 columns", () => {
    const rows = [
      "| C1 | C2 | C3 | C4 | C5 |",
      "| --- | --- | --- | --- | --- |",
      "| a | b | c | d | e |",
    ]

    for (const width of [60, 80, 120]) {
      const lines = formatTable(rows, width)
      expect(lines[0]?.text).toBe("C1  C2  C3  C4  C5")
      expect(lines[1]?.text).toBe("──  ──  ──  ──  ──")
      expect(lines[2]?.text).toBe("a   b   c   d   e")
      for (const line of lines) {
        expect(textWidth(line.text)).toBeLessThanOrEqual(width)
      }
    }
  })

  it("aligns CJK and Latin cells in the grid", () => {
    const lines = formatTable(
      ["| 名称 | Value | 状态 |", "| --- | --- | --- |", "| 中文 | 42 | 完成 |"],
      60,
    )

    expect(lines[0]?.text).toContain("名称")
    expect(lines[0]?.text).toContain("Value")
    expect(lines[2]?.text).toContain("中文")
    expect(lines[2]?.text).toContain("完成")
    for (const line of lines) expect(textWidth(line.text)).toBeLessThanOrEqual(60)
  })

  it("switches to vertical records when columns would be unreadable", () => {
    const lines = formatTable(
      [
        "| Component | Responsibility | Status |",
        "| --- | --- | --- |",
        "| Protocol | Wire schemas | stable |",
        "| Runtime | Agent loop | active |",
      ],
      20,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "Component:",
      "  Protocol",
      "Responsibility:",
      "  Wire schemas",
      "Status: stable",
      "",
      "Component:",
      "  Runtime",
      "Responsibility:",
      "  Agent loop",
      "Status: active",
    ])
    expect(lines.filter((line) => line.text === "")).toHaveLength(1)
    for (const line of lines) expect(textWidth(line.text)).toBeLessThanOrEqual(20)
  })

  it("returns no lines without a header or delimiter", () => {
    expect(formatTable([], 40)).toEqual([])
    expect(formatTable(["| a | b |"], 40)).toEqual([])
  })
})
