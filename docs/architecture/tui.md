# TUI

Reference studied: `D:\soft\vscodefiles\continue\openclaude` (MIT), a Claude Code-style terminal agent.

## What OpenClaude does

- A **custom Ink fork** (`src/ink`): alternate screen, scroll box, terminal-size context, keyboard/paste/mouse events, terminal focus and title.
- **FullscreenLayout**: a scrollable transcript, a pinned bottom prompt, and a modal pane for slash-command dialogs.
- **Design system** (`src/components/design-system`): themed boxes/text, dialogs, panes, keyboard shortcut hints, fuzzy picker.
- **Keybinding registry** (`src/keybindings`): context-specific bindings for global, chat, autocomplete, confirmation, tabs, transcript, settings, vim.
- **Slash commands / help**, output styles, Vim mode, diff views, cost/token/status lines, image paste, voice.
- It is a **TUI**, not a GUI. The renderer is terminal-native.

## What OpenContinue adopts

- **Inline Claude Code-style transcript**, not a full-screen dashboard. Completed items are written once to terminal scrollback through Ink `<Static>`; only the live tail, spinner, and prompt repaint.
- No header bar, no bordered transcript, no bordered input. The only box is the permission dialog.
- Tool blocks: `● Tool(args)` with wrapped continuation aligned under the call, `⎿` output lines, colored diff lines, and `… +N lines (ctrl+o to expand)`.
- User prompts: `❯ text` with two-space continuation. Assistant text: markdown-style headings, lists, quotes, and fenced code.
- Completion line: `✻ Worked for 3.2s`; live spinner: `✻ Thinking… (3s · esc to interrupt)` or `Running Bash…`.
- Bottom mode line: `⏵⏵ auto mode on (shift+tab to cycle)`, `⛔ readonly mode …`, or `? for shortcuts …`; workspace, branch, model, duration, and tokens sit dim on the right when width allows.
- Prompt input submitted while a run is active is queued and sent when the run finishes.
- Keybindings:
  - `Ctrl+C` exit
  - `Ctrl+O` open/close the expanded transcript view
  - `Shift+Tab` cycle permission mode (`ask` → `auto` → `readonly`)
  - `Esc` abort the active run
  - `Up`/`Down` input history
  - `Ctrl+D` exit when input is empty
  - Terminal scrollback handles normal scrolling; the transcript view adds `↑/↓` and `PgUp`/`PgDn`.
- Slash commands: `/help`, `/clear`, `/model`, `/provider`, `/resume`, `/mode`, `/status`, `/exit`.
- Slash menu above the prompt: borderless, filters as you type, `↑/↓` selects, `Tab` completes, `Enter` runs, `Esc` closes.
- Session picker via `/resume`: sorted by recency, type-to-filter by title or id, `Esc` returns to chat. Sessions with the generic default title are labeled by their first user message.
- Permission dialog: bordered, shows the tool name and a readable detail (command, path, or pattern); write/edit tools also show a dry-run diff before approval. `y` allows once, `a` remembers the tool for the session, `n` denies. The gate lives in `packages/tui/src/permission-gate.ts`; previews come from the tool's optional `preview` method.
- Provider/model pickers with type-to-filter search, `Esc` to clear or return, and per-provider API keys.
- A pure timeline reducer in `packages/tui/src/timeline.ts`.
- Formatting in `packages/tui/src/render.ts`: tool headers, `⎿` output, diff coloring, markdown, and the expanded transcript line buffer.
- Presentational components in `packages/tui/src/components/` (Transcript, Picker, Prompt, Input, SlashMenu, PermissionPrompt); `index.tsx` stays the state machine and event wiring.
- A cursor-aware input (`components/Input.tsx` plus pure `input.ts`): horizontal and vertical scrolling, readline keys, forward delete, and multi-line entry when the terminal reports modifiers.
- `Ctrl+R` history search, `@file` completion, workspace/git status, and Ink `kittyKeyboard` auto mode.

## Rendering contract

The TUI is an inline Ink app:

- `<Static>` owns committed transcript items and prints each once; never mutate a committed item.
- The live area below it renders the streaming assistant item, running tools, queued notices, spinner, menus, permission dialog, and prompt.
- Every rendered line must be truncated or pre-wrapped so the terminal cannot auto-wrap. Terminal scrollback is the scrollback; do not replace it with a fixed-height viewport.
- The expanded `Ctrl+O` transcript is the only scrolling viewport and is rendered on demand.
- Permission dialogs, pickers, and the provider setup screens may use borders, but the main transcript and prompt do not.

## What OpenContinue does not copy yet

- The custom Ink renderer fork, `ScrollBox`, and OpenTUI/Solid.
- Vim mode, themes marketplace, output styles, voice, images, multi-agent panes, plugin UI.
- A generated component/design-system package.

The current TUI uses upstream Ink so the team can keep upgrading it. We copy the **interaction model and visual hierarchy**, not the renderer code.

## Next slices

1. Inline code styling and syntax highlighting for fenced code.
2. A typed `packages/client` so the TUI talks to the server instead of running the runtime in-process.
3. Optional OpenTUI evaluation if Ink becomes the limiting factor.
