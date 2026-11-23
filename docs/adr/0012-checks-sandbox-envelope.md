# 0012 — Checks run in an isolation envelope

- Status: accepted
- Date: 2026-11-23
- Milestone: M4/M5

## Context

Checks run agent-authored shell commands with `allowAll` inside a git worktree.
The worktree bounds the default cwd, but a command can name the source repo,
the user's home, or inherited secret environment variables. That is a trust
boundary for local runs and CI.

## Decision

Checks run with a defense-in-depth envelope:

- Child environment: remove names matching key/token/secret/password/auth/
  credential/session/cookie/connection-string/URL/DSN patterns.
- `HOME`, `USERPROFILE`, `APPDATA`, `LOCALAPPDATA`, `XDG_*`, and
  `OPENCONTINUE_HOME` point at a per-check temp home.
- `TMP`, `TEMP`, and `TMPDIR` point at a per-check temp directory.
- `GIT_CONFIG_GLOBAL` is an empty file; the system config and terminal prompts
  are disabled.
- The bash tool refuses commands that name an absolute (or `..`) path inside
  the source repo, the real user home, or the original `OPENCONTINUE_HOME`,
  while still allowing paths inside the worktree.
- The provider/model client still runs in the trusted parent process; only the
  child environment is scrubbed.

This is **not an OS sandbox**. The command-path guard is textual and can be
bypassed by a script that constructs paths at runtime. A fully hostile check
must run in a container or a dedicated low-privilege runner.

## Consequences

- Accidental `env`, `cat ~/.opencontinue/auth.json`, or source-repo reads are
  blocked or use an empty home.
- Builds that need a real secret should receive it through an explicit,
  documented mechanism in a future sandbox design.
- No event or protocol shape changes.

## Alternatives

- Full OS sandbox (bubblewrap, jobs, container): strongest, but needs
  platform-specific tooling and a larger product decision.
- Deny bash entirely in checks: safe but breaks tests/builds.
- Cwd-only isolation: the current behavior; leaves repo/home/secrets exposed.
