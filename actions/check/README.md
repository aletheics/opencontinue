# OpenContinue Checks Action

Runs source-controlled checks on a pull request, posts a comment, and fails the job when a check fails.

```yaml
name: Checks
on: pull_request

permissions:
  contents: read
  pull-requests: write
  issues: write

jobs:
  checks:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6
        with:
          fetch-depth: 0
      - uses: aletheics/opencontinue/actions/check@main
        with:
          base: origin/${{ github.base_ref }}
          api-key: ${{ secrets.OPENCONTINUE_API_KEY }}
          base-url: ${{ secrets.OPENCONTINUE_BASE_URL }}
          model: ${{ secrets.OPENCONTINUE_MODEL }}
```

Requirements:

- Checkout with `fetch-depth: 0`; the action verifies it.
- `pull-requests: write` and `issues: write` for the comment.
- An OpenAI-compatible provider secret.

Inputs:

| Input | Default | Purpose |
|---|---|---|
| `base` | `origin/main` | Base git ref |
| `api-key` | required | Provider key |
| `base-url` | `https://api.openai.com/v1` | Provider URL |
| `model` | `gpt-6.2` | Model |
| `patch` | `true` | Include patches in the comment |
| `comment` | `true` | Post or update a PR comment |
| `fail-on-error` | `true` | Fail the job on check failures |
| `timeout` | `300` | Per-check timeout in seconds |

The action runs the CLI from this repository checkout, so it does not require an npm release.
