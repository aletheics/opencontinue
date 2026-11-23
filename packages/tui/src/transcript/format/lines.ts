import { theme } from "../../theme.js"
import type { TimelineItem } from "../../timeline.js"
import { assistantBlock } from "./assistant.js"
import { formatDiffLines } from "./diff.js"
import type { Line } from "./line.js"
import { formatToolOutputLines, toolHeaderLines } from "./tool.js"
import { wrapPrefixed, wrapText } from "./wrap.js"

/**
 * Flatten the timeline for the ctrl+o transcript view.
 */
export function timelineLines(
  items: TimelineItem[],
  columns: number,
  expanded: boolean,
): Line[] {
  const width = Math.max(20, columns)
  const lines: Line[] = []

  for (const item of items) {
    if (item.kind === "usage") continue

    if (item.kind === "banner") {
      lines.push({
        text: `OpenContinue v${item.version}`,
        color: theme.brand,
        bold: true,
      })
      lines.push({ text: `${item.model} · ${item.provider}`, dim: true })
      lines.push({ text: item.workspace, dim: true })
      lines.push({ text: "", dim: true })
      continue
    }

    if (item.kind === "meta") {
      for (const line of wrapText(item.text, width)) {
        lines.push({ text: line, dim: true })
      }
      continue
    }

    if (item.kind === "system") {
      for (const line of wrapText(item.text, width)) {
        lines.push({ text: line, dim: true })
      }
      continue
    }

    if (item.kind === "user") {
      for (const line of wrapPrefixed("❯ ", item.text, width)) {
        lines.push({ text: line, color: theme.assistant })
      }
      continue
    }

    if (item.kind === "assistant") {
      if (!item.text) continue
      lines.push(...assistantBlock(item.text, width))
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
