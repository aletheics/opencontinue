# components

**Why:** keep `index.tsx` as the state machine and event wiring, not a rendering dump.

**Files:**

- `Header.tsx` — fixed 3-row brand, provider/model, permission mode, and stats.
- `Picker.tsx` — generic type-to-filter list used by provider, model, and session selection.
- `Timeline.tsx` — clipped line viewport for the chat transcript.
- `Prompt.tsx` — fixed 3-row input, permission question, or spinner.

**Rule:** components are presentational. Sessions, providers, permissions, commands, and keybindings stay in `index.tsx`. A component receives already-computed data and callbacks.

**Tests:** behavior is covered through `../index.test.tsx`; the line buffer itself is covered in `../render.test.ts`.
