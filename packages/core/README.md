# @opencontinue/core

**Why:** sessions must survive crashes and replay from any client.

**Owns:** append-only event store, projections, SQLite/memory implementations, session export/import, recovery.

**Public API:** `SessionStore`, `MemorySessionStore`, `SqliteSessionStore`, `createSessionStore`.

**Allowed imports:** `@opencontinue/protocol`.

**Must not:** import server, runtime, TUI, or CLI.

**Tests:** `store.test.ts`, `sqlite.test.ts`.
