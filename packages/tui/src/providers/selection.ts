import { PROVIDER_PRESETS, type ProviderPreset } from "@opencontinue/providers"

export function initialProviderIndex(provider: string | undefined): number {
  const index = PROVIDER_PRESETS.findIndex(
    (item) =>
      item.id === provider ||
      (provider === "openai-compatible" && item.id === "openai") ||
      (provider === "anthropic" && item.id === "claude"),
  )
  return index >= 0 ? index : 0
}

export function filterProviders(query: string): ProviderPreset[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return PROVIDER_PRESETS
  return PROVIDER_PRESETS.filter((item) =>
    `${item.label} ${item.id} ${item.note ?? ""}`.toLowerCase().includes(needle),
  )
}

export function filterModels(models: readonly string[], query: string): string[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...models]
  return models.filter((item) => item.toLowerCase().includes(needle))
}
