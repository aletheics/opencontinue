import { randomUUID } from "node:crypto"
import { mkdtemp, rm } from "node:fs/promises"
import { DatabaseSync } from "node:sqlite"
import os from "node:os"
import path from "node:path"

import { afterEach, describe, expect, it } from "vitest"

import { SqliteSessionStore } from "./sqlite.js"
import type { SessionExport } from "./types.js"

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

  it("closes a pending permission request on reopen", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create()

    store.append(session.id, {
      type: "permission.requested",
      requestId: "req-1",
      tool: "write",
      capability: "write",
      input: { path: "a.txt" },
    })
    store.close()

    const reopened = new SqliteSessionStore(file)
    const resolved = reopened
      .events(session.id)
      .find(
        (event) =>
          event.type === "permission.resolved" &&
          event.requestId === "req-1",
      )
    expect(resolved).toMatchObject({ approved: false })
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

  it("rejects a malformed import before writing rows", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create("exported")
    store.append(session.id, { type: "message.user", text: "hi" })
    const exported = store.exportSession(session.id)!

    const broken = {
      ...exported,
      events: [
        ...exported.events,
        {
          type: "message.user",
          sessionId: session.id,
          seq: 99,
          at: new Date().toISOString(),
          text: "gap",
        },
      ],
    }

    expect(() => store.importSession(broken as SessionExport)).toThrow(
      /sequence must start at 0/,
    )
    expect(store.list()).toHaveLength(1)
    store.close()
  })

  it("rejects a corrupt stored event on open", async () => {
    const file = await makeDbPath()
    const store = new SqliteSessionStore(file)
    const session = store.create("corrupt")
    store.close()

    const raw = new DatabaseSync(file)
    raw
      .prepare(
        "INSERT INTO events (session_id, seq, type, at, payload) VALUES (?, ?, ?, ?, ?)",
      )
      .run(
        session.id,
        99,
        "message.user",
        new Date().toISOString(),
        JSON.stringify({ type: "message.user", seq: 99 }),
      )
    raw.close()

    expect(() => new SqliteSessionStore(file)).toThrow(/Invalid session event/)
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
      session: {
        ...exported!.session,
        id: randomUUID(),
        title: "imported",
      },
    })

    expect(imported.title).toBe("imported")
    expect(store.snapshot(imported.id)?.messages).toEqual([{ role: "user", text: "hi" }])
    store.close()
  })
})
