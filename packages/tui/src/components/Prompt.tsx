import { Box, Text } from "ink"

import { theme } from "../theme.js"
import { Input } from "./Input.js"

export type PromptProps = {
  columns: number
  height: number
  input: string
  cursor: number
  menuOpen: boolean
  onInput: (value: string, cursor: number) => void
  onSubmit: (value: string) => void
  permission: { tool: string; detail: string } | null
  busy: boolean
  spinner: string
}

export function Prompt({
  columns,
  height,
  input,
  cursor,
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
          menuOpen={menuOpen}
          onChange={onInput}
          onSubmit={onSubmit}
        />
      )}
    </Box>
  )
}
