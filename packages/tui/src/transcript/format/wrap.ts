/**
 * Display width of one character, following the same width class a terminal
 * uses: CJK and fullwidth ranges take two columns, combining and zero-width
 * characters take none.
 */
export function charWidth(char: string): number {
  const code = char.codePointAt(0) ?? 0

  if (code === 0) return 0
  if (code < 32 || (code >= 0x7f && code < 0xa0)) return 0
  if (
    (code >= 0x0300 && code <= 0x036f) ||
    (code >= 0x200b && code <= 0x200f) ||
    code === 0xfeff
  ) {
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

export function textWidth(text: string): number {
  let width = 0
  for (const char of text) width += charWidth(char)
  return width
}

/**
 * Display-width wrapping. One terminal row per returned string.
 */
export function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(10, width)
  const result: string[] = []

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.length === 0) {
      result.push("")
      continue
    }

    let line = ""
    let lineWidth = 0
    for (const char of raw) {
      const next = charWidth(char)
      if (line.length > 0 && lineWidth + next > safeWidth) {
        result.push(line)
        line = ""
        lineWidth = 0
      }
      line += char
      lineWidth += next
    }
    result.push(line)
  }

  return result
}

export function wrapPrefixed(
  prefix: string,
  text: string,
  width: number,
): string[] {
  const prefixWidth = textWidth(prefix)
  const lines = wrapText(text, Math.max(10, width - prefixWidth))
  return lines.map((line, index) =>
    index === 0 ? `${prefix}${line}` : `${" ".repeat(prefixWidth)}${line}`,
  )
}
