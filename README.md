# OpenContinue

> The open continuum for AI-assisted engineering.

Open-source terminal coding agent with durable sessions, streaming, tools, and capability permissions.

## Install

Requires Node.js 22+.

```bash
git clone https://github.com/aletheics/opencontinue.git
cd opencontinue
npm install
```

## Configure

```bash
cp .env.example .env
```

OpenAI:

```dotenv
OPENCONTINUE_PROVIDER=openai-compatible
OPENCONTINUE_BASE_URL=https://api.openai.com/v1
OPENCONTINUE_API_KEY=sk-...
OPENCONTINUE_MODEL=gpt-4o-mini
```

DeepSeek:

```dotenv
OPENCONTINUE_PROVIDER=openai-compatible
OPENCONTINUE_BASE_URL=https://api.deepseek.com/v1
OPENCONTINUE_API_KEY=sk-...
OPENCONTINUE_MODEL=deepseek-chat
```

Ollama:

```dotenv
OPENCONTINUE_PROVIDER=ollama
OPENCONTINUE_MODEL=qwen2.5-coder:7b
```

Without a key, `opencontinue` falls back to `echo` so the session and streaming paths still work.

## Usage

```bash
npm run dev                       # interactive
npm run dev -- "explain this repo" # headless, readonly by default
npm run dev -- --auto "fix tests"  # headless with write/shell tools
npm run dev -- serve --port 8787   # server only
npm run dev -- sessions            # list sessions on a running server
```

Flags:

| Flag | Effect |
|---|---|
| `--auto` | Allow write and shell tools without approval |
| `--readonly` | Deny write and shell tools |
| `--resume <id>` | Resume a session |
| `--url <url>` | Connect to a running server |
| `--port <port>` | Embedded server port (default `8787`) |

Tools: `read`, `write`, `edit`, `glob`, `grep`, `bash`.

Permissions: read-only tools are always allowed. `write` and `bash` ask in interactive mode, are denied in headless readonly mode, and are allowed with `--auto`.

## Development

```bash
npm test
npm run typecheck
```

Architecture and roadmap: [`docs/`](docs).

## License

Apache-2.0. See [LICENSE](LICENSE) and [NOTICE](NOTICE).

OpenContinue is not affiliated with Continue Dev or OpenCode.
