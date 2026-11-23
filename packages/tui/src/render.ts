import { theme } from "./theme.js"
import type { TimelineItem, ToolTimelineItem } from "./timeline.js"

export type Line = {
  text: string
  color?: string
  dim?: boolean
  bold?: boolean
}

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

function prefixed(prefix: string, text: string, width: number): string[] {
  const lines = wrapText(text, Math.max(10, width - prefix.length))
  return lines.map((line, index) =>
    index === 0 ? `${prefix}${line}` : `${" ".repeat(prefix.length)}${line}`,
  )
}

export function toolDisplayName(name: string): string {
  return name.length > 0 ? `${name[0]?.toUpperCase() ?? ""}${name.slice(1)}` : name
}

export function toolArgumentSummary(item: ToolTimelineItem): string {
  const input =
    typeof item.input === "object" && item.input !== null
      ? (item.input as Record<string, unknown>)
      : {}
  const text = (key: string): string | undefined =>
    typeof input[key] === "string" ? (input[key] as string) : undefined

  const value =
    item.name === "bash"
      ? text("command")
      : item.name === "read" || item.name === "write" || item.name === "edit"
        ? text("path")
        : item.name === "grep" || item.name === "glob"
          ? text("pattern")
          : JSON.stringify(item.input)

  return (value ?? "").replace(/\s+/g, " ").trim()
}

export function toolHeaderLines(item: ToolTimelineItem, width: number): string[] {
  const name = toolDisplayName(item.name)
  const args = toolArgumentSummary(item)
  const safeWidth = Math.max(20, width)

  if (!args) return [`● ${name}()`]

  const prefix = `● ${name}(`
  const contentWidth = Math.max(8, safeWidth - prefix.length - 2)
  const parts = wrapText(args, contentWidth)
  const lines = parts.map((part, index) =>
    index === 0 ? `${prefix}${part}` : `${" ".repeat(prefix.length)}${part}`,
  )

  const lastIndex = lines.length - 1
  lines[lastIndex] = `${lines[lastIndex]})`
  return lines
}

export function formatToolOutputLines(
  text: string,
  width: number,
  expanded: boolean,
): Line[] {
  const lines = text.replace(/\r\n/g, "\n").trimEnd().split("\n")
  if (lines.length === 1 && lines[0] === "") return []

  const max = expanded ? 200 : 3
  const contentWidth = Math.max(10, width - 5)
  const shown: Line[] = []

  lines.slice(0, max).forEach((line, index) => {
    wrapText(line, contentWidth).forEach((part, partIndex) => {
      shown.push({
        text: `${index === 0 && partIndex === 0 ? "  ⎿  " : "     "}${part}`,
        dim: true,
      })
    })
  })

  if (lines.length > max) {
    shown.push({
      text: `     … +${lines.length - max} lines (ctrl+o to expand)`,
      dim: true,
    })
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
  const max = expanded ? 200 : 4
  const shown: Line[] = []

  for (const line of lines.slice(0, max)) {
    for (const part of wrapText(line, Math.max(10, width - 4))) {
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

function pushPrefixed(
  lines: Line[],
  prefix: string,
  text: string,
  width: number,
  color: string = theme.assistant,
): void {
  const contentWidth = Math.max(10, width - prefix.length)
  const parts = wrapText(text, contentWidth)
  parts.forEach((part, index) => {
    lines.push({
      text: `${index === 0 ? prefix : " ".repeat(prefix.length)}${part}`,
      color,
    })
  })
}

export function formatAssistantLines(text: string, width: number): Line[] {
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
      for (const part of wrapText(line.length === 0 ? " " : line, Math.max(10, width - 2))) {
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
      for (const part of wrapText(heading[2] ?? "", Math.max(10, width - markerWidth))) {
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

    for (const part of wrapText(line, width)) {
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

    if (item.kind === "meta") {
      for (const line of wrapText(item.text, width)) lines.push({ text: line, dim: true })
      continue
    }

    if (item.kind === "system") {
      for (const line of wrapText(item.text, width)) lines.push({ text: line, dim: true })
      continue
    }

    if (item.kind === "user") {
      for (const line of prefixed("❯ ", item.text, width)) {
        lines.push({ text: line, color: theme.assistant })
      }
      continue
    }

    if (item.kind === "assistant") {
      if (!item.text) continue
      lines.push(...formatAssistantLines(item.text, width))
      continue
    }

    const header = toolHeaderLines(item, width)
    header.forEach((text, index) => {
      lines.push({
        text,
        color:
          item.status === "failed"
            ? theme.error
            : item.status === "running"
              ? theme.tool
              : index === 0
                ? theme.assistant
                : undefined,
        bold: index === 0,
      })
    })

    if (item.diff) {
      const diff = formatDiffLines(item.diff, Math.max(10, width - 5), expanded)
      diff.forEach((line, index) => {
        lines.push({
          ...line,
          text: `${index === 0 ? "  ⎿  " : "     "}${line.text}`,
        })
      })
    } else if (item.output) {
      lines.push(...formatToolOutputLines(item.output, width, expanded))
    }

    if (item.error) {
      for (const line of formatToolOutputLines(item.error, width, expanded)) {
        lines.push({ ...line, color: theme.error, dim: false })
      }
    }
  }

  return lines
}
