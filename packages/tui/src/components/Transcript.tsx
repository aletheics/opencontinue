import type { PermissionMode } from "@opencontinue/protocol"
import { Box, Text } from "ink"

import { glyphs } from "../glyphs.js"
import {
  assistantBlock,
  diffSummary,
  formatDiffLines,
  formatToolOutputLines,
  toolHeaderLines,
  toolNotes,
  wrapText,
} from "../transcript/format/index.js"
import { theme } from "../theme.js"
import type { TimelineItem, ToolTimelineItem } from "../timeline.js"
import { LineText } from "./LineText.js"
import { Welcome } from "./Welcome.js"

type TranscriptItemProps = {
  item: TimelineItem
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
  maxLines?: number
  workspace?: string
}

function ToolBlock({
  item,
  columns,
  expanded,
  leading,
  permissionMode,
  workspace,
}: {
  item: ToolTimelineItem
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
  workspace?: string
}) {
  const hasOutput = Boolean(item.output?.trim())
  const width = Math.max(20, columns - 2)
  const header = toolHeaderLines(item, width)
  const summary = item.diff ? diffSummary(item.diff) : undefined
  const dot =
    item.status === "failed"
      ? theme.danger
      : item.status === "running"
        ? theme.working
        : theme.success

  return (
    <Box marginTop={leading ? 1 : 0} flexDirection="column">
      {header.map((line, index) => {
        if (index === 0 && line.startsWith(`${glyphs.tool} `)) {
          return (
            <Text key={index} wrap="truncate">
              <Text color={dot}>{glyphs.tool}</Text>{" "}
              <Text bold>{line.slice(glyphs.tool.length + 1)}</Text>
            </Text>
          )
        }
        return (
          <Text key={index} wrap="truncate">
            {line}
          </Text>
        )
      })}

      {summary ? (
        <Text dimColor wrap="truncate">
          {"  ⎿  "}
          {summary}
        </Text>
      ) : null}

      {item.diff
        ? formatDiffLines(item.diff, Math.max(10, width - 5), expanded).map(
            (line, index) => (
              <Text
                key={`diff-${index}`}
                color={line.color}
                dimColor={line.dim}
                wrap="truncate"
              >
                {summary || index > 0 ? "     " : "  ⎿  "}
                {line.text}
              </Text>
            ),
          )
        : hasOutput
          ? formatToolOutputLines(item.output ?? "", width, expanded).map(
              (line, index) => <LineText key={`out-${index}`} line={line} />,
            )
          : item.status === "done" && !item.error
            ? (
                <Text dimColor wrap="truncate">
                  {"  ⎿  (No output)"}
                </Text>
              )
            : null}

      {item.error
        ? formatToolOutputLines(item.error, width, expanded).map((line, index) => (
            <Text key={`err-${index}`} color={theme.danger} wrap="truncate">
              {line.text}
            </Text>
          ))
        : null}

      {(item.status === "running" ? [] : toolNotes(item, workspace)).map((note) => (
        <Text key={note} dimColor wrap="truncate">
          {"  ⎿  "}
          {note}
        </Text>
      ))}

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
  workspace,
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
        branch={item.branch}
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
            <Text color={theme.assistant}>{index === 0 ? "› " : "  "}</Text>
            {line}
          </Text>
        ))}
      </Box>
    )
  }

  if (item.kind === "assistant") {
    if (!item.text) return null
    const all = assistantBlock(item.text, width, {
      dotted: !item.continuation,
    })
    const limit = maxLines ? Math.max(1, maxLines) : all.length
    const hidden = all.length > limit ? all.length - (limit - 1) : 0
    const visible = hidden > 0 ? all.slice(hidden) : all

    return (
      <Box marginTop={leading && !item.continuation ? 1 : 0} flexDirection="column">
        {hidden > 0 ? (
          <Text dimColor wrap="truncate">
            {"  "}… +{hidden} earlier lines
          </Text>
        ) : null}
        {visible.map((line, index) => (
          <LineText key={index} line={line} />
        ))}
      </Box>
    )
  }

  if (item.kind === "tool") {
    // Todo updates are a task panel, not transcript noise.
    if (item.name === "todo") return null
    return (
      <ToolBlock
        item={item}
        columns={columns}
        expanded={expanded}
        leading={leading}
        permissionMode={permissionMode}
        workspace={workspace}
      />
    )
  }

  if (item.kind === "meta") {
    return (
      <Box marginTop={leading ? 1 : 0} flexDirection="column">
        {item.text.split("\n").map((line, index) => (
          <Text key={index} dimColor wrap="truncate">
            {line}
          </Text>
        ))}
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
  workspace,
}: {
  items: TimelineItem[]
  columns: number
  expanded: boolean
  leading: boolean
  permissionMode?: PermissionMode
  maxLines?: number
  workspace?: string
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
          workspace={workspace}
        />
      ))}
    </Box>
  )
}
