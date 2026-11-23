import type { ToolTimelineItem } from "../timeline.js"
import { textWidth } from "../transcript/format/wrap.js"
import { formatDuration, formatNumber } from "./format.js"

export type ActivityThresholds = {
  delayedMs: number
  stalledMs: number
}

export const DEFAULT_ACTIVITY_THRESHOLDS: ActivityThresholds = {
  delayedMs: 10_000,
  stalledMs: 30_000,
}

/** Thresholds are configurable; stalled always stays at or above delayed. */
export function activityThresholds(
  env: Record<string, string | undefined> = process.env,
): ActivityThresholds {
  const parse = (value: string | undefined, fallback: number): number => {
    const parsed = Number(value)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback
  }

  const delayedMs = parse(
    env.OPENCONTINUE_DELAYED_MS,
    DEFAULT_ACTIVITY_THRESHOLDS.delayedMs,
  )
  const stalledMs = Math.max(
    delayedMs,
    parse(env.OPENCONTINUE_STALLED_MS, DEFAULT_ACTIVITY_THRESHOLDS.stalledMs),
  )
  return { delayedMs, stalledMs }
}

export type ProgressState = "active" | "delayed" | "stalled"

/**
 * A running tool is never treated as a stalled model. Long model or network
 * waits become delayed/stalled warnings, never failures.
 */
export function progressState(
  idleMs: number,
  activeTool: boolean,
  thresholds: ActivityThresholds = DEFAULT_ACTIVITY_THRESHOLDS,
): ProgressState {
  if (activeTool) return "active"
  if (idleMs >= thresholds.stalledMs) return "stalled"
  if (idleMs >= thresholds.delayedMs) return "delayed"
  return "active"
}

export function toolActivityLabel(
  tool: Pick<ToolTimelineItem, "name">,
): string {
  switch (tool.name) {
    case "read":
      return "Reading files"
    case "grep":
    case "glob":
      return "Searching files"
    case "write":
    case "edit":
      return "Editing"
    case "bash":
      return "Running command"
    case "todo":
      return "Updating tasks"
    default:
      return `Running ${tool.name}`
  }
}

export function activityLabel(input: {
  activeTool?: Pick<ToolTimelineItem, "name">
  hasText: boolean
  todoLabel?: string
}): string {
  if (input.activeTool) return toolActivityLabel(input.activeTool)
  if (input.todoLabel) return input.todoLabel
  return input.hasText ? "Responding" : "Waiting for model"
}

export function displayActivityLabel(
  label: string,
  state: ProgressState,
): string {
  if (state === "stalled") return "Still waiting — no recent activity"
  if (state === "delayed") return `${label} · still working`
  return label
}

/**
 * The metadata tail in priority order: duration, tokens, effort. On narrow
 * terminals the lowest-priority fields are dropped first.
 */
export function activityTailParts(input: {
  label: string
  elapsedMs: number
  tokens: number
  effort?: string
  width: number
}): string[] {
  const duration = formatDuration(input.elapsedMs)
  const tokens =
    input.tokens > 0 ? `${formatNumber(input.tokens)} tokens` : undefined
  const candidates: string[][] = [
    [duration, tokens, input.effort].filter((part): part is string => Boolean(part)),
    [tokens, input.effort].filter((part): part is string => Boolean(part)),
    [input.effort].filter((part): part is string => Boolean(part)),
    [],
  ]

  const available = Math.max(0, input.width - textWidth(input.label) - 4)
  for (const parts of candidates) {
    if (textWidth(parts.join(" · ")) <= available) return parts
  }
  return []
}
