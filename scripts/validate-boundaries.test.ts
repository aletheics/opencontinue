import { existsSync, readdirSync, readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

import { describe, expect, it } from "vitest"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")

const RULES: Record<string, ReadonlySet<string>> = {
  protocol: new Set(),
  config: new Set(),
  core: new Set(["protocol"]),
  providers: new Set(),
  tools: new Set(["providers"]),
  runtime: new Set(["protocol", "core", "providers", "tools"]),
  tui: new Set(["config", "core", "providers", "runtime", "tools"]),
  server: new Set(["config", "core", "protocol", "providers", "runtime", "tools"]),
  cli: new Set(["config", "core", "protocol", "providers", "runtime", "server", "tools", "tui"]),
}

const SOURCES: Array<{ name: string; dir: string }> = [
  { name: "protocol", dir: "packages/protocol/src" },
  { name: "config", dir: "packages/config/src" },
  { name: "core", dir: "packages/core/src" },
  { name: "providers", dir: "packages/providers/src" },
  { name: "tools", dir: "packages/tools/src" },
  { name: "runtime", dir: "packages/runtime/src" },
  { name: "tui", dir: "packages/tui/src" },
  { name: "server", dir: "apps/server/src" },
  { name: "cli", dir: "apps/cli/src" },
]

function sourceFiles(directory: string): string[] {
  const files: string[] = []
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "dist") continue
      files.push(...sourceFiles(full))
      continue
    }
    if (!entry.name.endsWith(".ts") && !entry.name.endsWith(".tsx")) continue
    if (entry.name.includes(".test.")) continue
    files.push(full)
  }
  return files
}

describe("package boundaries", () => {
  it("only allows the declared internal imports", () => {
    const violations: string[] = []

    for (const source of SOURCES) {
      const allowed = RULES[source.name]
      expect(allowed, source.name).toBeDefined()

      for (const file of sourceFiles(path.join(root, source.dir))) {
        const content = readFileSync(file, "utf8")
        for (const match of content.matchAll(/@opencontinue\/([a-z0-9-]+)/g)) {
          const dependency = match[1]!
          if (dependency === source.name) continue
          if (!allowed?.has(dependency)) {
            violations.push(
              `${path.relative(root, file)} imports @opencontinue/${dependency}`,
            )
          }
        }
      }
    }

    expect(violations).toEqual([])
  })

  it("documents every package and app", () => {
    for (const source of SOURCES) {
      const directory = path.join(root, source.dir, "..")
      expect(existsSync(path.join(directory, "README.md")), directory).toBe(true)
    }
  })
})
