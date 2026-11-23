# providers

**Why:** provider and model picker decisions should be testable without Ink or config files.

**Files:**

- `selection.ts` — saved-provider index, provider filtering, model filtering.

**Rule:** the catalog lives in `@opencontinue/providers`; this folder only turns catalog data into picker state.

**Tests:** `selection.test.ts`.
