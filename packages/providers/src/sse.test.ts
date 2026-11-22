import { describe, expect, it } from "vitest"

import { SseParser } from "./index.js"

describe("SseParser", () => {
  it("handles events split across chunks", () => {
    const parser = new SseParser()
    expect(parser.push('data: {"a":1}\n\ndata: {"b"')).toEqual(['{"a":1}'])
    expect(parser.push(':2}\n\n')).toEqual(['{"b":2}'])
  })

  it("joins multiple data lines", () => {
    const parser = new SseParser()
    expect(parser.push("data: one\ndata: two\n\n")).toEqual(["one\ntwo"])
  })

  it("normalizes CRLF and flushes a trailing event", () => {
    const parser = new SseParser()
    expect(parser.push("data: x\r\n\r\n")).toEqual(["x"])
    expect(parser.push("data: tail")).toEqual([])
    expect(parser.flush()).toEqual(["tail"])
  })
})
