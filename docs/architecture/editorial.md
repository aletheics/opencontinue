# Terminal editorial system

**Why:** assistant output should read like typeset engineering notes, not like
terminal text that happens to contain Markdown.

This file is the canonical contract for the TUI's markdown rendering. Keep
renderer behavior, tests, and this document in the same change.

## Scope

- Ink + React stay the rendering stack.
- `packages/protocol` is unchanged.
- Display width comes from one implementation (`transcript/format/wrap.ts`).
- No new runtime dependency; built-in Node APIs are allowed.

## Pipeline

```text
assistant text
  -> parseBlocks (assistant.ts)       top-level blocks, blank-line separated
  -> parseInline (inline.ts)          code, bold, italic, strike, links
  -> wrap / highlight / table         display-cell layout
  -> Line[] (format/line.ts)          styled lines
  -> LineText / Transcript            Ink rendering
```

The inline renderer commits finished items through `<Static>`; the alternate
screen re-projects the durable timeline. Both must use the same formatter.

## Markdown contract

| Feature | Rule |
|---|---|
| Paragraph | GFM soft breaks join into one flowing paragraph; two trailing spaces or `\` keep a hard break. No space is inserted between CJK edges. |
| Headings | H1–H2 bold soft white, H3 soft white, H4–H6 secondary/dim. One blank line before and after. No copper heading text. |
| Bold / italic / strike | Inline spans, body color unchanged. |
| Inline code | Soft blue-gray (`theme.inlineCode`), never a full-line highlight. |
| Fenced code | Left `▎` rule, dim language label, syntax colors; long lines wrap. No high-contrast box. |
| Lists | `-`, `1.`, `1)` with hanging indents; nested lists keep indentation; consecutive items never get blank lines. |
| Task lists | `- [x]` / `- [ ]` with the same list layout. |
| Tables | Display-cell column widths, header bold, dim rule, wide cells wrap. Below the readable minimum, switch to vertical key/value rows. |
| Blockquotes | `▎` gutter, italic body. |
| Horizontal rules | Full-width low-contrast `─` rule, not a literal `---`. |
| Links | Styled link text; a differing URL follows in dim parentheses, middle-shortened. |
| Diff fences | `+` success green, `-` error red, `@@` hunk blue, file headers dim. |

## Layout

- Exactly one blank line between top-level blocks; extra source blank lines
  collapse.
- No blank line between consecutive list items or table rows.
- No paragraph borders, no per-line boxes, no background wallpaper.
- Body text stays neutral; saturated colors are reserved for code, diffs,
  status, and emphasis.

## Width and Unicode

- CJK and fullwidth characters count as two cells.
- Emoji sequences (ZWJ, skin tones, flags, variation selectors) count as one
  grapheme; wrapping must not split them.
- Every rendered line is truncated or pre-wrapped, so terminals never
  auto-wrap.
- Common test widths: 60, 80, and 120 columns.

## Streaming

- Do not commit inside an open code fence, inline code, table, list, or link.
- Commit only whole blocks at a blank line or a closed fence; otherwise keep the
  message live.
- Inline scrollback must not print the same history twice.
- The final inline layout must match a one-shot render of the completed text.
- Alternate-screen rendering always reflows from the full durable timeline.

## Themes

- Dark Copper is the default.
- Light mode is selected by `OPENCONTINUE_THEME=light`, then a `COLORFGBG`
  heuristic, otherwise dark.
- `NO_COLOR` (or `FORCE_COLOR=0`) removes all color while keeping glyphs,
  weights, and spacing meaningful.

## Staged delivery

| Stage | Scope | Status |
|---|---|---|
| 0 | Feature corpus, 60/80/120 width guards, this document | done |
| 1 | Paragraph joining, white heading hierarchy, full-width rules, block spacing | done |
| 2 | Table readable minimums and vertical narrow layout | done |
| 3 | Code labels/rules, PowerShell/YAML/Markdown/Diff highlighting | done |
| 4 | Link destinations, grapheme-aware emoji width | done |
| 5 | Streaming stability for tables/lists/links, inline/fullscreen parity | done |
| 6 | Light/dark theme tokens | planned |
| 7 | Answer-structure guidance and final visual verification | planned |
