# 0004 — Roadmap

## 0.0.1 — scaffold (current)

- event-sourced in-memory sessions
- HTTP server with SSE
- CLI interactive + headless
- session list
- tests and typecheck

## 0.1 — usable local agent (target: 6–10 weeks)

1. Provider adapter: OpenAI-compatible first, then Anthropic, Gemini, Ollama.
2. Agent loop with streaming, cancellation, and retry.
3. Tools: read, write, edit, grep, glob, bash, fetch.
4. Capability-based permissions with an audit event per call.
5. SQLite persistence and crash recovery.
6. Config file plus import from Continue, Claude, and Codex configs.
7. MCP client.
8. Minimal TUI on top of the same session API.

## 0.2 — checks (target: 4–6 weeks after 0.1)

1. Worktree-isolated check runner.
2. `opencontinue check --base <ref> --format json --patch`.
3. `--fix`, `--fail-fast`, and non-zero exit codes.
4. GitHub Action and a demo repository.
5. A Checks view in the CLI and web client.

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
