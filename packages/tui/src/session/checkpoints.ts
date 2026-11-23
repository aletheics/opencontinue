import { glyphs } from "../glyphs.js"
import { formatClock, formatDuration } from "../status/format.js"

export type Checkpoint = {
  seq: number
  at: string
  status: "completed" | "failed" | "interrupted"
  durationMs?: number
}

export function checkpointLabel(checkpoint: Checkpoint): string {
  const time = Number.isNaN(Date.parse(checkpoint.at))
    ? checkpoint.at
    : formatClock(new Date(checkpoint.at))
  const duration =
    checkpoint.durationMs === undefined
      ? ""
      : ` · ${formatDuration(checkpoint.durationMs)}`
  return `${time}${duration} · ${checkpoint.status}`
}

export function formatCheckpoints(
  checkpoints: readonly Checkpoint[],
): string {
  if (checkpoints.length === 0) return `${glyphs.checkpoint} No checkpoints yet.`

  const lines = [
    `${glyphs.checkpoint} Checkpoints · ${checkpoints.length}`,
  ]
  for (const checkpoint of [...checkpoints].slice(-8).reverse()) {
    lines.push(checkpointLabel(checkpoint))
  }
  return lines.join("\n")
}
