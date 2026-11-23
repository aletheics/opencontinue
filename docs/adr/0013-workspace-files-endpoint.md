# 0013 — Workspace files endpoint for remote clients

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

The TUI with `--url` shared sessions and runs over HTTP but still scanned its
local directory for `@file` completion. A remote client therefore completed
paths that the server could not read, and missed files that only exist beside
the server.

## Decision

- Add `GET /v1/workspace/files?directories=1&limit=N`, protected by the same
  local bearer token as every route.
- The server uses `listWorkspaceFiles` over its own workspace, with the same
  ignored directories and symlink policy as local completion.
- Add `WorkspaceFilesResponse` to the protocol.
- Add optional `workspaceFiles(options)` to `OpenContinueClient`.
  - `HttpSessionClient` calls the endpoint.
  - `LocalSessionClient` calls the in-process helper.
- The TUI uses `client.workspaceFiles` when connected with `--url`, otherwise
  the local helper.
- The endpoint is read-only and bounded to 5,000 entries.

## Consequences

- `@file` completion follows the active transport and cannot name paths the
  server does not have.
- The returned paths are display strings, not filesystem handles; content tools
  still run on the server through tool calls.
- No event or session contract change.

## Alternatives

- Keep local scanning for remote sessions: wrong workspace and a source of
  broken prompts.
- Send the full file list with each session: stale and expensive.
- A per-workspace API with multiple roots: future multi-workspace design.
