# transcript/format

**Why:** the transcript has one formatting concern per file, each testable without Ink.

**Files:**

- `line.ts` — the styled line shape used by every formatter.
- `wrap.ts` — width wrapping and prefixed continuation.
- `assistant.ts` — markdown-style assistant output and top-level block spacing.
- `table.ts` — GFM tables with display-width column alignment.
- `diff.ts` — line-numbered diff gutters, colors, summary, collapse hint, and stats.
- `tool.ts` — `● Tool(args)` headers and `⎿` output lines.
- `lines.ts` — flatten the timeline for the `ctrl+o` transcript.
- `index.ts` — public barrel.

**Rule:** no React, no session state, no client calls. Colors come from `theme.ts`.

**Tests:** colocated `*.test.ts` files.
