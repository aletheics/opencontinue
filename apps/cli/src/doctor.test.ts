import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import { doctorExitCode, formatDoctor, runDoctor } from "./doctor.js"

let workspace = ""
let home = ""
let previousHome: string | undefined
let previousProvider: string | undefined

beforeEach(async () => {
  workspace = await mkdtemp(path.join(os.tmpdir(), "opencontinue-doctor-"))
  home = await mkdtemp(path.join(os.tmpdir(), "opencontinue-doctor-home-"))
  previousHome = process.env.OPENCONTINUE_HOME
  previousProvider = process.env.OPENCONTINUE_PROVIDER
  process.env.OPENCONTINUE_HOME = home
  process.env.OPENCONTINUE_PROVIDER = "echo"
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.OPENCONTINUE_HOME
  else process.env.OPENCONTINUE_HOME = previousHome
  if (previousProvider === undefined) delete process.env.OPENCONTINUE_PROVIDER
  else process.env.OPENCONTINUE_PROVIDER = previousProvider
  await rm(workspace, { recursive: true, force: true })
  await rm(home, { recursive: true, force: true })
})

describe("doctor", () => {
  it("reports the local environment without failing on a fresh workspace", async () => {
    const checks = await runDoctor({ workspace })
    const byName = Object.fromEntries(checks.map((check) => [check.name, check]))

    expect(byName.node?.status).toBe("ok")
    expect(byName.workspace?.status).toBe("ok")
    expect(byName.git?.status).toBe("warn")
    expect(byName.config?.status).toBe("warn")
    expect(byName.auth?.status).toBe("warn")
    expect(byName.provider?.status).toBe("ok")
    expect(byName.sessions?.status).toBe("ok")
    expect(doctorExitCode(checks)).toBe(0)

    const text = formatDoctor(checks)
    expect(text).toContain("workspace")
    expect(text).toContain("sessions")
    expect(text).toContain("warning")
  })

  it("reads a git branch and reports config files when present", async () => {
    await mkdir(path.join(workspace, ".git"), { recursive: true })
    await writeFile(path.join(workspace, ".git", "HEAD"), "ref: refs/heads/main\n")
    await writeFile(path.join(home, "config.json"), "{}\n")
    await writeFile(path.join(home, "auth.json"), "{}\n")

    const checks = await runDoctor({ workspace })
    const byName = Object.fromEntries(checks.map((check) => [check.name, check]))

    expect(byName.git).toMatchObject({ status: "ok", detail: expect.stringContaining("main") })
    expect(byName.config?.status).toBe("ok")
    expect(byName.auth?.status).toBe("ok")
  })
})
