# @opencontinue/config

**Why:** provider settings and API keys must survive process restarts and stay out of the repository.

**Owns:** `~/.opencontinue/config.json`, `~/.opencontinue/auth.json`, per-provider keys, env precedence.

**Public API:** `loadProviderConfig`, `saveProviderConfig`, `loadAuthConfig`, `saveAuthConfig`, `resolveProviderSettings`.

**Allowed imports:** external packages only.

**Must not:** import core, providers, runtime, or clients.

**Tests:** `src/index.test.ts` uses a temporary `OPENCONTINUE_HOME`.
