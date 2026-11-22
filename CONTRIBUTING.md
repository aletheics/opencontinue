# Contributing to OpenContinue

Thanks for taking the time to contribute.

## Development

```bash
npm install
npm run dev
npm test
npm run typecheck
```

## Scope

The 0.1 milestone is deliberately narrow:

- session continuity
- local-first execution
- source-controlled checks that can run in CI

Please open an issue before starting a large feature. Small fixes and tests are always welcome.

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
