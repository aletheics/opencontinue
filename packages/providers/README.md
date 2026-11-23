# @opencontinue/providers

**Why:** model vendors differ; the agent loop should see one streaming/tool-call interface.

**Owns:** provider catalog, OpenAI-compatible SSE transport, native Anthropic transport, model listing, reasoning-effort capabilities, echo fallback.

**Public API:** `createProvider`, `listModels`, `PROVIDER_PRESETS`, `reasoningEffortsFor`, `ChatProvider`, `ChatRequest`, `ChatStreamEvent`.

**Reasoning:** `reasoningEffortsFor(provider, model)` advertises levels only where the provider documents the capability. OpenAI o-series / GPT-5 / GPT-6 use `reasoning_effort`; Claude 3.7/4/5 models use extended-thinking budgets via `anthropicThinking` (low 1k, medium 4k, high 8k tokens, with `max_tokens` raised above the budget). `auto` sends nothing; unadvertised levels are dropped. Thinking text is never surfaced as assistant output; signed thinking blocks are preserved across tool steps so multi-step Anthropic runs remain valid.

**Allowed imports:** external packages only.

**Must not:** import core, runtime, server, TUI, or CLI.

**Tests:** `provider.test.ts`, `catalog.test.ts`, `sse.test.ts`.
