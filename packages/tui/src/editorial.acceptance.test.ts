import { describe, expect, it } from "vitest"

import { headerLines } from "./header.js"
import { footerLayout } from "./status/footer.js"
import { theme } from "./theme.js"
import { assistantBlock, formatAssistantLines } from "./transcript/format/assistant.js"
import { timelineLines } from "./transcript/format/lines.js"
import { textWidth } from "./transcript/format/wrap.js"

const CORPUS = [
  "# OpenContinue report",
  "",
  "This paragraph is written across",
  "three source lines and includes **bold**, *italic*, ~~strike~~, `inline`, and [docs](https://example.com).",
  "",
  "## Findings",
  "",
  "### Details",
  "",
  "#### Deeper",
  "",
  "##### More",
  "",
  "###### Deepest",
  "",
  "1. first",
  "2. second",
  "   - nested A",
  "   - nested B",
  "",
  "- [x] done",
  "- [ ] todo",
  "",
  "> A quiet quote.",
  "",
  "---",
  "",
  "| Component | Responsibility | Status | Owner |",
  "| --- | --- | --- | --- |",
  "| Protocol | Wire schemas | stable | 张三 |",
  "| Runtime | Agent loop and tool execution | active | team |",
  "",
  "```ts",
  "const answer = 42 // 注释",
  `const longValue = "${"x".repeat(100)}"`,
  "```",
  "",
  "```javascript",
  "const ok = true",
  "```",
  "",
  "```json",
  '{"ok": true, "count": 42}',
  "```",
  "",
  "```bash",
  "npm test # run tests",
  "```",
  "",
  "```powershell",
  "Get-ChildItem -Path . -Recurse # files",
  "```",
  "",
  "```python",
  'print("你好")',
  "```",
  "",
  "```yaml",
  "name: opencontinue",
  "enabled: true",
  "```",
  "",
  "```markdown",
  "## Example",
  "- item",
  "```",
  "",
  "```diff",
  "@@ -1 +1 @@",
  "-old",
  "+new",
  "```",
  "",
  "发布 🚀 👨‍👩‍👧‍👦 👍🏽 ❤️ 完成。",
].join("\n")

describe("editorial acceptance", () => {
  for (const columns of [60, 80, 120]) {
    it(`renders the full corpus at ${columns} columns`, () => {
      const lines = formatAssistantLines(CORPUS, columns)
      const plain = lines.map((line) => line.text).join("\n")

      for (const expected of [
        "OpenContinue report",
        "Findings",
        "Deepest",
        "nested A",
        "- [x] done",
        "A quiet quote.",
        "Component",
        "张三",
        "https://example.com",
        "▎ ts",
        "▎ js",
        "▎ json",
        "▎ bash",
        "▎ powershell",
        "▎ python",
        "▎ yaml",
        "▎ markdown",
        "▎ diff",
        "发布 🚀",
      ]) {
        expect(plain).toContain(expected)
      }

      expect(lines.some((line) => line.text === "─".repeat(columns))).toBe(true)

      const added = lines.find((line) => line.text.includes("+new"))
      expect(added?.spans?.find((span) => span.text.includes("+new"))?.color).toBe(theme.diffAdd)
      const removed = lines.find((line) => line.text.includes("-old"))
      expect(removed?.spans?.find((span) => span.text.includes("-old"))?.color).toBe(
        theme.diffRemove,
      )

      for (const line of lines) {
        expect(textWidth(line.text)).toBeLessThanOrEqual(columns)
        if (line.text.includes("👨")) expect(line.text).toContain("👨‍👩‍👧‍👦")
        if (line.text.includes("👍")) expect(line.text).toContain("👍🏽")
        if (line.text.includes("🇨")) expect(line.text).toContain("🇨🇳")
      }
    })

    it(`matches the alternate-screen formatter at ${columns} columns`, () => {
      const assistant = {
        kind: "assistant" as const,
        id: "assistant:1",
        runId: "run:1",
        text: CORPUS,
      }
      const inline = assistantBlock(CORPUS, columns).map((line) => line.text)
      const alternate = timelineLines([assistant], columns, false).map((line) => line.text)

      expect(alternate).toEqual(inline)
    })
  }

  it("keeps header and status bar inside the terminal", () => {
    for (const columns of [60, 80, 120]) {
      const header = headerLines({
        version: "0.0.1",
        model: "deepseek-flash[1M]",
        effort: "High",
        provider: "DeepSeek",
        workspace: "D:\\soft\\vscodefiles\\opencontinue\\packages\\tui\\src\\transcript\\format",
        columns,
      })
      for (const line of header) {
        expect(textWidth(line.text)).toBeLessThanOrEqual(columns)
      }
      expect(header[0]?.text).toContain("OpenContinue")
      expect(header[1]?.text).toContain("deepseek-flash[1M]")

      const footer = footerLayout({
        mode: "auto",
        branch: "main",
        columns: columns - 4,
      })
      expect(footer.left).toBe("⟳ Auto")
      expect(footer.right).toBe("main · ? help")
    }
  })
})
