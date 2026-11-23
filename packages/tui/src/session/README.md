# session

**Why:** session display decisions are independent of Ink and of the client transport.

**Files:**

- `transcript.ts` — committed vs live timeline partition and the commit rule.
- `stream.ts` — stable streaming boundary: complete lines, blank lines, fenced blocks, inline code.
- `todos.ts` — the newest todo tool call projected into the task panel.
- `labels.ts` — readable session labels and session-list filtering.
- `workspace.ts` — workspace name and git branch from `.git/HEAD`.

**Rule:** pure functions only. Session creation, subscriptions, sends, aborts, and permissions stay in `index.tsx`.

**Tests:** colocated `*.test.ts` files.
