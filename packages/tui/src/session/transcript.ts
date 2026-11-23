import type { TimelineItem } from "../timeline.js"

/**
 * An item is printed once to scrollback when it will never change again.
 * The streaming assistant stays live until a later item or the run ends.
 */
export function isCommittedItem(
  item: TimelineItem,
  index: number,
  items: TimelineItem[],
  busy: boolean,
): boolean {
  if (item.kind === "usage") return false
  if (
    item.kind === "user" ||
    item.kind === "system" ||
    item.kind === "meta" ||
    item.kind === "banner"
  ) {
    return true
  }
  if (item.kind === "tool") return item.status !== "running"
  if (item.kind === "assistant") {
    // Streamed prefixes are immutable once printed, even while the run is live.
    if (item.id.startsWith("stream:")) return true
    if (!busy) return true
    return items.slice(index + 1).some((later) => later.kind !== "usage")
  }
  return false
}

export function partitionTimeline(
  items: TimelineItem[],
  busy: boolean,
): { committed: TimelineItem[]; live: TimelineItem[] } {
  const committed: TimelineItem[] = []
  const live: TimelineItem[] = []

  items.forEach((item, index) => {
    if (item.kind === "usage") return
    if (isCommittedItem(item, index, items, busy)) committed.push(item)
    else live.push(item)
  })

  return { committed, live }
}
