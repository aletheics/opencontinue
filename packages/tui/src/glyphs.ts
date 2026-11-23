export type Glyphs = {
  brand: string
  ready: string
  tool: string
  done: string
  failed: string
  approval: string
  checkpoint: string
  plan: string
  confirm: string
  auto: string
  spinnerFrames: readonly string[]
}

const UNICODE: Glyphs = {
  brand: "◈",
  ready: "·",
  tool: "↳",
  done: "✓",
  failed: "×",
  approval: "?",
  checkpoint: "◆",
  plan: "◎",
  confirm: "◈",
  auto: "⟳",
  spinnerFrames: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
}

const ASCII: Glyphs = {
  brand: "O",
  ready: ".",
  tool: ">",
  done: "+",
  failed: "x",
  approval: "!",
  checkpoint: "*",
  plan: "o",
  confirm: "C",
  auto: "A",
  spinnerFrames: ["|", "/", "-", "\\"],
}

export function getGlyphs(env: Record<string, string | undefined> = process.env): Glyphs {
  return env.OPENCONTINUE_ASCII === "1" ? ASCII : UNICODE
}

/**
 * Terminal glyph set chosen at startup. Set OPENCONTINUE_ASCII=1 for
 * terminals that cannot render Braille or geometric symbols.
 */
export const glyphs: Glyphs = getGlyphs()
