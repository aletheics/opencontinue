import { describe, expect, it } from "vitest"

import { assistantBlock } from "../transcript/format/assistant.js"
import { stableStreamBoundary } from "./stream.js"

describe("stream commit boundary", () => {
  it("keeps incomplete short responses live", () => {
    expect(stableStreamBoundary("one\ntwo\n")).toBe(0)
    expect(stableStreamBoundary("one\n\ntwo\n\n")).toBeGreaterThan(0)
  })

  it("commits complete blocks above the live tail", () => {
    const text = ["paragraph one", "", "paragraph two", "", "paragraph three", ""].join("\n")
    const boundary = stableStreamBoundary(text, 1)

    expect(boundary).toBeGreaterThan(0)
    const committed = text.slice(0, boundary)
    expect(committed.endsWith("\n\n")).toBe(true)
  })

  it("does not fall back to a line inside a paragraph or list", () => {
    expect(stableStreamBoundary("a\nb\nc\nd\ne\nf\ng\nh\n", 1)).toBe(0)
    expect(stableStreamBoundary("- one\n- two\n- three\n- four\n- five\n", 1)).toBe(0)
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
    const text = "start\n`inline code\nstill code`\n\nend\nmore\n"
    const boundary = stableStreamBoundary(text, 2)
    const prefix = text.slice(0, boundary)

    expect(prefix.endsWith("\n\n")).toBe(true)
    expect((prefix.match(/`/g) ?? []).length % 2).toBe(0)
  })

  it("keeps an unclosed inline code span live", () => {
    expect(stableStreamBoundary("start\n`inline code\n\nend\nmore\n", 1)).toBe(0)
  })

  it("keeps an unclosed link live", () => {
    expect(stableStreamBoundary("[docs](https://example.com\n\nnext paragraph\n\nmore\n", 1)).toBe(
      0,
    )
  })
})

/**
 * Simulate the inline commit loop over a fully known message, then compare the
 * concatenated chunk layout with a one-shot render. Chunk items are separated
 * by one blank row, exactly like adjacent `<Static>` items.
 */
function streamingLayout(text: string, width: number): string[] {
  let committed = 0
  const chunks: string[] = []

  for (let end = 1; end <= text.length; end++) {
    const boundary = stableStreamBoundary(text.slice(0, end))
    if (boundary <= committed) continue

    const chunk = text.slice(committed, boundary).replace(/\n+$/, "")
    committed = boundary
    if (chunk.trim()) chunks.push(chunk)
  }

  const tail = text.slice(committed).replace(/\n+$/, "")
  if (tail.trim()) chunks.push(tail)

  return chunks.flatMap((chunk, index) => {
    const lines = assistantBlock(chunk, width, { dotted: index === 0 }).map((line) => line.text)
    return index === 0 ? lines : ["", ...lines]
  })
}

describe("stream layout stability", () => {
  const corpus = [
    "# Release notes",
    "",
    "The parser now handles **tables**, `code`, and [docs](https://example.com).",
    "",
    "## Changes",
    "",
    "- fixed alignment",
    "  - nested item",
    "",
    "| File | Lines | Status |",
    "| --- | ---: | --- |",
    "| src/app.ts | 42 | ok |",
    "",
    "```ts",
    "const answer = 42",
    "```",
    "",
    "> A quote.",
    "",
    "---",
    "",
    "Done.",
  ].join("\n")

  for (const width of [60, 80, 120]) {
    it(`matches a one-shot render at ${width} columns`, () => {
      const expected = assistantBlock(corpus, width).map((line) => line.text)
      const streamed = streamingLayout(corpus, width)

      expect(streamed).toEqual(expected)
      expect(streamed.some((line) => line === "")).toBe(true)
    })
  }

  it("never commits a trailing blank row", () => {
    const chunk = assistantBlock("one\n\ntwo\n\n", 40).map((line) => line.text)

    expect(chunk).toEqual(["● one", "", "  two"])
  })
})
