# transcript/format

**Why:** the transcript has one formatting concern per file, each testable without Ink.

**Files:**

- `line.ts` — the styled line shape used by every formatter.
- `wrap.ts` — display-width wrapping, grapheme-aware emoji, and prefixed continuation.
- `assistant.ts` — markdown-style assistant output, top-level block spacing, and ruled code blocks.
- `highlight.ts` — language-aware code tokenizer and canonical code labels.
- `table.ts` — GFM tables with display-width column alignment and a vertical fallback for narrow terminals.
- `diff.ts` — line-numbered diff gutters, colors, summary, collapse hint, and stats.
- `tool.ts` — `● Tool(args)` headers and `⎿` output lines.
- `lines.ts` — flatten the timeline for the `ctrl+o` transcript.
- `index.ts` — public barrel.

**Rule:** no React, no session state, no client calls. Colors come from `theme.ts`.

**Tests:** colocated `*.test.ts` files.
