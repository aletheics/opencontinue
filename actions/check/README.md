# OpenContinue Checks Action

Runs `opencontinue check` on a pull request.

```yaml
- uses: opencontinue/opencontinue/actions/check@main
  with:
    api-key: ${{ secrets.OPENCONTINUE_API_KEY }}
    base-url: https://api.openai.com/v1
    model: gpt-4o-mini
```

The action currently installs `@opencontinue/cli` from npm. Until the package is published, use [`.github/workflows/checks.yml`](../../.github/workflows/checks.yml) in this repository.
