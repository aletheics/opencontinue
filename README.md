# OpenContinue

> The open continuum for AI-assisted engineering.

OpenContinue is an open-source coding agent built around one idea: **your work should continue, not restart.** The same session should follow you from the terminal to the browser, from your machine to CI, and from an agent back to a human.

This repository is the **0.0.1 scaffold**. The architecture and contracts are in place; the agent currently echoes messages so the event stream, session recovery, and multi-client flow can be exercised end to end.

## Status

- [x] Monorepo, Apache-2.0, TypeScript
- [x] Event-sourced session kernel
- [x] HTTP server with SSE event stream
- [x] CLI with interactive and headless modes
- [x] Session list / resume primitives
- [x] Provider adapter (OpenAI-compatible + `echo` fallback)
- [x] Streaming agent loop (no tools yet)
- [ ] Tool loop (read / write / edit / grep / bash) with capability permissions
- [ ] Worktree-isolated checks and GitHub Action
- [ ] Web client, TUI, desktop shell

## Configure a provider

Provider settings are read from environment variables and from a `.env` file at the repository root:

```bash
cp .env.example .env
```

OpenAI:

```dotenv
OPENCONTINUE_PROVIDER=openai-compatible
OPENCONTINUE_BASE_URL=https://api.openai.com/v1
OPENCONTINUE_API_KEY=sk-...
OPENCONTINUE_MODEL=gpt-4o-mini
```

DeepSeek (or any OpenAI-compatible endpoint):

```dotenv
OPENCONTINUE_PROVIDER=openai-compatible
OPENCONTINUE_BASE_URL=https://api.deepseek.com/v1
OPENCONTINUE_API_KEY=sk-...
OPENCONTINUE_MODEL=deepseek-chat
```

Ollama:

```dotenv
OPENCONTINUE_PROVIDER=ollama
OPENCONTINUE_MODEL=qwen2.5-coder:7b
```

With no key configured, OpenContinue falls back to an `echo` provider so a fresh checkout can still exercise sessions, streaming, and resume:

```dotenv
OPENCONTINUE_PROVIDER=echo
```

## Quickstart

Requires Node.js 22+.

```bash
cd D:/soft/vscodefiles/opencontinue
npm install

# Interactive chat (starts an embedded server)
npm run dev

# Headless
npm run dev -- "explain this repository"

# Server only
npm run dev:server

# Talk to a running server
npm run dev -- --url http://127.0.0.1:8787
```

Run checks:

```bash
npm test
npm run typecheck
```

## How it works

```
clients (CLI / Web / Desktop / CI)
        │  OpenAPI + SSE
        ▼
server (Hono) ── sessions, permissions, checks
        │
        ▼
core (event-sourced kernel) ── SQLite-backed store later
```

Every session is an append-only event stream. Clients can replay from any sequence number, which is what makes resume, multi-client continuity, and crash recovery possible without special cases.

See:

- [`docs/0001-product-thesis.md`](docs/0001-product-thesis.md)
- [`docs/0002-architecture.md`](docs/0002-architecture.md)
- [`docs/0003-license-and-governance.md`](docs/0003-license-and-governance.md)
- [`docs/0004-roadmap.md`](docs/0004-roadmap.md)

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

OpenContinue is not affiliated with Continue Dev or OpenCode.
