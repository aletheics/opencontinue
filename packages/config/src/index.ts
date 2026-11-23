import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export type PermissionModeSetting = "plan" | "confirm" | "auto"
export type ReasoningEffortSetting =
  | "auto"
  | "low"
  | "medium"
  | "high"
  | "max"

export type ProviderConfig = {
  provider?: string
  baseUrl?: string
  model?: string
  /** Last execution mode chosen in the TUI. */
  permissionMode?: PermissionModeSetting
  /** Last reasoning effort chosen in the TUI. */
  reasoningEffort?: ReasoningEffortSetting
}

export function normalizeReasoningEffortSetting(
  value: unknown,
): ReasoningEffortSetting | undefined {
  if (
    value === "auto" ||
    value === "low" ||
    value === "medium" ||
    value === "high" ||
    value === "max"
  ) {
    return value
  }
  return undefined
}

export function normalizePermissionModeSetting(
  value: unknown,
): PermissionModeSetting | undefined {
  if (value === "plan" || value === "readonly") return "plan"
  if (value === "confirm" || value === "ask") return "confirm"
  if (value === "auto") return "auto"
  return undefined
}

export type AuthConfig = {
  apiKey?: string
  keys?: Record<string, string>
}

export type ProviderSettings = {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
  permissionMode?: PermissionModeSetting
  reasoningEffort?: ReasoningEffortSetting
}

export function configHome(): string {
  return process.env.OPENCONTINUE_HOME ?? path.join(os.homedir(), ".opencontinue")
}

export function configPath(): string {
  return path.join(configHome(), "config.json")
}

export function authPath(): string {
  return path.join(configHome(), "auth.json")
}

function readJson<T>(file: string): T | undefined {
  if (!existsSync(file)) return undefined
  try {
    const text = readFileSync(file, "utf8")
    const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
    return JSON.parse(clean) as T
  } catch {
    return undefined
  }
}

function writeJson(file: string, value: unknown): void {
  mkdirSync(path.dirname(file), { recursive: true, mode: 0o700 })
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 })
  try {
    chmodSync(file, 0o600)
  } catch {
    // Windows may ignore POSIX modes; the file is still outside the repo.
  }
}

export function loadProviderConfig(): ProviderConfig {
  return readJson<ProviderConfig>(configPath()) ?? {}
}

export function loadAuthConfig(): AuthConfig {
  return readJson<AuthConfig>(authPath()) ?? {}
}

export function saveProviderConfig(config: ProviderConfig): void {
  writeJson(configPath(), { ...loadProviderConfig(), ...config })
}

export function saveAuthConfig(auth: AuthConfig): void {
  const current = loadAuthConfig()
  const merged: AuthConfig = { ...current, ...auth }
  if (current.keys || auth.keys) {
    merged.keys = { ...current.keys, ...auth.keys }
  }
  writeJson(authPath(), merged)
}

/**
 * Precedence: environment > ~/.opencontinue/config.json + auth.json.
 * Environment variables remain the CI and container path.
 */
export function resolveProviderSettings(env: NodeJS.ProcessEnv = process.env): ProviderSettings {
  const config = loadProviderConfig()
  const auth = loadAuthConfig()
  const provider = env.OPENCONTINUE_PROVIDER ?? config.provider
  const providerKey = provider ? auth.keys?.[provider] : undefined

  // OPENAI_* variables only apply to the default OpenAI provider. A Claude or
  // DeepSeek request must never receive an OpenAI key or endpoint.
  const openai = provider === undefined || provider === "openai"
  const openaiEnv = (key: string): string | undefined =>
    openai ? env[key] : undefined

  const permissionMode =
    normalizePermissionModeSetting(env.OPENCONTINUE_PERMISSION_MODE) ??
    normalizePermissionModeSetting(config.permissionMode)
  const reasoningEffort =
    normalizeReasoningEffortSetting(env.OPENCONTINUE_REASONING_EFFORT) ??
    normalizeReasoningEffortSetting(config.reasoningEffort)

  return {
    provider,
    baseUrl:
      env.OPENCONTINUE_BASE_URL ??
      openaiEnv("OPENAI_BASE_URL") ??
      config.baseUrl,
    apiKey:
      env.OPENCONTINUE_API_KEY ??
      openaiEnv("OPENAI_API_KEY") ??
      providerKey ??
      auth.apiKey,
    model:
      env.OPENCONTINUE_MODEL ?? openaiEnv("OPENAI_MODEL") ?? config.model,
    permissionMode,
    reasoningEffort,
  }
}
