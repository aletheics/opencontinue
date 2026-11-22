# OpenContinue

> The open continuum for AI-assisted engineering.

Open-source terminal coding agent with durable sessions, streaming, tools, and capability permissions.

## Installation

Requires Node.js 22+.

```bash
git clone https://github.com/aletheics/opencontinue.git
cd opencontinue
npm install
cp .env.example .env
```

Configure an OpenAI-compatible provider in `.env`:

```dotenv
OPENCONTINUE_PROVIDER=openai-compatible
OPENCONTINUE_BASE_URL=https://api.openai.com/v1
OPENCONTINUE_API_KEY=sk-...
OPENCONTINUE_MODEL=gpt-4o-mini
```

DeepSeek, Ollama, vLLM, and LM Studio work through the same interface. See [`.env.example`](.env.example). Without a key, OpenContinue runs in `echo` mode so sessions and streaming still work.

## Usage

```bash
npm run dev                          # interactive
npm run dev -- --auto "fix tests"    # headless, write/shell allowed
npm run dev -- --readonly "review"   # headless, read-only
npm run dev -- serve --port 8787     # server only
npm run dev -- sessions              # list sessions
npm run check -- --base main         # run source-controlled checks
```

Flags: `--auto`, `--readonly`, `--resume <id>`, `--url <url>`, `--port <port>`.

Sessions persist in `.opencontinue/sessions/sessions.db` (WAL). Set `OPENCONTINUE_DB` to use another path. Interrupted runs are marked failed on the next start.

Tools: `read`, `write`, `edit`, `glob`, `grep`, `bash`.

Permissions: read-only tools are always allowed. `write` and `bash` ask in interactive mode, are denied in headless read-only mode, and are allowed with `--auto`.

## GitHub Actions

Use [`actions/check`](actions/check) on pull requests. Checkout with `fetch-depth: 0`, grant `pull-requests: write` and `issues: write`, and set `OPENCONTINUE_API_KEY`.

## Documentation

- [BLUEPRINT.md](BLUEPRINT.md) — product direction, milestones, and the spiral development process
- [AGENTS.md](AGENTS.md) — rules for AI agents and contributors
- [docs/](docs) — architecture, license, roadmap, ADRs
- [.opencontinue/](.opencontinue) — project constraints, agents, commands, and skills

## Contributing

Read [BLUEPRINT.md](BLUEPRINT.md) and [AGENTS.md](AGENTS.md) first. One vertical slice per pull request. CI runs typecheck and tests.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).
