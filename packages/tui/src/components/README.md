# components

**Why:** keep `index.tsx` as the state machine and event wiring, not a rendering dump.

**Files:**

- `Welcome.tsx` — startup logo, version, model/provider, workspace, and welcome line.
- `Transcript.tsx` — Claude Code-style inline blocks: `❯` prompts, `● Tool(args)`, `⎿` output, colored diffs, collapsed output hints, and dim meta lines.
- `Picker.tsx` — generic type-to-filter list used by provider, model, session, history, and file selection.
- `Prompt.tsx` — borderless prompt composed with `composer/editor/Input.tsx`.
- `SlashMenu.tsx` — borderless command palette above the prompt.
- `PermissionPrompt.tsx` — bordered permission dialog with the tool detail, preview diff, and y/a/n choices.

**Rule:** components are presentational. Sessions, providers, permissions, commands, and keybindings stay in `index.tsx`. A component receives already-computed data and callbacks.

**Tests:** behavior is covered through `../index.test.tsx`; formatting is covered in `../transcript/format/*.test.ts`.
