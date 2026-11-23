# @opencontinue/config

**Why:** provider settings and API keys must survive process restarts and stay out of the repository.

**Owns:** `~/.opencontinue/config.json`, `~/.opencontinue/auth.json`, per-provider keys, the last chosen execution mode and reasoning effort, env precedence. `OPENAI_*` variables apply only to the default OpenAI provider; other providers use `OPENCONTINUE_*` or their per-provider key. Config and auth files tolerate a UTF-8 BOM.

**Public API:** `loadProviderConfig`, `saveProviderConfig`, `loadAuthConfig`, `saveAuthConfig`, `resolveProviderSettings`, `normalizePermissionModeSetting`, `normalizeReasoningEffortSetting`.

**Allowed imports:** external packages only.

**Must not:** import core, providers, runtime, or clients.

**Tests:** `src/index.test.ts` uses a temporary `OPENCONTINUE_HOME`.
