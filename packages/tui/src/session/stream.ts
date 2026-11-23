/**
 * Lines kept in the live streaming viewport. Everything above this tail is
 * stable and can be printed to terminal scrollback.
 */
export const STREAM_TAIL_LINES = 1

function fenceBalanced(lines: string[]): boolean {
  const fences = lines.filter((line) => line.trimStart().startsWith("```")).length
  return fences % 2 === 0
}

function inlineBalanced(text: string): boolean {
  let ticks = 0
  for (const char of text) {
    if (char === "`") ticks++
  }
  return ticks % 2 === 0
}

/**
 * Find the largest safe character offset of the streamed assistant text that
 * can be committed to scrollback. A boundary is safe when it ends a line,
 * does not cut a fenced code block, and does not split inline code. Prefer a
 * blank line so paragraph spacing survives the split; otherwise any balanced
 * line boundary works.
 */
export function stableStreamBoundary(
  text: string,
  tailLines: number = STREAM_TAIL_LINES,
): number {
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
    return fenceBalanced(prefix) && inlineBalanced(prefix.join("\n"))
  }

  let fallback = 0
  for (let cut = maxCut; cut > 0; cut--) {
    if (!safe(cut)) continue
    const offset = offsetAt(cut)
    if (!fallback) fallback = offset
    if ((lines[cut - 1] ?? "").trim() === "") return offset
  }

  return fallback
}
