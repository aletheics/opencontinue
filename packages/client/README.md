# @opencontinue/client

**Why:** every client needs one session contract and one SSE implementation, not a copy per app.

**Owns:** the typed session client interface, HTTP request helpers, run abort, SSE replay/reconnect, subscriber lifecycle, and server-workspace file listing for remote prompt completion. It knows the protocol, not the runtime, tools, provider, or database.

**Public API:** `OpenContinueClient`, `HttpSessionClient`, `SessionSubscription`, `ClientHttpError`.

**Allowed imports:** `protocol`.

**Must not:** import `core`, `runtime`, `providers`, `tools`, `server`, `tui`, or `cli`.

**Tests:** `src/index.test.ts` uses a local HTTP server to cover requests, SSE replay, reconnect, workspace files, and close.

The in-process adapter lives in `packages/local-client` behind the same interface.
