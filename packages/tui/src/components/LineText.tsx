import { Text } from "ink"

import type { Line } from "../transcript/format/index.js"

/**
 * Renders a formatted line, including inline spans for assistant markdown.
 */
export function LineText({ line }: { line: Line }) {
  if (line.spans?.length) {
    return (
      <Text wrap="truncate">
        {line.spans.map((span, index) => (
          <Text
            key={index}
            color={span.color}
            dimColor={span.dim}
            bold={span.bold}
            italic={span.italic}
            underline={span.underline}
            strikethrough={span.strikethrough}
            backgroundColor={span.backgroundColor}
          >
            {span.text}
          </Text>
        ))}
      </Text>
    )
  }

  return (
    <Text
      color={line.color}
      dimColor={line.dim}
      bold={line.bold}
      italic={line.italic}
      underline={line.underline}
      strikethrough={line.strikethrough}
      backgroundColor={line.backgroundColor}
      wrap="truncate"
    >
      {line.text}
    </Text>
  )
}
