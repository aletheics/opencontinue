import { describe, expect, it } from "vitest"

import { footerLayout } from "./footer.js"

describe("footer layout", () => {
  it("keeps mode and branch at common widths", () => {
    const footer = footerLayout({
      mode: "confirm",
      branch: "main",
      columns: 80,
      busy: false,
    })
    expect(footer.left).toBe("◈ Confirm · main")
    expect(footer.right).toBe("? help")
  })

  it("shows non-default reasoning before help", () => {
    const footer = footerLayout({
      mode: "auto",
      branch: "main",
      reasoning: "Reasoning: High",
      columns: 120,
      busy: false,
    })
    expect(footer.right).toBe("Reasoning: High · ? help")
  })

  it("drops low-priority fields before clipping the mode", () => {
    const footer = footerLayout({
      mode: "plan",
      branch: "feature/long-branch-name",
      reasoning: "Reasoning: High",
      columns: 28,
      busy: false,
    })
    expect(footer.left.startsWith("◎ Plan")).toBe(true)
    expect(footer.right).toBe("")
  })

  it("replaces help with the interrupt hint while working", () => {
    const footer = footerLayout({
      mode: "confirm",
      branch: "main",
      reasoning: "Reasoning: High",
      columns: 100,
      busy: true,
    })
    expect(footer.left).toContain("esc to interrupt")
    expect(footer.right).toBe("")
  })
})
