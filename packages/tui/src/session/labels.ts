import type { SessionSnapshot, SessionSummary } from "@opencontinue/protocol"

const GENERIC_TITLES = new Set(["OpenContinue TUI", "Untitled session"])

export function sessionLabel(
  snapshot: SessionSnapshot,
  item: SessionSummary,
): string {
  if (item.title && !GENERIC_TITLES.has(item.title)) return item.title

  const first = snapshot.messages.find((message) => message.role === "user")
  const text = first?.text.replace(/\s+/g, " ").trim()
  if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text

  return item.title || item.id.slice(0, 8)
}

export function filterSessions(
  sessions: readonly SessionSummary[],
  labels: Readonly<Record<string, string>>,
  query: string,
): SessionSummary[] {
  const needle = query.trim().toLowerCase()
  if (!needle) return [...sessions]
  return sessions.filter((item) =>
    `${labels[item.id] ?? item.title} ${item.id}`.toLowerCase().includes(needle),
  )
}
