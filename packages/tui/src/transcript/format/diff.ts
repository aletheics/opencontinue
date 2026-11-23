import { theme } from "../../theme.js"
import type { Line } from "./line.js"
import { textWidth, wrapText } from "./wrap.js"

function isHeader(line: string): boolean {
  return (
    line.startsWith("Index: ") ||
    line.startsWith("===================================================================") ||
    line.startsWith("--- ") ||
    line.startsWith("+++ ")
  )
}

const HUNK_PATTERN = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/

type DiffEntry =
  | { kind: "hunk"; text: string }
  | { kind: "meta"; text: string }
  | {
      kind: "context" | "added" | "removed"
      sign: string
      text: string
      old?: number
      new?: number
    }

function parseEntries(diff: string): DiffEntry[] {
  const entries: DiffEntry[] = []
  let oldLine = 0
  let newLine = 0
  let inHunk = false

  for (const line of diff.replace(/\r\n/g, "\n").split("\n")) {
    if (!inHunk && isHeader(line)) continue
    if (line === "") continue

    const hunk = line.match(HUNK_PATTERN)
    if (hunk) {
      inHunk = true
      oldLine = Number(hunk[1])
      newLine = Number(hunk[3])
      entries.push({ kind: "hunk", text: line })
      continue
    }

    if (!inHunk) continue

    if (line.startsWith("\\")) {
      entries.push({ kind: "meta", text: line })
      continue
    }

    const sign = line[0] ?? ""
    if (sign === "+") {
      entries.push({ kind: "added", sign, text: line.slice(1), new: newLine })
      newLine++
      continue
    }
    if (sign === "-") {
      entries.push({ kind: "removed", sign, text: line.slice(1), old: oldLine })
      oldLine++
      continue
    }

    entries.push({
      kind: "context",
      sign: sign === " " ? " " : "",
      text: sign === " " ? line.slice(1) : line,
      old: oldLine,
      new: newLine,
    })
    oldLine++
    newLine++
  }

  return entries
}

function maxLineNumber(entries: DiffEntry[]): number {
  let max = 1
  for (const entry of entries) {
    if (entry.kind === "context" || entry.kind === "added") {
      max = Math.max(max, entry.new ?? 0)
    }
    if (entry.kind === "context" || entry.kind === "removed") {
      max = Math.max(max, entry.old ?? 0)
    }
  }
  return max
}

function blankGutter(width: number): string {
  return `${" ".repeat(width)} ${" ".repeat(width)}  `
}

/**
 * Unified diff view with old/new line-number gutters. File headers
 * (`Index:`, `---`, `+++`) are dropped; hunk headers stay dim.
 */
export function formatDiffLines(diff: string, width: number, expanded: boolean): Line[] {
  const entries = parseEntries(diff)
  const numberWidth = String(maxLineNumber(entries)).length
  const rendered: Line[] = []

  for (const entry of entries) {
    if (entry.kind === "hunk" || entry.kind === "meta") {
      const gutter = blankGutter(numberWidth)
      const available = Math.max(10, width - textWidth(gutter))
      for (const [index, part] of wrapText(entry.text, available).entries()) {
        rendered.push({
          text: `${index === 0 ? gutter : " ".repeat(textWidth(gutter))}${part}`,
          color: entry.kind === "hunk" ? theme.diffHunk : theme.muted,
          dim: true,
        })
      }
      continue
    }

    const old = entry.old === undefined ? "" : String(entry.old)
    const next = entry.new === undefined ? "" : String(entry.new)
    const gutter = `${old.padStart(numberWidth)} ${next.padStart(numberWidth)}  `
    const available = Math.max(10, width - textWidth(gutter))
    const color =
      entry.kind === "added"
        ? theme.diffAdd
        : entry.kind === "removed"
          ? theme.diffRemove
          : undefined

    for (const [index, part] of wrapText(`${entry.sign}${entry.text}`, available).entries()) {
      rendered.push({
        text: `${index === 0 ? gutter : " ".repeat(textWidth(gutter))}${part}`,
        color,
        dim: entry.kind === "context",
      })
    }
  }

  const max = expanded ? 200 : 4
  if (rendered.length <= max) return rendered

  return [
    ...rendered.slice(0, max),
    {
      text: `… +${rendered.length - max} lines (ctrl+o to expand)`,
      dim: true,
    },
  ]
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

/** One-line change summary: `Added 1 line, removed 1 line`. */
export function diffSummary(diff: string): string | undefined {
  const { added, removed } = diffStats(diff)
  const lines = (count: number) => `${count} line${count === 1 ? "" : "s"}`

  if (added > 0 && removed > 0) {
    return `Added ${lines(added)}, removed ${lines(removed)}`
  }
  if (added > 0) return `Added ${lines(added)}`
  if (removed > 0) return `Removed ${lines(removed)}`
  return undefined
}
