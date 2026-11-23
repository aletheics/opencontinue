import { Box, Text } from "ink"

import { theme } from "../theme.js"

export type HeaderProps = {
  provider: string
  model: string
  mode: string
  stats?: string
}

export function Header({ provider, model, mode, stats }: HeaderProps) {
  return (
    <Box
      flexShrink={0}
      height={3}
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      justifyContent="space-between"
      overflow="hidden"
    >
      <Box flexShrink={0}>
        <Text bold color={theme.brand} wrap="truncate">
          OpenContinue
        </Text>
      </Box>
      <Box flexShrink={1} overflow="hidden">
        <Text dimColor wrap="truncate">
          {provider} · model: {model} · {mode}
          {stats ? ` · ${stats}` : ""}
        </Text>
      </Box>
    </Box>
  )
}
