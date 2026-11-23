# hooks

**Why:** terminal integration belongs behind React hooks, not in the screen state machine.

**Files:**

- `use-terminal-size.ts` — columns/rows with a one-cell margin and resize subscription.

**Rule:** hooks may touch Ink and process streams; formatting and decisions stay in pure feature folders.
