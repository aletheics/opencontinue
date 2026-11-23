import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { assistantBlock, formatAssistantLines } from "./assistant.js"
import { textWidth } from "./wrap.js"

describe("assistant markdown", () => {
  it("renders headings, lists, quotes, and fenced code", () => {
    const text = [
      "# Title",
      "",
      "- first",
      "1. second",
      "> quote",
      "```ts",
      "const x = 1",
      "```",
    ].join("\n")
    const lines = formatAssistantLines(text, 40)
    const plain = lines.map((line) => line.text)

    expect(plain).toContain("Title")
    expect(lines.find((line) => line.text === "Title")?.bold).toBe(true)
    expect(lines.find((line) => line.text === "Title")?.color).toBe(theme.brandShimmer)
    expect(plain).toContain("- first")
    expect(plain).toContain("1. second")
    expect(plain).toContain("▎ quote")
    expect(plain).toContain("const x = 1")
    expect(plain).not.toContain("┌─ ts")
    expect(plain).not.toContain("│ const x = 1")
    expect(plain).not.toContain("└─")
  })

  it("keeps markdown literal inside a code fence", () => {
    const lines = formatAssistantLines(
      ["```", "# not a heading", "- not a bullet", "| a | b |", "| --- | --- |", "```"].join("\n"),
      40,
    )
    const plain = lines.map((line) => line.text)
    expect(plain).toContain("# not a heading")
    expect(plain).toContain("- not a bullet")
    expect(plain).toContain("| a | b |")
    expect(plain).toContain("| --- | --- |")
  })

  it("separates top-level blocks with one blank line", () => {
    const lines = formatAssistantLines(
      ["first", "", "", "", "second", "", "```", "const x = 1", "```", "", "after"].join("\n"),
      40,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "first",
      "",
      "second",
      "",
      "const x = 1",
      "",
      "after",
    ])
  })

  it("keeps one trailing blank line for streamed chunks", () => {
    expect(formatAssistantLines("first\n\nsecond\n", 40).map((line) => line.text)).toEqual([
      "first",
      "",
      "second",
      "",
    ])
    expect(formatAssistantLines("first\n\n\n\nsecond\n\n\n", 40).map((line) => line.text)).toEqual([
      "first",
      "",
      "second",
      "",
    ])
  })

  it("keeps one blank line around headings and uses Copper tiers", () => {
    const lines = formatAssistantLines(
      ["body", "# H1", "## H2", "### H3", "#### H4", "tail"].join("\n"),
      40,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "body",
      "",
      "H1",
      "",
      "H2",
      "",
      "H3",
      "",
      "H4",
      "",
      "tail",
    ])
    expect(lines.find((line) => line.text === "H1")).toMatchObject({
      color: theme.brandShimmer,
      bold: true,
    })
    expect(lines.find((line) => line.text === "H2")).toMatchObject({
      color: theme.brand,
      bold: true,
    })
    expect(lines.find((line) => line.text === "H3")?.color).toBe(theme.brand)
    expect(lines.find((line) => line.text === "H4")).toMatchObject({
      color: theme.brand,
      dim: true,
    })
  })

  it("preserves nested list indentation", () => {
    const lines = formatAssistantLines(
      ["- top", "  - child", "    - grandchild", "1. one", "   continuation"].join("\n"),
      40,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "- top",
      "  - child",
      "    - grandchild",
      "1. one",
      "   continuation",
    ])
  })

  it("renders markdown tables aligned by display width", () => {
    const lines = formatAssistantLines(
      ["| Name | Qty |", "| --- | ---: |", "| Apple | 2 |", "| 香蕉 | 10 |"].join("\n"),
      40,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "Name   Qty",
      "─────  ───",
      "Apple    2",
      "香蕉    10",
    ])
    expect(lines[0]?.spans?.some((span) => span.bold && span.text.includes("Name"))).toBe(true)
    expect(lines[1]).toMatchObject({ color: theme.muted, dim: true })
  })

  it("accepts tables without outer pipes", () => {
    const lines = formatAssistantLines(["Name | Qty", "--- | ---", "Apple | 2"].join("\n"), 40)

    expect(lines.map((line) => line.text)).toEqual(["Name   Qty", "─────  ───", "Apple  2"])
  })

  it("wraps wide table cells instead of overflowing", () => {
    const lines = formatAssistantLines(
      ["| First column | Second column |", "| --- | --- |", "| 一段很长的中文内容 | values |"].join(
        "\n",
      ),
      24,
    )

    expect(lines.length).toBeGreaterThan(3)
    for (const line of lines) {
      expect(textWidth(line.text)).toBeLessThanOrEqual(24)
    }
  })

  it("highlights fenced code with syntax spans", () => {
    const lines = formatAssistantLines(["```ts", "const answer = 42 // note", "```"].join("\n"), 60)
    const line = lines.find((entry) => entry.text.includes("const answer"))
    const spans = line?.spans ?? []

    expect(line?.text).toBe("const answer = 42 // note")
    expect(spans.find((span) => span.text === "const")?.color).toBe(theme.syntaxKeyword)
    expect(spans.find((span) => span.text === "42")?.color).toBe(theme.syntaxNumber)
    expect(spans.find((span) => span.text === "// note")?.color).toBe(theme.syntaxComment)
  })

  it("wraps a list item under its marker", () => {
    const lines = formatAssistantLines(`- ${"word ".repeat(20)}`, 30)
    expect(lines[0]?.text.startsWith("- word")).toBe(true)
    expect(lines[1]?.text.startsWith("  ")).toBe(true)
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(30)
  })

  it("places the body beside the dot and indents continuation lines", () => {
    const lines = assistantBlock("first\n\nsecond", 40)
    expect(lines.map((line) => line.text)).toEqual(["● first", "", "  second"])
    for (const line of lines) expect(line.text.length).toBeLessThanOrEqual(40)
  })

  it("wraps CJK assistant text by display width", () => {
    const lines = assistantBlock("你好".repeat(20), 20)
    for (const line of lines) {
      expect(textWidth(line.text)).toBeLessThanOrEqual(20)
    }
  })

  it("styles inline code and bold inside assistant text", () => {
    const lines = assistantBlock("run `typecheck` and **ship** it", 80)
    const spans = lines[0]?.spans ?? []

    expect(lines[0]?.text).toBe("● run typecheck and ship it")
    expect(spans.find((span) => span.text === "typecheck")?.color).toBe(theme.inlineCode)
    expect(spans.find((span) => span.text === "ship")?.bold).toBe(true)
  })
})
