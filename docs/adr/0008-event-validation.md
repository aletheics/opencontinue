# 0008 — Validate stored and imported events

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

SQLite event payloads were parsed as `SessionEvent` with no validation, and
session import trusted arbitrary JSON. A malformed event could reach a
projection, crash a client, or inject an unknown shape into replay.

## Decision

- `SessionEvent` remains the single protocol Zod schema.
- The SQLite store validates every payload on read and import before any row is
  written.
- Import also requires version 1, a UUID session id, parseable timestamps, at
  least one event, a `session.created` first event, and contiguous seq values
  from 0.
- A failed open closes the SQLite handle before rethrowing.
- The memory store applies the same import validation.
- No event shape changes; this is a runtime integrity check.

## Consequences

- Corrupt databases fail loudly on open instead of rendering a partial or
  invalid session. The database can be repaired or exported externally.
- An older build cannot read events written by a newer incompatible build; the
  append-only contract plus optional fields remains the compatibility rule.
- Validation adds a small parse cost on session load and import.

## Alternatives

- Skip invalid events: hides corruption and creates sequence gaps.
- Validate only imports: stored corruption still reaches projections.
- A database-level JSON schema: SQLite has no first-class schema validation for
  these payloads.
