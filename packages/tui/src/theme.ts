/**
 * OpenContinue Copper theme. Neutral text carries most of the interface;
 * copper marks identity and active work, green means verified success,
 * amber means attention/approval, red means error or a real failure.
 */
const copper = {
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
} as const

export const theme = {
  ...copper,

  // Component aliases. Prefer the semantic names above in new code.
  working: copper.warning,
  workingShimmer: copper.brandShimmer,
  assistant: copper.textPrimary,
  user: copper.success,
  userBar: copper.surface,
  tool: copper.warning,
  muted: copper.textMuted,
  border: copper.borderSubtle,
  inputBorder: copper.borderSubtle,
  danger: copper.error,

  inlineCode: copper.info,
  link: copper.info,
  syntaxKeyword: copper.info,
  syntaxString: copper.success,
  syntaxNumber: copper.warning,
  syntaxComment: copper.textMuted,
  syntaxLiteral: copper.warning,
  syntaxFunction: copper.info,

  diffAdd: copper.success,
  diffRemove: copper.error,
  diffHunk: copper.info,
} as const
