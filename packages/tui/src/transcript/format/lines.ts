import { PRODUCT_NAME, READY_LINE, TAGLINE } from "../../brand.js"
import { glyphs } from "../../glyphs.js"
import { theme } from "../../theme.js"
import type { TimelineItem } from "../../timeline.js"
import { assistantBlock } from "./assistant.js"
import { formatDiffLines } from "./diff.js"
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

  for (const item of items) {
    if (item.kind === "usage") continue

    if (item.kind === "banner") {
      const title = `${glyphs.brand} ${PRODUCT_NAME}  v${item.version}`
      lines.push({
        text: title,
        color: theme.assistant,
        spans: [
          { text: glyphs.brand, color: theme.brandMark },
          { text: ` ${PRODUCT_NAME}`, bold: true },
          { text: `  v${item.version}`, dim: true },
        ],
      })
      lines.push({ text: TAGLINE, dim: true })
      lines.push({ text: `Model       ${item.model}`, dim: true })
      lines.push({ text: `Provider    ${item.provider}`, dim: true })
      lines.push({ text: `Workspace   ${item.workspace}`, dim: true })
      lines.push({ text: `${glyphs.ready} ${READY_LINE}`, dim: true })
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
    header.forEach((text, index) => {
      lines.push({
        text,
        color:
          item.status === "failed"
            ? theme.danger
            : item.status === "running"
              ? theme.working
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
  }

  return lines
}
