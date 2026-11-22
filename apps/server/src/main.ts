import { existsSync } from "node:fs"
import { loadEnvFile } from "node:process"
import { fileURLToPath } from "node:url"

import { closeServer, startServer } from "./index.js"

const envPath = fileURLToPath(new URL("../../../.env", import.meta.url))
if (existsSync(envPath)) loadEnvFile(envPath)

const running = startServer()
console.log(`opencontinue server listening on http://127.0.0.1:${running.port}`)
if (running.warning) console.warn(`provider: ${running.warning}`)
else console.log(`provider: ${running.provider.id} (${running.provider.model})`)
console.log(`workspace: ${running.workspace}`)
console.log(`permissions: ${running.permissionMode}`)

const shutdown = async () => {
  console.log("\nShutting down...")
  await closeServer(running.server)
  process.exit(0)
}

process.on("SIGINT", () => void shutdown())
process.on("SIGTERM", () => void shutdown())
