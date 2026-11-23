# 0011 — Scope OPENAI_* environment variables to OpenAI

- Status: accepted
- Date: 2026-11-23
- Milestone: M5

## Context

`resolveProviderSettings` used `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and
`OPENAI_MODEL` as fallbacks for every provider. Selecting Claude or DeepSeek
while an OpenAI key was exported could send that key or endpoint to the wrong
vendor.

## Decision

- `OPENCONTINUE_*` variables always apply and take precedence.
- `OPENAI_API_KEY`, `OPENAI_BASE_URL`, and `OPENAI_MODEL` apply only when the
  resolved provider is `openai` or unset (the default OpenAI provider).
- The provider-specific key in `auth.json` is used for other providers, then
  the legacy global `auth.apiKey` remains as a last-resort fallback.
- `OPENAI_PROVIDER` is no longer read; use `OPENCONTINUE_PROVIDER`.

## Consequences

- A custom OpenAI-compatible endpoint must use `OPENCONTINUE_*` variables or a
  provider-specific stored key, not `OPENAI_BASE_URL`.
- Existing OpenAI users keep the same environment behavior.
- No config schema or protocol change.

## Alternatives

- Ignore all `OPENAI_*` variables: breaks the common OpenAI CI setup.
- Bind keys to base URLs: safer but requires a larger credential model.
