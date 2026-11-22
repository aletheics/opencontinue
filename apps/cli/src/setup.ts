import { createInterface } from "node:readline/promises"

import {
  authPath,
  configPath,
  loadAuthConfig,
  loadProviderConfig,
  saveAuthConfig,
  saveProviderConfig,
} from "@opencontinue/config"

export async function setupCommand(): Promise<void> {
  if (!process.stdin.isTTY) {
    throw new Error("setup requires a TTY. Use OPENCONTINUE_* environment variables in CI.")
  }

  const current = loadProviderConfig()
  const auth = loadAuthConfig()
  const rl = createInterface({ input: process.stdin, output: process.stdout })

  try {
    const provider =
      (
        await rl.question(
          `Provider [openai-compatible/ollama/echo] (${current.provider ?? "openai-compatible"}): `,
        )
      ).trim() ||
      current.provider ||
      "openai-compatible"

    const ollama = provider === "ollama"
    const defaultBase = ollama ? "http://127.0.0.1:11434/v1" : "https://api.openai.com/v1"
    const baseUrl =
      (await rl.question(`Base URL (${current.baseUrl ?? defaultBase}): `)).trim() ||
      current.baseUrl ||
      defaultBase

    const defaultModel = ollama ? "qwen2.5-coder:7b" : "gpt-6.2"
    const model =
      (await rl.question(`Model (${current.model ?? defaultModel}): `)).trim() ||
      current.model ||
      defaultModel

    const apiKey = (
      await rl.question(`API key${auth.apiKey ? " (blank keeps current)" : ""}: `)
    ).trim()

    saveProviderConfig({ provider, baseUrl, model })
    if (apiKey) saveAuthConfig({ apiKey })

    console.log(`\nconfig: ${configPath()}`)
    console.log(`auth:   ${authPath()}`)
    console.log("Run `npm run dev` to start.")
  } finally {
    rl.close()
  }
}

export function configCommand(): void {
  const config = loadProviderConfig()
  const auth = loadAuthConfig()
  const key = auth.apiKey
  const masked = !key
    ? "(unset)"
    : key.length <= 8
      ? "(set)"
      : `${key.slice(0, 4)}...${key.slice(-4)}`

  console.log(`provider: ${config.provider ?? "(unset)"}`)
  console.log(`baseUrl:  ${config.baseUrl ?? "(unset)"}`)
  console.log(`model:    ${config.model ?? "(unset)"}`)
  console.log(`apiKey:   ${masked}`)
  console.log(`config:   ${configPath()}`)
  console.log(`auth:     ${authPath()}`)
  console.log("\nEnvironment variables OPENCONTINUE_* override these values.")
}
