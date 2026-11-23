import { mkdtemp, rm, writeFile } from "node:fs/promises"
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
    expect(loadAuthConfig()).toMatchObject({ apiKey: "secret" })
    expect(configPath()).toBe(path.join(home, "config.json"))
    expect(authPath()).toBe(path.join(home, "auth.json"))
  })

  it("uses the key for the selected provider", () => {
    saveProviderConfig({ provider: "deepseek" })
    saveAuthConfig({ keys: { deepseek: "deep-key", openai: "open-key" } })

    expect(resolveProviderSettings({}).apiKey).toBe("deep-key")
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
      permissionMode: undefined,
      reasoningEffort: undefined,
    })
  })

  it("accepts UTF-8 BOM in config and auth files", async () => {
    const bom = String.fromCharCode(0xfeff)
    await writeFile(
      path.join(home, "config.json"),
      bom + JSON.stringify({ provider: "deepseek", model: "deepseek-chat" }),
      "utf8",
    )
    await writeFile(
      path.join(home, "auth.json"),
      bom + JSON.stringify({ keys: { deepseek: "bom-key" } }),
      "utf8",
    )

    expect(loadProviderConfig()).toMatchObject({
      provider: "deepseek",
      model: "deepseek-chat",
    })
    expect(resolveProviderSettings({}).apiKey).toBe("bom-key")
  })

  it("does not leak OPENAI_* env into another provider", () => {
    saveProviderConfig({ provider: "claude" })
    saveAuthConfig({ keys: { claude: "claude-key" } })

    const claude = resolveProviderSettings({
      OPENCONTINUE_PROVIDER: "claude",
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-6.2",
    })
    expect(claude.apiKey).toBe("claude-key")
    expect(claude.baseUrl).toBeUndefined()
    expect(claude.model).toBeUndefined()

    const openai = resolveProviderSettings({
      OPENCONTINUE_PROVIDER: "openai",
      OPENAI_API_KEY: "openai-key",
      OPENAI_BASE_URL: "https://api.openai.com/v1",
      OPENAI_MODEL: "gpt-6.2",
    })
    expect(openai).toMatchObject({
      apiKey: "openai-key",
      baseUrl: "https://api.openai.com/v1",
      model: "gpt-6.2",
    })
  })

  it("persists and resolves the permission mode", () => {
    saveProviderConfig({ permissionMode: "auto" })
    expect(resolveProviderSettings({}).permissionMode).toBe("auto")
    expect(
      resolveProviderSettings({ OPENCONTINUE_PERMISSION_MODE: "plan" })
        .permissionMode,
    ).toBe("plan")
    expect(
      resolveProviderSettings({ OPENCONTINUE_PERMISSION_MODE: "readonly" })
        .permissionMode,
    ).toBe("plan")
  })

  it("persists and resolves reasoning effort", () => {
    saveProviderConfig({ reasoningEffort: "high" })
    expect(resolveProviderSettings({}).reasoningEffort).toBe("high")
    expect(
      resolveProviderSettings({ OPENCONTINUE_REASONING_EFFORT: "low" })
        .reasoningEffort,
    ).toBe("low")
  })
})
