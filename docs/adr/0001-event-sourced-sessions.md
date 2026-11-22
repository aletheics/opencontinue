# 0001 — Event-sourced sessions

- Status: accepted
- Date: 2026-11-22
- Milestone: M0

## Context

Clients must resume work, replay a run, and inspect what happened after a crash. A mutable transcript makes those properties special cases.

## Decision

Every session is an append-only event stream with a monotonically increasing `seq`. Reads are projections. Clients replay from any sequence number.

The current store is in memory. M3 replaces it with SQLite behind the same interface.

## Consequences

- Resume, multi-client continuity, audit, and crash recovery share one mechanism.
- Event shapes are a public contract and must remain append-only.
- Some UI state must be derived from projections rather than stored directly.

## Alternatives

- Mutable message arrays with periodic snapshots: simpler, but replay and recovery become separate code paths.
- A database-first design with no event log: faster to start, weaker audit and replay story.
