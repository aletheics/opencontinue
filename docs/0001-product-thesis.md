# 0001 — Product Thesis

## One sentence

**OpenContinue is the open continuum for AI-assisted engineering: your work continues across terminal, editor, browser, desktop, and CI.**

## The problem

Coding agents are usually islands:

- a terminal session that dies with the terminal
- a chat in an IDE that cannot be resumed in CI
- a review agent that cannot be rerun locally
- a desktop app that duplicates the CLI instead of continuing it

The result is re-explaining context, re-running work, and trusting a transcript instead of a reproducible record.

## The three pillars

1. **Continuity**
   Sessions are durable event streams. You can resume from any client, replay any run, hand off between a human and an agent, and reproduce a CI run locally.

2. **Checks**
   A check is source-controlled, isolated in a worktree, and produces machine-readable output plus a patch. It runs locally and in CI with the same semantics.

3. **Trust**
   Local-first by default. Capability-based permissions, visible tool calls, redacted secrets, and an audit log. No telemetry unless the user opts in.

## Target users

- developers who live in the terminal but also use a browser and CI
- teams that want AI review to be enforceable, not advisory
- people who need local or self-hosted models

## Non-goals for 0.1

- autocomplete
- codebase-wide semantic indexing
- a plugin marketplace
- team sync / billing
- feature parity with every coding agent

## Success criteria for 0.1

- time to first session under 2 minutes
- resume after a process crash without losing committed events
- one check can run locally and in GitHub Actions with identical output
- 10 external users run it weekly
