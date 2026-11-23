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
    expect(lines.find((line) => line.text === "Title")?.color).toBe(
      theme.assistant,
    )
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
      ["```", "# not a heading", "- not a bullet", "```"].join("\n"),
      40,
    )
    const plain = lines.map((line) => line.text)
    expect(plain).toContain("# not a heading")
    expect(plain).toContain("- not a bullet")
  })

  it("highlights fenced code with syntax spans", () => {
    const lines = formatAssistantLines(
      ["```ts", "const answer = 42 // note", "```"].join("\n"),
      60,
    )
    const line = lines.find((entry) => entry.text.includes("const answer"))
    const spans = line?.spans ?? []

    expect(line?.text).toBe("const answer = 42 // note")
    expect(spans.find((span) => span.text === "const")?.color).toBe(
      theme.syntaxKeyword,
    )
    expect(spans.find((span) => span.text === "42")?.color).toBe(
      theme.syntaxNumber,
    )
    expect(spans.find((span) => span.text === "// note")?.color).toBe(
      theme.syntaxComment,
    )
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
    expect(
      spans.find((span) => span.text === "typecheck")?.color,
    ).toBe(theme.inlineCode)
    expect(spans.find((span) => span.text === "ship")?.bold).toBe(true)
  })
})
