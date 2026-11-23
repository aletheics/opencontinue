import { formatDuration, formatNumber } from "./format.js"

/**
 * Spinner verbs follow Claude Code's list. The verb is sampled once per turn
 * and shown with a trailing ellipsis.
 */
export const SPINNER_VERBS = [
  "Accomplishing",
  "Actioning",
  "Actualizing",
  "Architecting",
  "Baking",
  "Beaming",
  "Beboppin'",
  "Befuddling",
  "Billowing",
  "Blanching",
  "Bloviating",
  "Boogieing",
  "Boondoggling",
  "Booping",
  "Bootstrapping",
  "Brewing",
  "Bunning",
  "Burrowing",
  "Calculating",
  "Canoodling",
  "Caramelizing",
  "Cascading",
  "Catapulting",
  "Cerebrating",
  "Channelling",
  "Choreographing",
  "Churning",
  "Coalescing",
  "Cogitating",
  "Combobulating",
  "Composing",
  "Computing",
  "Concocting",
  "Considering",
  "Contemplating",
  "Cooking",
  "Crafting",
  "Creating",
  "Crunching",
  "Crystallizing",
  "Cultivating",
  "Deciphering",
  "Deliberating",
  "Determining",
  "Dilly-dallying",
  "Discombobulating",
  "Doing",
  "Doodling",
  "Drizzling",
  "Elucidating",
  "Embellishing",
  "Enchanting",
  "Envisioning",
  "Fermenting",
  "Fiddle-faddling",
  "Finagling",
  "Flambéing",
  "Flowing",
  "Flummoxing",
  "Fluttering",
  "Forging",
  "Forming",
  "Frolicking",
  "Frosting",
  "Gallivanting",
  "Galloping",
  "Garnishing",
  "Generating",
  "Gesticulating",
  "Germinating",
  "Gitifying",
  "Grooving",
  "Gusting",
  "Harmonizing",
  "Hashing",
  "Hatching",
  "Herding",
  "Honking",
  "Hullaballooing",
  "Hyperspacing",
  "Ideating",
  "Imagining",
  "Improvising",
  "Incubating",
  "Inferring",
  "Infusing",
  "Ionizing",
  "Jitterbugging",
  "Julienning",
  "Kneading",
  "Leavening",
  "Levitating",
  "Lollygagging",
  "Manifesting",
  "Marinating",
  "Meandering",
  "Metamorphosing",
  "Misting",
  "Moonwalking",
  "Moseying",
  "Mulling",
  "Musing",
  "Noodling",
  "Percolating",
  "Pondering",
  "Puttering",
  "Reticulating",
  "Scampering",
  "Scurrying",
  "Simmering",
  "Spelunking",
  "Tinkering",
  "Topsy-turvying",
  "Transmuting",
  "Unfurling",
  "Whirring",
  "Wrangling",
  "Zesting",
] as const

/** Past-tense verbs for turn completion, e.g. "Churned for 1s". */
export const TURN_COMPLETION_VERBS = [
  "Baked",
  "Brewed",
  "Churned",
  "Cogitated",
  "Cooked",
  "Crunched",
  "Sautéed",
  "Worked",
] as const

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

const COLORS = {
  claude: { r: 215, g: 119, b: 87 },
  error: { r: 171, g: 43, b: 63 },
} as const

const STATUS_AFTER_MS = 30_000
const FRAME_MS = 120
const GLIMMER_MS = 200

export type Rgb = { r: number; g: number; b: number }

export function pickSpinnerVerb(random: number = Math.random()): string {
  const index = Math.floor(Math.abs(random) * SPINNER_VERBS.length)
  return SPINNER_VERBS[index] ?? SPINNER_VERBS[0]
}

export function pickCompletionVerb(random: number = Math.random()): string {
  const index = Math.floor(Math.abs(random) * TURN_COMPLETION_VERBS.length)
  return TURN_COMPLETION_VERBS[index] ?? "Worked"
}

export function pickSpinnerTip(random: number = Math.random()): string {
  const index = Math.floor(Math.abs(random) * SPINNER_TIPS.length)
  return SPINNER_TIPS[index] ?? SPINNER_TIPS[0]!
}

/**
 * Six glyphs run forward then backward, 120ms per frame. Windows uses `*`
 * where macOS uses `✽`, matching Claude Code's terminal quirk workaround.
 */
export function spinnerFrames(platform: string = process.platform): string[] {
  const glyphs =
    platform === "darwin" ? ["·", "✢", "✳", "✶", "✻", "✽"] : ["·", "✢", "*", "✶", "✻", "✽"]
  return [...glyphs, ...[...glyphs].reverse()]
}

export function spinnerGlyph(elapsedMs: number, frames: string[]): string {
  const frame = Math.floor(Math.max(0, elapsedMs) / FRAME_MS)
  return frames[frame % frames.length] ?? frames[0] ?? "✻"
}

/**
 * Claude Code holds the base color for 3s, then fades to red over 2s.
 * Active tools suppress the stall.
 */
export function stallIntensity(idleMs: number, activeTool: boolean): number {
  if (activeTool) return 0
  return Math.max(0, Math.min(1, (idleMs - 3000) / 2000))
}

export function interpolateRgb(from: Rgb, to: Rgb, t: number): Rgb {
  const mix = Math.max(0, Math.min(1, t))
  return {
    r: Math.round(from.r + (to.r - from.r) * mix),
    g: Math.round(from.g + (to.g - from.g) * mix),
    b: Math.round(from.b + (to.b - from.b) * mix),
  }
}

export function rgbColor(color: Rgb): string {
  return `rgb(${color.r},${color.g},${color.b})`
}

/** Interpolates the spinner tint from Claude orange to the error red. */
export function stallTint(intensity: number): string {
  return rgbColor(interpolateRgb(COLORS.claude, COLORS.error, intensity))
}

/**
 * The shimmer highlight sweeps right to left across the message. Indices
 * within one column of the returned position use the shimmer color.
 */
export function glimmerIndex(
  messageLength: number,
  elapsedMs: number,
  speedMs: number = GLIMMER_MS,
): number {
  const cycleLength = Math.max(1, messageLength) + 20
  const position = Math.floor(Math.max(0, elapsedMs) / speedMs) % cycleLength
  return messageLength + 10 - position
}

export function isShimmerChar(index: number, position: number): boolean {
  return Math.abs(index - position) <= 1
}

/**
 * Timer and token count stay hidden for the first 30 seconds, then drop from
 * the tail when the terminal cannot fit them. The parentheses are added by
 * the caller.
 */
export function visibleStatusParts(
  elapsedMs: number,
  tokens: number,
  availableWidth: number,
): string[] {
  if (elapsedMs <= STATUS_AFTER_MS) return []

  const parts = [formatDuration(elapsedMs)]
  if (tokens > 0) parts.push(`↓ ${formatNumber(tokens)} tokens`)

  while (parts.length > 0) {
    const width = `(${parts.join(" · ")})`.length
    if (width <= availableWidth) return parts
    parts.pop()
  }

  return []
}
