import { mkdtemp, rm } from "node:fs/promises"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { SqliteSessionStore } from "./sqlite.js"

const temporary: string[] = []

afterEach(async () => {
  await Promise.all(temporary.splice(0).map((directory) => rm(directory, { recursive: true, force: true })))
})

async function makeDbPath(): Promise<string> {
  const directory = await mkdtemp(path.join(os.tmpdir(), "opencontinue-sqlite-"))
  temporary.push(directory)
  return path.join(directory, "sessions.db")
}

describe("SqliteSessionStore", () => {
  it("persists sessions and events across reopen", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create("persisted")

    store.append(session.id, { type: "message.user", text: "hi" })
    store.append(session.id, { type: "run.started", runId: "r1" })
    store.append(session.id, { type: "message.assistant.delta", runId: "r1", text: "hello" })
    store.append(session.id, { type: "run.completed", runId: "r1" })

    expect(store.events(session.id, 0).map((event) => event.type)).toEqual([
      "message.user",
      "run.started",
      "message.assistant.delta",
      "run.completed",
    ])
    store.close()

    const reopened = new SqliteSessionStore(file)
    expect(reopened.list()[0]).toMatchObject({ id: session.id, title: "persisted", lastSeq: 4 })
    expect(reopened.snapshot(session.id)?.messages).toEqual([
      { role: "user", text: "hi" },
      { role: "assistant", text: "hello" },
    ])
    reopened.close()
  })

  it("marks an interrupted run failed on reopen", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create()

    store.append(session.id, { type: "message.user", text: "hi" })
    store.append(session.id, { type: "run.started", runId: "r1" })
    store.close()

    const reopened = new SqliteSessionStore(file)
    const events = reopened.events(session.id)
    expect(events.some((event) => event.type === "run.failed" && event.runId === "r1")).toBe(true)
    expect(reopened.snapshot(session.id)?.messages.at(-1)?.text).toContain("Recovered after restart")
    reopened.close()
  })

  it("forks a session through a sequence", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create("source")
    store.append(session.id, { type: "message.user", text: "hi" })
    store.append(session.id, { type: "run.started", runId: "r1" })
    store.append(session.id, {
      type: "message.assistant.delta",
      runId: "r1",
      text: "hello",
    })
    store.append(session.id, { type: "run.completed", runId: "r1" })

    const fork = store.fork(session.id, 1, "forked")
    expect(fork?.title).toBe("forked")
    expect(store.snapshot(fork!.id)?.messages).toEqual([
      { role: "user", text: "hi" },
    ])
    expect(store.events(session.id)).toHaveLength(5)
    store.close()
  })

  it("exports and imports sessions", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create("exported")

    store.append(session.id, { type: "message.user", text: "hi" })
    const exported = store.exportSession(session.id)
    expect(exported).toBeTruthy()

    const imported = store.importSession({
      ...exported!,
      session: { ...exported!.session, id: "imported-session", title: "imported" },
    })

    expect(imported.title).toBe("imported")
    expect(store.snapshot(imported.id)?.messages).toEqual([{ role: "user", text: "hi" }])
    store.close()
  })
})
