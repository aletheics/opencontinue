/**
 * Character-width wrapping. One terminal row per returned string.
 */
export function wrapText(text: string, width: number): string[] {
  const safeWidth = Math.max(10, width)
  const result: string[] = []

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (raw.length === 0) {
      result.push("")
      continue
    }
    for (let index = 0; index < raw.length; index += safeWidth) {
      result.push(raw.slice(index, index + safeWidth))
    }
  }

  return result
}

export function wrapPrefixed(
  prefix: string,
  text: string,
  width: number,
): string[] {
  const lines = wrapText(text, Math.max(10, width - prefix.length))
  return lines.map((line, index) =>
    index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`,
  )
}
