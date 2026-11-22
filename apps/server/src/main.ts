import { closeServer, startServer } from "./index.js"

const { port, server } = startServer()
console.log(`opencontinue server listening on http://127.0.0.1:${port}`)

const shutdown = async () => {
  console.log("\nShutting down...")
  await closeServer(server)
  process.exit(0)
}

process.on("SIGINT", () => void shutdown())
process.on("SIGTERM", () => void shutdown())
