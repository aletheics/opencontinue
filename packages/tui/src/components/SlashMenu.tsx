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
    <Box
      flexShrink={0}
      height={commands.length + 2}
      flexDirection="column"
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      overflow="hidden"
    >
      {commands.map((command, index) => (
        <Text
          key={command.name}
          color={index === selected ? theme.brand : undefined}
          wrap="truncate"
        >
          {index === selected ? "› " : "  "}
          {command.name} — {command.description}
        </Text>
      ))}
    </Box>
  )
}
