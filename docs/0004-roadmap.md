# 0004 — Roadmap

> Canonical plan: [BLUEPRINT.md](../BLUEPRINT.md). This file keeps implementation notes.

## 0.0.1 — scaffold (current)

- event-sourced in-memory sessions
- HTTP server with SSE
- CLI interactive + headless
- session list
- OpenAI-compatible provider + `echo` fallback
- streaming agent loop
- tests and typecheck

## 0.1 — usable local agent (target: 6–10 weeks)

1. [x] Provider adapter: OpenAI-compatible first (covers OpenAI, DeepSeek, Ollama, vLLM).
2. [x] Agent loop with streaming and tool calls; cancellation and retry next.
3. [x] Tools: read, write, edit, glob, grep, bash.
4. [x] Capability-based permissions with an audit event per call.
5. [x] SQLite persistence and crash recovery (store-level export/import included).
6. Config file plus import from Continue, Claude, and Codex configs.
7. MCP client.
8. Minimal TUI on top of the same session API.

## 0.2 — checks (done)

1. [x] Worktree-isolated check runner.
2. [x] `opencontinue check --base <ref> --format json --patch`.
3. [x] `--fix`, `--fail-fast`, and non-zero exit codes.
4. [x] Pull-request workflow and repo-hosted action with PR comments.
5. [ ] A Checks view in the CLI and web client.

## 0.3 — continuity

1. Cross-client session resume (CLI ↔ web ↔ CI).
2. Session export/import and shareable local links.
3. Worktree snapshots and rollback.
4. A local trace/cost viewer.

## Later

- web client
- desktop shell (Electron first)
- VS Code client
- plugin API with capability tokens
- WASM plugin sandbox
- hosted team features (commercial)

## Guiding rule

Ship one vertical slice at a time. No feature parity races.
