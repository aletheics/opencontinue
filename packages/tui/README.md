# @opencontinue/tui

**Why:** a terminal client should be a package, not a mode inside the CLI.

**Owns:** provider picker, per-provider key prompt, model picker, streaming chat, permission prompt, session resume.

**Public API:** `runTui`, `App`.

**Allowed imports:** config, core, providers, runtime, tools.

**Must not:** import `apps/cli` or `apps/server`.

**Tests:** `src/index.test.tsx` covers provider selection, key entry, and the full provider → model → chat loop.

**Known gap:** it currently runs the runtime in-process. The target is `packages/client` over the server.
