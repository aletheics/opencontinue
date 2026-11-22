# @opencontinue/protocol

**Why:** every client and the server need one wire contract for sessions, events, permissions, and requests.

**Owns:** Zod schemas and inferred types for the public event and HTTP shapes.

**Public API:** `SessionEvent`, `SessionSnapshot`, `SessionSummary`, request schemas.

**Allowed imports:** external packages only.

**Must not:** import core, runtime, server, or clients.

**Tests:** covered by core/runtime/TUI tests; add a schema test when an event changes.
