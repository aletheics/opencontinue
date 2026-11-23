import { afterEach, describe, expect, it, vi } from "vitest"

describe("light theme rendering", () => {
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.resetModules()
  })

  it("uses light tokens for headings, tables, and diffs", async () => {
    vi.stubEnv("OPENCONTINUE_THEME", "light")
    vi.resetModules()

    const { theme } = await import("./theme.js")
    const { formatAssistantLines } = await import("./transcript/format/assistant.js")

    expect(theme.background).toBe("#FFFFFF")
    expect(theme.assistant).toBe("#1F1D1A")

    const lines = formatAssistantLines(
      [
        "# Title",
        "",
        "| A | B |",
        "| --- | --- |",
        "| 1 | 2 |",
        "",
        "```diff",
        "+new",
        "-old",
        "```",
      ].join("\n"),
      60,
    )

    expect(lines.find((line) => line.text === "Title")?.color).toBe(theme.assistant)

    const header = lines.find((line) => line.text.startsWith("A"))
    expect(header?.spans?.some((span) => span.bold && span.color === theme.assistant)).toBe(true)

    const separator = lines.find((line) => line.text.startsWith("─"))
    expect(separator?.color).toBe(theme.muted)

    const added = lines.find((line) => line.text.includes("+new"))
    expect(added?.spans?.find((span) => span.text.includes("+new"))?.color).toBe(theme.diffAdd)

    const removed = lines.find((line) => line.text.includes("-old"))
    expect(removed?.spans?.find((span) => span.text.includes("-old"))?.color).toBe(theme.diffRemove)
  })
})
