/**
 * Lines kept in the live streaming viewport. Everything above this tail is
 * stable and can be printed to terminal scrollback.
 */
export const STREAM_TAIL_LINES = 1

function isFenceLine(line: string): boolean {
  return /^\s*```/.test(line)
}

function fenceBalanced(lines: string[]): boolean {
  return lines.filter(isFenceLine).length % 2 === 0
}

function inlineBalanced(lines: string[]): boolean {
  let ticks = 0
  let inFence = false

  for (const line of lines) {
    if (isFenceLine(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    for (const char of line) {
      if (char === "`") ticks++
    }
  }

  return ticks % 2 === 0
}

function linksBalanced(lines: string[]): boolean {
  let open = 0
  let inFence = false

  for (const line of lines) {
    if (isFenceLine(line)) {
      inFence = !inFence
      continue
    }
    if (inFence) continue
    for (let index = 0; index < line.length; index++) {
      if (line.startsWith("](", index)) {
        open++
        index++
      } else if (line[index] === ")" && open > 0) {
        open--
      }
    }
  }

  return open === 0
}

/**
 * Find the largest offset of the streamed assistant text that ends a complete
 * top-level block. Only a blank line or a closing fence is a commit point, so
 * a chunk never starts in the middle of a paragraph, list, table, quote, or
 * code block. Open inline code or links keep the text live. Returning zero
 * means "keep it all live"; the formatter then sees the whole message.
 */
export function stableStreamBoundary(text: string, tailLines: number = STREAM_TAIL_LINES): number {
  const lines = text.split("\n")
  const complete = lines.length - 1
  if (complete <= tailLines + 1) return 0

  const maxCut = complete - Math.max(1, tailLines)
  if (maxCut <= 0) return 0

  const offsetAt = (cut: number): number => {
    let offset = 0
    for (let index = 0; index < cut; index++) {
      offset += (lines[index]?.length ?? 0) + 1
    }
    return offset
  }

  const safe = (cut: number): boolean => {
    const prefix = lines.slice(0, cut)
    return fenceBalanced(prefix) && inlineBalanced(prefix) && linksBalanced(prefix)
  }

  for (let cut = maxCut; cut > 0; cut--) {
    if (!safe(cut)) continue
    const previous = lines[cut - 1] ?? ""
    if (previous.trim() === "" || isFenceLine(previous)) {
      return offsetAt(cut)
    }
  }

  return 0
}
