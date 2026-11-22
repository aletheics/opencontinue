<h1 align="center">OpenContinue</h1>

<p align="center">The open continuum for AI-assisted engineering.</p>

<div align="center">

[![GitHub stars](https://img.shields.io/github/stars/aletheics/opencontinue?style=flat-square)](https://github.com/aletheics/opencontinue/stargazers)
[![CI](https://github.com/aletheics/opencontinue/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/aletheics/opencontinue/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache_2.0-blue.svg)](LICENSE)
[![Blueprint](https://img.shields.io/badge/Blueprint-opencontinue-BE1B55.svg)](BLUEPRINT.md)

</div>

<p align="center">
  <img src="image/github-readme.png" alt="OpenContinue banner" />
</p>

## What is OpenContinue?

OpenContinue is an open-source terminal coding agent with durable sessions, streaming, tools, and source-controlled checks. Work continues across your terminal, CI, and future clients.

It is not affiliated with Continue Dev or OpenCode.

## Installation

Requires Node.js 22+.

```bash
git clone https://github.com/aletheics/opencontinue.git
cd opencontinue
npm install
npm run link
opencontinue
```

On first launch, choose a provider inside the TUI: OpenAI (GPT), DeepSeek, Kimi (Moonshot), Claude (Anthropic), OpenRouter, Ollama, Custom, or Echo. Enter that provider's key, then choose a model. The model is saved to `~/.opencontinue/config.json`; the key is stored per provider in `~/.opencontinue/auth.json` (mode `0600`).

Use `opencontinue` as the primary command. `onc` is the short alias; `oc` would collide with OpenCode.

Optional commands:

```bash
opencontinue setup              # interactive provider setup
opencontinue config             # show current config
opencontinue import continue    # import ~/.continue/config.yaml
opencontinue import opencode    # import opencode.json(c)
```

OpenContinue supports 30+ providers, including OpenAI, DeepSeek, Kimi, Claude, OpenRouter, Groq, Mistral, xAI, Qwen, GLM, Gemini, local Ollama/LM Studio/vLLM, and more. See [docs/providers.md](docs/providers.md). Imports map to the matching provider preset.

For CI and containers, set environment variables directly:

```bash
OPENCONTINUE_PROVIDER=openai
OPENCONTINUE_API_KEY=sk-...
OPENCONTINUE_MODEL=gpt-6.2
```

## Usage

`opencontinue` starts the TUI: enter your API key, choose a model, and chat.

```bash
opencontinue                    # TUI
onc                             # same, shorter
opencontinue --auto -p "fix tests"
opencontinue --readonly -p "review"
opencontinue check --base main
opencontinue serve --port 8787
```

Flags: `--auto`, `--readonly`, `--resume <id>`, `--url <url>`, `--port <port>`.

Sessions persist in `.opencontinue/sessions/sessions.db` (WAL). Set `OPENCONTINUE_DB` to override. Interrupted runs are marked failed on the next start.

Tools: `read`, `write`, `edit`, `glob`, `grep`, `bash`.

Permissions: read-only tools are always allowed. `write` and `bash` ask interactively, are denied in headless read-only mode, and are allowed with `--auto`.

## Checks

```bash
opencontinue check --base main
opencontinue check --base main --format json --patch
opencontinue check --base main --fix
```

Checks run each agent in an isolated git worktree. A non-empty patch is a failure; an empty patch is a pass. Agents come from `.opencontinue/agent`, `.continue/agents`, and `.continue/checks`.

## GitHub Actions

Use [`actions/check`](actions/check) on pull requests. Checkout with `fetch-depth: 0`, grant `pull-requests: write` and `issues: write`, and set `OPENCONTINUE_API_KEY`.

## Documentation

- [BLUEPRINT.md](BLUEPRINT.md) — direction, milestones, and the spiral development process
- [AGENTS.md](AGENTS.md) — rules for AI agents and contributors
- [docs/](docs) — architecture, roadmap, and ADRs
- [.opencontinue/](.opencontinue) — project constraints, agents, commands, and skills

## Contributing

Read [BLUEPRINT.md](BLUEPRINT.md) and [AGENTS.md](AGENTS.md) first. One vertical slice per pull request. CI runs typecheck and tests.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
