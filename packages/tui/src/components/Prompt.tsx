import { Box, Text } from "ink"
import TextInput from "ink-text-input"

import { theme } from "../theme.js"

export type PromptProps = {
  columns: number
  height: number
  input: string
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  permission: { tool: string; detail: string } | null
  busy: boolean
  spinner: string
}

export function Prompt({
  columns,
  height,
  input,
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
        <Box width={Math.max(10, columns - 8)} overflow="hidden">
          <Text color={theme.user}>{"you> "}</Text>
          <TextInput
            value={input}
            onChange={onInput}
            onSubmit={onSubmit}
            placeholder="Type a message…"
            focus
          />
        </Box>
      )}
    </Box>
  )
}
