---
description: Extract non-obvious learnings from this session into the nearest AGENTS.md.
---

Review the session for discoveries that took multiple attempts or contradict the code's appearance.

Place each learning as close as possible:

- project-wide → root `AGENTS.md`
- package-specific → `packages/<name>/AGENTS.md`
- feature-specific → the nearest source directory

Only add non-obvious facts: hidden coupling, required command sequences, misleading errors, platform quirks.

Do not add:

- facts already in README or docs
- standard framework behavior
- session-specific details
- verbose explanations

Keep each entry to 1–3 lines. Report which files changed and how many entries were added.
