export function formatTokens(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

/**
 * Compact counts as Claude Code renders them: one decimal for thousands and
 * above, lower-case units ("1.0k", "45.5k", "1.8m").
 */
export function formatNumber(value: number): string {
  const units = [
    { limit: 1e12, suffix: "t" },
    { limit: 1e9, suffix: "b" },
    { limit: 1e6, suffix: "m" },
    { limit: 1e3, suffix: "k" },
  ] as const

  for (const unit of units) {
    if (Math.abs(value) >= unit.limit) {
      return `${(value / unit.limit).toFixed(1).toLowerCase()}${unit.suffix}`
    }
  }

  return String(value)
}

export function formatClock(date: Date = new Date()): string {
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`
}

/**
 * Claude Code's duration shape: `39s`, `15m 57s`, `1h 2m 0s`, `2d 3h 4m`.
 */
export function formatDuration(ms: number): string {
  if (ms < 60_000) {
    if (ms === 0) return "0s"
    if (ms < 1_000) return `${(ms / 1000).toFixed(1)}s`
    return `${Math.floor(ms / 1000)}s`
  }

  let days = Math.floor(ms / 86_400_000)
  let hours = Math.floor((ms % 86_400_000) / 3_600_000)
  let minutes = Math.floor((ms % 3_600_000) / 60_000)
  let seconds = Math.round((ms % 60_000) / 1000)

  if (seconds === 60) {
    seconds = 0
    minutes++
  }
  if (minutes === 60) {
    minutes = 0
    hours++
  }
  if (hours === 24) {
    hours = 0
    days++
  }

  if (days > 0) return `${days}d ${hours}h ${minutes}m`
  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`
  return `${minutes}m ${seconds}s`
}
