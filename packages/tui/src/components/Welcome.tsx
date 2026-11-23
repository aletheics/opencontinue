import { Box, Text } from "ink"

import { theme } from "../theme.js"

const LOGO = ["  ██████", " ██    ██", "  ██████"]

export type WelcomeProps = {
  version: string
  model: string
  provider: string
  workspace: string
  columns: number
}

export function Welcome({
  version,
  model,
  provider,
  workspace,
  columns,
}: WelcomeProps) {
  const infoWidth = Math.max(20, columns - 24)

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box flexDirection="row">
        <Box flexDirection="column" marginRight={2} flexShrink={0}>
          {LOGO.map((line, index) => (
            <Text key={index} color={theme.brand} wrap="truncate">
              {line}
            </Text>
          ))}
        </Box>
        <Box flexDirection="column" flexShrink={1} overflow="hidden">
          <Text wrap="truncate">
            <Text bold>OpenContinue</Text>
            <Text dimColor> v{version}</Text>
          </Text>
          <Text dimColor wrap="truncate">
            {`${model} · ${provider}`.slice(0, infoWidth)}
          </Text>
          <Text dimColor wrap="truncate">
            {workspace.slice(0, infoWidth)}
          </Text>
        </Box>
      </Box>
      <Box marginTop={1}>
        <Text dimColor wrap="truncate">
          Welcome to OpenContinue · type a message, /help for commands
        </Text>
      </Box>
    </Box>
  )
}
