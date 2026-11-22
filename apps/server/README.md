# @opencontinue/server

**Why:** clients need an HTTP/SSE boundary over the runtime.

**Owns:** Hono routes, SSE replay/live delivery, permission endpoint, server lifecycle, provider resolution.

**Public API:** `startServer`, `createApp`, `closeServer`, `RunningServer`.

**Allowed imports:** config, core, protocol, providers, runtime, tools.

**Must not:** import CLI or TUI.

**Tests:** route tests are the next gap; runtime behavior is covered by `packages/runtime`.
