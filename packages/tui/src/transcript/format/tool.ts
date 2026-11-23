import { glyphs } from "../../glyphs.js"
import { formatDuration } from "../../status/format.js"
import type { ToolTimelineItem } from "../../timeline.js"
import type { Line } from "./line.js"
import { wrapText } from "./wrap.js"

const DEFAULT_BASH_TIMEOUT_MS = 120_000

const DISPLAY_NAMES: Record<string, string> = {
  edit: "Update",
}

export function toolDisplayName(name: string): string {
  if (DISPLAY_NAMES[name]) return DISPLAY_NAMES[name]
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

  if (!args) return [`${glyphs.tool} ${name}()`]

  const prefix = `${glyphs.tool} ${name}(`
  const contentWidth = Math.max(8, safeWidth - prefix.length - 2)
  const lines = wrapText(args, contentWidth).map((part, index) =>
    index === 0 ? `${prefix}${part}` : `  ${part}`,
  )

  const lastIndex = lines.length - 1
  lines[lastIndex] = `${lines[lastIndex]})`
  return lines
}

/**
 * Shell notes Claude Code appends under a tool block: the reset cwd after a
 * `cd`, and the command timeout. The TUI owns the wording so the tool output
 * stays plain text.
 */
export function toolNotes(item: ToolTimelineItem, workspace?: string): string[] {
  if (item.name !== "bash") return []

  const input =
    typeof item.input === "object" && item.input !== null
      ? (item.input as Record<string, unknown>)
      : {}
  const timeoutMs = typeof input.timeoutMs === "number" ? input.timeoutMs : DEFAULT_BASH_TIMEOUT_MS
  const command = typeof input.command === "string" ? input.command : ""

  const notes: string[] = []
  if (workspace && /(^|[\s;&|(])cd(\s|$)/m.test(command)) {
    notes.push(`Shell cwd was reset to ${workspace}`)
  }
  notes.push(`(timeout ${formatDuration(timeoutMs, { hideTrailingZeros: true })})`)
  return notes
}

export function formatToolOutputLines(text: string, width: number, expanded: boolean): Line[] {
  const lines = text.replace(/\r\n/g, "\n").trimEnd().split("\n")
  if (lines.length === 1 && lines[0] === "") return []

  const max = expanded ? 200 : 3
  const contentWidth = Math.max(10, width - 5)
  const shown: Line[] = []

  lines.slice(0, max).forEach((line, index) => {
    wrapText(line, contentWidth).forEach((part, partIndex) => {
      const prefix = index === 0 && partIndex === 0 ? "  ⎿  " : "     "
      shown.push({
        text: `${prefix}${part}`,
        spans: [{ text: prefix, dim: true }, { text: part }],
      })
    })
  })

  if (lines.length > max) {
    const hint = `     … +${lines.length - max} lines (ctrl+o to expand)`
    shown.push({ text: hint, spans: [{ text: hint, dim: true }] })
  }

  return shown
}
