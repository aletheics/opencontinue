import { randomUUID } from "node:crypto"

import type { SessionSnapshot, SessionSummary } from "@opencontinue/protocol"
import { describe, expect, it } from "vitest"

import { filterSessions, sessionLabel } from "./labels.js"

const id = randomUUID()

function summary(title: string): SessionSummary {
  return {
    id,
    title,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    lastSeq: 1,
  }
}

function snapshot(messages: SessionSnapshot["messages"]): SessionSnapshot {
  return { ...summary("OpenContinue TUI"), messages }
}

describe("session labels", () => {
  it("keeps an explicit title", () => {
    expect(sessionLabel(snapshot([]), summary("Release work"))).toBe("Release work")
  })

  it("uses the first user message for generic titles", () => {
    expect(
      sessionLabel(snapshot([{ role: "assistant", text: "hi" }, { role: "user", text: "fix\nthe parser" }]), summary("OpenContinue TUI")),
    ).toBe("fix the parser")
  })

  it("keeps the stored title when there is no user message", () => {
    expect(sessionLabel(snapshot([]), summary("Untitled session"))).toBe(
      "Untitled session",
    )
  })

  it("filters by label or id", () => {
    const labels = { [id]: "fix parser" }
    expect(filterSessions([summary("x")], labels, "parser")).toHaveLength(1)
    expect(filterSessions([summary("x")], labels, id.slice(0, 4))).toHaveLength(1)
    expect(filterSessions([summary("x")], labels, "nope")).toHaveLength(0)
  })
})
