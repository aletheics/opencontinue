export type Glyphs = {
  brand: string
  ready: string
  tool: string
  done: string
  failed: string
  interrupted: string
  approval: string
  checkpoint: string
  pending: string
  active: string
  plan: string
  confirm: string
  auto: string
}

const UNICODE: Glyphs = {
  brand: "◈",
  ready: "·",
  tool: "↳",
  done: "✓",
  failed: "×",
  interrupted: "■",
  approval: "?",
  checkpoint: "◆",
  pending: "○",
  active: "▸",
  plan: "◎",
  confirm: "◈",
  auto: "⟳",
}

const ASCII: Glyphs = {
  brand: "O",
  ready: ".",
  tool: ">",
  done: "+",
  failed: "x",
  interrupted: "=",
  approval: "!",
  checkpoint: "*",
  pending: "o",
  active: ">",
  plan: "o",
  confirm: "C",
  auto: "A",
}

export function getGlyphs(env: Record<string, string | undefined> = process.env): Glyphs {
  return env.OPENCONTINUE_ASCII === "1" ? ASCII : UNICODE
}

/**
 * Terminal glyph set chosen at startup. Set OPENCONTINUE_ASCII=1 for
 * terminals that cannot render Braille or geometric symbols.
 */
export const glyphs: Glyphs = getGlyphs()
