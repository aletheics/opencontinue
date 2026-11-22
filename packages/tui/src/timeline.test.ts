import type { SessionEvent } from "@opencontinue/protocol"
import { describe, expect, it } from "vitest"

import { timelineFromEvents, toolLabel, type ToolTimelineItem } from "./timeline.js"

const base = { sessionId: "session", at: "2026-01-01T00:00:00.000Z" }

describe("timeline", () => {
  it("interleaves assistant text, tools, and later assistant text", () => {
    const events: SessionEvent[] = [
      { ...base, seq: 1, type: "message.user", text: "run tests" },
      { ...base, seq: 2, type: "run.started", runId: "r1" },
      { ...base, seq: 3, type: "message.assistant.delta", runId: "r1", text: "Checking." },
      {
        ...base,
        seq: 4,
        type: "tool.started",
        runId: "r1",
        callId: "c1",
        name: "bash",
        input: { command: "npm test" },
      },
      {
        ...base,
        seq: 5,
        type: "tool.completed",
        runId: "r1",
        callId: "c1",
        output: "12 passed",
      },
      { ...base, seq: 6, type: "message.assistant.delta", runId: "r1", text: "All green." },
      { ...base, seq: 7, type: "run.completed", runId: "r1" },
    ]

    const timeline = timelineFromEvents(events)
    expect(timeline.map((item) => item.kind)).toEqual([
      "user",
      "assistant",
      "tool",
      "assistant",
    ])
    expect(timeline[2]).toMatchObject({ status: "done", output: "12 passed" })
    expect(timeline[3]).toMatchObject({ text: "All green." })
  })

  it("labels common tools with their arguments", () => {
    const item: ToolTimelineItem = {
      kind: "tool",
      id: "tool:c1",
      runId: "r1",
      name: "bash",
      input: { command: "npm test" },
      status: "running",
    }
    expect(toolLabel(item)).toBe("Bash npm test")
  })
})
