export type ViewportWindow = {
  start: number
  end: number
  hiddenAbove: number
  hiddenBelow: number
  atBottom: boolean
  maxScroll: number
}

/**
 * Window a transcript from the bottom. `scrollFromBottom` is how many lines
 * the user has scrolled up; zero follows the tail.
 */
export function viewportWindow(
  total: number,
  height: number,
  scrollFromBottom: number,
): ViewportWindow {
  const safeHeight = Math.max(1, height)
  const safeTotal = Math.max(0, total)
  const maxScroll = Math.max(0, safeTotal - safeHeight)
  const scroll = Math.max(0, Math.min(scrollFromBottom, maxScroll))
  const end = safeTotal - scroll
  const start = Math.max(0, end - safeHeight)

  return {
    start,
    end,
    hiddenAbove: start,
    hiddenBelow: safeTotal - end,
    atBottom: scroll === 0,
    maxScroll,
  }
}

/** Rows left for the transcript after the fixed fullscreen regions. */
export function fullscreenViewportHeight(regions: {
  rows: number
  header: number
  activity: number
  todos: number
  queued: number
  composer: number
  menus: number
  footer: number
}): number {
  const used =
    regions.header +
    regions.activity +
    regions.todos +
    regions.queued +
    regions.composer +
    regions.menus +
    regions.footer +
    1
  return Math.max(3, regions.rows - used)
}

export function scrollViewport(
  current: number,
  total: number,
  height: number,
  delta: number,
): number {
  const maxScroll = Math.max(0, total - Math.max(1, height))
  return Math.max(0, Math.min(current + delta, maxScroll))
}
