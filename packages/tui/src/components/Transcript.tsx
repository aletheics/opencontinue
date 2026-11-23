import { Box, Text } from "ink"

import {
  formatAssistantLines,
  formatDiffLines,
  formatToolOutputLines,
  toolHeaderLines,
  wrapText,
} from "../render.js"
import type { PermissionMode } from "../permission-gate.js"
import { theme } from "../theme.js"
import type { TimelineItem, ToolTimelineItem } from "../timeline.js"

type TranscriptItemProps = {
  item: TimelineItem
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
}

function ToolBlock({
  item,
  columns,
  expanded,
  leading,
  permissionMode,
}: {
  item: ToolTimelineItem
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
}) {
  const width = Math.max(20, columns - 2)
  const header = toolHeaderLines(item, width)
  const dot =
    item.status === "failed"
      ? theme.error
      : item.status === "running"
        ? theme.tool
        : theme.muted

  return (
    <Box marginTop={leading ? 1 : 0} flexDirection="column">
      {header.map((line, index) => {
        if (index === 0 && line.startsWith("● ")) {
          return (
            <Text key={index} wrap="truncate">
              <Text color={dot}>●</Text> <Text bold>{line.slice(2)}</Text>
            </Text>
          )
        }
        return (
          <Text key={index} wrap="truncate">
            {line}
          </Text>
        )
      })}

      {item.diff
        ? formatDiffLines(item.diff, Math.max(10, width - 5), expanded).map(
            (line, index) => (
              <Text
                key={`diff-${index}`}
                color={line.color}
                dimColor={line.dim}
                wrap="truncate"
              >
                {index === 0 ? "  ⎿  " : "     "}
                {line.text}
              </Text>
            ),
          )
        : item.output
          ? formatToolOutputLines(item.output, width, expanded).map((line, index) => (
              <Text key={`out-${index}`} dimColor wrap="truncate">
                {line.text}
              </Text>
            ))
          : null}

      {item.error
        ? formatToolOutputLines(item.error, width, expanded).map((line, index) => (
            <Text key={`err-${index}`} color={theme.error} wrap="truncate">
              {line.text}
            </Text>
          ))
        : null}

      {permissionMode === "auto" &&
      item.status === "done" &&
      !["read", "grep", "glob"].includes(item.name) ? (
        <Text dimColor wrap="truncate">
          {"  ⎿  Allowed by auto mode"}
        </Text>
      ) : null}
    </Box>
  )
}

export function TranscriptItem({
  item,
  columns,
  expanded,
  leading,
  permissionMode,
}: TranscriptItemProps) {
  const width = Math.max(20, columns - 2)

  if (item.kind === "usage") return null

  if (item.kind === "user") {
    return (
      <Box marginTop={leading ? 1 : 0} flexDirection="column">
        {wrapText(item.text || " ", Math.max(10, width - 2)).map((line, index) => (
          <Text key={index} wrap="truncate">
            <Text color={theme.assistant}>{index === 0 ? "❯ " : "  "}</Text>
            {line}
          </Text>
        ))}
      </Box>
    )
  }

  if (item.kind === "assistant") {
    if (!item.text) return null
    return (
      <Box marginTop={leading ? 1 : 0} flexDirection="column">
        {formatAssistantLines(item.text, width).map((line, index) => (
          <Text
            key={index}
            color={line.color}
            dimColor={line.dim}
            bold={line.bold}
            wrap="truncate"
          >
            {line.text}
          </Text>
        ))}
      </Box>
    )
  }

  if (item.kind === "tool") {
    return (
      <ToolBlock
        item={item}
        columns={columns}
        expanded={expanded}
        leading={leading}
        permissionMode={permissionMode}
      />
    )
  }

  if (item.kind === "meta") {
    return (
      <Box marginTop={leading ? 1 : 0}>
        <Text dimColor wrap="truncate">
          {item.text}
        </Text>
      </Box>
    )
  }

  return (
    <Box marginTop={leading ? 1 : 0} flexDirection="column">
      {wrapText(item.text, width).map((line, index) => (
        <Text key={index} dimColor wrap="truncate">
          {line}
        </Text>
      ))}
    </Box>
  )
}

export function Transcript({
  items,
  columns,
  expanded,
  leading,
  permissionMode,
}: {
  items: TimelineItem[]
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
}) {
  if (items.length === 0) return null
  return (
    <Box flexDirection="column">
      {items.map((item, index) => (
        <TranscriptItem
          key={item.id}
          item={item}
          columns={columns}
          expanded={expanded}
          leading={leading || index > 0}
          permissionMode={permissionMode}
        />
      ))}
    </Box>
  )
}
