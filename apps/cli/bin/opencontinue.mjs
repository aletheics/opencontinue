#!/usr/bin/env node

import { spawn } from "node:child_process"
import { existsSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const here = path.dirname(fileURLToPath(import.meta.url))
const root = path.resolve(here, "../../..")
const tsx = path.join(root, "node_modules", "tsx", "dist", "cli.mjs")
const entry = path.join(root, "apps", "cli", "src", "index.ts")

if (!existsSync(tsx)) {
  console.error("OpenContinue is not installed. Run `npm install` in the repository root.")
  process.exit(1)
}

const child = spawn(process.execPath, [tsx, entry, ...process.argv.slice(2)], {
  stdio: "inherit",
})

child.on("exit", (code, signal) => {
  if (signal) process.kill(process.pid, signal)
  else process.exit(code ?? 0)
})
