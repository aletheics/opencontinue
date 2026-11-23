import { Box, Text } from "ink"

import { theme } from "../theme.js"

/**
 * Three-row coral block mark, 9 columns wide, matching Claude Code's
 * condensed startup footprint. It is an OpenContinue mark, not a copy.
 */
export const BANNER_MARK = [
  " ▄█████▄ ",
  "██     ██",
  " ▀█████▀ ",
] as const

const NAME = "OpenContinue"
const VERSION_PREFIX = `${NAME} v`
const SEPARATOR = " · "

export type WelcomeProps = {
  version: string
  model: string
  provider: string
  workspace: string
  columns: number
}

/**
 * Claude Code subtracts the mark (9), the gap (2), and padding (2) from the
 * terminal width, with a 20-column floor.
 */
export function bannerTextWidth(columns: number): number {
  return Math.max(20, columns - 15)
}

export function truncateLine(text: string, width: number): string {
  const limit = Math.max(0, width)
  if (text.length <= limit) return text
  if (limit === 0) return ""
  if (limit === 1) return "…"
  return `${text.slice(0, limit - 1)}…`
}

/**
 * `model · provider` on one line, or two dim lines when the terminal is
 * narrow. Mirrors the split Claude Code applies to model and billing.
 */
export function modelLines(
  model: string,
  provider: string,
  width: number,
): string[] {
  const combined = `${model}${SEPARATOR}${provider}`
  if (combined.length <= width) return [combined]
  return [truncateLine(model, width), truncateLine(provider, width)]
}

export function Welcome({
  version,
  model,
  provider,
  workspace,
  columns,
}: WelcomeProps) {
  const textWidth = bannerTextWidth(columns)
  const versionText = truncateLine(
    version,
    Math.max(6, textWidth - VERSION_PREFIX.length),
  )
  const lines = modelLines(model, provider, textWidth)
  const workspaceText = truncateLine(workspace, textWidth)

  return (
    <Box flexDirection="row" paddingLeft={2}>
      <Box flexDirection="column" marginRight={2} flexShrink={0}>
        {BANNER_MARK.map((line, index) => (
          <Text key={index} color={theme.logo} wrap="truncate">
            {line}
          </Text>
        ))}
      </Box>
      <Box flexDirection="column" flexShrink={1} overflow="hidden">
        <Text wrap="truncate">
          <Text bold>{NAME}</Text>
          <Text dimColor> v{versionText}</Text>
        </Text>
        {lines.map((line, index) => (
          <Text key={`model-${index}`} dimColor wrap="truncate">
            {line}
          </Text>
        ))}
        <Text dimColor wrap="truncate">
          {workspaceText}
        </Text>
      </Box>
    </Box>
  )
}
