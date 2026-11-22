import { existsSync, readFileSync, readdirSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const constraints = path.join(root, ".opencontinue")

function frontmatter(content: string): Record<string, string> {
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---/)
  if (!match) return {}

  const result: Record<string, string> = {}
  for (const line of (match[1] ?? "").split(/\r?\n/)) {
    const index = line.indexOf(":")
    if (index === -1) continue
    const key = line.slice(0, index).trim()
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "")
    if (key) result[key] = value
  }
  return result
}

function markdownFiles(directory: string): string[] {
  return readdirSync(path.join(constraints, directory))
    .filter((file) => file.endsWith(".md"))
    .sort()
}

describe(".opencontinue constraints", () => {
  it("has a valid project config", () => {
    const config = JSON.parse(
      readFileSync(path.join(constraints, "opencontinue.json"), "utf8"),
    ) as {
      permissions?: { mode?: string; allow?: string[]; ask?: string[]; deny?: string[] }
      instructions?: string[]
      checks?: { agents?: string[] }
    }

    expect(["ask", "auto", "readonly"]).toContain(config.permissions?.mode)
    expect(Array.isArray(config.permissions?.allow)).toBe(true)
    expect(Array.isArray(config.permissions?.ask)).toBe(true)
    expect(Array.isArray(config.permissions?.deny)).toBe(true)
    expect(Array.isArray(config.instructions)).toBe(true)
    for (const instruction of config.instructions ?? []) {
      expect(existsSync(path.join(root, instruction)), instruction).toBe(true)
    }
    expect(config.checks?.agents).toContain(".opencontinue/agent/*.md")
  })

  it("documents every agent", () => {
    const files = markdownFiles("agent")
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const data = frontmatter(readFileSync(path.join(constraints, "agent", file), "utf8"))
      expect(data.description, file).toBeTruthy()
      expect(["primary", "subagent", "all"], file).toContain(data.mode)
    }
  })

  it("documents every command", () => {
    const files = markdownFiles("command")
    expect(files.length).toBeGreaterThan(0)

    for (const file of files) {
      const data = frontmatter(readFileSync(path.join(constraints, "command", file), "utf8"))
      expect(data.description, file).toBeTruthy()
    }
  })

  it("documents every skill", () => {
    const directories = readdirSync(path.join(constraints, "skills"), { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort()
    expect(directories.length).toBeGreaterThan(0)

    for (const directory of directories) {
      const file = path.join(constraints, "skills", directory, "SKILL.md")
      expect(existsSync(file), directory).toBe(true)
      const data = frontmatter(readFileSync(file, "utf8"))
      expect(data.name, directory).toBeTruthy()
      expect(data.description, directory).toBeTruthy()
    }
  })
})
