# 0006 — Local server authentication and origin policy

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

The HTTP/SSE server can start agent runs, approve permissions, and execute local
tools. It previously accepted every request and enabled CORS for every origin.
Any browser page could therefore list sessions, send prompts, approve prompts,
and drive shell commands on `127.0.0.1`.

## Decision

- Every HTTP request requires `Authorization: Bearer <token>`.
- The token is `StartServerOptions.token`, then `OPENCONTINUE_SERVER_TOKEN`,
  otherwise a fresh random token per process.
- `serve` and `apps/server/main.ts` print the token once; embedded CLI/TUI
  clients receive it from `RunningServer.token`.
- CORS is denied by default. Same-host browser requests and exact origins in
  `StartServerOptions.cors` pass; `*` is never accepted.
- The server still binds `127.0.0.1` by default.
- No public event or protocol shape changes; this is an HTTP transport policy.

## Consequences

- `opencontinue --url` and `opencontinue sessions --url` need `--token` or
  `OPENCONTINUE_SERVER_TOKEN`. Embedded clients do not.
- Rotating the token requires restarting the server; there are no sessions or
  user accounts.
- This protects loopback from web pages, not from a local process running as
  the same user. It is not a multi-user authorization system.
- A future web client can add a sign-in/cookie flow on top of the same token
  check.

## Alternatives

- No auth, but reject `Origin` only: stops browser reads, not form/CSRF or
  non-browser local callers.
- Unix-socket only: strong local boundary, but the web client and Windows need
  an HTTP endpoint.
- Full password/session auth from OpenCode: more than a single-user local
  server needs today.
