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

- Full-screen alternate buffer with one persistent frame.
- Fixed regions: header, scrollable timeline, input box, footer.
- Timeline blocks: user, assistant, tool, system; tool blocks show `●`/`✗`, `+N -M`, colored diffs, collapsed output.
- Token usage and elapsed time in the header.
- Keybindings:
  - `Ctrl+C` exit
  - `Ctrl+O` expand/collapse tool output and diffs
  - `Shift+Tab` cycle permission mode (`ask` → `auto` → `readonly`)
  - `Esc` abort the active run
  - `Up`/`Down` input history
  - `PgUp`/`PgDn` scroll the timeline
  - `Ctrl+D` exit when input is empty
- Slash commands: `/help`, `/clear`, `/model`, `/provider`, `/mode`, `/status`, `/exit`.
- Provider/model pickers and per-provider API keys inside the same frame.
- A pure timeline reducer in `packages/tui/src/timeline.ts`.

## What OpenContinue does not copy yet

- The custom Ink renderer fork, `ScrollBox`, and OpenTUI/Solid.
- Vim mode, themes marketplace, output styles, voice, images, multi-agent panes, plugin UI.
- A generated component/design-system package.

The current TUI uses upstream Ink so the team can keep upgrading it. We copy the **interaction model and visual hierarchy**, not the renderer code.

## Next slices

1. Split the TUI into `components/` (Header, Timeline, ToolBlock, InputBar, Pickers) and a `theme.ts`.
2. Multi-line input, input history search (`Ctrl+R`), `@file` completion.
3. Markdown rendering and collapsible context.
4. A typed `packages/client` so the TUI talks to the server instead of running the runtime in-process.
5. Optional OpenTUI evaluation if Ink becomes the limiting factor.
