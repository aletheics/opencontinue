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

- **Inline OpenContinue transcript**, not a full-screen dashboard. The startup header is two compact lines: `◈ OpenContinue  v0.0.1`, then `model · provider · workspace-basename · branch` in display-cell width. Lower-priority metadata drops on narrow terminals; the full workspace path is in `/status`. The tagline appears only on the first-run provider picker. A saved provider/model auto-starts chat.
- The status line always names the active execution mode. Completed items are written once to terminal scrollback through Ink `<Static>`; only the live tail, spinner, and prompt repaint.
- No header bar, no bordered transcript, no bordered input, no bordered permission prompt. Modal screens (provider/model/session pickers, setup) may use separation, but the chat surface stays borderless.
- Task panel: the model maintains a `todo` list (read capability, no approval). The TUI projects the newest valid list above the prompt as `◈ Tasks · done/total`, with `✓` completed (green), `▸` in progress (working blue), and `○` pending (dim). Todo tool calls are not rendered as transcript blocks; the panel survives run completion and is rebuilt from the durable timeline on resume.
- Tool blocks: `↳ Tool(args)` with wrapped continuation indented two spaces, dim `⎿` gutters with normal-brightness output, colored diff lines, and `… +N lines (ctrl+o to expand)`. Done tools with no output show `⎿ (No output)`. Bash adds `⎿ (timeout 2m)` and, after a `cd`, `⎿ Shell cwd was reset to <workspace>`.
- User prompts: `› text` with two-space continuation. Assistant blocks use a white `●` dot followed by a two-column content area: continuation lines indent two spaces, headings are bold white, list items use `-` or `1.` with hanging indents, quotes use `▎`, and rules render as `---`. Inline markdown becomes colored spans: code is blue (`#5769F7`), bold, italic, strikethrough, and links are styled, and wrapped lines keep their span styling. Fenced code renders without a border or language label, using a small highlight.js-style tokenizer: keywords cyan, strings green, numbers magenta, comments gray, literals yellow, calls blue. Code hard-wraps at the display width instead of at spaces.
- Activity line: `◈ Running command · 39s · 1.8k tokens · High`, with a dim `  ⎿  Tip: …` line below. The label comes from the running tool (`Reading files`, `Searching files`, `Editing`, `Running command`) or the model-authored in-progress todo; it is never a random verb. Before the first token it reads `Waiting for model`, then `Responding`. A running tool uses its own `tool.started` timestamp. Progress thresholds: active under 10s (amber), delayed at 10s (`· still working`, copper), stalled at 30s (`Still waiting — no recent activity`, error red). Thresholds are configurable with `OPENCONTINUE_DELAYED_MS` / `OPENCONTINUE_STALLED_MS`. A long wait is never labeled `Failed`; actual failures come only from `run.failed`, and `Esc` interruptions show `■ Interrupted`. The `◈` glyph uses a restrained 800ms copper pulse; `OPENCONTINUE_REDUCED_MOTION=1` disables it and `OPENCONTINUE_ASCII=1` falls back to `O`.
- Completion summary: `✓ Completed in 3.2s · 16:01`, then an evidence line from the run's tool results (`2 files changed · 3 commands (1 failed)`), then `◆ Checkpoint saved`. Internal event seqs are not shown in normal mode. Failed runs use `× Failed in …` but still report changes, commands, and the checkpoint. `/diff` shows `git status --short` plus `git diff --stat` for the working tree. `/checkpoints` lists the current session's run boundaries, newest first, with clock time, duration, and completed/failed status. Resuming a session prints `◆ Restored session · N events` before the replayed transcript.
- Footer: active mode first (`◈ Confirm`, `◎ Plan`, `⟳ Auto`), then the git branch when it fits; busy adds `esc to interrupt`. The right side shows non-default reasoning effort and `? help` while idle. Model, elapsed time, and tokens are not repeated in the footer; elapsed/tokens stay on the working spinner. `status/footer.ts` drops reasoning, then help, then truncates the left side, so low-priority fields never clip the mode. `shift+tab` is documented in `?` help instead of occupying the footer. Mode cycling succeeds through the client, then saves the choice in `~/.opencontinue/config.json`; startups resolve explicit flags → saved preference → project config → Confirm, and `health()` syncs the displayed mode from the runtime.
- Reasoning effort is provider-aware. `health()` reports the effective level and the levels the active provider/model supports; `Shift+R` (empty prompt) or `/reasoning` cycles them, saves the preference, and posts through the client. OpenAI o-series/GPT-5/GPT-6 advertise `reasoning_effort`; Claude 3.7/4/5 models advertise extended-thinking budgets. `Auto` omits the parameter; unsupported providers hide the control and `/reasoning` explains why. Anthropic thinking text stays private; signed blocks are preserved across tool steps.
- The streaming assistant is split like Claude Code's `StreamingMarkdown`: complete lines above the current partial line are committed to scrollback through `Static`, while only the unfinished tail stays live. The commit boundary always ends a line and never cuts a fenced block or inline code. This keeps early output visible instead of hiding it until the run ends, and the full message is never reprinted when the run completes. Resume and `ctrl+o` read the durable full message, not the display chunks.
- Slash, file, and history menus render below the prompt. File completion uses a `+ path` list and includes directories with the platform separator (`.github\` on Windows); completing a directory keeps the menu open at the trailing slash. Slash completion uses name/description columns.
- Prompt input submitted while a run is active is queued and sent when the run finishes.
- Keybindings:
  - `Ctrl+C` exit
  - `Ctrl+O` open/close the expanded transcript view
  - `Shift+Tab` cycle execution mode (`Plan` → `Confirm` → `Auto`; starts at `Confirm`)
  - `Shift+R` cycle reasoning effort when the input is empty and the provider advertises levels
  - `?` show help when the input is empty
  - `Esc` abort the active run
  - `Up`/`Down` input history
  - `Ctrl+D` exit when input is empty
  - Terminal scrollback handles normal scrolling; the transcript view adds `↑/↓` and `PgUp`/`PgDn`.
- Slash commands: `/help`, `/clear`, `/model`, `/provider`, `/resume`, `/mode`, `/reasoning`, `/diff`, `/checkpoints`, `/rewind`, `/permissions`, `/status`, `/exit`.
- `/rewind` opens a checkpoint picker (newest first) and forks the conversation through the chosen event seq into a new session. The runtime `SessionStore.fork` copies events and leaves the source session untouched; the working tree is not restored, and the picker says so. HTTP exposes the same operation at `/v1/sessions/:id/fork`.
- `/permissions` reads `health()` and prints the effective mode plus the runtime broker's allow/ask/deny lists, including tools remembered with `a` during the session. It is inspection only; editing rule files stays a manual, source-controlled action.
- Slash menu above the prompt: borderless, filters as you type, `↑/↓` selects, `Tab` completes, `Enter` runs, `Esc` closes.
- Session picker via `/resume`: sorted by recency, type-to-filter by title or id, `Esc` returns to chat. Sessions with the generic default title are labeled by their first user message.
- Permission card: inline, titled `? Permission required`, with the exact operation and target (command, path, or pattern), the working directory for bash, and a dry-run diff for write/edit before approval. `y` allows once, `a` asks the runtime broker to remember the tool for the session, `n` denies. The runtime `PermissionBroker` is the authorization source of truth; the TUI never re-implements Plan/Confirm/Auto policy. Previews come from the tool's optional `preview` method.
- Provider/model pickers with type-to-filter search, `Esc` to clear or return, and per-provider API keys.
- A pure timeline reducer in `packages/tui/src/timeline.ts`.
- Formatting in `packages/tui/src/transcript/format/`: one file each for wrapping, markdown, diffs, tool headers/output, and transcript lines.
- Presentational components in `packages/tui/src/components/` (Transcript, Picker, Prompt, Input, SlashMenu, PermissionPrompt); `index.tsx` stays the state machine and event wiring.
- A cursor-aware input (`components/Input.tsx` plus pure `input.ts`): horizontal and vertical scrolling, readline keys, forward delete, and multi-line entry when the terminal reports modifiers.
- `Ctrl+R` history search, `@file` completion, workspace/git status, and Ink `kittyKeyboard` auto mode.

## Module layout

The TUI follows OpenCode's feature-folder rule: one concern per folder, pure decisions separate from Ink.

```text
packages/tui/src/
  composer/        slash commands, history search, @file mentions, editor actions/view
  session/         transcript partition, session labels, workspace info
  providers/       provider/model picker filtering
  permissions/     approval decision and prompt controller
  hooks/           terminal integration hooks
  status/          token and duration formatting
  components/      presentational Ink components
  transcript/format/  wrap, markdown, diff, tool, transcript lines
  timeline.ts      durable event -> timeline reducer
  index.tsx        state machine and event wiring
```

A folder's README states why it exists. New pure logic goes beside its test in a feature folder before it is wired into `index.tsx`.

## Rendering contract

The TUI is an inline Ink app:

- `<Static>` owns committed transcript items and prints each once; never mutate a committed item.
- The live area below it renders only the unfinished streaming tail, running tools, queued notices, spinner, menus, permission card, and prompt. Completed streamed lines are in scrollback.
- Every rendered line must be truncated or pre-wrapped so the terminal cannot auto-wrap. Wrapping measures terminal display width, so CJK and fullwidth characters count as two columns, and it breaks at spaces before hard-splitting a long word. Terminal scrollback is the scrollback; do not replace it with a fixed-height viewport.
- The expanded `Ctrl+O` transcript is the only scrolling viewport and is rendered on demand.
- The permission prompt is an inline card, matching the transcript. Picker and setup screens stay borderless.

## What OpenContinue does not copy yet

- The custom Ink renderer fork, `ScrollBox`, and OpenTUI/Solid.
- Vim mode, themes marketplace, output styles, voice, images, multi-agent panes, plugin UI.
- A generated component/design-system package.

The current TUI uses upstream Ink so the team can keep upgrading it. We copy the **interaction model and visual hierarchy**, not the renderer code.

## Next slices

1. Thinking blocks (`Thought for Ns`) once the runtime emits reasoning events.
2. Richer shell metadata (elapsed time, background tasks).
3. Optional OpenTUI evaluation if Ink becomes the limiting factor.
