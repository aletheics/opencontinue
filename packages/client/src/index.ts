import {
  SessionEvent as SessionEventSchema,
  type SessionEvent,
  type SessionSnapshot,
  type SessionSummary,
} from "@opencontinue/protocol"

export type FetchLike = typeof fetch

export type ClientOptions = {
  baseUrl: string
  fetch?: FetchLike
  reconnectDelayMs?: number
}

export type SessionEventListener = (event: SessionEvent) => void

export type SessionSubscription = {
  /** Resolves after the first SSE connection is established. */
  ready: Promise<void>
  close(): void
}

export interface OpenContinueClient {
  readonly baseUrl: string
  health(): Promise<{ ok: boolean }>
  listSessions(): Promise<SessionSummary[]>
  createSession(title?: string): Promise<SessionSnapshot>
  getSession(sessionId: string): Promise<SessionSnapshot>
  sendMessage(sessionId: string, text: string): Promise<void>
  resolvePermission(
    sessionId: string,
    requestId: string,
    approved: boolean,
  ): Promise<void>
  subscribe(
    sessionId: string,
    after: number,
    listener: SessionEventListener,
  ): SessionSubscription
  close(): void
}

export class ClientHttpError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`OpenContinue request failed: ${status} ${body}`)
    this.name = "ClientHttpError"
  }
}

function normalizeBaseUrl(value: string): string {
  return value.replace(/\/+$/, "")
}

function sseData(block: string): string | null {
  const data = block
    .split(/\r?\n/)
    .filter((line) => line.startsWith("data:"))
    .map((line) => line.slice(5).trimStart())
    .join("\n")
  return data.length > 0 ? data : null
}

function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.resolve()
  return new Promise((resolve) => {
    const timer = setTimeout(resolve, ms)
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}

/**
 * HTTP/SSE implementation of the session contract.
 *
 * The client owns reconnects and replay cursors. Callers subscribe once and
 * receive every durable event after `after`, in order, with no duplicates.
 */
export class HttpSessionClient implements OpenContinueClient {
  readonly baseUrl: string
  private readonly fetchImpl: FetchLike
  private readonly reconnectDelayMs: number
  private readonly abort = new AbortController()
  private readonly subscriptions = new Set<AbortController>()
  private closed = false

  constructor(options: ClientOptions) {
    this.baseUrl = normalizeBaseUrl(options.baseUrl)
    this.fetchImpl = options.fetch ?? fetch
    this.reconnectDelayMs = Math.max(10, options.reconnectDelayMs ?? 500)
  }

  async health(): Promise<{ ok: boolean }> {
    return this.request("/health")
  }

  async listSessions(): Promise<SessionSummary[]> {
    return this.request("/v1/sessions")
  }

  async createSession(title?: string): Promise<SessionSnapshot> {
    return this.request("/v1/sessions", {
      method: "POST",
      body: JSON.stringify(title === undefined ? {} : { title }),
    })
  }

  async getSession(sessionId: string): Promise<SessionSnapshot> {
    return this.request(`/v1/sessions/${encodeURIComponent(sessionId)}`)
  }

  async sendMessage(sessionId: string, text: string): Promise<void> {
    await this.request(`/v1/sessions/${encodeURIComponent(sessionId)}/messages`, {
      method: "POST",
      body: JSON.stringify({ text }),
    })
  }

  async resolvePermission(
    sessionId: string,
    requestId: string,
    approved: boolean,
  ): Promise<void> {
    await this.request(
      `/v1/sessions/${encodeURIComponent(sessionId)}/permissions/${encodeURIComponent(requestId)}`,
      {
        method: "POST",
        body: JSON.stringify({ approved }),
      },
    )
  }

  subscribe(
    sessionId: string,
    after: number,
    listener: SessionEventListener,
  ): SessionSubscription {
    if (this.closed) {
      return {
        ready: Promise.reject(new Error("Client is closed")),
        close: () => {},
      }
    }

    const controller = new AbortController()
    this.subscriptions.add(controller)

    let resolveReady: () => void = () => {}
    let rejectReady: (error: Error) => void = () => {}
    const ready = new Promise<void>((resolve, reject) => {
      resolveReady = resolve
      rejectReady = reject
    })
    ready.catch(() => {})

    let subscriptionClosed = false
    const close = () => {
      if (subscriptionClosed) return
      subscriptionClosed = true
      controller.abort()
      this.subscriptions.delete(controller)
    }

    void this.runSubscription(
      sessionId,
      Math.max(-1, after),
      listener,
      controller.signal,
      () => subscriptionClosed,
      resolveReady,
      rejectReady,
    ).finally(close)

    return { ready, close }
  }

  close(): void {
    if (this.closed) return
    this.closed = true
    this.abort.abort()
    for (const controller of this.subscriptions) controller.abort()
    this.subscriptions.clear()
  }

  private async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      signal: init.signal ?? this.abort.signal,
      headers: {
        "content-type": "application/json",
        ...(init.headers ?? {}),
      },
    })

    const body = await response.text()
    if (!response.ok) throw new ClientHttpError(response.status, body)

    return (body.length > 0 ? JSON.parse(body) : undefined) as T
  }

  private async runSubscription(
    sessionId: string,
    after: number,
    listener: SessionEventListener,
    signal: AbortSignal,
    isClosed: () => boolean,
    resolveReady: () => void,
    rejectReady: (error: Error) => void,
  ): Promise<void> {
    let lastSeq = after
    let connected = false

    while (!this.closed && !signal.aborted && !isClosed()) {
      try {
        const response = await this.fetchImpl(
          `${this.baseUrl}/v1/sessions/${encodeURIComponent(sessionId)}/events?after=${lastSeq}`,
          {
            signal,
            headers: { accept: "text/event-stream" },
          },
        )

        if (!response.ok || !response.body) {
          throw new ClientHttpError(response.status, await response.text())
        }

        connected = true
        resolveReady()

        const reader = response.body.getReader()
        const decoder = new TextDecoder()
        let buffer = ""

        for (;;) {
          const { value, done } = await reader.read()
          if (done) break
          buffer += decoder.decode(value, { stream: true })

          let boundary = buffer.indexOf("\n\n")
          while (boundary >= 0) {
            const block = buffer.slice(0, boundary)
            buffer = buffer.slice(boundary + 2)
            boundary = buffer.indexOf("\n\n")

            const data = sseData(block)
            if (!data) continue

            const parsedJson: unknown = JSON.parse(data)
            const parsed = SessionEventSchema.safeParse(parsedJson)
            if (!parsed.success) continue

            const event = parsed.data
            if (event.seq <= lastSeq) continue
            lastSeq = event.seq
            listener(event)
          }
        }
      } catch (error) {
        if (this.closed || signal.aborted || isClosed()) return
        const failure = error instanceof Error ? error : new Error(String(error))
        if (!connected) {
          rejectReady(failure)
          return
        }
      }

      if (this.closed || signal.aborted || isClosed()) return
      await sleep(this.reconnectDelayMs, signal)
    }
  }
}

export function createHttpClient(options: ClientOptions): HttpSessionClient {
  return new HttpSessionClient(options)
}
