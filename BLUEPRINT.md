# OpenContinue Blueprint

Status: living document · Version: 0.1 · Updated: 2026-11-22

This is the canonical plan. Change it by pull request: one milestone or decision per PR. Details belong in [docs/adr](docs/adr).

## 1. Thesis

**OpenContinue is the open continuum for AI-assisted engineering: work continues across terminal, CI, and clients.**

The open-source phase builds influence. The commercial phase sells team and hosted features, never the local core.

Three pillars:

1. **Continuity** — durable sessions, replay, resume, handoff between humans and agents.
2. **Checks** — source-controlled, worktree-isolated, enforceable in CI.
3. **Trust** — local-first, capability permissions, visible tool calls, no telemetry by default.

Non-goals for 0.x: autocomplete, codebase-wide semantic indexing, plugin marketplace, billing.

## 2. Architecture

```
CLI / TUI / Web / Desktop / VS Code / CI
                  │
          OpenAPI + SSE
                  │
          server (Hono)
   sessions · permissions · checks
                  │
          core (event-sourced)
   agent loop · tools · providers · worktrees
                  │
          SQLite (M3)
```

Boundaries:

- `packages/protocol` owns the public event and wire contract.
- `packages/client` owns the session client contract, HTTP/SSE replay, reconnect, and subscription lifecycle.
- `packages/core` owns durable sessions and projections.
- `packages/providers` owns the provider catalog and model transport.
- `packages/tools` owns local capabilities and the permission gate.
- `packages/runtime` owns the agent loop, permissions, and project context.
- `packages/tui` is an independent Ink client; it does not depend on the CLI.
- `apps/server` owns HTTP/SSE over the runtime.
- `apps/cli` is an entrypoint that composes the runtime, server, checks, and TUI.
- Clients are thin. The server owns state.

The event contract is append-only. New behavior adds events; it does not rename or reuse them.

The boundary is explicit: [folder map](docs/architecture/folders.md) and [dependency rules](docs/architecture/dependency-rules.md). `scripts/validate-boundaries.test.ts` fails CI on a forbidden import. Adding a folder or changing a dependency direction requires a README and an ADR.

Reference implementations (read-only):

- OpenCode: `D:\soft\vscodefiles\continue\opencode` (MIT)
- Continue: `D:\soft\vscodefiles\continue\continue` (Apache-2.0)

## 3. Spiral development

Every loop ships one vertical slice:

1. Pick one milestone slice.
2. Update the contract and write an ADR if a decision changed.
3. Implement the smallest usable version.
4. Add tests and CI coverage.
5. Update docs and release notes.
6. Merge, then start the next loop.

Rules:

- One feature per PR. No feature-parity races.
- Every release is runnable.
- Tests and docs land with the code.
- Keep the code smaller than the reference implementation.
- If code is adapted from OpenCode or Continue, record attribution in [NOTICE](NOTICE).

## 4. Milestones

| ID | Status | Goal | Done when |
|---|---|---|---|
| M0 | done | Scaffold, event store, CLI, SSE | `npm run dev` works |
| M1 | done | Provider adapter and streaming | Real model streams into a session |
| M2 | done | Tools and capability permissions | Model edits files, shell is gated |
| M3 | done | SQLite persistence and recovery | Kill the server mid-run, restart, resume |
| M4 | done | Checks, worktree, GitHub Action | One check runs locally and in CI identically |
| M5 | in progress | TUI and web client | Same session continues in two clients |
| M6 | planned | Desktop and VS Code | Thin clients over the same API |
| M7 | planned | Plugin API and sandbox | Third-party tool without core changes |
| M8 | planned | Team and commercial features | Paid design partners |

### M3 — persistence and recovery (done)

- SQLite event store behind the `SessionStore` interface.
- Migrations and a schema version.
- Startup recovery for interrupted runs.
- Session export/import at the store layer.
- Out of scope: multi-user sync and HTTP/CLI export commands.

### M4 — checks (done)

- Diff against a base ref.
- Agent discovery from `.opencontinue/agent`, `.continue/agents`, and `.continue/checks`.
- Isolated git worktree per check, including uncommitted and untracked files.
- Text, JSON, and patch output; `--fix`, `--fail-fast`, non-zero exit on failure.
- Pull-request workflow and repo-hosted action that posts a comment and gates the job.
- Out of scope: hosted dashboard and automatic PR comments.

### M5 — clients (in progress)

- [x] TUI: API key entry, model selection, streaming chat, permission prompts.
- [x] TUI: OpenContinue inline transcript (`◈ OpenContinue` startup header with tagline, model/provider/workspace rows, and ready line; `›` prompt, `↳ Tool(args)`, `⎿` output, Braille spinner, `✓ Completed` / `× Failed`, `◈ Confirm` / `◎ Plan` / `⟳ Auto` mode line), scrollback via Ink `Static`, `ctrl+o` expanded transcript, keybindings, filterable slash menu, diffs, usage, type-to-filter pickers, markdown-style assistant output, session resume picker, permission card with preview diffs, cursor-aware multi-line input, queued messages, `ctrl+r` history search, `@file` completion, workspace/git status line.
- [x] `packages/client`: one `OpenContinueClient` contract, HTTP/SSE replay and reconnect, typed errors; CLI uses it.
- [x] `packages/local-client`: in-process transport behind the same contract, including replay and permission events.
- [x] Client/server e2e: real server + client + echo provider creates, streams, and lists a session; abort is covered over both transports.
- [x] `opencontinue doctor`: Node, workspace, git, config, auth, provider, sessions, optional server/network checks.
- [x] TUI uses the client contract through `LocalSessionClient`, with `--url` selecting `HttpSessionClient`.
- [ ] Minimal web client over the same SSE stream.
- Out of scope: full IDE features.

## 5. Updating this blueprint

- Open an issue naming the milestone and acceptance criteria.
- A PR changes one section and explains motivation and non-goals.
- Decisions that affect the event contract, architecture, or license require an ADR in `docs/adr/NNNN-title.md`.
- Breaking a public event or protocol shape requires a migration and a version bump.
- Keep this file under 200 lines. Move detail to `docs/`.

## 6. Community and AI workflow

- Read [AGENTS.md](AGENTS.md) and this file first.
- Claim a milestone issue before writing code.
- Ship code, tests, and docs together.
- CI runs on Linux and Windows with Node 22 and 24.
- Review checks scope, event compatibility, and test coverage.

## 7. Success metrics

- 0.1: 10 weekly users; resume works; one check runs in CI.
- 0.2: 3 external contributors; 100 checks executed.
- 1.0: 10 design partners; paid team pilot.

North star: weekly active repositories running OpenContinue checks.

## 8. License and governance

Apache-2.0. DCO sign-off. Trademark is separate from the code license. The local core is never crippled to sell hosted features.
