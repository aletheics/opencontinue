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

  it("keeps tool diffs and token usage", () => {
    const events: SessionEvent[] = [
      { ...base, seq: 1, type: "run.started", runId: "r1" },
      {
        ...base,
        seq: 2,
        type: "tool.started",
        runId: "r1",
        callId: "c1",
        name: "edit",
        input: { path: "a.ts" },
      },
      {
        ...base,
        seq: 3,
        type: "tool.completed",
        runId: "r1",
        callId: "c1",
        output: "Replaced 1",
        diff: "+const a = 2",
      },
      {
        ...base,
        seq: 4,
        type: "usage",
        runId: "r1",
        inputTokens: 10,
        outputTokens: 5,
        totalTokens: 15,
      },
    ]

    const timeline = timelineFromEvents(events)
    expect(timeline.find((item) => item.kind === "tool")).toMatchObject({
      diff: "+const a = 2",
    })
    expect(timeline.find((item) => item.kind === "usage")).toMatchObject({
      totalTokens: 15,
    })
  })

  it("marks a non-zero shell exit as a failed tool", () => {
    const events: SessionEvent[] = [
      { ...base, seq: 1, type: "run.started", runId: "r1" },
      {
        ...base,
        seq: 2,
        type: "tool.started",
        runId: "r1",
        callId: "c1",
        name: "bash",
        input: { command: "npm test" },
      },
      {
        ...base,
        seq: 3,
        type: "tool.completed",
        runId: "r1",
        callId: "c1",
        output: "1 failed\nExit code 1",
        failed: true,
        exitCode: 1,
        timedOut: false,
      },
    ]

    const item = timelineFromEvents(events).find(
      (entry): entry is ToolTimelineItem => entry.kind === "tool",
    )
    expect(item).toMatchObject({
      status: "failed",
      output: "1 failed\nExit code 1",
      exitCode: 1,
      timedOut: false,
    })
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
