# @opencontinue/tools

**Why:** the agent needs bounded local capabilities, not unrestricted shell access.

**Owns:** read, write, edit, glob, grep, bash; workspace confinement; tool registry; permission gate.

**Public API:** `ToolRegistry`, `Tool`, `PermissionGate`, individual tools.

**Allowed imports:** `@opencontinue/providers` for tool definitions.

**Must not:** import core, runtime, server, TUI, or CLI.

**Tests:** `src/index.test.ts` uses temporary workspaces.
