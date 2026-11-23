# composer

**Why:** the prompt has independent concerns. Keep their decisions testable without Ink.

**Files:**

- `commands.ts` — slash command catalog, help text, and bare-prefix matching.
- `history.ts` — newest-first history search and cursor movement.
- `mentions.ts` — `@file` token detection, ranked filtering, and token replacement.
- `editor/` — cursor-aware input actions, viewport math, and the Ink component.

**Rule:** `commands`, `history`, and `mentions` are pure. `editor/` owns its Ink component and pure actions/viewport. App state and session wiring stay in `index.tsx`.

**Tests:** colocated `*.test.ts` files.
