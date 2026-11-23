import { Box, Text } from "ink"

import { formatDiffLines } from "../render.js"
import { theme } from "../theme.js"
import { Input } from "./Input.js"

export type PromptProps = {
  columns: number
  height: number
  input: string
  cursor: number
  prefix?: string
  menuOpen: boolean
  onInput: (value: string, cursor: number) => void
  onSubmit: (value: string) => void
  permission: { tool: string; detail: string; diff?: string } | null
  busy: boolean
  spinner: string
}

export function Prompt({
  columns,
  height,
  input,
  cursor,
  prefix,
  menuOpen,
  onInput,
  onSubmit,
  permission,
  busy,
  spinner,
}: PromptProps) {
  return (
    <Box
      flexShrink={0}
      height={height}
      flexDirection={permission ? "column" : "row"}
      borderStyle="round"
      borderColor={permission ? theme.tool : theme.inputBorder}
      paddingX={1}
      overflow="hidden"
    >
      {permission ? (
        <>
          <Text color={theme.tool} wrap="truncate">
            ● Permission needed: {permission.tool}
          </Text>
          <Text wrap="truncate">{permission.detail || "(no details)"}</Text>
          {permission.diff ? (
            <Box flexDirection="column" height={3} overflow="hidden">
              {formatDiffLines(permission.diff, Math.max(20, columns - 4), false)
                .slice(0, 3)
                .map((line, index) => (
                  <Text
                    key={index}
                    color={line.color}
                    dimColor={line.dim}
                    wrap="truncate"
                  >
                    {line.text}
                  </Text>
                ))}
            </Box>
          ) : null}
          <Text dimColor wrap="truncate">
            [y] allow · [a] allow {permission.tool} for session · [n] deny
          </Text>
        </>
      ) : busy ? (
        <Text dimColor wrap="truncate">
          {spinner} Thinking…
        </Text>
      ) : (
        <Input
          value={input}
          cursor={cursor}
          width={Math.max(8, columns - 9)}
          rows={Math.max(1, height - 2)}
          placeholder="Type a message…"
          prefix={prefix}
          menuOpen={menuOpen}
          onChange={onInput}
          onSubmit={onSubmit}
        />
      )}
    </Box>
  )
}
