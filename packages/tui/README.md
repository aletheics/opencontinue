# @opencontinue/tui

**Why:** a terminal client should be a package, not a mode inside the CLI.

**Owns:** an inline Claude Code-style terminal UI: saved-provider auto-start, a startup banner with logo, version, model/provider, workspace, and welcome line; completed transcript written to terminal scrollback through Ink `Static`, `❯` prompts, `● Tool(args)` blocks, `⎿` output, colored diffs, compact output hints, `✻` thinking/completion lines, `⏵⏵` permission-mode line, queued messages, provider/model/session pickers, permission dialogs with preview diffs, markdown-style assistant output, cursor-aware multi-line input, `ctrl+r` history search, `@file` completion, and a workspace/git status line. There is no alternate screen and no bordered body/input.

**Files:** `index.tsx` owns state, screens, and event wiring; `components/` holds Welcome, Transcript, Picker, Prompt, Input, SlashMenu, and PermissionPrompt; `composer/` holds pure slash, history, and `@file` logic plus the editor feature folder; `session/` holds transcript partitioning, labels, and workspace info; `providers/` holds picker filtering; `status/` holds token/duration formatting; `transcript/format/` has one formatter per concern (wrap, markdown, diff, tool, transcript); `timeline.ts` reduces session events; `theme.ts` holds color tokens.

**Public API:** `runTui`, `App`.

**Allowed imports:** client, local-client, config, core, protocol, providers, tools.

**Must not:** import `apps/cli` or `apps/server`.

**Keys:** type to filter providers or models; `esc` clears the filter or returns to chat; typing `/` opens a filterable command menu (`↑/↓` select, `Tab` complete, `Enter` run, `Esc` close); typing `@` opens workspace file completion (`↑/↓` select, `Tab`/`Enter` insert, `Esc` close); `ctrl+o` opens the full expanded transcript; `shift+tab` cycles permission mode; `esc` aborts a run; `up`/`down` recall input history; `ctrl+r` opens a filterable history search; `ctrl+d` exits when the input is empty. The input supports `left`/`right`, `home`/`end`, `delete`, `ctrl+a`/`ctrl+e`, `ctrl+u`/`ctrl+w`/`ctrl+k`, and multi-line entry with `shift+enter` (or `alt+enter`/`ctrl+enter` on terminals that report modifiers). Messages submitted while a run is active are queued. A permission dialog shows the tool detail and, for writes/edits, a preview diff: `y` allows once, `a` allows that tool for the session, `n` denies.

**Slash commands:** `/help`, `/clear`, `/model`, `/provider`, `/resume`, `/mode`, `/status`, `/exit`.

**Tests:** `src/index.test.tsx` covers provider selection, type-to-filter pickers, slash-menu filtering and completion, key entry, session resume labels, the permission dialog with a preview diff, `ctrl+r` history search, `@file` completion, the workspace/git status line, the welcome banner, the full provider → model → chat loop, and repeated help output; `src/composer/editor/*.test.ts` cover cursor editing and viewport math; `src/timeline.test.ts` covers tool/assistant interleaving, diffs, and usage; `src/transcript/format/*.test.ts` cover wrapping, markdown, tool headers, diffs, and transcript lines.

**Startup:** a saved provider/model with credentials opens chat directly; otherwise the provider picker runs. The startup banner is a durable transcript item, so `/clear` and `/resume` print a fresh banner.

**Transport:** the App uses `OpenContinueClient`. It defaults to `LocalSessionClient` from `@opencontinue/local-client`; `--url` selects `HttpSessionClient` and lets the server own provider/model/transcript state. It never calls `runAgent` or owns a permission gate.
