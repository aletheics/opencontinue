# components

**Why:** keep `index.tsx` as the state machine and event wiring, not a rendering dump.

**Files:**

- `Welcome.tsx` — OpenContinue startup header: `◈ OpenContinue`, tagline, aligned model/provider/workspace rows with middle-shortened paths, and a ready line.
- `Transcript.tsx` — OpenContinue inline blocks: `›` prompts, white `●` assistant dots with a two-column indented markdown body, `↳ Tool(args)` with two-space header wraps, dim `⎿` gutters with normal output, colored diffs, collapsed output hints, `(No output)`, bash timeout/cwd notes, and dim meta lines.
- `Picker.tsx` — generic type-to-filter list used by provider, model, session, history, and file selection.
- `TodoPanel.tsx` — the model-maintained task list above the prompt: `✓` completed, `▸` in progress, `○` pending, with an `◈ Tasks · done/total` header.
- `SpinnerLine.tsx` — live turn status: a 120ms Braille spinner, a shimmering working-blue verb, the working-blue-to-danger-red stall fade, the 30-second timer/token gate, and the `  ⎿  Tip:` line.
- `LineText.tsx` — renders a formatted line, including inline markdown spans (code, bold, italic, strikethrough, links).
- `Prompt.tsx` — borderless prompt composed with `composer/editor/Input.tsx`.
- `SlashMenu.tsx` — borderless command palette above the prompt.
- `PermissionPrompt.tsx` — inline permission card with `? Permission required`, the exact operation and target, working directory for bash, preview diff, and y/a/n choices.

**Rule:** components are presentational. Sessions, providers, permissions, commands, and keybindings stay in `index.tsx`. A component receives already-computed data and callbacks.

**Tests:** behavior is covered through `../index.test.tsx`; formatting and display-width wrapping (CJK counts as two columns) are covered in `../transcript/format/*.test.ts`.
