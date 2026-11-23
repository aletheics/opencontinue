# @opencontinue/cli

**Why:** one entrypoint for `opencontinue` and `onc`.

**Owns:** command parsing, TUI launch, setup/config/import commands, environment diagnostics (`doctor`), checks command composition, headless mode. Checks run git and agent commands with a bounded timeout and process-tree cleanup.

**Public API:** the binary only; do not import this package.

**Allowed imports:** all packages and `apps/server`.

**Must not:** hold domain logic needed by the web or desktop client. Move it to a package.

**Tests:** `import.test.ts`, `checks.test.ts`, `doctor.test.ts`, `e2e.test.ts` (real server + client + echo provider).
