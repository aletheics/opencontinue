# 0009 — Interrupted runs are runtime events

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

The TUI labeled a run "Interrupted" only when the local Esc key had set an
in-process flag before `run.failed` arrived. A remote abort, a server restart,
or another client's abort appeared as "Failed". That made the UI guess state
that the runtime already knew.

## Decision

- `run.failed` gains an optional `interrupted: boolean` field. The contract
  remains append-only.
- `runAgent` sets it when its `AbortSignal` is aborted.
- SQLite recovery sets it on runs closed after a restart.
- `projectMessages`, the TUI timeline, completion summary, and checkpoints read
  the field directly. The local `interruptedRef` is removed.
- Checkpoints may be `completed`, `failed`, or `interrupted`.
- A provider timeout is a failure, not an interruption, unless the run signal
  itself was aborted.

## Consequences

- Remote clients, resume, and replay show the same interrupted state.
- Older events without the field keep their previous "Failed" rendering.
- No new event type and no breaking schema change.

## Alternatives

- Match error text for "abort": brittle and language/implementation dependent.
- A separate `run.interrupted` event: more events for one boolean.
- Keep the TUI-local flag: wrong for remote and replayed runs.
