# Dependency Rules

The boundary is enforced by [`scripts/validate-boundaries.test.ts`](../../scripts/validate-boundaries.test.ts). `npm test` fails when a package imports something it must not.

## Rule table

| From | May import | Must not import |
|---|---|---|
| `protocol` | external only | any internal package |
| `config` | external only | any internal package |
| `core` | `protocol` | server, clients, runtime |
| `providers` | external only | core, runtime, clients |
| `tools` | `providers` | core runtime, clients |
| `runtime` | `protocol`, `core`, `providers`, `tools` | server, CLI, TUI |
| `tui` | `config`, `core`, `protocol`, `providers`, `runtime`, `tools` | server, CLI |
| `server` | `config`, `core`, `protocol`, `providers`, `runtime`, `tools` | CLI, TUI |
| `cli` | any package and `apps/server` | none (entrypoint) |

## Why these directions

- `protocol` and `config` are leaves. Everyone may depend on them; they depend on no one.
- `core` owns state. It does not know about HTTP or clients.
- `providers` and `tools` are capabilities. They do not know about sessions or the agent loop.
- `runtime` composes core, providers, and tools. It does not know how it is transported.
- `server` is an adapter. It may use the runtime but not a client.
- `tui` is a client. It may use config and runtime today; the target is a typed `packages/client`.
- `cli` is an entrypoint. It composes everything but owns no reusable domain logic.

## Public API

Each package has one public entry (`exports` in `package.json`). Deep imports such as `@opencontinue/core/src/...` are not allowed. Add a named export instead.

## Evolving the graph

- A new capability used by two clients becomes a package.
- A new client becomes an app and depends on `client`, not on `runtime` or `server`.
- A new provider is data in `packages/providers/src/catalog.ts`, not a new package.
- A new transport is a new adapter package (`server`, `client`) and an ADR.

## Next boundary

The TUI currently runs `runtime` in-process. The next slice introduces `packages/client`:

```
apps/cli ──> packages/tui ──> packages/client ──> protocol
    └──> apps/server ──> packages/runtime
```

`packages/client` owns HTTP/SSE, retries, and session resume. `packages/tui`, `apps/web`, and `apps/desktop` become thin clients. This also makes cross-client continuity a protocol feature instead of a per-client implementation.
