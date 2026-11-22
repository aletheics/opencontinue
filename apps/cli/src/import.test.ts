import { mkdtemp, rm, writeFile } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { readContinueConfig, readOpenCodeConfig } from "./import.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
  delete process.env.OPENCONTINUE_IMPORT_KEY
})

async function makeFile(name: string, content: string): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-import-"))
  temporary.push(directory)
  const file = path.join(directory, name)
  await writeFile(file, content)
  return file
}

describe("import", () => {
  it("imports a Continue chat model", async () => {
    const file = await makeFile(
      "config.yaml",
      `models:
  - name: deepseek
    provider: deepseek
    model: deepseek-chat
    apiKey: test-key
    roles: [chat]
`,
    )

    const result = readContinueConfig(file)
    expect(result.settings).toMatchObject({
      provider: "openai-compatible",
      baseUrl: "https://api.deepseek.com/v1",
      model: "deepseek-chat",
      apiKey: "test-key",
    })
  })

  it("imports an OpenCode JSONC config with comments and trailing commas", async () => {
    process.env.OPENCONTINUE_IMPORT_KEY = "env-key"
    const file = await makeFile(
      "opencode.jsonc",
      `{
  // default model
  "model": "openai/gpt-4o",
  "providers": {
    "openai": {
      "settings": {
        "baseURL": "https://example.test/v1",
        "apiKey": "{env:OPENCONTINUE_IMPORT_KEY}",
      },
    },
  },
}`,
    )

    const result = readOpenCodeConfig(file)
    expect(result.settings).toMatchObject({
      provider: "openai-compatible",
      baseUrl: "https://example.test/v1",
      model: "gpt-4o",
      apiKey: "env-key",
    })
  })

  it("reports unsupported providers", async () => {
    const file = await makeFile(
      "config.yaml",
      `models:
  - provider: anthropic
    model: claude-sonnet
    roles: [chat]
`,
    )

    const result = readContinueConfig(file)
    expect(result.settings.provider).toBeUndefined()
    expect(result.notes.join(" ")).toContain("OpenAI-compatible")
  })
})
