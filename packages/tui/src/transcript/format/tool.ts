import type { ToolTimelineItem } from "../../timeline.js"
import type { Line } from "./line.js"
import { wrapText } from "./wrap.js"

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
  const lines = wrapText(args, contentWidth).map((part, index) =>
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
