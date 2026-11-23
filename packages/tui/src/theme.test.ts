import { describe, expect, it } from "vitest"

import { createTheme, resolveThemeMode } from "./theme.js"

describe("theme", () => {
  it("uses Copper colors by default", () => {
    const theme = createTheme({})
    expect(theme.brand).toBe("#D99A75")
    expect(theme.success).toBe("#7EBB91")
    expect(theme.error).toBe("#D9767C")
  })

  it("selects light explicitly or from a light terminal background", () => {
    expect(resolveThemeMode({ OPENCONTINUE_THEME: "light" })).toBe("light")
    expect(resolveThemeMode({ OPENCONTINUE_THEME: "DARK", COLORFGBG: "0;15" })).toBe("dark")
    expect(resolveThemeMode({ COLORFGBG: "0;15" })).toBe("light")
    expect(resolveThemeMode({ COLORFGBG: "15;0" })).toBe("dark")
    expect(resolveThemeMode({ COLORFGBG: "0;default" })).toBe("dark")
    expect(resolveThemeMode({})).toBe("dark")
  })

  it("uses light tokens with the same roles", () => {
    const dark = createTheme({})
    const light = createTheme({ OPENCONTINUE_THEME: "light" })

    expect(Object.keys(light)).toEqual(Object.keys(dark))
    expect(light.background).toBe("#FFFFFF")
    expect(light.assistant).toBe("#1F1D1A")
    expect(light.textSecondary).toBe("#5E5A54")
    expect(light.inlineCode).toBe("#2F6F8F")
    expect(light.diffAdd).toBe("#3F7D52")
    expect(light.diffRemove).toBe("#A64046")
  })

  it("removes colors when NO_COLOR or FORCE_COLOR=0 is set", () => {
    for (const env of [
      { NO_COLOR: "1" },
      { NO_COLOR: "" },
      { FORCE_COLOR: "0" },
      { OPENCONTINUE_THEME: "light", NO_COLOR: "1" },
    ]) {
      const theme = createTheme(env)
      expect(Object.values(theme).every((value) => value === undefined)).toBe(true)
    }
  })
})
