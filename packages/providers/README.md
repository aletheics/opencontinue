# @opencontinue/providers

**Why:** model vendors differ; the agent loop should see one streaming/tool-call interface.

**Owns:** provider catalog, OpenAI-compatible SSE transport, native Anthropic transport, model listing, echo fallback.

**Public API:** `createProvider`, `listModels`, `PROVIDER_PRESETS`, `ChatProvider`, `ChatStreamEvent`.

**Allowed imports:** external packages only.

**Must not:** import core, runtime, server, TUI, or CLI.

**Tests:** `provider.test.ts`, `catalog.test.ts`, `sse.test.ts`.
