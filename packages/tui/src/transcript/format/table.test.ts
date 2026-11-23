import { describe, expect, it } from "vitest"

import { formatTable, isTableDelimiterLine, splitTableRow } from "./table.js"

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

  it("returns no lines without a header or delimiter", () => {
    expect(formatTable([], 40)).toEqual([])
    expect(formatTable(["| a | b |"], 40)).toEqual([])
  })
})
