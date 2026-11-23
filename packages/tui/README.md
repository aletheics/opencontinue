# @opencontinue/tui

**Why:** a terminal client should be a package, not a mode inside the CLI.

**Owns:** provider picker, per-provider key prompt, model picker, streaming chat, permission prompt, session resume (generic sessions are labeled by their first prompt), Claude Code-style timeline (user/assistant/tool blocks), markdown-style assistant output (headings, lists, quotes, fenced code), collapsible tool output, colored diffs, token/time stats, spinner, cursor-aware multi-line input, `ctrl+r` history search, `@file` completion, workspace/git-branch status line, fixed header/body/input/footer.

**Files:** `index.tsx` owns state, screens, and event wiring; `components/` holds the fixed frame pieces (Header, Picker, Timeline, Prompt, Input, SlashMenu); `input.ts` holds pure editing and viewport math; `permission-gate.ts` bridges async authorization to the prompt; `render.ts` turns timeline items into a clipped line buffer (one terminal row per line); `timeline.ts` reduces session events; `theme.ts` holds color tokens.

**Public API:** `runTui`, `App`.

**Allowed imports:** config, core, protocol, providers, runtime, tools.

**Must not:** import `apps/cli` or `apps/server`.

**Keys:** type to filter providers or models; `esc` clears the filter or returns to chat; typing `/` opens a filterable command menu (`↑/↓` select, `Tab` complete, `Enter` run, `Esc` close); typing `@` opens workspace file completion (`↑/↓` select, `Tab`/`Enter` insert, `Esc` close); `ctrl+o` expands or collapses tool output and diffs; `shift+tab` cycles permission mode; `esc` aborts a run; `up`/`down` recall input history; `ctrl+r` opens a filterable history search (`↑/↓` select, `Enter` use, `Esc` cancel); `pgup`/`pgdn` scroll; `ctrl+d` exits when the input is empty. The input supports `left`/`right`, `home`/`end`, `delete`, `ctrl+a`/`ctrl+e`, `ctrl+u`/`ctrl+w`/`ctrl+k`, and multi-line entry with `shift+enter` (or `alt+enter`/`ctrl+enter` on terminals that report modifiers). A permission prompt shows the tool detail and, for writes/edits, a preview diff: `y` allows once, `a` allows that tool for the session, `n` denies.

**Slash commands:** `/help`, `/clear`, `/model`, `/provider`, `/resume`, `/mode`, `/status`, `/exit`.

**Tests:** `src/index.test.tsx` covers provider selection, type-to-filter pickers, slash-menu filtering and completion, key entry, session resume labels, the permission dialog with a preview diff, `ctrl+r` history search, `@file` completion, the workspace/git status line, the full provider → model → chat loop, and a fixed frame after repeated help output; `src/input.test.ts` covers cursor editing and viewport math; `src/permission-gate.test.ts` covers modes and per-session tool memory; `src/timeline.test.ts` covers tool/assistant interleaving, diffs, and usage; `src/render.test.ts` covers wrapping, markdown, diff colorization, output collapsing, and line clipping. The frame is fixed: one header, one body, one input box, one footer.

**Known gap:** it currently runs the runtime in-process. The target is `packages/client` over the server.
