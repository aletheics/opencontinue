import { describe, expect, it } from "vitest"

import { stableStreamBoundary } from "./stream.js"

describe("stream commit boundary", () => {
  it("keeps short responses live", () => {
    expect(stableStreamBoundary("one\ntwo\n")).toBe(0)
    expect(stableStreamBoundary("one\ntwo\nthree\n")).toBe(8)
  })

  it("commits everything above the live tail", () => {
    const text = Array.from({ length: 12 }, (_, index) => `line ${index}`)
      .map((line) => `${line}\n`)
      .join("")
    const boundary = stableStreamBoundary(text, 4)

    expect(boundary).toBeGreaterThan(0)
    expect(boundary).toBeLessThan(text.length)
    const committed = text.slice(0, boundary)
    expect(committed.endsWith("\n")).toBe(true)
    expect(committed.split("\n").filter(Boolean)).toHaveLength(8)
  })

  it("prefers a blank-line boundary so paragraphs survive", () => {
    const text = "a\nb\nc\nd\n\nparagraph\nmore\nnext\nlast\n"
    const boundary = stableStreamBoundary(text, 3)
    expect(text.slice(0, boundary).endsWith("\n\n")).toBe(true)
  })

  it("does not cut inside a fenced code block", () => {
    const text = "before\n```ts\nconst a = 1\nconst b = 2\nconst c = 3\n```\nafter\n"
    const boundary = stableStreamBoundary(text, 1)
    const prefix = text.slice(0, boundary)

    expect(prefix.endsWith("```\n")).toBe(true)
  })

  it("does not cut inside inline code", () => {
    const text = "start\n`inline code\nstill code`\nend\nmore\n"
    const boundary = stableStreamBoundary(text, 2)
    const prefix = text.slice(0, boundary)

    expect((prefix.match(/`/g) ?? []).length % 2).toBe(0)
  })
})
