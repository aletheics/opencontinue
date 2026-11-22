import type { SessionEvent } from "@opencontinue/protocol"

export type UserTimelineItem = {
  kind: "user"
  id: string
  text: string
}

export type AssistantTimelineItem = {
  kind: "assistant"
  id: string
  runId: string
  text: string
}

export type ToolTimelineItem = {
  kind: "tool"
  id: string
  runId: string
  name: string
  input: unknown
  status: "running" | "done" | "failed"
  output?: string
  error?: string
}

export type TimelineItem = UserTimelineItem | AssistantTimelineItem | ToolTimelineItem

export function reduceTimeline(items: TimelineItem[], event: SessionEvent): TimelineItem[] {
  if (event.type === "message.user") {
    return [...items, { kind: "user", id: `user:${event.seq}`, text: event.text }]
  }

  if (event.type === "run.started") {
    return [
      ...items,
      {
        kind: "assistant",
        id: `assistant:${event.runId}:${event.seq}`,
        runId: event.runId,
        text: "",
      },
    ]
  }

  if (event.type === "message.assistant.delta") {
    const last = items.at(-1)
    if (last?.kind === "assistant" && last.runId === event.runId) {
      return [...items.slice(0, -1), { ...last, text: last.text + event.text }]
    }
    return [
      ...items,
      {
        kind: "assistant",
        id: `assistant:${event.runId}:${event.seq}`,
        runId: event.runId,
        text: event.text,
      },
    ]
  }

  if (event.type === "tool.started") {
    return [
      ...items,
      {
        kind: "tool",
        id: `tool:${event.callId}`,
        runId: event.runId,
        name: event.name,
        input: event.input,
        status: "running",
      },
    ]
  }

  if (event.type === "tool.completed") {
    return items.map((item) =>
      item.kind === "tool" && item.id === `tool:${event.callId}`
        ? { ...item, status: "done", output: event.output }
        : item,
    )
  }

  if (event.type === "tool.failed") {
    return items.map((item) =>
      item.kind === "tool" && item.id === `tool:${event.callId}`
        ? { ...item, status: "failed", error: event.error }
        : item,
    )
  }

  if (event.type === "run.failed") {
    return [
      ...items,
      {
        kind: "assistant",
        id: `assistant:${event.runId}:error:${event.seq}`,
        runId: event.runId,
        text: `Run failed: ${event.error}`,
      },
    ]
  }

  return items
}

export function timelineFromEvents(events: SessionEvent[]): TimelineItem[] {
  return events.reduce(reduceTimeline, [] as TimelineItem[])
}

export function toolLabel(item: ToolTimelineItem): string {
  const input =
    typeof item.input === "object" && item.input !== null
      ? (item.input as Record<string, unknown>)
      : {}
  const path = typeof input.path === "string" ? input.path : undefined
  const command = typeof input.command === "string" ? input.command : undefined
  const pattern = typeof input.pattern === "string" ? input.pattern : undefined

  switch (item.name) {
    case "read":
      return `Read ${path ?? ""}`.trim()
    case "write":
      return `Write ${path ?? ""}`.trim()
    case "edit":
      return `Edit ${path ?? ""}`.trim()
    case "bash":
      return `Bash ${command ?? ""}`.trim()
    case "grep":
      return `Grep ${pattern ?? ""}`.trim()
    case "glob":
      return `Glob ${pattern ?? ""}`.trim()
    default:
      return item.name
  }
}
