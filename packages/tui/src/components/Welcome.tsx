import { Box, Text } from "ink"

import { PRODUCT_NAME, READY_LINE, TAGLINE } from "../brand.js"
import { glyphs } from "../glyphs.js"
import { theme } from "../theme.js"
import { charWidth, textWidth } from "../transcript/format/wrap.js"

const LABEL_WIDTH = 12

export type WelcomeProps = {
  version: string
  model: string
  provider: string
  workspace: string
  columns: number
}

function takeStart(value: string, width: number): string {
  let result = ""
  let used = 0
  for (const char of value) {
    const size = charWidth(char)
    if (used + size > width) break
    result += char
    used += size
  }
  return result
}

function takeEnd(value: string, width: number): string {
  const chars = Array.from(value)
  let result = ""
  let used = 0
  for (let index = chars.length - 1; index >= 0; index--) {
    const char = chars[index] ?? ""
    const size = charWidth(char)
    if (used + size > width) break
    result = char + result
    used += size
  }
  return result
}

/** Keep the root and the tail by display width, ellipsis in the middle. */
export function shortenPath(value: string, width: number): string {
  const limit = Math.max(0, width)
  if (textWidth(value) <= limit) return value
  if (limit <= 1) return "…"

  const keep = limit - 1
  const head = Math.ceil(keep / 2)
  const tail = Math.floor(keep / 2)
  return `${takeStart(value, head)}…${takeEnd(value, tail)}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <Text wrap="truncate">
      <Text dimColor>{label.padEnd(LABEL_WIDTH)}</Text>
      {value}
    </Text>
  )
}

/**
 * OpenContinue startup header: a stable brand mark, product name and
 * version, tagline, aligned model/provider/workspace rows, and a ready line.
 */
export function Welcome({ version, model, provider, workspace, columns }: WelcomeProps) {
  const valueWidth = Math.max(10, columns - LABEL_WIDTH)

  return (
    <Box flexDirection="column">
      <Text wrap="truncate">
        <Text color={theme.brandMark}>{glyphs.brand}</Text>
        <Text bold> {PRODUCT_NAME}</Text>
        <Text dimColor>{"  "}v{version}</Text>
      </Text>
      <Text dimColor wrap="truncate">
        {TAGLINE}
      </Text>

      <Box marginTop={1} flexDirection="column">
        <Row label="Model" value={model} />
        <Row label="Provider" value={provider} />
        <Row label="Workspace" value={shortenPath(workspace, valueWidth)} />
      </Box>

      <Box marginTop={1}>
        <Text dimColor wrap="truncate">
          {glyphs.ready} {READY_LINE}
        </Text>
      </Box>
    </Box>
  )
}
