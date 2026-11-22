# 0003 — Checks run in an isolated worktree

- Status: accepted
- Date: 2026-11-22
- Milestone: M4

## Context

Checks need to review a diff and may edit files to suggest fixes. Running them in the user's working tree risks losing uncommitted work and makes concurrent checks collide.

## Decision

Each check gets a temporary git worktree:

1. `git worktree add --detach <tmp> HEAD`
2. Apply the user's uncommitted tracked diff (`git diff HEAD --binary`) to the worktree.
3. Copy untracked files listed by `git ls-files --others --exclude-standard`.
4. Commit the result as the check baseline.
5. Run the agent against the worktree with an allow-all permission gate.
6. Capture `git add -A && git diff --cached --binary` as the suggested patch.
7. Remove the worktree.

A check fails when its patch is non-empty. An empty patch is a pass. Provider or process errors are reported separately.

## Consequences

- The user's working tree is never modified by a check.
- Uncommitted and untracked files are visible to the agent.
- Patches apply cleanly to the original tree because the baseline includes those files.
- Worktrees cost disk and process time; checks default to four in parallel.
- Binary files and submodules are best-effort; a failed worktree setup is reported as a check error.

## Alternatives

- Run in the working tree: simple, but destructive and racy.
- Copy the whole repository: works, but slower and duplicates ignored files.
- Read-only review with no edits: safe, but cannot produce a fix patch.
