import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { highlightCode, highlightCodeLine } from "./highlight.js"

function text(spans: { text: string }[]): string {
  return spans.map((span) => span.text).join("")
}

describe("syntax highlight", () => {
  it("colors keywords, functions, strings, numbers, and comments", () => {
    const { spans } = highlightCodeLine('const answer = call("hi", 42) // done', "ts")

    expect(text(spans)).toBe('const answer = call("hi", 42) // done')
    expect(spans.find((span) => span.text === "const")?.color).toBe(theme.syntaxKeyword)
    expect(spans.find((span) => span.text === "call")?.color).toBe(theme.syntaxFunction)
    expect(spans.find((span) => span.text === '"hi"')?.color).toBe(theme.syntaxString)
    expect(spans.find((span) => span.text === "42")?.color).toBe(theme.syntaxNumber)
    expect(spans.find((span) => span.text === "// done")?.color).toBe(theme.syntaxComment)
  })

  it("tracks a block comment across lines", () => {
    const lines = highlightCode("/* start\nstill comment */\nconst x = 1", "ts")

    expect(lines[0]?.every((span) => span.color === theme.syntaxComment)).toBe(true)
    expect(lines[1]?.every((span) => span.color === theme.syntaxComment)).toBe(true)
    expect(lines[2]?.find((span) => span.text === "const")?.color).toBe(theme.syntaxKeyword)
  })

  it("highlights JSON strings, literals, and numbers", () => {
    const { spans } = highlightCodeLine('{"ok": true, "n": 42}', "json")

    expect(text(spans)).toBe('{"ok": true, "n": 42}')
    expect(spans.find((span) => span.text === '"ok"')?.color).toBe(theme.syntaxString)
    expect(spans.find((span) => span.text === "true")?.color).toBe(theme.syntaxLiteral)
    expect(spans.find((span) => span.text === "42")?.color).toBe(theme.syntaxNumber)
  })

  it("highlights YAML keys, scalars, and comments", () => {
    const { spans } = highlightCodeLine("  enabled: true # note", "yaml")

    expect(text(spans)).toBe("  enabled: true # note")
    expect(spans.find((span) => span.text === "enabled")?.color).toBe(theme.syntaxFunction)
    expect(spans.find((span) => span.text === "true")?.color).toBe(theme.syntaxLiteral)
    expect(spans.find((span) => span.text === "# note")?.color).toBe(theme.syntaxComment)

    const quoted = highlightCodeLine('name: "中文"', "yaml")
    expect(quoted.spans.find((span) => span.text === '"中文"')?.color).toBe(theme.syntaxString)
  })

  it("highlights Markdown markers and inline code", () => {
    const heading = highlightCodeLine("## Title `code`", "markdown")
    expect(heading.spans.find((span) => span.text === "##")?.color).toBe(theme.syntaxKeyword)
    expect(heading.spans.find((span) => span.text === "`code`")?.color).toBe(theme.syntaxString)

    const list = highlightCodeLine("- item", "markdown")
    expect(list.spans.find((span) => span.text === "-")?.color).toBe(theme.syntaxKeyword)
  })

  it("highlights PowerShell cmdlets, parameters, variables, and comments", () => {
    const { spans } = highlightCodeLine("Get-ChildItem -Path . -Recurse # files", "powershell")

    expect(spans.find((span) => span.text === "Get-ChildItem")?.color).toBe(theme.syntaxFunction)
    expect(spans.find((span) => span.text === "-Path")?.color).toBe(theme.syntaxKeyword)
    expect(spans.find((span) => span.text === "# files")?.color).toBe(theme.syntaxComment)

    const variable = highlightCodeLine('$name = "value"', "powershell")
    expect(variable.spans.find((span) => span.text === "$name")?.color).toBe(theme.syntaxFunction)
    expect(variable.spans.find((span) => span.text === '"value"')?.color).toBe(theme.syntaxString)
  })

  it("highlights diff lines by intent", () => {
    const added = highlightCodeLine("+new", "diff").spans
    const removed = highlightCodeLine("-old", "diff").spans
    const hunk = highlightCodeLine("@@ -1 +1 @@", "diff").spans
    const header = highlightCodeLine("--- a/a.ts", "diff").spans

    expect(added[0]?.color).toBe(theme.diffAdd)
    expect(removed[0]?.color).toBe(theme.diffRemove)
    expect(hunk[0]?.color).toBe(theme.diffHunk)
    expect(header[0]?.color).toBe(theme.syntaxComment)
    expect(header[0]?.dim).toBe(true)
  })

  it("uses hash comments for shell and python", () => {
    const shell = highlightCodeLine("echo hi # note", "bash")
    expect(shell.spans.find((span) => span.text === "# note")?.color).toBe(theme.syntaxComment)

    const py = highlightCodeLine("def run(): # note", "py")
    expect(py.spans.find((span) => span.text === "def")?.color).toBe(theme.syntaxKeyword)
    expect(py.spans.find((span) => span.text === "# note")?.color).toBe(theme.syntaxComment)
  })
})
