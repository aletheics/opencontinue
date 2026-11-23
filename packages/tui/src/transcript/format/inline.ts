import { theme } from "../../theme.js"
import type { Line, Span } from "./line.js"
import { charWidth, textWidth } from "./wrap.js"

type Style = Omit<Span, "text">

const BASE: Style = { color: theme.assistant }

function sameStyle(left: Style, right: Style): boolean {
  return (
    left.color === right.color &&
    Boolean(left.dim) === Boolean(right.dim) &&
    Boolean(left.bold) === Boolean(right.bold) &&
    Boolean(left.italic) === Boolean(right.italic) &&
    Boolean(left.underline) === Boolean(right.underline) &&
    Boolean(left.strikethrough) === Boolean(right.strikethrough) &&
    left.backgroundColor === right.backgroundColor
  )
}

function push(spans: Span[], span: Span): void {
  if (!span.text) return
  const last = spans.at(-1)
  if (last && sameStyle(last, span)) last.text += span.text
  else spans.push(span)
}

/**
 * Inline markdown: code spans, bold, italic, strikethrough, and links.
 * Styling follows Claude Code: inline code is blue, links are underlined.
 */
export function parseInline(text: string, style: Style = BASE): Span[] {
  const spans: Span[] = []
  let plain = ""
  let index = 0

  const flush = () => {
    if (plain) {
      push(spans, { ...style, text: plain })
      plain = ""
    }
  }

  while (index < text.length) {
    const rest = text.slice(index)

    const code = rest.match(/^`([^`]+)`/)
    if (code) {
      flush()
      push(spans, { ...style, color: theme.inlineCode, text: code[1] ?? "" })
      index += code[0].length
      continue
    }

    const bold = rest.match(/^(\*\*|__)([\s\S]+?)\1/)
    if (bold) {
      flush()
      for (const span of parseInline(bold[2] ?? "", { ...style, bold: true })) {
        push(spans, span)
      }
      index += bold[0].length
      continue
    }

    const strike = rest.match(/^~~([\s\S]+?)~~/)
    if (strike) {
      flush()
      for (const span of parseInline(strike[1] ?? "", {
        ...style,
        strikethrough: true,
      })) {
        push(spans, span)
      }
      index += strike[0].length
      continue
    }

    const italic = rest.match(/^(\*|_)([^*_\n]+)\1/)
    if (italic) {
      flush()
      for (const span of parseInline(italic[2] ?? "", {
        ...style,
        italic: true,
      })) {
        push(spans, span)
      }
      index += italic[0].length
      continue
    }

    const link = rest.match(/^\[([^\]]+)\]\(([^)]+)\)/)
    if (link) {
      flush()
      push(spans, {
        ...style,
        color: theme.link,
        underline: true,
        text: link[1] ?? "",
      })
      index += link[0].length
      continue
    }

    plain += rest.charAt(0)
    index++
  }

  flush()
  return spans
}

export function spanText(spans: Span[]): string {
  return spans.map((span) => span.text).join("")
}

export function spanWidth(spans: Span[]): number {
  return textWidth(spanText(spans))
}

/**
 * Wrap a span sequence at a display width, splitting span text when a
 * character crosses the boundary.
 */
export function wrapSpans(spans: Span[], width: number): Span[][] {
  const safeWidth = Math.max(1, width)
  const lines: Span[][] = []
  let current: Span[] = []
  let used = 0

  const pushChar = (span: Style, char: string, size: number) => {
    if (used > 0 && used + size > safeWidth) {
      lines.push(current)
      current = []
      used = 0
    }
    push(current, { ...span, text: char })
    used += size
  }

  for (const span of spans) {
    const { text, ...style } = span
    for (const char of text) pushChar(style, char, charWidth(char))
  }

  if (current.length > 0 || lines.length === 0) lines.push(current)
  return lines
}

/**
 * Collapse a uniformly styled span list into line-level styling so plain text
 * keeps rendering as one Text node.
 */
export function lineFromSpans(
  spans: Span[],
  fallbackColor: string = theme.assistant,
): Line {
  const text = spanText(spans)
  if (spans.length === 0) return { text: "", color: fallbackColor }

  const first = spans[0]!
  if (spans.every((span) => sameStyle(span, first))) {
    return {
      text,
      color: first.color,
      dim: first.dim,
      bold: first.bold,
      italic: first.italic,
      underline: first.underline,
      strikethrough: first.strikethrough,
      backgroundColor: first.backgroundColor,
    }
  }

  return { text, color: fallbackColor, spans }
}
