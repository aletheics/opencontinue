import { Box, Text } from "ink"

import {
  glimmerIndex,
  isShimmerChar,
  spinnerGlyph,
  stallTint,
  visibleStatusParts,
} from "../status/spinner.js"
import { theme } from "../theme.js"
import { textWidth } from "../transcript/format/wrap.js"

export type SpinnerLineProps = {
  verb: string
  tip: string
  elapsedMs: number
  tokens: number
  stalled: number
  columns: number
  frames: readonly string[]
}

/**
 * Claude Code's live status: the glyph and verb sweep through the coral
 * palette, fade to red when output stalls, and only reveal elapsed time and
 * tokens after 30 seconds. The tip sits on a dim `⎿` line below.
 */
export function SpinnerLine({
  verb,
  tip,
  elapsedMs,
  tokens,
  stalled,
  columns,
  frames,
}: SpinnerLineProps) {
  const message = `${verb}…`
  const tint = stalled > 0 ? stallTint(stalled) : theme.working
  const glyph = spinnerGlyph(elapsedMs, frames)
  const shimmerAt = glimmerIndex(message.length, elapsedMs)
  const statusParts = visibleStatusParts(
    elapsedMs,
    tokens,
    Math.max(0, columns - textWidth(message) - 9),
  )

  return (
    <>
      <Box marginTop={1} paddingX={2}>
        <Text color={tint}>{glyph} </Text>
        {stalled > 0 ? (
          <Text color={tint}>{message}</Text>
        ) : (
          <Text>
            {Array.from(message).map((character, index) => (
              <Text
                key={index}
                color={
                  isShimmerChar(index, shimmerAt)
                    ? theme.workingShimmer
                    : theme.working
                }
              >
                {character}
              </Text>
            ))}
          </Text>
        )}
        {statusParts.length > 0 ? (
          <Text dimColor> ({statusParts.join(" · ")})</Text>
        ) : null}
      </Box>
      <Box paddingX={2}>
        <Text dimColor wrap="truncate">
          {"  ⎿  "}Tip: {tip}
        </Text>
      </Box>
    </>
  )
}
