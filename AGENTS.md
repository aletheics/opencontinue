# AGENTS.md

Guidance for AI coding agents and contributors.

## Read first

1. [BLUEPRINT.md](BLUEPRINT.md) — canonical plan and milestone ladder.
2. [docs/0002-architecture.md](docs/0002-architecture.md) — event model and boundaries.
3. [docs/adr/](docs/adr) — accepted decisions.

## Project constraints

`/.opencontinue` is the project-level constraint set:

- `opencontinue.json` — permission mode and instruction files, loaded at server start.
- `AGENTS.md` — runtime rules injected into the agent system prompt.
- `agent/` — review and check agents, consumed by checks in M4.
- `command/` and `skills/` — reusable guides for agents.
- `scripts/validate-constraints.test.ts` enforces the structure in CI.

## Reference implementations

These are read-only references for behavior and edge cases:

- OpenCode: `D:\soft\vscodefiles\continue\opencode` (MIT)
- Continue: `D:\soft\vscodefiles\continue\continue` (Apache-2.0)

Do not copy wholesale. If code is adapted, keep attribution in [NOTICE](NOTICE).

## Repository map

| Path | Responsibility |
|---|---|
| `packages/protocol` | Wire schemas and the public event contract |
| `packages/config` | Global provider config and auth files |
| `packages/core` | Event-sourced session store and projections |
| `packages/providers` | Provider catalog, OpenAI-compatible transport, native Anthropic |
| `packages/tools` | read / write / edit / glob / grep / bash + permission gate |
| `packages/runtime` | Agent loop, history projection, permissions, project context |
| `packages/tui` | Ink TUI, independent from the CLI |
| `apps/server` | HTTP/SSE transport over the runtime |
| `apps/cli` | Command entrypoint and headless paths |
| `apps/cli/src/checks.ts` | Worktree-isolated checks and patch capture |
| `apps/cli/src/import.ts` | Continue and OpenCode config import |
| `actions/check` | Reusable GitHub Action for checks |

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
