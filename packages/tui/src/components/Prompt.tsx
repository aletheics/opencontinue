import { Box, Text } from "ink"
import TextInput from "ink-text-input"

import { theme } from "../theme.js"

export type PromptProps = {
  columns: number
  input: string
  onInput: (value: string) => void
  onSubmit: (value: string) => void
  permission: { tool: string } | null
  busy: boolean
  spinner: string
}

export function Prompt({
  columns,
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
      height={3}
      borderStyle="round"
      borderColor={theme.inputBorder}
      paddingX={1}
      overflow="hidden"
    >
      {permission ? (
        <Text color={theme.tool} wrap="truncate">
          permission: {permission.tool} · Allow? [y/N]
        </Text>
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
