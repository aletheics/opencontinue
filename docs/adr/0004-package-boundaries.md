# 0004 — Package boundaries

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

The first TUI lived inside `apps/cli`, and the agent loop lived inside `apps/server`. That made the TUI depend on the CLI, and made the runtime depend on HTTP. A second client (web or desktop) would copy or bypass those boundaries.

OpenCode solves this with applications that compose packages, a runtime independent of transport, and clients that speak a protocol instead of importing a server.

## Decision

Adopt the same direction:

- `packages/protocol`, `config`, `client`, `core`, `providers`, `tools`, `runtime`, `tui`
- `apps/cli` is an entrypoint; `apps/server` is an HTTP/SSE adapter
- packages never import applications
- clients never import the server
- the provider catalog is data, not one package per provider
- `scripts/validate-boundaries.test.ts` enforces the graph in CI

See [folders.md](../architecture/folders.md) and [dependency-rules.md](../architecture/dependency-rules.md).

## Consequences

- The TUI can be tested without the CLI.
- The runtime can be used by checks, the server, and future clients.
- Adding a provider is a catalog entry plus a transport, not a new package.
- Every boundary is visible and enforceable.
- `packages/client` now owns the HTTP/SSE session contract; the CLI uses it.
- The current TUI still runs the runtime in-process. The next slice puts the in-process adapter and HTTP transport behind the same client interface for TUI, web, and desktop.

## Alternatives

- Keep the TUI in `apps/cli`: fewer folders, but a second client would duplicate or bypass it.
- One package per provider (OpenCode's route-level detail): powerful, but too much surface for this stage. The catalog covers the same providers with one adapter.
- A single application package: fastest to start, but impossible to keep cohesive as clients grow.
