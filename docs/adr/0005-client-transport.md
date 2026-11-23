# 0005 — One session client, transport adapters

Status: accepted.

## Context

The CLI already spoke HTTP/SSE to the server, but that transport lived inside
`apps/cli`. The TUI ran the runtime in-process. A web client would have become a
third implementation. Every new client would re-learn replay cursors,
reconnects, permission decisions, and error handling.

OpenCode separates a public contract, a generated/client package, and server
transports. We adopt the separation, not the generated API surface.

## Decision

`packages/client` owns the session contract and the HTTP/SSE transport:

- request helpers for sessions, messages, permissions, and health;
- one subscription per session;
- replay from an exclusive `after` cursor;
- reconnect with the same cursor, no duplicate events;
- typed HTTP errors;
- a single close that aborts requests and subscriptions.

The interface is `OpenContinueClient`. `HttpSessionClient` is the first
transport. In-process and WebSocket transports can implement the same interface
without changing clients.

Dependency direction:

```text
apps/cli ──> packages/client ──> packages/protocol
apps/cli ──> apps/server ──> packages/runtime ──> packages/core
```

`packages/client` must not import the runtime, tools, provider adapters, store,
server, or TUI. It knows the wire, not how a run is executed.

## Consequences

- CLI session chat no longer owns SSE parsing or cursor state.
- The next client (TUI, web, desktop) depends on `client`, not `server`.
- Protocol changes remain a deliberate package change; clients do not silently
  depend on server internals.
- The TUI still needs an in-process adapter to keep startup cheap and offline
  use simple. That adapter lives in `packages/local-client`, behind the same
  interface, not in the wire transport package.
- Publishing can later expose `@opencontinue/client` and generated SDKs without
  exposing the runtime.

## Non-goals

- Generated OpenAPI clients in this slice.
- Authentication and multi-user authorization.
- Replacing the event store or runtime.
