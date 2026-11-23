# 0010 — "Always allow" is session-scoped

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

The permission card says "Always allow this tool for this session", but
`allowForSession` appended the tool to the broker's global policy. Approving a
tool in one session changed every other session handled by the same broker.

## Decision

- The broker keeps a `sessionId -> Set<tool>` allow map.
- `allowForSession(sessionId, tool)` only affects that session.
- Effective precedence stays: deny > project allow > session allow > explicit
  ask > read > auto.
- `getPolicy(sessionId)` merges the project allow list with that session's
  remembered tools; `getPolicy()` without an id reports project rules only.
- `health(sessionId?)` and the HTTP `?sessionId=` query expose the session view
  for `/permissions`.
- No protocol event or permission event shape changes.

## Consequences

- Approving "Always allow" in one session no longer widens another session.
- The mode remains broker-wide; only the remembered tool list is per session.
- A restart clears session allow lists, matching the "this session" wording.
- The session map is not persisted; it is rebuilt only by new approvals.

## Alternatives

- Persist allow rules in the session event log: stronger audit, but a larger
  contract change and a policy-replay design.
- Make every rule global and change the UI wording: contradicts the trust
  model and multi-session clients.
