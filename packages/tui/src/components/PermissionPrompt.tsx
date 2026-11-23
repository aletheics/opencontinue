import { Box, Text } from "ink"

import { formatDiffLines } from "../transcript/format/index.js"
import { theme } from "../theme.js"

export type PermissionPromptProps = {
  columns: number
  permission: { tool: string; detail: string; diff?: string }
}

export function PermissionPrompt({ columns, permission }: PermissionPromptProps) {
  return (
    <Box
      marginX={1}
      marginTop={1}
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.tool}
      paddingX={1}
    >
      <Text color={theme.tool} wrap="truncate">
        Permission required · {permission.tool}
      </Text>
      <Text wrap="truncate">{permission.detail || "(no details)"}</Text>
      {permission.diff
        ? formatDiffLines(permission.diff, Math.max(20, columns - 8), false)
            .slice(0, 6)
            .map((line, index) => (
              <Text
                key={index}
                color={line.color}
                dimColor={line.dim}
                wrap="truncate"
              >
                {line.text}
              </Text>
            ))
        : null}
      <Text dimColor wrap="truncate">
        [y] allow · [a] allow for session · [n] deny
      </Text>
    </Box>
  )
}
