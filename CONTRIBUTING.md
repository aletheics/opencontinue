# Contributing to OpenContinue

Read [BLUEPRINT.md](BLUEPRINT.md), [AGENTS.md](AGENTS.md), and [`.opencontinue/`](.opencontinue) first.

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
```

## Workflow

1. Pick one milestone in [BLUEPRINT.md](BLUEPRINT.md) and open or claim an issue with acceptance criteria.
2. If the decision changes the event contract, architecture, or license, add an ADR under [`docs/adr`](docs/adr).
3. Implement one vertical slice. Include tests and docs.
4. Run `npm run typecheck` and `npm test`.
5. Open a PR. CI must pass on Linux and Windows.

Keep PRs small. One feature per PR, no feature-parity races.

## Scope

0.1 is deliberately narrow:

- session continuity
- local-first execution
- source-controlled checks that run in CI

Open an issue before starting a large feature.

## DCO

By contributing, you agree to the Developer Certificate of Origin (DCO) 1.1. Sign off your commits:

```bash
git commit -s -m "feat(core): add session replay"
```

## Style

- TypeScript strict; no `any` unless there is no alternative.
- Prefer explicit, small modules over clever abstractions.
- Add tests for behavior that would be expensive to break.
- Keep user-facing errors actionable.

## Security

Do not open a public issue for a vulnerability. Email the maintainers instead.
