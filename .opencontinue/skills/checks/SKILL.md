---
name: checks
description: Use when implementing or running source-controlled checks.
---

# Checks

A check is:

1. a diff against a base ref
2. an agent from `.opencontinue/agent/*.md`
3. an isolated git worktree
4. a captured patch
5. a status and machine-readable report
6. a non-zero exit code on failure

Rules:

- One worktree per check.
- Checks must be read-only outside their worktree.
- Output must be identical locally and in CI.
- Use the same session event contract as chat.
- Never depend on a hosted service for the local path.

Minimum command:

```bash
opencontinue check --base origin/main --format json --patch
```
