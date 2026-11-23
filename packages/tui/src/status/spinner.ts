export type SpinnerVerb = {
  present: string
  past: string
}

export const SPINNER_VERBS: SpinnerVerb[] = [
  { present: "Thinking", past: "Thought" },
  { present: "Working", past: "Worked" },
  { present: "Churning", past: "Churned" },
  { present: "Pondering", past: "Pondered" },
  { present: "Scampering", past: "Scampered" },
  { present: "Scurrying", past: "Scurried" },
  { present: "Noodling", past: "Noodled" },
  { present: "Tinkering", past: "Tinkered" },
]

export const SPINNER_TIP = "Tip: /help for commands · ctrl+o transcript"

export function pickSpinnerVerb(random: number = Math.random()): SpinnerVerb {
  const index = Math.floor(Math.abs(random) * SPINNER_VERBS.length)
  return SPINNER_VERBS[index] ?? SPINNER_VERBS[0]!
}

/**
 * OpenClaude behavior: remain yellow, then fade to red after 3s without
 * new model output. Active tools keep the spinner from turning red.
 */
export function stallIntensity(idleMs: number, activeTool: boolean): number {
  if (activeTool) return 0
  return Math.max(0, Math.min(1, (idleMs - 3000) / 2000))
}

export function spinnerColor(intensity: number): "yellow" | "red" {
  return intensity >= 0.5 ? "red" : "yellow"
}
