# Dependency Rules

The boundary is enforced by [`scripts/validate-boundaries.test.ts`](../../scripts/validate-boundaries.test.ts). `npm test` fails when a package imports something it must not.

## Rule table

| From | May import | Must not import |
|---|---|---|
| `protocol` | external only | any internal package |
| `config` | external only | any internal package |
| `client` | `protocol` | core, runtime, providers, tools, server, apps |
| `local-client` | `client`, `protocol`, `core`, `runtime`, `providers`, `tools` | server, tui, cli, apps |
| `core` | `protocol` | server, clients, runtime |
| `providers` | external only | core, runtime, clients |
| `tools` | `providers` | core runtime, clients |
| `runtime` | `protocol`, `core`, `providers`, `tools` | server, CLI, TUI |
| `tui` | `client`, `local-client`, `config`, `core`, `protocol`, `providers`, `runtime`, `tools` | server, CLI |
| `server` | `config`, `core`, `protocol`, `providers`, `runtime`, `tools` | CLI, TUI |
| `cli` | any package, `packages/local-client`, and `apps/server` | none (entrypoint) |

## Why these directions

- `protocol` and `config` are leaves. Everyone may depend on them; they depend on no one.
- `client` owns the wire contract in practice: replay cursor, reconnect, subscription lifecycle. It knows protocol, not how a run executes.
- `local-client` is the in-process adapter. It may compose the runtime and tools, but no client or app may depend on it for wire semantics.
- `core` owns state. It does not know about HTTP or clients.
- `providers` and `tools` are capabilities. They do not know about sessions or the agent loop.
- `runtime` composes core, providers, and tools. It does not know how it is transported.
- `server` is an adapter. It may use the runtime but not a client.
- `tui` is a client. It may use `client`; the remaining direct runtime imports are the in-process adapter gap.
- `cli` is an entrypoint. It composes everything but owns no reusable domain logic.

## Public API

Each package has one public entry (`exports` in `package.json`). Deep imports such as `@opencontinue/core/src/...` are not allowed. Add a named export instead.

## Evolving the graph

- A new capability used by two clients becomes a package.
- A new client becomes an app and depends on `client`, not on `runtime` or `server`.
- A new provider is data in `packages/providers/src/catalog.ts`, not a new package.
- A new transport is a new adapter package (`server`, `client`) and an ADR.

## Next boundary

`packages/client` now owns HTTP/SSE, replay, reconnect, and subscription lifecycle. The CLI uses it. The remaining boundary is the TUI's in-process adapter:

```
apps/cli ──> packages/tui ──> packages/client ──> protocol
    │             └────────> packages/local-client ──> packages/runtime
    └──> apps/server ──> packages/runtime
```

The in-process adapter now exists as `packages/local-client`. Next, the TUI should consume `OpenContinueClient` and choose `LocalSessionClient` or `HttpSessionClient`; `apps/web` and `apps/desktop` use the HTTP client directly. Cross-client continuity becomes a protocol feature instead of a per-client implementation.
