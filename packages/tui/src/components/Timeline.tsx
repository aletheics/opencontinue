import { Text } from "ink"

import type { Line } from "../render.js"

export type TimelineProps = {
  lines: Line[]
  bodyHeight: number
  scrollOffset: number
}

export function Timeline({ lines, bodyHeight, scrollOffset }: TimelineProps) {
  const maxLines = Math.max(1, bodyHeight - 4)
  const end = Math.max(0, lines.length - scrollOffset)
  const start = Math.max(0, end - maxLines)
  const visible = lines.slice(start, end)
  const hiddenAbove = start
  const hiddenBelow = lines.length - end

  return (
    <>
      {hiddenAbove > 0 ? (
        <Text dimColor wrap="truncate">
          … {hiddenAbove} older lines · PgUp
        </Text>
      ) : null}
      {visible.length === 0 ? (
        <Text dimColor wrap="truncate">
          Type a message to start.
        </Text>
      ) : (
        visible.map((line, index) => (
          <Text
            key={`${start + index}`}
            color={line.color}
            dimColor={line.dim}
            wrap="truncate"
          >
            {line.text}
          </Text>
        ))
      )}
      {hiddenBelow > 0 ? (
        <Text dimColor wrap="truncate">
          … {hiddenBelow} newer lines · PgDn
        </Text>
      ) : null}
    </>
  )
}
