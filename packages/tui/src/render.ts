import { theme } from "./theme.js"
import { toolLabel, type TimelineItem } from "./timeline.js"

export type Line = {
  text: string
  color?: string
  dim?: boolean
  bold?: boolean
}

function wrap(text: string, width: number): string[] {
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

function prefixed(prefix: string, text: string, width: number): string[] {
  const lines = wrap(text, Math.max(10, width - prefix.length))
  return lines.map((line, index) =>
    index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`,
  )
}

function outputLines(text: string, width: number, expanded: boolean): Line[] {
  const lines = text.replace(/\r\n/g, "\n").trim().split("\n")
  const max = expanded ? 12 : 2
  const shown: Line[] = []

  lines.slice(0, max).forEach((line, index) => {
    wrap(line, width - 6).forEach((part, partIndex) => {
      shown.push({
        text: `${index === 0 && partIndex === 0 ? "  ⎿ " : "    "}${part}`,
        dim: true,
      })
    })
  })

  if (lines.length > max) {
    shown.push({ text: `    … ${lines.length - max} more lines · ctrl+o`, dim: true })
  }

  return shown
}

export function formatDiffLines(diff: string, width: number, expanded: boolean): Line[] {
  const lines = diff
    .replace(/\r\n/g, "\n")
    .split("\n")
    .filter(
      (line) =>
        !line.startsWith("Index: ") &&
        !line.startsWith("===================================================================") &&
        !line.startsWith("--- ") &&
        !line.startsWith("+++ "),
    )
  const max = expanded ? 20 : 4
  const shown: Line[] = []

  for (const line of lines.slice(0, max)) {
    for (const part of wrap(line, width - 4)) {
      const added = part.startsWith("+")
      const removed = part.startsWith("-")
      const hunk = part.startsWith("@@")
      shown.push({
        text: part,
        color: added ? theme.diffAdd : removed ? theme.diffRemove : hunk ? theme.diffHunk : undefined,
        dim: !added && !removed && !hunk,
      })
    }
  }

  if (lines.length > max) {
    shown.push({ text: `… ${lines.length - max} more diff lines · ctrl+o`, dim: true })
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

function pushPrefixed(
  lines: Line[],
  prefix: string,
  text: string,
  width: number,
  color: string = theme.assistant,
): void {
  const contentWidth = Math.max(10, width - prefix.length)
  const parts = wrap(text, contentWidth)
  parts.forEach((part, index) => {
    lines.push({
      text: `${index === 0 ? prefix : " ".repeat(prefix.length)}${part}`,
      color,
    })
  })
}

function assistantLines(text: string, width: number): Line[] {
  const lines: Line[] = []
  let codeLanguage = ""
  let inCode = false

  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    const line = raw.replace(/\t/g, "  ")
    const fence = line.match(/^\s*```\s*([\w.+-]*)\s*$/)

    if (fence) {
      if (inCode) {
        lines.push({ text: "└─", color: theme.muted, dim: true })
        inCode = false
      } else {
        codeLanguage = fence[1] ?? ""
        lines.push({ text: `┌─ ${codeLanguage || "code"}`, color: theme.muted, dim: true })
        inCode = true
      }
      continue
    }

    if (inCode) {
      for (const part of wrap(line.length === 0 ? " " : line, Math.max(10, width - 2))) {
        lines.push({ text: `│ ${part}`, color: theme.muted, dim: true })
      }
      continue
    }

    if (line.trim() === "") {
      lines.push({ text: "", color: theme.assistant })
      continue
    }

    const heading = line.match(/^\s{0,3}(#{1,6})\s+(.*)$/)
    if (heading) {
      const markerWidth = (heading[1]?.length ?? 1) + 1
      for (const part of wrap(heading[2] ?? "", Math.max(10, width - markerWidth))) {
        lines.push({ text: part, color: theme.brand, bold: true })
      }
      continue
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      lines.push({ text: "─".repeat(Math.min(width, 24)), color: theme.muted, dim: true })
      continue
    }

    const quote = line.match(/^\s*>\s?(.*)$/)
    if (quote) {
      pushPrefixed(lines, "│ ", quote[1] ?? "", width, theme.muted)
      continue
    }

    const task = line.match(/^(\s*)[-*+]\s+\[([ xX])\]\s+(.*)$/)
    if (task) {
      const box = task[2]?.toLowerCase() === "x" ? "[x]" : "[ ]"
      pushPrefixed(lines, `${task[1] ?? ""}• ${box} `, task[3] ?? "", width)
      continue
    }

    const bullet = line.match(/^(\s*)[-*+]\s+(.*)$/)
    if (bullet) {
      pushPrefixed(lines, `${bullet[1] ?? ""}• `, bullet[2] ?? "", width)
      continue
    }

    const numbered = line.match(/^(\s*)(\d+[.)])\s+(.*)$/)
    if (numbered) {
      pushPrefixed(lines, `${numbered[1] ?? ""}${numbered[2]} `, numbered[3] ?? "", width)
      continue
    }

    for (const part of wrap(line, width)) {
      lines.push({ text: part, color: theme.assistant })
    }
  }

  return lines
}

export function timelineLines(
  items: TimelineItem[],
  columns: number,
  expanded: boolean,
): Line[] {
  const width = Math.max(20, columns)
  const lines: Line[] = []

  for (const item of items) {
    if (item.kind === "usage") continue

    if (item.kind === "system") {
      for (const line of wrap(item.text, width)) lines.push({ text: line, dim: true })
      continue
    }

    if (item.kind === "user") {
      for (const line of prefixed("you> ", item.text, width)) {
        lines.push({ text: line, color: theme.user })
      }
      continue
    }

    if (item.kind === "assistant") {
      if (!item.text) continue
      lines.push(...assistantLines(item.text, width))
      continue
    }

    const stats = item.diff ? diffStats(item.diff) : undefined
    const label = toolLabel(item).slice(0, Math.max(20, width - 8))
    lines.push({
      text: `${item.status === "failed" ? "✗" : "●"} ${label}${
        stats ? `  +${stats.added} -${stats.removed}` : ""
      }`,
      color:
        item.status === "failed" ? theme.error : item.status === "running" ? theme.tool : theme.user,
    })

    if (item.diff) {
      lines.push(...formatDiffLines(item.diff, width, expanded))
    } else if (item.output) {
      lines.push(...outputLines(item.output, width, expanded))
    }

    if (item.error) {
      for (const line of outputLines(item.error, width, expanded)) {
        lines.push({ ...line, color: theme.error, dim: false })
      }
    }
  }

  return lines
}
