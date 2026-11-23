# @opencontinue/tui

**Why:** a terminal client should be a package, not a mode inside the CLI.

**Owns:** provider picker, per-provider key prompt, model picker, streaming chat, permission prompt, session resume, Claude Code-style timeline (user/assistant/tool blocks), collapsible tool output, colored diffs, token/time stats, spinner, fixed header/body/input/footer.

**Files:** `index.tsx` owns screens, input, and the fixed frame; `render.ts` turns timeline items into a clipped line buffer (one terminal row per line); `timeline.ts` reduces session events; `theme.ts` holds color tokens.

**Public API:** `runTui`, `App`.

**Allowed imports:** config, core, protocol, providers, runtime, tools.

**Must not:** import `apps/cli` or `apps/server`.

**Keys:** type to filter providers or models; `esc` clears the filter or returns to chat; `ctrl+o` expands or collapses tool output and diffs; `shift+tab` cycles permission mode; `esc` aborts a run; `up`/`down` recall input history; `pgup`/`pgdn` scroll; `ctrl+d` exits when the input is empty.

**Slash commands:** `/help`, `/clear`, `/model`, `/provider`, `/mode`, `/status`, `/exit`.

**Tests:** `src/index.test.tsx` covers provider selection, type-to-filter pickers, key entry, the full provider → model → chat loop, and a fixed frame after repeated help output; `src/timeline.test.ts` covers tool/assistant interleaving, diffs, and usage; `src/render.test.ts` covers wrapping, diff colorization, output collapsing, and line clipping. The frame is fixed: one header, one body, one input box, one footer.

**Known gap:** it currently runs the runtime in-process. The target is `packages/client` over the server.
