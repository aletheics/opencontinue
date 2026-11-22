import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, beforeEach, describe, expect, it } from "vitest"

import {
  authPath,
  configPath,
  loadAuthConfig,
  loadProviderConfig,
  resolveProviderSettings,
  saveAuthConfig,
  saveProviderConfig,
} from "./index.js"

let home = ""
let previousHome: string | undefined

beforeEach(async () => {
  home = await mkdtemp(path.join(os.tmpdir(), "opencontinue-config-"))
  previousHome = process.env.OPENCONTINUE_HOME
  process.env.OPENCONTINUE_HOME = home
})

afterEach(async () => {
  if (previousHome === undefined) delete process.env.OPENCONTINUE_HOME
  else process.env.OPENCONTINUE_HOME = previousHome
  await rm(home, { recursive: true, force: true })
})

describe("config", () => {
  it("saves and loads provider config and auth", () => {
    saveProviderConfig({ provider: "openai-compatible", baseUrl: "https://api.example.test/v1", model: "test" })
    saveAuthConfig({ apiKey: "secret" })

    expect(loadProviderConfig()).toMatchObject({
      provider: "openai-compatible",
      baseUrl: "https://api.example.test/v1",
      model: "test",
    })
    expect(loadAuthConfig()).toEqual({ apiKey: "secret" })
    expect(configPath()).toBe(path.join(home, "config.json"))
    expect(authPath()).toBe(path.join(home, "auth.json"))
  })

  it("lets environment variables override files", () => {
    saveProviderConfig({ provider: "ollama", baseUrl: "http://127.0.0.1:11434/v1", model: "qwen" })
    saveAuthConfig({ apiKey: "file-key" })

    const settings = resolveProviderSettings({
      OPENCONTINUE_PROVIDER: "openai-compatible",
      OPENCONTINUE_BASE_URL: "https://env.example.test/v1",
      OPENCONTINUE_API_KEY: "env-key",
      OPENCONTINUE_MODEL: "env-model",
    })

    expect(settings).toEqual({
      provider: "openai-compatible",
      baseUrl: "https://env.example.test/v1",
      apiKey: "env-key",
      model: "env-model",
    })
  })
})
