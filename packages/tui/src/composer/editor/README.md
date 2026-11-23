# composer/editor

**Why:** the cursor-aware prompt editor is a feature with its own state, actions, viewport, and component.

**Files:**

- `state.ts` — `EditorState` and cursor clamping.
- `actions.ts` — insert, delete, word/line deletion, horizontal/vertical movement.
- `view.ts` — line boundaries and the horizontally/vertically scrolled viewport.
- `Input.tsx` — Ink component and key bindings.
- `index.ts` — public barrel.

**Rule:** `actions.ts` and `view.ts` are pure. The component only maps Ink keys to actions.

**Tests:** `actions.test.ts`, `view.test.ts`.
