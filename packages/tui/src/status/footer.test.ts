import { describe, expect, it } from "vitest"

import { theme } from "../theme.js"
import { textWidth } from "../transcript/format/wrap.js"
import { footerLayout, modeLabel, modeTint } from "./footer.js"

describe("footer layout", () => {
  it("shows mode, branch, and help at 80, 100, and 120 columns", () => {
    for (const columns of [80, 100, 120]) {
      const footer = footerLayout({ mode: "auto", branch: "main", columns })
      expect(footer.left).toBe("⟳ Auto")
      expect(footer.right).toBe("main · ? help")
      expect(textWidth(footer.left) + 2 + textWidth(footer.right)).toBeLessThanOrEqual(columns)
    }
  })

  it("labels Manual and Plan without Claude-style uppercase modes", () => {
    expect(modeLabel("confirm")).toBe("◈ Manual")
    expect(modeLabel("plan")).toBe("◎ Plan")
    expect(modeLabel("auto")).toBe("⟳ Auto")
  })

  it("tints auto gold, plan blue, and manual neutral", () => {
    expect(modeTint("auto")).toBe(theme.tool)
    expect(modeTint("plan")).toBe(theme.info)
    expect(modeTint("confirm")).toBe(theme.textSecondary)
  })

  it("drops help, then branch, before clipping the mode", () => {
    const compact = footerLayout({ mode: "auto", branch: "main", columns: 20 })
    expect(compact.left).toBe("⟳ Auto")
    expect(compact.right).toBe("main")

    const narrow = footerLayout({ mode: "auto", branch: "main", columns: 10 })
    expect(narrow.left).toBe("⟳ Auto")
    expect(narrow.right).toBe("")

    const tiny = footerLayout({ mode: "auto", branch: "main", columns: 4 })
    expect(tiny.left.endsWith("…")).toBe(true)
    expect(tiny.right).toBe("")
  })

  it("omits the branch separator when there is no branch", () => {
    expect(footerLayout({ mode: "plan", columns: 80 })).toEqual({
      left: "◎ Plan",
      right: "? help",
    })
  })
})
