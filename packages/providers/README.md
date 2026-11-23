# @opencontinue/providers

**Why:** model vendors differ; the agent loop should see one streaming/tool-call interface.

**Owns:** provider catalog, OpenAI-compatible SSE transport, native Anthropic transport, model listing, reasoning-effort capabilities, echo fallback.

**Public API:** `createProvider`, `listModels`, `PROVIDER_PRESETS`, `reasoningEffortsFor`, `ChatProvider`, `ChatRequest`, `ChatStreamEvent`.

**Reasoning:** `reasoningEffortsFor(provider, model)` advertises levels only where the API documents `reasoning_effort` (OpenAI o-series / GPT-5 / GPT-6). The OpenAI-compatible transport drops the parameter unless the request level is advertised; `auto` never sends it. Anthropic extended-thinking budgets are not implemented yet, so it advertises none.

**Allowed imports:** external packages only.

**Must not:** import core, runtime, server, TUI, or CLI.

**Tests:** `provider.test.ts`, `catalog.test.ts`, `sse.test.ts`.
