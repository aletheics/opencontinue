import { Box, Text } from "ink"

import {
  assistantBlock,
  formatDiffLines,
  formatToolOutputLines,
  toolHeaderLines,
  wrapText,
} from "../transcript/format/index.js"
import { theme } from "../theme.js"
import type { TimelineItem, ToolTimelineItem } from "../timeline.js"
import { Welcome } from "./Welcome.js"

type PermissionMode = "ask" | "auto" | "readonly"

type TranscriptItemProps = {
  item: TimelineItem
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
  maxLines?: number
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
        : theme.user

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
  maxLines,
}: TranscriptItemProps) {
  const width = Math.max(20, columns - 2)

  if (item.kind === "usage") return null

  if (item.kind === "banner") {
    return (
      <Welcome
        version={item.version}
        model={item.model}
        provider={item.provider}
        workspace={item.workspace}
        columns={columns}
      />
    )
  }

  if (item.kind === "user") {
    return (
      <Box
        marginTop={leading ? 1 : 0}
        width={columns}
        backgroundColor={theme.userBar}
        paddingX={1}
        flexDirection="column"
      >
        {wrapText(item.text || " ", Math.max(10, width - 4)).map((line, index) => (
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
    const all = assistantBlock(item.text, width)
    const limit = maxLines ? Math.max(1, maxLines) : all.length
    const hidden = all.length > limit ? all.length - (limit - 1) : 0
    const visible = hidden > 0 ? all.slice(hidden) : all

    return (
      <Box marginTop={leading ? 1 : 0} flexDirection="column">
        {hidden > 0 ? (
          <Text dimColor wrap="truncate">
            {"  "}… +{hidden} earlier lines
          </Text>
        ) : null}
        {visible.map((line, index) => (
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
  maxLines,
}: {
  items: TimelineItem[]
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
  maxLines?: number
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
          maxLines={maxLines}
        />
      ))}
    </Box>
  )
}
