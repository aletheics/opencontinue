# @opencontinue/tui

**Why:** a terminal client should be a package, not a mode inside the CLI.

**Owns:** an inline Claude Code-style terminal UI: completed transcript written to terminal scrollback through Ink `Static`, `❯` prompts, `● Tool(args)` blocks, `⎿` output, colored diffs, compact output hints, `✻` thinking/completion lines, `⏵⏵` permission-mode line, queued messages, provider/model/session pickers, permission dialogs with preview diffs, markdown-style assistant output, cursor-aware multi-line input, `ctrl+r` history search, `@file` completion, and a workspace/git status line. There is no alternate screen and no bordered body/input.

**Files:** `index.tsx` owns state, screens, and event wiring; `components/` holds Transcript, Picker, Prompt, Input, SlashMenu, and PermissionPrompt; `input.ts` holds pure editing math; `permission-gate.ts` bridges async authorization to the dialog; `render.ts` formats inline tool blocks and the `ctrl+o` transcript; `timeline.ts` reduces session events; `theme.ts` holds color tokens.

**Public API:** `runTui`, `App`.

**Allowed imports:** config, core, protocol, providers, runtime, tools.

**Must not:** import `apps/cli` or `apps/server`.

**Keys:** type to filter providers or models; `esc` clears the filter or returns to chat; typing `/` opens a filterable command menu (`↑/↓` select, `Tab` complete, `Enter` run, `Esc` close); typing `@` opens workspace file completion (`↑/↓` select, `Tab`/`Enter` insert, `Esc` close); `ctrl+o` opens the full expanded transcript; `shift+tab` cycles permission mode; `esc` aborts a run; `up`/`down` recall input history; `ctrl+r` opens a filterable history search; `ctrl+d` exits when the input is empty. The input supports `left`/`right`, `home`/`end`, `delete`, `ctrl+a`/`ctrl+e`, `ctrl+u`/`ctrl+w`/`ctrl+k`, and multi-line entry with `shift+enter` (or `alt+enter`/`ctrl+enter` on terminals that report modifiers). Messages submitted while a run is active are queued. A permission dialog shows the tool detail and, for writes/edits, a preview diff: `y` allows once, `a` allows that tool for the session, `n` denies.

**Slash commands:** `/help`, `/clear`, `/model`, `/provider`, `/resume`, `/mode`, `/status`, `/exit`.

**Tests:** `src/index.test.tsx` covers provider selection, type-to-filter pickers, slash-menu filtering and completion, key entry, session resume labels, the permission dialog with a preview diff, `ctrl+r` history search, `@file` completion, the workspace/git status line, the full provider → model → chat loop, and repeated help output; `src/input.test.ts` covers cursor editing and viewport math; `src/permission-gate.test.ts` covers modes and per-session tool memory; `src/timeline.test.ts` covers tool/assistant interleaving, diffs, and usage; `src/render.test.ts` covers wrapping, markdown, tool headers, diff colorization, and output collapsing.

**Known gap:** it currently imports the runtime directly. `packages/client` and `packages/local-client` now implement the same contract; the next slice moves the TUI state machine onto `OpenContinueClient`.
