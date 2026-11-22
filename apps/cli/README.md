# @opencontinue/cli

**Why:** one entrypoint for `opencontinue` and `onc`.

**Owns:** command parsing, TUI launch, setup/config/import commands, checks command composition, headless mode.

**Public API:** the binary only; do not import this package.

**Allowed imports:** all packages and `apps/server`.

**Must not:** hold domain logic needed by the web or desktop client. Move it to a package.

**Tests:** `import.test.ts`, `checks.test.ts`.
