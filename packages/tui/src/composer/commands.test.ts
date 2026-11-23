import { describe, expect, it } from "vitest"

import { HELP_TEXT, matchSlashCommands, SLASH_COMMANDS } from "./commands.js"

describe("slash commands", () => {
  it("matches a bare prefix", () => {
    expect(matchSlashCommands("/re").map((command) => command.name)).toEqual([
      "/resume",
      "/reasoning",
      "/rewind",
    ])
  })

  it("lists commands for a bare slash and closes on arguments", () => {
    expect(matchSlashCommands("/").length).toBe(5)
    expect(matchSlashCommands("/help now")).toEqual([])
    expect(matchSlashCommands("help")).toEqual([])
  })

  it("builds help from the same source and documents keys", () => {
    expect(
      HELP_TEXT.split("\n").filter((line) => line.startsWith("/")),
    ).toHaveLength(SLASH_COMMANDS.length)
    expect(HELP_TEXT).toContain("/resume — resume a session")
    expect(HELP_TEXT).toContain("Shift+Tab  cycle Plan/Confirm/Auto")
    expect(HELP_TEXT).toContain("Ctrl+O     expanded transcript")
  })
})
