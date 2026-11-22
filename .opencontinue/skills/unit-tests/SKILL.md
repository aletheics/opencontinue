---
name: unit-tests
description: Use when adding or fixing tests in this repository.
---

# Unit tests

- Runner: Vitest (`npm test`).
- File pattern: `*.test.ts` next to the code, or under `apps/*/src`.
- Filesystem tests: `mkdtemp` under `os.tmpdir()`, clean up in `afterEach`.
- No fixed sleeps and no wall-clock assertions.
- Test failure paths, not only the happy path.
- Tests must pass on Linux and Windows with Node 22 and 24.
- Run `npm run typecheck` before `npm test`.

Prefer in-process tests. Spawn a process only when the behavior is the process boundary.
