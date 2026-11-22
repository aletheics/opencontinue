# @opencontinue/tui

**Why:** a terminal client should be a package, not a mode inside the CLI.

**Owns:** provider picker, per-provider key prompt, model picker, streaming chat, permission prompt, session resume, Claude Code-style timeline (user/assistant/tool blocks), collapsible tool output, colored diffs, token/time stats, spinner, fixed header/body/input/footer.

**Public API:** `runTui`, `App`.

**Allowed imports:** config, core, protocol, providers, runtime, tools.

**Must not:** import `apps/cli` or `apps/server`.

**Keys:** `ctrl+o` expands or collapses tool output and diffs; `ctrl+c` exits; `/exit` quits chat.

**Tests:** `src/index.test.tsx` covers provider selection, key entry, and the full provider → model → chat loop; `src/timeline.test.ts` covers tool/assistant interleaving, diffs, and usage. The frame is fixed: one header, one body, one input box, one footer.

**Known gap:** it currently runs the runtime in-process. The target is `packages/client` over the server.
