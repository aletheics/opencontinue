# @opencontinue/tools

**Why:** the agent needs bounded local capabilities, not unrestricted shell access.

**Owns:** read, write, edit, glob, grep, bash, todo; workspace confinement; tool registry; permission gate; bounded workspace file listing for prompt completion; dry-run previews for write/edit.

**Public API:** `ToolRegistry`, `Tool`, `ToolPreview`, `PermissionGate`, individual tools, `listWorkspaceFiles`.

**Allowed imports:** `@opencontinue/providers` for tool definitions.

**Must not:** import core, runtime, server, TUI, or CLI.

**Tests:** `src/index.test.ts` and `src/files.test.ts` use temporary workspaces.
