---
description: Run typecheck and tests, then report a concise pass/fail summary.
---

Run, in order:

1. `npm run typecheck`
2. `npm test`

Then inspect `git diff` for behavior changes that the tests do not cover.

Report:

- pass/fail for each command
- failing test names and the first useful error line
- missing tests for changed behavior

Do not commit. Do not fix unrelated failures.
