import { Box, Text } from "ink"

import { glyphs } from "../glyphs.js"
import {
  activityTailParts,
  displayActivityLabel,
  type ProgressState,
} from "../status/activity.js"
import { theme } from "../theme.js"

export type SpinnerLineProps = {
  /** Real phase or tool label; never a random verb. */
  label: string
  state: ProgressState
  elapsedMs: number
  tokens: number
  effort?: string
  columns: number
  tip: string
  /** Restrained copper pulse; disabled for reduced motion. */
  pulse: boolean
}

/**
 * Event-driven activity line. The label comes from the running tool or the
 * model-authored todo, and elapsed time uses that tool's real start. A long
 * wait becomes a delayed/stalled warning with explicit text; it is never
 * labeled as a failure.
 */
export function SpinnerLine({
  label,
  state,
  elapsedMs,
  tokens,
  effort,
  columns,
  tip,
  pulse,
}: SpinnerLineProps) {
  const display = displayActivityLabel(label, state)
  const parts = activityTailParts({
    label: display,
    elapsedMs,
    tokens,
    effort,
    width: Math.max(1, columns - 4),
  })
  const color =
    state === "stalled"
      ? theme.error
      : state === "delayed"
        ? theme.brand
        : pulse
          ? theme.brandShimmer
          : theme.warning

  return (
    <>
      <Box marginTop={1} paddingX={2}>
        <Text color={color}>{glyphs.brand} </Text>
        <Text color={color}>{display}</Text>
        {parts.length > 0 ? (
          <Text dimColor> · {parts.join(" · ")}</Text>
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
