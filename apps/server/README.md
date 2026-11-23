# @opencontinue/server

**Why:** clients need an HTTP/SSE boundary over the runtime.

**Owns:** Hono routes, local bearer-token auth and origin policy, SSE replay/live delivery with heartbeats, session-scoped permission decisions, server-workspace file listing for remote clients, server lifecycle, provider resolution.

**Public API:** `startServer`, `createApp`, `closeServer`, `RunningServer`.

**Allowed imports:** config, core, protocol, providers, runtime, tools.

**Must not:** import CLI or TUI.

**Tests:** `src/security.test.ts` covers tokens/origins, `src/event-stream.test.ts` covers replay gaps, and `apps/cli/src/e2e.test.ts` exercises the HTTP/SSE contract.
