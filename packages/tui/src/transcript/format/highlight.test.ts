import { describe, expect, it } from "vitest"

import { theme } from "../../theme.js"
import { highlightCode, highlightCodeLine } from "./highlight.js"

function text(spans: { text: string }[]): string {
  return spans.map((span) => span.text).join("")
}

describe("syntax highlight", () => {
  it("colors keywords, functions, strings, numbers, and comments", () => {
    const { spans } = highlightCodeLine(
      'const answer = call("hi", 42) // done',
      "ts",
    )

    expect(text(spans)).toBe('const answer = call("hi", 42) // done')
    expect(spans.find((span) => span.text === "const")?.color).toBe(
      theme.syntaxKeyword,
    )
    expect(spans.find((span) => span.text === "call")?.color).toBe(
      theme.syntaxFunction,
    )
    expect(spans.find((span) => span.text === '"hi"')?.color).toBe(
      theme.syntaxString,
    )
    expect(spans.find((span) => span.text === "42")?.color).toBe(
      theme.syntaxNumber,
    )
    expect(spans.find((span) => span.text === "// done")?.color).toBe(
      theme.syntaxComment,
    )
  })

  it("tracks a block comment across lines", () => {
    const lines = highlightCode("/* start\nstill comment */\nconst x = 1", "ts")

    expect(lines[0]?.every((span) => span.color === theme.syntaxComment)).toBe(
      true,
    )
    expect(lines[1]?.every((span) => span.color === theme.syntaxComment)).toBe(
      true,
    )
    expect(
      lines[2]?.find((span) => span.text === "const")?.color,
    ).toBe(theme.syntaxKeyword)
  })

  it("uses hash comments for shell and python", () => {
    const shell = highlightCodeLine("echo hi # note", "bash")
    expect(
      shell.spans.find((span) => span.text === "# note")?.color,
    ).toBe(theme.syntaxComment)

    const py = highlightCodeLine("def run(): # note", "py")
    expect(py.spans.find((span) => span.text === "def")?.color).toBe(
      theme.syntaxKeyword,
    )
    expect(py.spans.find((span) => span.text === "# note")?.color).toBe(
      theme.syntaxComment,
    )
  })
})
