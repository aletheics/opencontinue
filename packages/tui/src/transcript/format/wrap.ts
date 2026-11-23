const SEGMENTER = new Intl.Segmenter(undefined, { granularity: "grapheme" })

/** Split text into user-perceived characters (emoji sequences stay whole). */
export function graphemes(text: string): string[] {
  return Array.from(SEGMENTER.segment(text), (entry) => entry.segment)
}

/**
 * Display width of one character, following the same width class a terminal
 * uses: CJK and fullwidth ranges take two columns, combining and zero-width
 * characters take none.
 */
export function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0

  if (code === 0) return 0
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0
  if ((code >= 0x0300 && code <= 0x036f) || (code >= 0x200b && code <= 0x200f) || code === 0xfeff) {
    return 0
  }
  if (
    (code >= 0x1100 && code <= 0x115f) ||
    (code >= 0x2e80 && code <= 0x303e) ||
    (code >= 0x3041 && code <= 0x33ff) ||
    (code >= 0x3400 && code <= 0x4dbf) ||
    (code >= 0x4e00 && code <= 0x9fff) ||
    (code >= 0xa000 && code <= 0xa4cf) ||
    (code >= 0xa960 && code <= 0xa97f) ||
    (code >= 0xac00 && code <= 0xd7a3) ||
    (code >= 0xf900 && code <= 0xfaff) ||
    (code >= 0xfe10 && code <= 0xfe19) ||
    (code >= 0xfe30 && code <= 0xfe6f) ||
    (code >= 0xff00 && code <= 0xff60) ||
    (code >= 0xffe0 && code <= 0xffe6) ||
    (code >= 0x1f300 && code <= 0x1f64f) ||
    (code >= 0x1f900 && code <= 0x1f9ff) ||
    (code >= 0x20000 && code <= 0x3fffd)
  ) {
    return 2
  }

  return 1
}

function isEmojiGrapheme(grapheme: string): boolean {
  const codes = Array.from(grapheme, (char) => char.codePointAt(0) ?? 0)
  if (codes.includes(0x200d)) return true
  if (codes.includes(0x20e3)) return true
  if (codes.includes(0xfe0f)) return true
  return codes.some(
    (code) =>
      (code >= 0x1f000 && code <= 0x1faff) ||
      (code >= 0x1f1e6 && code <= 0x1f1ff) ||
      (code >= 0x1f3fb && code <= 0x1f3ff),
  )
}

/** Display width of a whole grapheme, never splitting emoji sequences. */
export function graphemeWidth(grapheme: string): number {
  if (isEmojiGrapheme(grapheme)) return 2

  let width = 0
  for (const char of grapheme) width += charWidth(char)
  return width
}

export function textWidth(text: string): number {
  let width = 0
  for (const grapheme of graphemes(text)) width += graphemeWidth(grapheme)
  return width
}

/** Shorten text to a display width, ending with a single ellipsis. */
export function truncateToWidth(text: string, width: number): string {
  if (textWidth(text) <= width) return text
  if (width <= 1) return "…"

  let result = ""
  let used = 0
  for (const grapheme of graphemes(text)) {
    const size = graphemeWidth(grapheme)
    if (used + size > width - 1) break
    result += grapheme
    used += size
  }
  return `${result}…`
}

/** Shorten text from the middle while keeping both ends readable. */
export function truncateMiddle(text: string, width: number): string {
  if (textWidth(text) <= width) return text
  if (width <= 1) return "…"

  const parts = graphemes(text)
  const leftBudget = Math.ceil((width - 1) / 2)
  const rightBudget = Math.floor((width - 1) / 2)

  let left = ""
  let used = 0
  for (const grapheme of parts) {
    const size = graphemeWidth(grapheme)
    if (used + size > leftBudget) break
    left += grapheme
    used += size
  }

  let right = ""
  used = 0
  for (let index = parts.length - 1; index >= 0; index--) {
    const grapheme = parts[index] ?? ""
    const size = graphemeWidth(grapheme)
    if (used + size > rightBudget) break
    right = `${grapheme}${right}`
    used += size
  }

  return `${left}…${right}`
}

/**
 * Display-width wrapping that breaks at spaces before splitting a word.
 * A word longer than the row is hard-split. One terminal row per string.
 */
export function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(10, width)
  const result: string[] = []

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.length === 0 || raw.trim().length === 0) {
      result.push("")
      continue
    }

    const before = result.length
    let line = ""
    let lineWidth = 0
    const flush = () => {
      result.push(line.trimEnd())
      line = ""
      lineWidth = 0
    }

    for (const token of raw.match(/\s+|\S+/g) ?? [raw]) {
      const tokenWidth = textWidth(token)

      if (lineWidth + tokenWidth <= safeWidth) {
        line += token
        lineWidth += tokenWidth
        continue
      }

      if (/^\s+$/.test(token)) {
        if (line.length > 0) flush()
        continue
      }

      if (line.trim().length > 0) flush()
      else {
        line = ""
        lineWidth = 0
      }

      let rest = token
      while (textWidth(rest) > safeWidth) {
        let part = ""
        let used = 0
        for (const grapheme of graphemes(rest)) {
          const size = graphemeWidth(grapheme)
          if (used + size > safeWidth) break
          part += grapheme
          used += size
        }
        if (part.length === 0) break
        result.push(part)
        rest = rest.slice(part.length)
      }

      line = rest
      lineWidth = textWidth(rest)
    }

    if (line.length > 0) result.push(line.trimEnd())
    else if (result.length === before) result.push("")
  }

  return result
}

export function wrapPrefixed(prefix: string, text: string, width: number): string[] {
  const prefixWidth = textWidth(prefix)
  const lines = wrapText(text, Math.max(10, width - prefixWidth))
  return lines.map((line, index) =>
    index === 0 ? `${prefix}${line}` : `${" ".repeat(prefixWidth)}${line}`,
  )
}
