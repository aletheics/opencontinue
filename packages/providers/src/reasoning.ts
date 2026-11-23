export type ReasoningEffort = "auto" | "low" | "medium" | "high" | "max"

export const REASONING_EFFORTS: readonly ReasoningEffort[] = [
  "auto",
  "low",
  "medium",
  "high",
  "max",
]

/**
 * Advertise reasoning levels only where the provider documents a matching
 * parameter. OpenAI uses reasoning_effort; Anthropic uses thinking budgets.
 */
export function reasoningEffortsFor(
  provider: string | undefined,
  model: string | undefined,
): ReasoningEffort[] {
  const id = (provider ?? "").toLowerCase()
  const name = model ?? ""

  if (id === "openai" && /^(o[1-9]|gpt-5|gpt-6)/i.test(name)) {
    return ["auto", "low", "medium", "high"]
  }

  if (
    (id === "anthropic" || id === "claude") &&
    /claude-(3-7|sonnet-4|opus-4|haiku-4|sonnet-5|opus-5)/i.test(name)
  ) {
    return ["auto", "low", "medium", "high"]
  }

  return []
}

const ANTHROPIC_BUDGETS: Record<Exclude<ReasoningEffort, "auto">, number> = {
  low: 1_024,
  medium: 4_096,
  high: 8_192,
  max: 16_384,
}

/**
 * Anthropic extended thinking: low/medium/high map to budget tokens, and
 * max_tokens must exceed the budget. `auto` omits the parameter entirely.
 */
export function anthropicThinking(
  effort: ReasoningEffort | undefined,
): { thinking?: { type: "enabled"; budget_tokens: number }; maxTokens: number } {
  if (!effort || effort === "auto") return { maxTokens: 8_192 }
  const budget = ANTHROPIC_BUDGETS[effort]
  return {
    thinking: { type: "enabled", budget_tokens: budget },
    maxTokens: Math.max(8_192, budget + 4_096),
  }
}
