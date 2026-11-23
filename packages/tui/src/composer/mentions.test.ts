import { describe, expect, it } from "vitest"

import {
  completeMention,
  filterWorkspaceFiles,
  mentionQueryAt,
} from "./mentions.js"

describe("@file mentions", () => {
  it("detects a token at a word boundary", () => {
    expect(mentionQueryAt("see @src/ap", 11)).toBe("src/ap")
    expect(mentionQueryAt("@ap", 3)).toBe("ap")
    expect(mentionQueryAt("name@host", 9)).toBeNull()
    expect(mentionQueryAt("plain", 5)).toBeNull()
  })

  it("ranks basename prefixes first", () => {
    expect(
      filterWorkspaceFiles(
        ["src/app.ts", "docs/application.md", "src/zap.ts"],
        "ap",
      ),
    ).toEqual(["src/app.ts", "docs/application.md", "src/zap.ts"])
  })

  it("replaces the active token and adds a trailing space", () => {
    expect(completeMention("look @ap", 8, "src/app.ts")).toEqual({
      value: "look @src/app.ts ",
      cursor: 17,
    })
    expect(completeMention("mail a@b", 9, "src/app.ts")).toBeNull()
  })
})
