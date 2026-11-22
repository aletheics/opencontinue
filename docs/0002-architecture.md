# 0002 — Architecture

## Shape

```
clients: CLI / TUI / Web / Desktop / VS Code / CI
                     │
             OpenAPI + SSE
                     │
             server (Hono)
       sessions · permissions · checks
                     │
             core (event-sourced)
       agent loop · tools · providers · worktrees
                     │
             SQLite (node:sqlite)
```

## Decisions

### Event-sourced sessions

Every state change is an immutable event with a session ID and monotonic sequence:

- `session.created`
- `message.user`
- `run.started`
- `message.assistant.delta`
- `run.completed`
- `run.failed`

Reads are projections. This gives replay, resume, multi-client sync, and auditability with one mechanism.

SQLite is the default store (`node:sqlite`, WAL mode). An in-memory store remains for tests and embedders. Both implement the same interface, so the server and clients do not change.

### One server, many clients

The server owns state. Clients are thin. CLI, web, desktop, IDE, and CI all speak the same HTTP/SSE contract. A client never owns the canonical transcript.

### Protocol first

Public shapes live in `packages/protocol` as Zod schemas. The HTTP API will be documented with OpenAPI 3.1 and SSE. SDKs can be generated for TypeScript, Python, and Go without server changes.

### Boring, debuggable stack

- Node.js 22+ and TypeScript strict
- Hono for HTTP
- SQLite via built-in `node:sqlite`; no native dependency
- React for web and desktop UI
- Electron for desktop v1; Tauri is a possible later "lite" build
- Rust only for narrow native components if measurements justify it

We intentionally avoid an effect system in the hot path. The agent loop should be readable by a new contributor in an afternoon.

### Checks are first-class

A check is:

1. a diff against a base ref
2. an agent definition (markdown)
3. an isolated worktree
4. a captured patch
5. a status and machine-readable report
6. a non-zero exit code on failure

Checks reuse the same session event stream as chat, so a check can be inspected, replayed, and resumed like any other run.

## Future: desktop

Desktop is not part of the 0.1 critical path. When it lands:

- the web UI is the source of truth
- the desktop shell is replaceable (Electron first)
- the local server remains the only state owner

## Future: native components

Rust is a good fit for:

- sandbox enforcement helpers
- PTY and process supervision
- file watching and indexing at scale

Each native component should expose a small, stable TypeScript API. Rust must earn its place with a measured problem, not a branding preference.
