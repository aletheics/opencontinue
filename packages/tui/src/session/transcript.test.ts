import { describe, expect, it } from "vitest"

import type { TimelineItem } from "../timeline.js"
import { isCommittedItem, partitionTimeline } from "./transcript.js"

const user: TimelineItem = { kind: "user", id: "u", text: "hi" }
const assistant: TimelineItem = {
  kind: "assistant",
  id: "a",
  runId: "r",
  text: "working",
}
const tool: TimelineItem = {
  kind: "tool",
  id: "t",
  runId: "r",
  name: "read",
  input: {},
  status: "done",
  output: "file",
}
const running: TimelineItem = {
  kind: "tool",
  id: "t2",
  runId: "r",
  name: "bash",
  input: {},
  status: "running",
}

describe("transcript partition", () => {
  it("commits durable items and completed tools", () => {
    expect(isCommittedItem(user, 0, [user], true)).toBe(true)
    expect(isCommittedItem(tool, 0, [tool], true)).toBe(true)
    expect(isCommittedItem(running, 0, [running], true)).toBe(false)
  })

  it("keeps the streaming assistant live until a later item exists", () => {
    expect(isCommittedItem(assistant, 0, [assistant], true)).toBe(false)
    expect(isCommittedItem(assistant, 0, [assistant, running], true)).toBe(true)
    expect(isCommittedItem(assistant, 0, [assistant], false)).toBe(true)
  })

  it("partitions and drops usage", () => {
    const usage: TimelineItem = {
      kind: "usage",
      id: "usage",
      inputTokens: 1,
      outputTokens: 2,
      totalTokens: 3,
    }
    const result = partitionTimeline([user, assistant, running, usage], true)
    expect(result.committed.map((item) => item.id)).toEqual(["u", "a"])
    expect(result.live.map((item) => item.id)).toEqual(["t2"])
  })
})
