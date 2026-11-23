/**
 * OpenContinue Copper theme. Neutral text carries most of the interface;
 * copper marks identity and active work, green means verified success,
 * amber means attention/approval, red means error or a real failure.
 *
 * `createTheme` returns an all-undefined palette when the terminal asks for
 * monochrome, so glyphs and labels carry state without color.
 */
const copperValues = {
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
  [Key in keyof typeof copperValues]: string | undefined
}

export function createTheme(
  env: Record<string, string | undefined> = process.env,
): Theme {
  const monochrome = env.NO_COLOR !== undefined || env.FORCE_COLOR === "0"
  if (!monochrome) return copperValues

  return Object.fromEntries(
    Object.keys(copperValues).map((key) => [key, undefined]),
  ) as Theme
}

export const theme: Theme = createTheme()
