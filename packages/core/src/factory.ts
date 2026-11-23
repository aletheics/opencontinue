import path from "node:path"

import { SqliteSessionStore } from "./sqlite.js"
import type { SessionStore } from "./types.js"

export type CreateSessionStoreOptions = {
  workspace: string
  dbPath?: string
  busyTimeoutMs?: number
}

/**
 * Persistent store by default. `OPENCONTINUE_DB` overrides the path.
 */
export function createSessionStore(options: CreateSessionStoreOptions): SessionStore {
  const dbPath =
    options.dbPath ??
    process.env.OPENCONTINUE_DB ??
    path.join(options.workspace, ".opencontinue", "sessions", "sessions.db")
  return new SqliteSessionStore(dbPath, {
    busyTimeoutMs: options.busyTimeoutMs,
  })
}
