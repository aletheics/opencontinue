# composer

**Why:** the prompt has independent concerns. Keep their decisions testable without Ink.

**Files:**

- `commands.ts` — slash command catalog, help text, and bare-prefix matching.
- `history.ts` — newest-first history search and cursor movement.
- `mentions.ts` — `@file` token detection, ranked filtering, and token replacement.

**Rule:** pure functions only. State and Ink subscriptions stay in `index.tsx`.

**Tests:** colocated `*.test.ts` files.
