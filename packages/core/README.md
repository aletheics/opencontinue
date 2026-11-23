# @opencontinue/core

**Why:** sessions must survive crashes and replay from any client.

**Owns:** append-only event store, projections, SQLite/memory implementations, session export/import, conversation forks, recovery, and schema validation of stored/imported events.

**Public API:** `SessionStore`, `MemorySessionStore`, `SqliteSessionStore`, `createSessionStore`, `draftOf` (strip an event envelope for replay). `fork(id, atSeq?, title?)` copies events through `atSeq` into a new session and leaves the source untouched.

**Allowed imports:** `@opencontinue/protocol`.

**Must not:** import server, runtime, TUI, or CLI.

**Tests:** `store.test.ts`, `sqlite.test.ts`.
