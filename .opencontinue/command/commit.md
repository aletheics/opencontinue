---
description: Commit the current change with a conventional message and DCO sign-off.
---

Before committing:

1. Run `npm run typecheck` and `npm test`.
2. Check `git status --short` for secrets, `.env`, `node_modules`, or temporary files.
3. Keep the commit to one vertical slice.

Commit with:

```bash
git commit -s -m "type(scope): summary"
```

Use `feat`, `fix`, `docs`, `chore`, `refactor`, or `test`.
Explain why from the user's perspective, not just what changed.

Do not push unless asked.
