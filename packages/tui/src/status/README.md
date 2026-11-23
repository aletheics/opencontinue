# status

**Why:** token and duration strings are display primitives used by the banner, spinner, and footer.

**Files:**

- `format.ts` — `formatTokens`, `formatDuration`.
- `spinner.ts` — verb pairs, tip, stall intensity, yellow-to-red color.

**Rule:** no React, no session state.

**Tests:** `format.test.ts`, `spinner.test.ts`.
