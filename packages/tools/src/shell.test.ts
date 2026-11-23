import { describe, expect, it } from "vitest"

import {
  decodeOutput,
  resolveShell,
  shellArgs,
  shellFamily,
} from "./shell.js"

describe("shell selection", () => {
  it("names shell families from Windows and POSIX paths", () => {
    expect(shellFamily("C:\\Windows\\System32\\cmd.exe")).toBe("cmd")
    expect(shellFamily("C:\\Program Files\\PowerShell\\7\\pwsh.exe")).toBe(
      "powershell",
    )
    expect(shellFamily("C:\\Program Files\\Git\\bin\\bash.exe")).toBe("bash")
    expect(shellFamily("/bin/bash")).toBe("bash")
    expect(shellFamily("/bin/sh")).toBe("bash")
  })

  it("builds UTF-8 command arguments per shell", () => {
    expect(shellArgs("C:\\Windows\\System32\\cmd.exe", "echo hi")).toEqual([
      "/d",
      "/s",
      "/c",
      "chcp 65001>nul & echo hi",
    ])

    const powershell = shellArgs(
      "C:\\Windows\\System32\\WindowsPowerShell\\v1.0\\powershell.exe",
      "Get-Date",
    )
    expect(powershell).toContain("-Command")
    expect(powershell.at(-1)).toContain("[Console]::OutputEncoding")
    expect(powershell.at(-1)).toContain("Get-Date")

    expect(shellArgs("/bin/bash", "echo hi")).toEqual(["-c", "echo hi"])
  })

  it("resolves a POSIX shell from the environment", () => {
    const shell = resolveShell("echo hi", "linux", {
      SHELL: "/bin/sh",
      PATH: "/bin:/usr/bin",
    })

    expect(shell.args).toEqual(["-c", "echo hi"])
    expect(shell.name).toBe("bash")
  })
})

describe("output decoding", () => {
  it("reads UTF-8 and legacy Chinese Windows output", () => {
    expect(decodeOutput(Buffer.from("中文", "utf8"))).toBe("中文")
    expect(
      decodeOutput(Buffer.from([0xd6, 0xd0, 0xce, 0xc4]), "win32"),
    ).toBe("中文")
    expect(
      decodeOutput(Buffer.from([0xff, 0xfe, 0x2d, 0x4e]), "win32"),
    ).toBe("中")
  })
})
