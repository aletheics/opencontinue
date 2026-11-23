import { existsSync, readFileSync } from "node:fs"
import path from "node:path"

import { normalizePermissionMode, type PermissionMode } from "./permissions.js"

export type ProjectConfig = {
  permissionMode?: PermissionMode
  allow: string[]
  ask: string[]
  deny: string[]
  instructions: string
}

const MAX_INSTRUCTION_BYTES = 20_000
const DEFAULT_INSTRUCTIONS = [".opencontinue/AGENTS.md"]

/**
 * Reads `.opencontinue/opencontinue.json` and the configured instruction files.
 * Missing or malformed files are ignored; the server still starts.
 */
export function loadProjectConfig(workspace: string): ProjectConfig {
  const root = path.resolve(workspace)
  const configPath = path.join(root, ".opencontinue", "opencontinue.json")

  let parsed: Record<string, unknown> = {}
  if (existsSync(configPath)) {
    try {
      const text = readFileSync(configPath, "utf8")
      const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
      const value = JSON.parse(clean) as unknown
      if (isRecord(value)) parsed = value
    } catch {
      parsed = {}
    }
  }

  const permissions = isRecord(parsed.permissions) ? parsed.permissions : {}
  const permissionMode = normalizePermissionMode(permissions.mode)
  const allow = stringList(permissions.allow)
  const ask = stringList(permissions.ask)
  const deny = stringList(permissions.deny)

  const listed = Array.isArray(parsed.instructions)
    ? parsed.instructions.filter((item): item is string => typeof item === "string")
    : DEFAULT_INSTRUCTIONS

  const instructions = listed
    .map((item) => path.resolve(root, item))
    .filter((file) => isInside(root, file) && existsSync(file))
    .map((file) => {
      const text = readFileSync(file, "utf8")
      const clean = text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
      return clean.slice(0, MAX_INSTRUCTION_BYTES).trim()
    })
    .filter(Boolean)
    .join("\n\n")

  return { permissionMode, allow, ask, deny, instructions }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : []
}

function isInside(root: string, file: string): boolean {
  const relative = path.relative(root, file)
  return relative !== "" && !relative.startsWith("..") && !path.isAbsolute(relative)
}
