# AGENTS.md

Guidance for AI coding agents and contributors.

## Read first

1. [BLUEPRINT.md](BLUEPRINT.md) — canonical plan and milestone ladder.
2. [docs/0002-architecture.md](docs/0002-architecture.md) — event model and boundaries.
3. [docs/adr/](docs/adr) — accepted decisions.

## Reference implementations

These are read-only references for behavior and edge cases:

- OpenCode: `D:\soft\vscodefiles\continue\opencode` (MIT)
- Continue: `D:\soft\vscodefiles\continue\continue` (Apache-2.0)

Do not copy wholesale. If code is adapted, keep attribution in [NOTICE](NOTICE).

## Repository map

| Path | Responsibility |
|---|---|
| `packages/protocol` | Wire schemas and the public event contract |
| `packages/core` | Event-sourced session store and projections |
| `packages/providers` | OpenAI-compatible streaming, tool calls, echo fallback |
| `packages/tools` | read / write / edit / glob / grep / bash + permission gate |
| `apps/server` | HTTP/SSE server, agent loop, permission broker |
| `apps/cli` | Interactive and headless CLI |

## Rules

- TypeScript strict. No `any` unless there is no alternative.
- One vertical slice per PR. Do not mix unrelated refactors.
- Every behavior change needs a test. Update docs or an ADR when the contract or scope changes.
- The public event contract is append-only. Add events; do not rename or reuse existing ones without a migration.
- Keep the code smaller and more direct than the reference implementation. Readability beats cleverness.
- Never commit `.env`, secrets, `node_modules`, or generated artifacts.
- Conventional commits: `feat`, `fix`, `docs`, `chore`, `refactor`, `test`.
- Use the DCO sign-off: `git commit -s`.

## Commands

```bash
npm install
npm run typecheck
npm test
npm run dev
```

## Definition of done

- `npm run typecheck` passes.
- `npm test` passes.
- The feature is usable from the CLI.
- `BLUEPRINT.md` or an ADR reflects any scope change.
