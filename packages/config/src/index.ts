import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs"
import os from "node:os"
import path from "node:path"

export type ProviderConfig = {
  provider?: string
  baseUrl?: string
  model?: string
}

export type AuthConfig = {
  apiKey?: string
}

export type ProviderSettings = {
  provider?: string
  baseUrl?: string
  apiKey?: string
  model?: string
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
    return JSON.parse(readFileSync(file, "utf8")) as T
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
  writeJson(authPath(), { ...loadAuthConfig(), ...auth })
}

/**
 * Precedence: environment > ~/.opencontinue/config.json + auth.json.
 * Environment variables remain the CI and container path.
 */
export function resolveProviderSettings(env: NodeJS.ProcessEnv = process.env): ProviderSettings {
  const config = loadProviderConfig()
  const auth = loadAuthConfig()
  return {
    provider: env.OPENCONTINUE_PROVIDER ?? env.OPENAI_PROVIDER ?? config.provider,
    baseUrl: env.OPENCONTINUE_BASE_URL ?? env.OPENAI_BASE_URL ?? config.baseUrl,
    apiKey: env.OPENCONTINUE_API_KEY ?? env.OPENAI_API_KEY ?? auth.apiKey,
    model: env.OPENCONTINUE_MODEL ?? env.OPENAI_MODEL ?? config.model,
  }
}
