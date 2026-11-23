# @opencontinue/runtime

**Why:** the agent loop, permissions, and project context should not depend on how they are transported.

**Owns:** `runAgent`, history projection, permission broker, `.opencontinue` project context. Auto mode still asks before obviously destructive shell commands; it is not a sandbox.

**Public API:** `runAgent`, `PermissionBroker`, `loadProjectConfig`, `projectHistory`.

**Allowed imports:** protocol, core, providers, tools.

**Must not:** import server, TUI, CLI, or config.

**Tests:** `agent.test.ts`, `permissions.test.ts`, `project.test.ts`.
