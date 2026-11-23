import { Box, Text } from "ink"

import { theme } from "../theme.js"

export type SlashCommandItem = {
  name: string
  description: string
}

export type SlashMenuProps = {
  commands: SlashCommandItem[]
  selectedIndex: number
}

export function SlashMenu({ commands, selectedIndex }: SlashMenuProps) {
  if (commands.length === 0) return null

  const selected = Math.min(selectedIndex, commands.length - 1)

  return (
    <Box flexDirection="column" paddingX={2}>
      {commands.map((command, index) => (
        <Text
          key={command.name}
          color={index === selected ? theme.brand : undefined}
          dimColor={index !== selected}
          wrap="truncate"
        >
          {index === selected ? "› " : "  "}
          {command.name} — {command.description}
        </Text>
      ))}
    </Box>
  )
}
