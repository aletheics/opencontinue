# status

**Why:** activity, footer, and number formatting are display primitives reused across the TUI.

**Files:**

- `activity.ts` — event-driven labels, configurable delayed/stalled thresholds, and metadata width gating.
- `footer.ts` — mode/branch/help status bar layout, mode tints, and display-cell width gating.
- `spinner.ts` — rotating tips (no random work verbs).
- `format.ts` — compact numbers, clock time, and durations.

**Rule:** labels derive from real protocol events (running tool, model-authored todo, first-token state). A timer can produce a delayed/stalled warning, but never a failure.

**Tests:** `activity.test.ts`, `footer.test.ts`, `spinner.test.ts`, `format.test.ts`.
