# components

**Why:** keep `index.tsx` as the state machine and event wiring, not a rendering dump.

**Files:**

- `Header.tsx` — fixed 3-row brand, provider/model, permission mode, and stats.
- `Picker.tsx` — generic type-to-filter list used by provider, model, session, and history selection.
- `Timeline.tsx` — clipped line viewport for the chat transcript.
- `Prompt.tsx` — fixed input, permission dialog (tool detail plus y/a/n), or spinner.
- `Input.tsx` — cursor-aware editor with horizontal/vertical scrolling and readline keys; pure editing math lives in `../input.ts`.
- `SlashMenu.tsx` — command palette above the input while a slash command is being typed.

**Rule:** components are presentational. Sessions, providers, permissions, commands, and keybindings stay in `index.tsx`. A component receives already-computed data and callbacks.

**Tests:** behavior is covered through `../index.test.tsx`; the line buffer itself is covered in `../render.test.ts`.
