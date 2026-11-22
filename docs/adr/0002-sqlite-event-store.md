# 0002 — SQLite event store

- Status: accepted
- Date: 2026-11-22
- Milestone: M3

## Context

Sessions must survive a process restart and an interrupted run must be visible after recovery. The in-memory store loses both.

## Decision

Use the built-in `node:sqlite` module and a single append-only `events` table.

- Database: `<workspace>/.opencontinue/sessions/sessions.db`
- Override: `OPENCONTINUE_DB`
- Mode: WAL, foreign keys on
- Schema: `sessions(id, title, created_at, updated_at)` and `events(session_id, seq, type, at, payload)`
- Schema version: `PRAGMA user_version = 1`
- Event payloads are stored as JSON; projections read them in sequence order.
- On open, a `run.started` without a matching `run.completed`/`run.failed` is closed with `run.failed: Recovered after restart`.

## Consequences

- No native dependency and no build step; Node 22.5+ works (Node 22 prints an experimental warning).
- One writer per database. The current server is single-process; multi-process writers need a queue or a different store.
- Recovery cannot guarantee exactly-once tool side effects. It records the interruption and lets the user or a check decide what to re-run.
- Event shape evolution still requires the append-only rules from ADR 0001.

## Alternatives

- `better-sqlite3`: mature, but adds a native dependency and platform builds.
- `sql.js` (WASM): portable, but requires manual file persistence and is slower for this workload.
- Drizzle ORM: useful later; the current schema is small enough for prepared statements.
