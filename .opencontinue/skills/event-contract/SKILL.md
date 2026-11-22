---
name: event-contract
description: Use when adding or changing session events or protocol shapes.
---

# Event contract

The session event stream is the public contract.

Rules:

- Add new event types; do not rename or reuse existing ones.
- Every event has `sessionId`, `seq`, `at`, and `type`.
- Keep projections in `packages/core` and `apps/server/src/history.ts` in sync.
- A breaking change needs an ADR and a migration.
- Update `packages/protocol` and add a test that replays the new event.
- Do not put secrets or raw environment values into events.

Checklist:

1. Add the schema to `packages/protocol`.
2. Add the draft to `packages/core` `EventDraft`.
3. Update projections and history.
4. Add a test in `packages/core` or `apps/server`.
