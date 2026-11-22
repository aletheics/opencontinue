import { describe, expect, it } from "vitest"

import { PROVIDER_PRESETS } from "./catalog.js"

describe("provider catalog", () => {
  it("has unique provider ids", () => {
    const ids = PROVIDER_PRESETS.map((provider) => provider.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it("has a base URL unless the provider asks for one", () => {
    for (const provider of PROVIDER_PRESETS) {
      if (provider.askBaseUrl || provider.transport === "echo") continue
      expect(provider.baseUrl, provider.id).toBeTruthy()
    }
  })
})
