# 0014 — Malformed-event diagnostics, BOM, and SQLite busy wait

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

Three small reliability gaps surfaced in the audit:

- The HTTP client silently skipped malformed SSE frames, or reconnected without
  explaining why.
- JSON config files written by Windows editors can start with a UTF-8 BOM; the
  strict parser ignored the whole file.
- SQLite had no busy timeout, so a second process/connection could fail with
  `SQLITE_BUSY` immediately.

## Decision

- `HttpSessionClient` accepts an optional `onEventProblem` callback. Invalid
  JSON and invalid session-event payloads are reported and skipped; the stream
  stays open instead of reconnecting.
- The TUI reports the first such problem as a system transcript line per
  remote session.
- Config, auth, and project config readers strip a leading UTF-8 BOM.
- SQLite sets `PRAGMA busy_timeout = 5000` by default; the constructor and
  `createSessionStore` accept `busyTimeoutMs`.
- No protocol event change.

## Consequences

- A protocol mismatch is visible instead of silent.
- BOM-prefixed files behave like plain UTF-8 files.
- Concurrent connections wait up to five seconds instead of failing
  immediately; the value is configurable for tests or tight shutdown paths.
- Busy waiting is not a substitute for a multi-writer queue.

## Alternatives

- Fail the subscription on any malformed frame: one bad frame would take down a
  live session.
- Strip BOMs only in one reader: the same file could parse differently by path.
- Infinite busy wait: risks a stuck CLI; five seconds is a bounded default.
