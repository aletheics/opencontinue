# `.opencontinue`

Project-level constraints for OpenContinue itself.

| Path | Purpose | Status |
|---|---|---|
| `opencontinue.json` | Permission mode, per-tool allow/ask/deny, instruction files | Loaded and enforced at server start |
| `AGENTS.md` | Runtime rules injected into the agent system prompt | Loaded at server start |
| `agent/` | Review and check agents | Consumed by checks in M4 |
| `command/` | Reusable command prompts | Reference for agents |
| `skills/` | Task-specific guides | Reference for agents |

CLI flags override `permissions.mode`:

```bash
opencontinue                   # project default (ask)
opencontinue --auto "..."
opencontinue --plan "..."
```

Headless runs default to `readonly` regardless of project config unless `--auto` is passed.

Keep this directory small. Add one agent, command, or skill per PR.
