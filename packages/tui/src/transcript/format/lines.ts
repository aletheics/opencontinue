import { headerLines } from "../../header.js"
import { theme } from "../../theme.js"
import type { TimelineItem } from "../../timeline.js"
import { assistantBlock } from "./assistant.js"
import { diffSummary, formatDiffLines } from "./diff.js"
import type { Line } from "./line.js"
import { formatToolOutputLines, toolHeaderLines, toolNotes } from "./tool.js"
import { wrapPrefixed, wrapText } from "./wrap.js"

/**
 * Flatten the timeline for the ctrl+o transcript view.
 */
export function timelineLines(
  items: TimelineItem[],
  columns: number,
  expanded: boolean,
  workspace?: string,
): Line[] {
  const width = Math.max(20, columns)
  const lines: Line[] = []
  const visible = items.filter(
    (item): item is Exclude<TimelineItem, { kind: "usage" }> =>
      item.kind !== "usage" &&
      !(item.kind === "tool" && item.name === "todo") &&
      !(item.kind === "assistant" && item.text === ""),
  )

  for (const item of visible) {
    if (lines.length > 0 && (lines.at(-1)?.text ?? "") !== "") {
      lines.push({ text: "", dim: true })
    }

    if (item.kind === "banner") {
      lines.push(
        ...headerLines({
          version: item.version,
          model: item.model,
          effort: item.effort,
          provider: item.provider,
          workspace: item.workspace,
          columns: width,
        }),
      )
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
      for (const line of wrapPrefixed("› ", item.text, width)) {
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
    header.forEach((text) => {
      lines.push({
        text,
        color:
          item.status === "failed"
            ? theme.danger
            : item.status === "running"
              ? theme.working
              : theme.assistant,
        bold: true,
      })
    })

    if (item.diff) {
      const summary = diffSummary(item.diff)
      if (summary) lines.push({ text: `  ⎿  ${summary}`, dim: true })

      const diff = formatDiffLines(item.diff, Math.max(10, width - 5), expanded)
      diff.forEach((line, index) => {
        lines.push({
          ...line,
          text: `${index === 0 && !summary ? "  ⎿  " : "     "}${line.text}`,
        })
      })
    } else if (item.output?.trim()) {
      lines.push(...formatToolOutputLines(item.output, width, expanded))
    } else if (item.status === "done" && !item.error) {
      lines.push({ text: "  ⎿  (No output)", dim: true })
    }

    if (item.error) {
      for (const line of formatToolOutputLines(item.error, width, expanded)) {
        lines.push({ ...line, color: theme.error, dim: false })
      }
    }

    if (item.status !== "running") {
      for (const note of toolNotes(item, workspace)) {
        lines.push({ text: `  ⎿  ${note}`, dim: true })
      }
    }
    if (item.authorization === "auto") {
      lines.push({ text: "  ⎿  Allowed by auto mode", dim: true })
    }
  }

  return lines
}
