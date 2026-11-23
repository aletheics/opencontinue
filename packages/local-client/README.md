# @opencontinue/local-client

**Why:** the TUI and offline embedders should use the same `OpenContinueClient` contract as HTTP clients, without starting a daemon.

**Owns:** the in-process adapter: local `SessionStore`, `runAgent`, `PermissionBroker`, replayed and live subscriptions, and local session lifecycle. It owns no HTTP, CLI, or UI.

**Public API:** `LocalSessionClient`, `LocalClientOptions`.

**Allowed imports:** `client` (contract), `protocol`, `core`, `runtime`, `providers`, `tools`.

**Must not:** import `server`, `tui`, `cli`, or any app. It does not own a daemon or network transport.

**Behavior:**
- `subscribe` replays durable events after the cursor, subscribes, then catches up the gap. Duplicates are filtered by sequence.
- `sendMessage` appends the user event and starts `runAgent`; run failures are durable events, not thrown requests.
- Permissions flow through `PermissionBroker`, including `detail` and preview `diff` on `permission.requested`.
- `close` releases subscriptions. The caller owns the store.

**Tests:** `src/index.test.ts` covers replay, live runs, session listing, and permission resolution.
