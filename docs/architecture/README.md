# Architecture

- [folders.md](folders.md) — what every folder owns and why
- [dependency-rules.md](dependency-rules.md) — allowed import directions
- [../adr](../adr) — decisions and their consequences
- [../../BLUEPRINT.md](../../BLUEPRINT.md) — milestones and product direction

Rules:

1. Applications compose packages. Packages never import applications.
2. A package exposes one public entry. Do not deep-import another package's source.
3. Every package has a README: why it exists, what it owns, allowed dependencies, tests.
4. `scripts/validate-boundaries.test.ts` enforces the dependency graph in CI.
5. Changing a boundary requires an ADR and an update to this folder map.
