# Folder Map

Every folder has one owner and one reason to exist. If a file does not fit its folder's job, move it or create a new folder with an ADR.

## Dependency direction

```
apps/cli ──> packages/tui
    │             │
    └──> apps/server ──> packages/runtime ──> packages/core
                              │                    │
                              ├──> packages/providers
                              └──> packages/tools

packages/config is a leaf used by clients and the runtime.
packages/protocol is a leaf used by core and server.
```

Apps can compose packages. Packages never import apps. The boundary test enforces this.

## Applications

| Folder | Why it exists | What belongs | Public surface | Allowed imports | Must not |
|---|---|---|---|---|---|
| `apps/cli` | User-facing command entrypoint | command parsing, checks command composition, imports, setup | `opencontinue` / `onc` binary | all packages, `apps/server`, `packages/tui` | domain logic that another client needs |
| `apps/server` | HTTP/SSE adapter over the runtime | routes, SSE, auth of local requests, server lifecycle | `startServer`, `createApp`, `closeServer` | config, core, protocol, providers, runtime, tools | CLI or TUI imports |

`apps/cli` is an entrypoint, not a library. If a feature is useful to the web or desktop client, it belongs in a package.

## Packages

| Folder | Why it exists | What belongs | Public surface | Allowed imports | Must not | Tests |
|---|---|---|---|---|---|---|
| `packages/protocol` | One wire contract for every client | event schemas, request/response schemas | Zod schemas, event types | external only | core, server, clients | schema tests when events change |
| `packages/config` | Local provider config and credentials | `~/.opencontinue` config/auth, env precedence | load/save/resolve functions | external only | core, server, clients | `index.test.ts` |
| `packages/core` | Durable session state | event store, projections, SQLite/memory | `SessionStore`, `createSessionStore` | protocol | server, clients, runtime | `store.test.ts`, `sqlite.test.ts` |
| `packages/providers` | Model transport and provider catalog | provider presets, OpenAI-compatible SSE, native Anthropic | `createProvider`, `listModels`, `PROVIDER_PRESETS` | external only | core, runtime, clients | `provider.test.ts`, `catalog.test.ts`, `sse.test.ts` |
| `packages/tools` | Local capabilities and policy gate | read/write/edit/glob/grep/bash, tool registry | tools, `ToolRegistry`, `PermissionGate` | providers | core runtime, clients | `index.test.ts` |
| `packages/runtime` | The agent loop, independent of transport | `runAgent`, history projection, permissions, project context | `runAgent`, `PermissionBroker`, `loadProjectConfig` | protocol, core, providers, tools | server, CLI, TUI | `agent.test.ts`, `permissions.test.ts`, `project.test.ts` |
| `packages/tui` | A client that happens to render in a terminal | Ink screens, model picker, permission prompt | `runTui`, `App` | config, core, protocol, providers, runtime, tools | `apps/cli`, `apps/server` | `index.test.tsx`, `timeline.test.ts` |

## Repository-level folders

| Folder | Why it exists | What belongs | Must not |
|---|---|---|---|
| `.opencontinue` | Project-level AI constraints | runtime rules, check agents, commands, skills | secrets or generated sessions |
| `actions/check` | CI entrypoint for checks | composite action, PR comment script | product logic |
| `docs` | Decisions and operating knowledge | architecture, providers, ADRs, roadmap | transient notes |
| `image` | README assets | banner images | runtime assets |
| `scripts` | Repository validation | boundary checks, constraint checks | product code |

## Known gaps

These are deliberate next steps, not accidents:

1. **TUI runs the runtime in-process.** It should use a typed `packages/client` over the server, like the future web and desktop clients. This is the next boundary to fix.
2. **Checks live in `apps/cli`.** When checks need a web or CI UI, extract `packages/checks` with the worktree/patch domain.
3. **No web or desktop app yet.** When added, they are `apps/web` and `apps/desktop`, composed from `packages/client` and shared UI packages.
4. **No generated SDK yet.** `packages/protocol` is the source; a generated client/SDK comes with the `packages/client` slice.

## Adding a folder

1. Add a `README.md` with: why, owns, public API, allowed imports, must not, tests.
2. Update `scripts/validate-boundaries.test.ts` and `docs/architecture/dependency-rules.md`.
3. Add an ADR if the dependency direction changes.
4. Add the folder to this map.
