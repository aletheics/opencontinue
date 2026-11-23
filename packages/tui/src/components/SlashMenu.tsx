import { Box, Text } from "ink"

import { theme } from "../theme.js"

export type SlashCommandItem = {
  name: string
  description: string
}

export type SlashMenuProps = {
  commands: SlashCommandItem[]
  selectedIndex: number
  columns: number
}

export function SlashMenu({ commands, selectedIndex, columns }: SlashMenuProps) {
  if (commands.length === 0) return null

  const selected = Math.min(selectedIndex, commands.length - 1)
  const nameWidth = Math.min(28, Math.max(12, Math.floor(columns * 0.28)))

  return (
    <Box flexDirection="column" paddingX={2}>
      {commands.map((command, index) => {
        const active = index === selected
        return (
          <Box key={command.name} flexDirection="row">
            <Box width={nameWidth} flexShrink={0}>
              <Text
                color={active ? theme.brand : undefined}
                dimColor={!active}
                wrap="truncate"
              >
                {active ? "› " : "  "}
                {command.name}
              </Text>
            </Box>
            <Box flexShrink={1} overflow="hidden">
              <Text dimColor={!active} wrap="truncate">
                {command.description}
              </Text>
            </Box>
          </Box>
        )
      })}
    </Box>
  )
}
