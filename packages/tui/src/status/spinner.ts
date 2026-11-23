export const SPINNER_TIPS = [
  "Run opencontinue --resume <id> to resume a session",
  "Use /clear to start fresh when switching topics and free up context",
  "Use @ to reference a file from the workspace",
  "Press shift+tab to cycle permission modes",
  "Press esc to interrupt the current run",
  "Press ctrl+o to open the full transcript",
  "Press ctrl+r to search your input history",
  "Use /help to see every command",
  "Use /model to switch models without leaving the session",
  "Use /resume to continue a previous session",
] as const

export function pickSpinnerTip(random: number = Math.random()): string {
  const index = Math.floor(Math.abs(random) * SPINNER_TIPS.length)
  return SPINNER_TIPS[index] ?? SPINNER_TIPS[0]!
}
