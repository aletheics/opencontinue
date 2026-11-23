import { describe, expect, it } from "vitest"

import {
  filterModels,
  filterProviders,
  initialProviderIndex,
} from "./selection.js"

describe("provider selection", () => {
  it("maps aliases to the saved preset", () => {
    expect(initialProviderIndex("openai-compatible")).toBe(
      initialProviderIndex("openai"),
    )
    expect(initialProviderIndex("anthropic")).toBe(initialProviderIndex("claude"))
    expect(initialProviderIndex(undefined)).toBe(0)
  })

  it("filters by label, id, or note", () => {
    expect(filterProviders("deepseek").map((item) => item.id)).toEqual([
      "deepseek",
      "openrouter",
    ])
    expect(filterProviders("deepinfra").map((item) => item.id)).toEqual(["deepinfra"])
    expect(filterProviders("").length).toBeGreaterThan(1)
  })

  it("filters model ids", () => {
    expect(filterModels(["gpt-6.2", "deepseek-chat"], "deep")).toEqual([
      "deepseek-chat",
    ])
    expect(filterModels(["a", "b"], "")).toEqual(["a", "b"])
  })
})
