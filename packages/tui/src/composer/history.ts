/**
 * Newest-first history matches. A blank query lists recent entries.
 */
export function searchHistory(
  entries: readonly string[],
  query: string,
  limit = 20,
): string[] {
  const needle = query.trim().toLowerCase()
  const matches = needle
    ? entries.filter((entry) => entry.toLowerCase().includes(needle))
    : entries
  return [...matches].reverse().slice(0, Math.max(1, limit))
}

export function historyIndexAfterMove(
  current: number,
  delta: number,
  length: number,
): number {
  if (length === 0) return -1
  if (current < 0) return delta < 0 ? length - 1 : -1
  const next = current + delta
  if (next < 0) return 0
  if (next >= length) return -1
  return next
}
