import { theme } from "../../theme.js"
import type { Line } from "./line.js"
import { wrapText } from "./wrap.js"

function isHeader(line: string): boolean {
  return (
    line.startsWith("Index: ") ||
    line.startsWith("===================================================================") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  )
}

export function formatDiffLines(
  diff: string,
  width: number,
  expanded: boolean,
): Line[] {
  const lines = diff.replace(/\r\n/g, "\n").split("\n").filter((line) => !isHeader(line))
  const max = expanded ? 200 : 4
  const shown: Line[] = []

  for (const line of lines.slice(0, max)) {
    for (const part of wrapText(line, Math.max(10, width - 4))) {
      const added = part.startsWith("+")
      const removed = part.startsWith("-")
      const hunk = part.startsWith("@@")
      shown.push({
        text: part,
        color: added
          ? theme.diffAdd
          : removed
            ? theme.diffRemove
            : hunk
              ? theme.diffHunk
              : undefined,
        dim: !added && !removed && !hunk,
      })
    }
  }

  if (lines.length > max) {
    shown.push({
      text: `… +${lines.length - max} more diff lines (ctrl+o to expand)`,
      dim: true,
    })
  }

  return shown
}

export function diffStats(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0

  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++
    else if (line.startsWith("-") && !line.startsWith("---")) removed++
  }

  return { added, removed }
}
