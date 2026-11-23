# @opencontinue/core

**Why:** sessions must survive crashes and replay from any client.

**Owns:** append-only event store, projections, SQLite/memory implementations, session export/import, conversation forks, recovery, schema validation of stored/imported events, and a 5-second SQLite busy wait for multi-connection access.

**Public API:** `SessionStore`, `MemorySessionStore`, `SqliteSessionStore`, `createSessionStore`, `draftOf` (strip an event envelope for replay). `fork(id, atSeq?, title?)` copies events through `atSeq` into a new session and leaves the source untouched.

**Allowed imports:** `@opencontinue/protocol`.

**Must not:** import server, runtime, TUI, or CLI.

**Tests:** `store.test.ts`, `sqlite.test.ts`.
