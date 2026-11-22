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
```

Flags: `--auto`, `--readonly`, `--resume <id>`, `--url <url>`, `--port <port>`.

Tools: `read`, `write`, `edit`, `glob`, `grep`, `bash`.

Permissions: read-only tools are always allowed. `write` and `bash` ask in interactive mode, are denied in headless read-only mode, and are allowed with `--auto`.

## Documentation

- [BLUEPRINT.md](BLUEPRINT.md) — product direction, milestones, and the spiral development process
- [AGENTS.md](AGENTS.md) — rules for AI agents and contributors
- [docs/](docs) — architecture, license, roadmap, ADRs

## Contributing

Read [BLUEPRINT.md](BLUEPRINT.md) and [AGENTS.md](AGENTS.md) first. One vertical slice per pull request. CI runs typecheck and tests.

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

OpenContinue is not affiliated with Continue Dev or OpenCode.
