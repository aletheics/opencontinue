import { Box } from "ink"

import { viewportWindow } from "../fullscreen/layout.js"
import type { Line } from "../transcript/format/index.js"
import { LineText } from "./LineText.js"

export type FullscreenTranscriptProps = {
  lines: Line[]
  height: number
  scrollFromBottom: number
}

/**
 * Fixed-height transcript viewport for the fullscreen renderer. The window
 * follows the tail unless the user scrolls up; terminal scrollback is not
 * used in alternate-screen mode.
 */
export function FullscreenTranscript({
  lines,
  height,
  scrollFromBottom,
}: FullscreenTranscriptProps) {
  const window = viewportWindow(lines.length, height, scrollFromBottom)
  const visible = lines.slice(window.start, window.end)

  return (
    <Box flexDirection="column" height={height} overflow="hidden" paddingX={1}>
      {visible.map((line, index) => (
        <LineText key={window.start + index} line={line} />
      ))}
    </Box>
  )
}
