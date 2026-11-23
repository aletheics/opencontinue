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
- Provider/model pickers with type-to-filter search, `Esc` to clear or return, and per-provider API keys inside the same frame.
- A pure timeline reducer in `packages/tui/src/timeline.ts`.
- A line-buffer renderer in `packages/tui/src/render.ts`: timeline items become styled lines, long text wraps to the content width, and the viewport slices by line so scrolling and clipping are exact.
- Presentational components in `packages/tui/src/components/` (Header, Picker, Timeline, Prompt); `index.tsx` stays the state machine and event wiring.

## Rendering contract

The frame must occupy exactly the terminal height. Every text line is one terminal row:

- header: fixed 3 rows, truncated
- body: fixed height, one `<Text wrap="truncate">` per buffered line
- input: fixed 3 rows, width-constrained
- footer: fixed 1 row, truncated

This avoids Ink diff desync caused by terminal auto-wrap and variable-height nested boxes. Scrolling is measured in lines, not timeline items.

## What OpenContinue does not copy yet

- The custom Ink renderer fork, `ScrollBox`, and OpenTUI/Solid.
- Vim mode, themes marketplace, output styles, voice, images, multi-agent panes, plugin UI.
- A generated component/design-system package.

The current TUI uses upstream Ink so the team can keep upgrading it. We copy the **interaction model and visual hierarchy**, not the renderer code.

## Next slices

1. Multi-line input, input history search (`Ctrl+R`), `@file` completion.
2. Markdown rendering and collapsible context.
3. A typed `packages/client` so the TUI talks to the server instead of running the runtime in-process.
4. Optional OpenTUI evaluation if Ink becomes the limiting factor.
