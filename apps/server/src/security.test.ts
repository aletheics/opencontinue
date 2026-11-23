import { describe, expect, it } from "vitest"

import {
  bearerAuthorized,
  originAllowed,
  resolveServerToken,
} from "./security.js"

describe("server security", () => {
  it("uses configured or environment tokens and generates otherwise", () => {
    expect(resolveServerToken("fixed")).toBe("fixed")
    expect(resolveServerToken(undefined, { OPENCONTINUE_SERVER_TOKEN: "env" })).toBe(
      "env",
    )
    const generated = resolveServerToken(undefined, {})
    expect(generated.length).toBeGreaterThan(20)
    expect(generated).not.toBe(resolveServerToken(undefined, {}))
  })

  it("requires a matching bearer token", () => {
    expect(bearerAuthorized("Bearer secret", "secret")).toBe(true)
    expect(bearerAuthorized("bearer secret", "secret")).toBe(true)
    expect(bearerAuthorized("Bearer wrong", "secret")).toBe(false)
    expect(bearerAuthorized("Basic secret", "secret")).toBe(false)
    expect(bearerAuthorized(undefined, "secret")).toBe(false)
  })

  it("allows same-host and explicitly allow-listed origins", () => {
    expect(originAllowed(undefined, "127.0.0.1:8787", [])).toBe(true)
    expect(
      originAllowed("http://127.0.0.1:8787", "127.0.0.1:8787", []),
    ).toBe(true)
    expect(
      originAllowed("https://app.example", "127.0.0.1:8787", [
        "https://app.example",
      ]),
    ).toBe(true)
    expect(
      originAllowed("https://evil.example", "127.0.0.1:8787", [
        "https://app.example",
      ]),
    ).toBe(false)
    expect(originAllowed("*", "127.0.0.1:8787", ["*"])).toBe(false)
  })
})
