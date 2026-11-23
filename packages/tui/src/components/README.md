# components

**Why:** keep `index.tsx` as the state machine and event wiring, not a rendering dump.

**Files:**

- `Welcome.tsx` — condensed startup banner: a three-row coral block mark beside a bold name with dim version, dim model/provider, and dim workspace. No welcome line.
- `Transcript.tsx` — Claude Code-style inline blocks: `❯` prompts, white `●` assistant dots with a two-column indented markdown body, `● Tool(args)`, `⎿` output, colored diffs, collapsed output hints, and dim meta lines.
- `Picker.tsx` — generic type-to-filter list used by provider, model, session, history, and file selection.
- `SpinnerLine.tsx` — live turn status: a 120ms glyph cycle, a shimmering coral verb, the coral-to-error-red stall fade, the 30-second timer/token gate, and the `  ⎿  Tip:` line.
- `Prompt.tsx` — borderless prompt composed with `composer/editor/Input.tsx`.
- `SlashMenu.tsx` — borderless command palette above the prompt.
- `PermissionPrompt.tsx` — bordered permission dialog with the tool detail, preview diff, and y/a/n choices.

**Rule:** components are presentational. Sessions, providers, permissions, commands, and keybindings stay in `index.tsx`. A component receives already-computed data and callbacks.

**Tests:** behavior is covered through `../index.test.tsx`; formatting and display-width wrapping (CJK counts as two columns) are covered in `../transcript/format/*.test.ts`.
