import { existsSync, readFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"
import { createInterface } from "node:readline/promises"

import {
  configPath,
  saveAuthConfig,
  saveProviderConfig,
  type ProviderSettings,
} from "@opencontinue/config"
import { parse as parseJsonc, type ParseError } from "jsonc-parser"
import YAML from "yaml"

export type ImportResult = {
  source: "continue" | "opencode"
  file: string
  settings: ProviderSettings
  notes: string[]
}

const COMPATIBLE_BASE_URLS: Record<string, string> = {
  openai: "https://api.openai.com/v1",
  "openai-compatible": "https://api.openai.com/v1",
  deepseek: "https://api.deepseek.com/v1",
  openrouter: "https://openrouter.ai/api/v1",
  groq: "https://api.groq.com/openai/v1",
  mistral: "https://api.mistral.ai/v1",
  xai: "https://api.x.ai/v1",
  together: "https://api.together.xyz/v1",
  fireworks: "https://api.fireworks.ai/inference/v1",
  vllm: "http://127.0.0.1:8000/v1",
  lmstudio: "http://127.0.0.1:1234/v1",
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function resolveTemplate(
  value: unknown,
  baseDir: string,
  notes: string[],
): string | undefined {
  if (typeof value !== "string" || !value) return undefined

  const env = value.match(/^\{env:([A-Za-z_][A-Za-z0-9_]*)\}$/)
  if (env) return process.env[env[1]!]

  const file = value.match(/^\{file:(.+)\}$/)
  if (file) {
    let target = file[1]!
    if (target.startsWith("~/")) target = path.join(os.homedir(), target.slice(2))
    target = path.isAbsolute(target) ? target : path.resolve(baseDir, target)
    try {
      return readFileSync(target, "utf8").trim()
    } catch {
      notes.push(`Could not read ${target}`)
      return undefined
    }
  }

  const continueSecret = value.match(
    /^\$\{\{\s*(?:inputs|secrets)\.([A-Za-z_][A-Za-z0-9_]*)\s*\}\}$/,
  )
  if (continueSecret) {
    const resolved = process.env[continueSecret[1]!]
    if (!resolved) notes.push(`Environment variable ${continueSecret[1]} is not set.`)
    return resolved
  }

  const dollar = value.match(/^\$([A-Za-z_][A-Za-z0-9_]*)$/)
  if (dollar) return process.env[dollar[1]!]

  return value
}

function mapProvider(
  provider: string,
  apiBase: string | undefined,
  notes: string[],
): Pick<ProviderSettings, "provider" | "baseUrl"> {
  const id = provider.toLowerCase()

  if (id === "ollama") {
    return {
      provider: "ollama",
      baseUrl: apiBase ?? "http://127.0.0.1:11434/v1",
    }
  }

  if (COMPATIBLE_BASE_URLS[id]) {
    return {
      provider: "openai-compatible",
      baseUrl: apiBase ?? COMPATIBLE_BASE_URLS[id],
    }
  }

  if (apiBase) {
    notes.push(`Provider "${provider}" is not native; using apiBase as an OpenAI-compatible endpoint.`)
    return { provider: "openai-compatible", baseUrl: apiBase }
  }

  notes.push(`Provider "${provider}" has no OpenAI-compatible endpoint; configure it manually.`)
  return {}
}

export function readContinueConfig(
  file = path.join(os.homedir(), ".continue", "config.yaml"),
): ImportResult {
  if (!existsSync(file)) throw new Error(`Continue config not found: ${file}`)

  const parsed = YAML.parse(readFileSync(file, "utf8")) as unknown
  const models = isRecord(parsed) && Array.isArray(parsed.models) ? parsed.models : []
  const selected =
    models.find(
      (model) =>
        isRecord(model) && Array.isArray(model.roles) && model.roles.includes("chat"),
    ) ?? models[0]

  if (!isRecord(selected)) throw new Error(`No models found in ${file}`)

  const provider = String(selected.provider ?? "")
  const model = String(selected.model ?? "")
  if (!model) throw new Error(`Selected model in ${file} has no model name`)

  const notes: string[] = []
  const apiBase =
    typeof selected.apiBase === "string" ? selected.apiBase : undefined
  const mapped = mapProvider(provider, apiBase, notes)
  const apiKey = resolveTemplate(selected.apiKey, path.dirname(file), notes)

  return {
    source: "continue",
    file,
    settings: { ...mapped, model, apiKey },
    notes,
  }
}

function findOpenCodeConfig(): string | undefined {
  const candidates = [
    path.join(process.cwd(), "opencode.jsonc"),
    path.join(process.cwd(), "opencode.json"),
    path.join(process.cwd(), ".opencode", "opencode.jsonc"),
    path.join(process.cwd(), ".opencode", "opencode.json"),
    path.join(os.homedir(), ".config", "opencode", "opencode.jsonc"),
    path.join(os.homedir(), ".config", "opencode", "opencode.json"),
  ]

  if (process.env.APPDATA) {
    candidates.push(path.join(process.env.APPDATA, "opencode", "opencode.jsonc"))
    candidates.push(path.join(process.env.APPDATA, "opencode", "opencode.json"))
  }

  return candidates.find((candidate) => existsSync(candidate))
}

export function readOpenCodeConfig(file = findOpenCodeConfig()): ImportResult {
  if (!file) throw new Error("OpenCode config not found")
  if (!existsSync(file)) throw new Error(`OpenCode config not found: ${file}`)

  const errors: ParseError[] = []
  const parsed = parseJsonc(readFileSync(file, "utf8"), errors, {
    allowTrailingComma: true,
  }) as unknown
  if (errors.length > 0) {
    throw new Error(`Invalid OpenCode config: ${file}`)
  }
  const data = isRecord(parsed) ? parsed : {}

  const notes: string[] = []
  const modelValue = resolveTemplate(data.model, path.dirname(file), notes)
  if (!modelValue) throw new Error(`OpenCode config has no model: ${file}`)

  const [providerId, ...modelParts] = modelValue.split("/")
  if (!providerId || modelParts.length === 0) {
    throw new Error(`OpenCode model must use provider/model format: ${modelValue}`)
  }
  const model = modelParts.join("/").split("#")[0]!

  const providers = isRecord(data.providers) ? data.providers : {}
  const providerConfig = isRecord(providers[providerId]) ? providers[providerId] : {}
  const settings = isRecord(providerConfig.settings) ? providerConfig.settings : {}
  const apiBase = resolveTemplate(
    settings.baseURL ?? settings.baseUrl,
    path.dirname(file),
    notes,
  )
  const apiKey = resolveTemplate(settings.apiKey, path.dirname(file), notes)
  const mapped = mapProvider(providerId, apiBase, notes)

  return {
    source: "opencode",
    file,
    settings: { ...mapped, model, apiKey },
    notes,
  }
}

export async function importCommand(
  source: string,
  options: { path?: string; yes?: boolean },
): Promise<void> {
  if (source !== "continue" && source !== "opencode") {
    throw new Error('Import source must be "continue" or "opencode".')
  }

  const result =
    source === "continue" ? readContinueConfig(options.path) : readOpenCodeConfig(options.path)

  console.log(`source:   ${result.source} (${result.file})`)
  console.log(`provider: ${result.settings.provider ?? "(unsupported)"}`)
  console.log(`baseUrl:  ${result.settings.baseUrl ?? "(default)"}`)
  console.log(`model:    ${result.settings.model ?? "(unset)"}`)
  console.log(`apiKey:   ${result.settings.apiKey ? "(found)" : "(not found)"}`)
  for (const note of result.notes) console.log(`note:     ${note}`)

  if (!result.settings.provider) {
    throw new Error("No supported provider found; run `npm run dev -- setup` instead.")
  }

  if (!options.yes) {
    const rl = createInterface({ input: process.stdin, output: process.stdout })
    try {
      const answer = (await rl.question("\nApply to OpenContinue? [y/N] ")).trim()
      if (!/^y/i.test(answer)) return
    } finally {
      rl.close()
    }
  }

  saveProviderConfig({
    provider: result.settings.provider,
    baseUrl: result.settings.baseUrl,
    model: result.settings.model,
  })
  if (result.settings.apiKey) saveAuthConfig({ apiKey: result.settings.apiKey })

  console.log(`\nSaved to ${configPath()}`)
  if (!result.settings.apiKey) {
    console.log("Run `npm run dev -- setup` to add an API key.")
  }
}
