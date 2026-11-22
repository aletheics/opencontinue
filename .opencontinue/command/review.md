---
description: Review the current diff against BLUEPRINT.md and event-contract rules.
---

Review `git diff` against the current branch's merge base.

Check:

- correctness and edge cases
- event-contract compatibility
- permission and workspace boundaries
- tests for new behavior

Output one finding per issue with `file:line`, severity, and a minimal fix.
If the diff is clean, say so and list the regression tests that cover it.
