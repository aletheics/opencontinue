import { closeServer, startServer } from "./index.js"

const running = startServer()
console.log(`opencontinue server listening on http://127.0.0.1:${running.port}`)
console.log(`auth token: ${running.token}`)
if (running.warning) console.warn(`provider: ${running.warning}`)
else console.log(`provider: ${running.provider.id} (${running.provider.model})`)
console.log(`workspace: ${running.workspace}`)
console.log(`permissions: ${running.permissionMode}`)

const shutdown = async () => {
  console.log("\nShutting down...")
  await closeServer(running.server)
  running.store.close()
  process.exit(0)
}

process.on("SIGINT", () => void shutdown())
process.on("SIGTERM", () => void shutdown())
