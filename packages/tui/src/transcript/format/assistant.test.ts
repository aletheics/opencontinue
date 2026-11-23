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
    expect(lines.find((line) => line.text === "Title")?.color).toBe(theme.assistant)
    expect(plain).toContain("- first")
    expect(plain).toContain("1. second")
    expect(plain).toContain("▎ quote")
    expect(plain).toContain("▎ ts")
    expect(plain.some((line) => line.includes("const x = 1"))).toBe(true)
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
    expect(plain.some((line) => line.includes("# not a heading"))).toBe(true)
    expect(plain.some((line) => line.includes("- not a bullet"))).toBe(true)
    expect(plain.some((line) => line.includes("| a | b |"))).toBe(true)
    expect(plain.some((line) => line.includes("| --- | --- |"))).toBe(true)
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
      "▎ const x = 1",
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

  it("keeps one blank line around headings and uses a soft-white hierarchy", () => {
    const lines = formatAssistantLines(
      ["body", "# H1", "## H2", "### H3", "#### H4", "##### H5", "###### H6", "tail"].join("\n"),
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
      "H5",
      "",
      "H6",
      "",
      "tail",
    ])
    expect(lines.find((line) => line.text === "H1")).toMatchObject({
      color: theme.assistant,
      bold: true,
    })
    expect(lines.find((line) => line.text === "H2")).toMatchObject({
      color: theme.assistant,
      bold: true,
    })
    expect(lines.find((line) => line.text === "H3")?.color).toBe(theme.assistant)
    expect(lines.find((line) => line.text === "H4")).toMatchObject({
      color: theme.textSecondary,
      bold: true,
    })
    expect(lines.find((line) => line.text === "H5")?.color).toBe(theme.textSecondary)
    expect(lines.find((line) => line.text === "H6")).toMatchObject({
      color: theme.textSecondary,
      dim: true,
    })
  })

  it("joins soft line breaks into a flowing paragraph", () => {
    const lines = formatAssistantLines("first line\nsecond line\nthird line", 60)
    expect(lines.map((line) => line.text)).toEqual(["first line second line third line"])
  })

  it("does not insert spaces between CJK soft-wrapped lines", () => {
    const lines = formatAssistantLines("第一句。\n第二句。", 60)
    expect(lines.map((line) => line.text)).toEqual(["第一句。第二句。"])
  })

  it("keeps hard line breaks", () => {
    const lines = formatAssistantLines(
      ["first line  ", "second line\\", "third line"].join("\n"),
      60,
    )
    expect(lines.map((line) => line.text)).toEqual(["first line", "second line", "third line"])
  })

  it("renders a full-width low-contrast horizontal rule", () => {
    const lines = formatAssistantLines("before\n\n---\n\nafter", 20)
    const rule = lines.find((line) => line.text.startsWith("─"))

    expect(rule?.text).toBe("─".repeat(20))
    expect(rule?.color).toBe(theme.borderSubtle)
    expect(rule?.dim).toBe(true)
  })

  it("keeps list items together and separates content blocks", () => {
    const lines = formatAssistantLines(
      ["- one", "- two", "", "paragraph", "", "> quote", "", "```", "code", "```"].join("\n"),
      40,
    )

    expect(lines.map((line) => line.text)).toEqual([
      "- one",
      "- two",
      "",
      "paragraph",
      "",
      "▎ quote",
      "",
      "▎ code",
    ])
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

    expect(line?.text).toBe("▎ const answer = 42 // note")
    expect(spans.find((span) => span.text === "const")?.color).toBe(theme.syntaxKeyword)
    expect(spans.find((span) => span.text === "42")?.color).toBe(theme.syntaxNumber)
    expect(spans.find((span) => span.text === "// note")?.color).toBe(theme.syntaxComment)
  })

  it("labels every supported code language", () => {
    const languages: Array<[string, string]> = [
      ["ts", "ts"],
      ["javascript", "js"],
      ["json", "json"],
      ["bash", "bash"],
      ["powershell", "powershell"],
      ["python", "python"],
      ["yaml", "yaml"],
      ["markdown", "markdown"],
      ["diff", "diff"],
    ]

    for (const [fence, label] of languages) {
      const lines = formatAssistantLines(["```" + fence, "sample", "```"].join("\n"), 60)

      expect(lines[0]?.text).toBe(`▎ ${label}`)
      expect(lines[1]?.text.startsWith("▎ ")).toBe(true)
    }
  })

  it("colors diff fences", () => {
    const lines = formatAssistantLines(
      [
        "```diff",
        "diff --git a/a.ts b/a.ts",
        "--- a/a.ts",
        "+++ b/a.ts",
        "@@ -1 +1 @@",
        "-old",
        "+new",
        " context",
        "```",
      ].join("\n"),
      60,
    )

    const spanColor = (needle: string) =>
      lines
        .find((line) => line.text.includes(needle))
        ?.spans?.find((span) => span.text.includes(needle))?.color

    expect(spanColor("+new")).toBe(theme.diffAdd)
    expect(spanColor("-old")).toBe(theme.diffRemove)
    expect(spanColor("@@ -1 +1 @@")).toBe(theme.diffHunk)
    expect(spanColor("--- a/a.ts")).toBe(theme.syntaxComment)
  })

  it("wraps long code lines with the left rule", () => {
    const lines = formatAssistantLines(
      ["```ts", "const value = " + "x".repeat(80), "```"].join("\n"),
      30,
    )

    for (const line of lines) {
      expect(textWidth(line.text)).toBeLessThanOrEqual(30)
    }
    expect(lines.filter((line) => line.text.startsWith("▎ ")).length).toBeGreaterThan(3)
  })

  it("wraps CJK code lines by display width", () => {
    const lines = formatAssistantLines(
      ["```ts", 'const 名称 = "中文" // 注释', "```"].join("\n"),
      24,
    )

    expect(lines.map((line) => line.text).join("\n")).toContain("中文")
    for (const line of lines) {
      expect(textWidth(line.text)).toBeLessThanOrEqual(24)
    }
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

  it("shows a link destination without repeating its label", () => {
    const lines = formatAssistantLines("See [docs](https://example.com).", 60)
    expect(lines[0]?.text).toBe("See docs (https://example.com).")

    const same = formatAssistantLines("[https://example.com](https://example.com)", 60)
    expect(same[0]?.text).toBe("https://example.com")
  })

  it("does not split emoji sequences in assistant text", () => {
    const family = "👨‍👩‍👧‍👦"
    const lines = formatAssistantLines(`${"word ".repeat(4)}${family}${"word ".repeat(4)}`, 12)

    for (const line of lines) {
      expect(textWidth(line.text)).toBeLessThanOrEqual(12)
      if (line.text.includes("👨")) expect(line.text).toContain(family)
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
