/**
 * OpenContinue Copper theme. Neutral text carries most of the interface;
 * copper marks identity and active work, green means verified success,
 * amber means attention/approval, red means error or a real failure.
 *
 * Dark is the default. `OPENCONTINUE_THEME=light|dark` selects explicitly;
 * otherwise a `COLORFGBG` light background chooses the light palette. A
 * monochrome request wins over both, so glyphs and labels carry state alone.
 */
const darkValues = {
  background: "#151515",
  surface: "#242424",
  surfaceSubtle: "#1C1C1C",
  textPrimary: "#E5E5E5",
  textSecondary: "#A3A3A3",
  textMuted: "#737373",
  borderSubtle: "#454545",
  brand: "#D99A75",
  brandShimmer: "#F0B18F",
  success: "#7EBB91",
  warning: "#D9AE62",
  error: "#D9767C",
  info: "#86AFC4",

  // Component aliases. Prefer the semantic names above in new code.
  working: "#D9AE62",
  workingShimmer: "#F0B18F",
  assistant: "#E5E5E5",
  user: "#7EBB91",
  userBar: "#242424",
  tool: "#D9AE62",
  muted: "#737373",
  border: "#454545",
  inputBorder: "#454545",
  danger: "#D9767C",

  inlineCode: "#86AFC4",
  link: "#86AFC4",
  syntaxKeyword: "#86AFC4",
  syntaxString: "#7EBB91",
  syntaxNumber: "#D9AE62",
  syntaxComment: "#737373",
  syntaxLiteral: "#D9AE62",
  syntaxFunction: "#86AFC4",

  diffAdd: "#7EBB91",
  diffRemove: "#D9767C",
  diffHunk: "#86AFC4",
} as const

export type Theme = {
  [Key in keyof typeof darkValues]: string | undefined
}

export type ThemeMode = "dark" | "light"

/** Light terminal palette: the same roles, tuned for a white background. */
const lightValues: Theme = {
  background: "#FFFFFF",
  surface: "#F2F1EF",
  surfaceSubtle: "#FAF9F7",
  textPrimary: "#1F1D1A",
  textSecondary: "#5E5A54",
  textMuted: "#8B857C",
  borderSubtle: "#D8D2C8",
  brand: "#A65D3A",
  brandShimmer: "#B86F48",
  success: "#3F7D52",
  warning: "#8A6218",
  error: "#A64046",
  info: "#3A6E8A",

  working: "#8A6218",
  workingShimmer: "#A67C2E",
  assistant: "#1F1D1A",
  user: "#3F7D52",
  userBar: "#F2F1EF",
  tool: "#8A6218",
  muted: "#8B857C",
  border: "#D8D2C8",
  inputBorder: "#D8D2C8",
  danger: "#A64046",

  inlineCode: "#2F6F8F",
  link: "#2F6F8F",
  syntaxKeyword: "#2F6F8F",
  syntaxString: "#3F7D52",
  syntaxNumber: "#8A6218",
  syntaxComment: "#8B857C",
  syntaxLiteral: "#8A6218",
  syntaxFunction: "#2F6F8F",

  diffAdd: "#3F7D52",
  diffRemove: "#A64046",
  diffHunk: "#3A6E8A",
}

/**
 * Resolve the terminal theme without changing the palette. An explicit
 * `OPENCONTINUE_THEME` wins; `COLORFGBG` uses its final field as the ANSI
 * background color (7–15 is light). The default is dark.
 */
export function resolveThemeMode(env: Record<string, string | undefined> = process.env): ThemeMode {
  const explicit = env.OPENCONTINUE_THEME?.trim().toLowerCase()
  if (explicit === "light" || explicit === "dark") return explicit

  const background = env.COLORFGBG?.split(";").at(-1)?.trim()
  const value = background ? Number.parseInt(background, 10) : Number.NaN
  if (!Number.isNaN(value) && value >= 7 && value <= 15) return "light"

  return "dark"
}

export function createTheme(env: Record<string, string | undefined> = process.env): Theme {
  const monochrome = env.NO_COLOR !== undefined || env.FORCE_COLOR === "0"
  if (monochrome) {
    return Object.fromEntries(Object.keys(darkValues).map((key) => [key, undefined])) as Theme
  }

  return resolveThemeMode(env) === "light" ? lightValues : darkValues
}

export const theme: Theme = createTheme()
