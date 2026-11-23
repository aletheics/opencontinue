import { randomUUID } from "node:crypto"
import { createServer, type Server } from "node:http"
import type { AddressInfo } from "node:net"
import { once } from "node:events"

import type { SessionEvent, SessionSnapshot, SessionSummary } from "@opencontinue/protocol"
import { afterEach, describe, expect, it } from "vitest"

import { ClientHttpError, HttpSessionClient } from "./index.js"

const sessionId = randomUUID()

const summary: SessionSummary = {
  id: sessionId,
  title: "Test session",
  createdAt: "2026-01-01T00:00:00.000Z",
  updatedAt: "2026-01-01T00:00:00.000Z",
  lastSeq: 1,
}

const snapshot: SessionSnapshot = {
  ...summary,
  messages: [{ role: "user", text: "hello" }],
}

const events: SessionEvent[] = [
  {
    type: "session.created",
    sessionId,
    seq: 0,
    at: "2026-01-01T00:00:00.000Z",
    title: "Test session",
  },
  {
    type: "message.user",
    sessionId,
    seq: 1,
    at: "2026-01-01T00:00:00.000Z",
    text: "hello",
  },
]

type RecordedRequest = {
  method: string
  path: string
  body: string
  authorization?: string
}

type Fixture = {
  server: Server
  baseUrl: string
  requests: RecordedRequest[]
  eventConnections: () => number
}

const servers: Server[] = []

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => {
          server.closeAllConnections()
          server.close(() => resolve())
        }),
    ),
  )
})

async function fixture(): Promise<Fixture> {
  const requests: RecordedRequest[] = []
  let eventConnections = 0

  const server = createServer(async (request, response) => {
    let body = ""
    for await (const chunk of request) body += String(chunk)
    const url = new URL(request.url ?? "/", "http://127.0.0.1")
    requests.push({
      method: request.method ?? "GET",
      path: `${url.pathname}${url.search}`,
      body,
      authorization: request.headers.authorization,
    })

    const json = (value: unknown, status = 200) => {
      response.writeHead(status, { "content-type": "application/json" })
      response.end(JSON.stringify(value))
    }

    if (url.pathname === "/health") return json({ ok: true })
    if (url.pathname === "/v1/sessions" && request.method === "GET") return json([summary])
    if (url.pathname === "/v1/sessions" && request.method === "POST") {
      return json(snapshot, 201)
    }
    if (url.pathname === `/v1/sessions/${sessionId}`) return json(snapshot)
    if (url.pathname === `/v1/sessions/${sessionId}/messages`) {
      return json({ accepted: true }, 202)
    }
    if (url.pathname === `/v1/sessions/${sessionId}/abort`) {
      return json({ aborted: true })
    }
    if (url.pathname.startsWith(`/v1/sessions/${sessionId}/permissions/`)) {
      return json({ ok: true })
    }
    if (url.pathname === `/v1/sessions/${sessionId}/events`) {
      eventConnections++
      const after = Number(url.searchParams.get("after") ?? "-1")
      response.writeHead(200, { "content-type": "text/event-stream" })
      const next = events.find((event) => event.seq > after)
      if (next) {
        response.write(`event: session\ndata: ${JSON.stringify(next)}\n\n`)
      }
      response.end()
      return
    }

    json({ error: "not found" }, 404)
  })

  server.listen(0, "127.0.0.1")
  await once(server, "listening")
  servers.push(server)
  const address = server.address() as AddressInfo
  return {
    server,
    baseUrl: `http://127.0.0.1:${address.port}/`,
    requests,
    eventConnections: () => eventConnections,
  }
}

describe("HttpSessionClient", () => {
  it("sends session requests through the protocol endpoints", async () => {
    const { baseUrl, requests } = await fixture()
    const client = new HttpSessionClient({ baseUrl })

    await expect(client.health()).resolves.toEqual({ ok: true })
    await expect(client.health("session-1")).resolves.toEqual({ ok: true })
    await expect(client.listSessions()).resolves.toEqual([summary])
    await expect(client.createSession("Test session")).resolves.toEqual(snapshot)
    await expect(client.getSession(sessionId)).resolves.toEqual(snapshot)
    await expect(client.sendMessage(sessionId, "hello")).resolves.toBeUndefined()
    await expect(client.abort(sessionId)).resolves.toBeUndefined()
    await expect(client.resolvePermission(sessionId, "request-1", true)).resolves.toBeUndefined()

    expect(requests).toContainEqual({
      method: "POST",
      path: "/v1/sessions",
      body: JSON.stringify({ title: "Test session" }),
    })
    expect(requests).toContainEqual({
      method: "POST",
      path: `/v1/sessions/${sessionId}/messages`,
      body: JSON.stringify({ text: "hello" }),
    })
    expect(requests.some((request) => request.path === "/health?sessionId=session-1")).toBe(
      true,
    )
    expect(requests).toContainEqual({
      method: "POST",
      path: `/v1/sessions/${sessionId}/abort`,
      body: "{}",
    })
    expect(requests).toContainEqual({
      method: "POST",
      path: `/v1/sessions/${sessionId}/permissions/request-1`,
      body: JSON.stringify({ approved: true }),
    })

    client.close()
  })

  it("sends a bearer token when configured", async () => {
    const { baseUrl, requests } = await fixture()
    const client = new HttpSessionClient({ baseUrl, token: "secret" })

    await client.health()
    expect(requests[0]?.authorization).toBe("Bearer secret")
    client.close()
  })

  it("replays and reconnects SSE without duplicate events", async () => {
    const { baseUrl, eventConnections } = await fixture()
    const client = new HttpSessionClient({ baseUrl, reconnectDelayMs: 10 })
    const received: number[] = []

    const done = new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error("timed out waiting for events")), 2000)
      const subscription = client.subscribe(sessionId, -1, (event) => {
        received.push(event.seq)
        if (received.length === events.length) {
          clearTimeout(timer)
          subscription.close()
          resolve()
        }
      })
      void subscription.ready.catch((error) => {
        clearTimeout(timer)
        reject(error)
      })
    })

    await done
    expect(received).toEqual([0, 1])
    expect(eventConnections()).toBeGreaterThanOrEqual(2)
    client.close()
  })

  it("reports HTTP failures as typed errors", async () => {
    const { baseUrl } = await fixture()
    const client = new HttpSessionClient({ baseUrl })

    await expect(client.getSession("missing")).rejects.toMatchObject({
      name: "ClientHttpError",
      status: 404,
    } satisfies Partial<ClientHttpError>)

    client.close()
  })
})
