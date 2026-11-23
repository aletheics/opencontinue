import { readFileSync } from "node:fs"
import path from "node:path"

import { Box, Static, Text, render, useApp, useInput, useStdout } from "ink"
import TextInput from "ink-text-input"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  loadAuthConfig,
  resolveProviderSettings,
  saveAuthConfig,
  saveProviderConfig,
} from "@opencontinue/config"
import {
  HttpSessionClient,
  type OpenContinueClient,
  type SessionSubscription,
} from "@opencontinue/client"
import { createSessionStore, type SessionStore } from "@opencontinue/core"
import { LocalSessionClient } from "@opencontinue/local-client"
import {
  createProvider,
  listModels,
  PROVIDER_PRESETS,
  type ProviderPreset,
} from "@opencontinue/providers"
import type {
  SessionEvent,
  SessionSnapshot,
  SessionSummary,
} from "@opencontinue/protocol"
import { listWorkspaceFiles } from "@opencontinue/tools"

import { Picker } from "./components/Picker.js"
import { PermissionPrompt } from "./components/PermissionPrompt.js"
import { Prompt } from "./components/Prompt.js"
import { SlashMenu } from "./components/SlashMenu.js"
import { Transcript, TranscriptItem } from "./components/Transcript.js"
import { timelineLines, toolDisplayName } from "./render.js"
import { theme } from "./theme.js"
import { reduceTimeline, type TimelineItem } from "./timeline.js"

type PermissionMode = "ask" | "auto" | "readonly"

type PermissionPromptState = {
  requestId: string
  tool: string
  detail: string
  diff?: string
}

export type TuiOptions = {
  auto?: boolean
  readonly?: boolean
  resume?: string
  url?: string
}

type Screen =
  | "provider"
  | "key"
  | "baseurl"
  | "loading"
  | "models"
  | "sessions"
  | "chat"
  | "error"
const SLASH_COMMANDS = [
  { name: "/help", description: "show commands" },
  { name: "/clear", description: "new session" },
  { name: "/model", description: "change model" },
  { name: "/provider", description: "change provider" },
  { name: "/resume", description: "resume a session" },
  { name: "/mode", description: "cycle permissions" },
  { name: "/status", description: "session status" },
  { name: "/exit", description: "quit" },
]

const HELP_TEXT = SLASH_COMMANDS.map((command) => `${command.name} — ${command.description}`).join(
  "\n",
)

function formatTokens(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
}

function formatDuration(ms: number): string {
  const seconds = Math.max(0, Math.round(ms / 1000))
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ${seconds % 60}s`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ${minutes % 60}m`
}

function useTerminalSize(): { columns: number; rows: number } {
  const stdout = useStdout().stdout as unknown as { columns?: number; rows?: number }
  const read = () => ({
    columns: Math.max(40, (stdout.columns ?? 80) - 1),
    rows: Math.max(12, (stdout.rows ?? 24) - 1),
  })
  const [size, setSize] = useState(read)

  useEffect(() => {
    const onResize = () => setSize(read())
    process.stdout.on("resize", onResize)
    return () => {
      process.stdout.off("resize", onResize)
    }
  }, [])

  return size
}

function initialProviderIndex(provider: string | undefined): number {
  const index = PROVIDER_PRESETS.findIndex(
    (item) =>
      item.id === provider ||
      (provider === "openai-compatible" && item.id === "openai") ||
      (provider === "anthropic" && item.id === "claude"),
  )
  return index >= 0 ? index : 0
}

function isPrintableInput(
  character: string,
  key: { ctrl?: boolean; meta?: boolean },
): boolean {
  return character.length > 0 && !key.ctrl && !key.meta && !/[\r\n\t]/.test(character)
}

function workspaceInfo(workspace: string): { name: string; branch: string | null } {
  const root = path.resolve(workspace)
  let branch: string | null = null
  let directory = root

  for (let depth = 0; depth < 8; depth++) {
    try {
      const head = readFileSync(path.join(directory, ".git", "HEAD"), "utf8").trim()
      if (head.startsWith("ref: refs/heads/")) {
        branch = head.slice("ref: refs/heads/".length)
      } else if (head) {
        branch = head.slice(0, 7)
      }
      break
    } catch {
      const parent = path.dirname(directory)
      if (parent === directory) break
      directory = parent
    }
  }

  return { name: path.basename(root), branch }
}

function isCommittedItem(
  item: TimelineItem,
  index: number,
  items: TimelineItem[],
  busy: boolean,
): boolean {
  if (item.kind === "usage") return false
  if (item.kind === "user" || item.kind === "system" || item.kind === "meta") return true
  if (item.kind === "tool") return item.status !== "running"
  if (item.kind === "assistant") {
    if (!busy) return true
    return items.slice(index + 1).some((later) => later.kind !== "usage")
  }
  return false
}

function sessionLabel(snapshot: SessionSnapshot, item: SessionSummary): string {
  const generic =
    !item.title || item.title === "OpenContinue TUI" || item.title === "Untitled session"
  if (!generic) return item.title

  const first = snapshot.messages.find((message) => message.role === "user")
  const text = first?.text.replace(/\s+/g, " ").trim()
  if (text) return text.length > 60 ? `${text.slice(0, 57)}…` : text

  return item.title || item.id.slice(0, 8)
}

export function App({ options }: { options: TuiOptions }) {
  const { exit } = useApp()
  const { columns, rows } = useTerminalSize()
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    options.auto ? "auto" : options.readonly ? "readonly" : "ask",
  )

  const initial = useMemo(() => resolveProviderSettings(), [])
  const workspace = useMemo(() => process.env.INIT_CWD ?? process.cwd(), [])
  const workspaceStatus = useMemo(() => workspaceInfo(workspace), [workspace])
  const [screen, setScreen] = useState<Screen>(options.url ? "loading" : "provider")
  const [providerIndex, setProviderIndex] = useState(() => initialProviderIndex(initial.provider))
  const [providerQuery, setProviderQuery] = useState("")
  const [preset, setPreset] = useState<ProviderPreset | null>(null)
  const [apiKey, setApiKey] = useState(initial.apiKey ?? "")
  const [baseUrl, setBaseUrl] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [baseInput, setBaseInput] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [modelIndex, setModelIndex] = useState(0)
  const [modelQuery, setModelQuery] = useState("")
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [sessionLabels, setSessionLabels] = useState<Record<string, string>>({})
  const [sessionIndex, setSessionIndex] = useState(0)
  const [sessionQuery, setSessionQuery] = useState("")
  const [model, setModel] = useState(initial.model ?? "gpt-6.2")
  const [error, setError] = useState("")
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [input, setInput] = useState("")
  const [cursor, setCursor] = useState(0)
  const [queued, setQueued] = useState<string[]>([])
  const queuedRef = useRef<string[]>([])
  const [slashIndex, setSlashIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [transcriptMode, setTranscriptMode] = useState(false)
  const [transcriptScroll, setTranscriptScroll] = useState(0)
  const [transcriptKey, setTranscriptKey] = useState(0)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null)
  const [permission, setPermission] = useState<PermissionPromptState | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [historySearch, setHistorySearch] = useState(false)
  const [historyQuery, setHistoryQuery] = useState("")
  const [historyCursor, setHistoryCursor] = useState(0)
  const [historySearchIndex, setHistorySearchIndex] = useState(0)
  const [workspaceFiles, setWorkspaceFiles] = useState<string[]>([])
  const [filesLoading, setFilesLoading] = useState(false)
  const [fileIndex, setFileIndex] = useState(0)
  const [dismissedMention, setDismissedMention] = useState<string | null>(null)
  const filesLoadedRef = useRef(false)

  const storeRef = useRef<SessionStore | null>(null)
  const clientRef = useRef<OpenContinueClient | null>(null)
  const sessionRef = useRef<string | null>(null)
  const subscriptionRef = useRef<SessionSubscription | null>(null)
  const runStartedRef = useRef<number | null>(null)
  const lineCountRef = useRef(0)
  const permissionModeRef = useRef<PermissionMode>(permissionMode)
  const allowedToolsRef = useRef<Set<string>>(new Set())
  permissionModeRef.current = permissionMode

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setTick((value) => value + 1), 100)
    return () => clearInterval(timer)
  }, [busy])

  useEffect(() => {
    setSlashIndex(0)
  }, [input])

  useEffect(() => {
    if (screen !== "chat" || filesLoadedRef.current) return
    filesLoadedRef.current = true
    setFilesLoading(true)
    void listWorkspaceFiles(workspace)
      .then(setWorkspaceFiles)
      .catch(() => setWorkspaceFiles([]))
      .finally(() => setFilesLoading(false))
  }, [screen])

  const filteredProviders = useMemo(() => {
    const query = providerQuery.trim().toLowerCase()
    if (!query) return PROVIDER_PRESETS
    return PROVIDER_PRESETS.filter((item) =>
      `${item.label} ${item.id} ${item.note ?? ""}`.toLowerCase().includes(query),
    )
  }, [providerQuery])

  const filteredModels = useMemo(() => {
    const query = modelQuery.trim().toLowerCase()
    if (!query) return models
    return models.filter((item) => item.toLowerCase().includes(query))
  }, [models, modelQuery])

  const filteredSessions = useMemo(() => {
    const query = sessionQuery.trim().toLowerCase()
    if (!query) return sessions
    return sessions.filter((item) =>
      `${sessionLabels[item.id] ?? item.title} ${item.id}`.toLowerCase().includes(query),
    )
  }, [sessionLabels, sessions, sessionQuery])

  const historyMatches = useMemo(() => {
    if (!historySearch) return []
    const query = historyQuery.trim().toLowerCase()
    const matches = query
      ? history.filter((item) => item.toLowerCase().includes(query))
      : history
    return [...matches].reverse().slice(0, 20)
  }, [history, historyQuery, historySearch])

  const mentionMatch =
    screen === "chat" ? input.slice(0, cursor).match(/(?:^|\s)@([^\s@]*)$/) : null
  const mentionQuery = mentionMatch?.[1] ?? null

  const fileMatches = useMemo(() => {
    if (mentionQuery === null) return []
    const query = mentionQuery.toLowerCase()
    const score = (file: string): number => {
      const lower = file.toLowerCase()
      const base = lower.split("/").at(-1) ?? ""
      if (base.startsWith(query)) return 0
      if (lower.startsWith(query)) return 1
      if (base.includes(query)) return 2
      return 3
    }

    return workspaceFiles
      .filter((file) => file.toLowerCase().includes(query))
      .sort(
        (left, right) =>
          score(left) - score(right) ||
          left.length - right.length ||
          left.localeCompare(right),
      )
      .slice(0, 20)
  }, [mentionQuery, workspaceFiles])

  useEffect(() => {
    setFileIndex(0)
  }, [mentionQuery])

  const slashQuery =
    screen === "chat" && input.startsWith("/") && !/\s/.test(input)
      ? (input.split(/\s+/)[0] ?? "/")
      : ""
  const slashMatches = slashQuery
    ? SLASH_COMMANDS.filter((command) => command.name.startsWith(slashQuery)).slice(0, 5)
    : []
  const fileMenuOpen =
    screen === "chat" &&
    mentionQuery !== null &&
    dismissedMention !== mentionQuery &&
    !busy &&
    !permission &&
    !historySearch
  const activeFileIndex = Math.min(fileIndex, Math.max(0, fileMatches.length - 1))
  const menuOpen =
    screen === "chat" &&
    slashMatches.length > 0 &&
    !busy &&
    !permission &&
    !historySearch &&
    !fileMenuOpen
  const activeSlashIndex = Math.min(slashIndex, Math.max(0, slashMatches.length - 1))
  const activeHistoryIndex = Math.min(
    historySearchIndex,
    Math.max(0, historyMatches.length - 1),
  )

  useEffect(() => {
    return () => {
      subscriptionRef.current?.close()
      clientRef.current?.close()
      storeRef.current?.close()
    }
  }, [])

  useEffect(() => {
    if (screen !== "loading" || !preset) return
    let cancelled = false

    void (async () => {
      try {
        const resolvedBase = baseUrl || preset.baseUrl
        if (!resolvedBase) throw new Error("Base URL is required.")

        const settings = {
          provider: preset.id,
          baseUrl: resolvedBase,
          apiKey,
          model: preset.defaultModel ?? initial.model,
        }
        const listed = await listModels(settings)
        if (cancelled) return
        if (listed.length === 0) throw new Error("The provider returned no models.")

        const sorted = [...listed].sort((left, right) => left.localeCompare(right))
        const preferredModel = preset.defaultModel ?? initial.model
        const preferred =
          preferredModel && sorted.includes(preferredModel) ? sorted.indexOf(preferredModel) : 0
        setModels(sorted)
        setModelIndex(preferred)
        setModel(sorted[preferred]!)
        setScreen("models")
      } catch (cause) {
        if (cancelled) return
        setError(cause instanceof Error ? cause.message : String(cause))
        setScreen("error")
      }
    })()

    return () => {
      cancelled = true
    }
  }, [screen, preset, baseUrl, apiKey, initial.model])

  const chooseProvider = () => {
    const selected = filteredProviders[providerIndex]
    if (!selected) return

    const sameProvider =
      selected.id === initial.provider ||
      (initial.provider === "openai-compatible" && selected.id === "openai") ||
      (initial.provider === "anthropic" && selected.id === "claude")
    const auth = loadAuthConfig()
    const savedKey =
      auth.keys?.[selected.id] ??
      (sameProvider ? (initial.apiKey ?? "") : "")
    const savedBaseUrl = sameProvider ? initial.baseUrl : undefined
    const nextBaseUrl = savedBaseUrl ?? selected.baseUrl ?? ""

    setPreset(selected)
    setApiKey(savedKey)
    setBaseUrl(nextBaseUrl)
    setKeyInput("")
    setBaseInput(nextBaseUrl)

    if (selected.needsKey && !savedKey) setScreen("key")
    else if (selected.askBaseUrl) setScreen("baseurl")
    else setScreen("loading")
  }

  const submitKey = () => {
    if (!preset) return
    const key = keyInput.trim()
    if (!key) return
    saveAuthConfig({ keys: { [preset.id]: key } })
    setApiKey(key)
    setScreen(preset.askBaseUrl ? "baseurl" : "loading")
  }

  const submitBaseUrl = () => {
    const value = baseInput.trim()
    if (!value) return
    setBaseUrl(value)
    setScreen("loading")
  }

  const answerPermission = (approved: boolean, remember = false) => {
    const request = permission
    if (!request) return
    if (approved && remember) allowedToolsRef.current.add(request.tool)
    const client = clientRef.current
    const sessionId = sessionRef.current
    if (client && sessionId) {
      void client
        .resolvePermission(sessionId, request.requestId, approved)
        .catch(() => {})
    }
    setPermission(null)
  }

  const cycleMode = () => {
    const next: PermissionMode =
      permissionMode === "ask" ? "auto" : permissionMode === "auto" ? "readonly" : "ask"
    setPermissionMode(next)
    permissionModeRef.current = next
    if (permission) {
      if (next === "auto") answerPermission(true)
      else if (next === "readonly") answerPermission(false)
    }
  }

  const appendSystem = (text: string) => {
    setTimeline((items) => [
      ...items,
      {
        kind: "system",
        id: `system:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        text,
      },
    ])
  }

  const appendMeta = (text: string) => {
    setTimeline((items) => [
      ...items,
      {
        kind: "meta",
        id: `meta:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        text,
      },
    ])
  }

  const handlePermissionRequest = (
    event: Extract<SessionEvent, { type: "permission.requested" }>,
  ) => {
    const client = clientRef.current
    const sessionId = sessionRef.current
    if (!client || !sessionId) return

    if (allowedToolsRef.current.has(event.tool)) {
      void client.resolvePermission(sessionId, event.requestId, true).catch(() => {})
      return
    }

    const mode = permissionModeRef.current
    if (mode === "auto") {
      void client.resolvePermission(sessionId, event.requestId, true).catch(() => {})
      return
    }
    if (mode === "readonly") {
      void client.resolvePermission(sessionId, event.requestId, false).catch(() => {})
      return
    }

    setPermission({
      requestId: event.requestId,
      tool: event.tool,
      detail: event.detail ?? JSON.stringify(event.input).slice(0, 200),
      diff: event.diff,
    })
  }

  const attachSession = (client: OpenContinueClient, sessionId: string) => {
    clientRef.current = client
    sessionRef.current = sessionId
    subscriptionRef.current?.close()
    allowedToolsRef.current = new Set()
    setPermission(null)
    setTimeline([])
    setTranscriptKey((key) => key + 1)
    setTranscriptScroll(0)
    setTranscriptMode(false)
    setBusy(false)

    const subscription = client.subscribe(sessionId, -1, (event) => {
      setTimeline((items) => reduceTimeline(items, event))

      if (event.type === "permission.requested") {
        handlePermissionRequest(event)
        return
      }
      if (event.type === "permission.resolved") {
        setPermission((current) =>
          current?.requestId === event.requestId ? null : current,
        )
        return
      }
      if (event.type === "run.completed" || event.type === "run.failed") {
        const started = runStartedRef.current
        if (started !== null) {
          const elapsed = Date.now() - started
          setLastDurationMs(elapsed)
          appendMeta(
            `✻ ${event.type === "run.completed" ? "Worked" : "Failed"} for ${formatDuration(elapsed)}`,
          )
        }
        runStartedRef.current = null
        setRunStartedAt(null)
        setBusy(false)
      }
    })

    void subscription.ready.catch((error) => {
      appendSystem(`Session error: ${error instanceof Error ? error.message : String(error)}`)
    })
    subscriptionRef.current = subscription
  }

  useEffect(() => {
    if (!options.url) return
    const client = new HttpSessionClient({ baseUrl: options.url })

    void (async () => {
      let sessionId = options.resume
      if (sessionId) {
        try {
          await client.getSession(sessionId)
        } catch {
          sessionId = undefined
        }
      }
      const session = sessionId
        ? { id: sessionId }
        : await client.createSession("OpenContinue TUI")
      attachSession(client, session.id)
      setModel("remote")
      setScreen("chat")
    })().catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause))
      setScreen("error")
    })

    return () => client.close()
  }, [])

  const clearSession = () => {
    const client = clientRef.current
    if (!client) return

    const current = sessionRef.current
    if (current) void client.abort(current).catch(() => {})

    void (async () => {
      const session = await client.createSession("OpenContinue TUI")
      attachSession(client, session.id)
      appendSystem("Started a new session.")
    })().catch((error) => {
      appendSystem(`Could not create a session: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const openSessions = () => {
    const client = clientRef.current
    if (!client) return

    const current = sessionRef.current
    if (current) void client.abort(current).catch(() => {})
    setPermission(null)
    setBusy(false)
    setLastDurationMs(null)
    setRunStartedAt(null)
    runStartedRef.current = null

    void (async () => {
      const list = [...(await client.listSessions())].sort((left, right) =>
        right.updatedAt.localeCompare(left.updatedAt),
      )
      const labels = await Promise.all(
        list.map(async (item) => {
          try {
            return [item.id, sessionLabel(await client.getSession(item.id), item)] as const
          } catch {
            return [item.id, item.title] as const
          }
        }),
      )
      setSessions(list)
      setSessionLabels(Object.fromEntries(labels))
      setSessionQuery("")
      setSessionIndex(0)
      setScreen("sessions")
    })().catch((error) => {
      appendSystem(`Could not list sessions: ${error instanceof Error ? error.message : String(error)}`)
    })
  }

  const chooseSession = () => {
    const client = clientRef.current
    const chosen = filteredSessions[sessionIndex]
    if (!client || !chosen) return
    attachSession(client, chosen.id)
    setSessionQuery("")
    setScreen("chat")
  }

  const handleCommand = (text: string): boolean => {
    const name = text.split(/\s+/)[0]
    switch (name) {
      case "/help":
        appendSystem(HELP_TEXT)
        return true
      case "/clear":
        clearSession()
        return true
      case "/model":
        if (options.url) {
          appendSystem("Model and provider are managed by the remote server.")
          return true
        }
        setModelQuery("")
        setModelIndex(Math.max(0, models.indexOf(model)))
        if (models.length === 0) {
          setProviderQuery("")
          setProviderIndex(initialProviderIndex(preset?.id ?? initial.provider))
          setScreen("provider")
        } else {
          setScreen("models")
        }
        return true
      case "/provider":
        if (options.url) {
          appendSystem("Model and provider are managed by the remote server.")
          return true
        }
        setProviderQuery("")
        setProviderIndex(initialProviderIndex(preset?.id ?? initial.provider))
        setScreen("provider")
        return true
      case "/resume":
      case "/sessions":
        openSessions()
        return true
      case "/mode":
        cycleMode()
        return true
      case "/status": {
        const tokens = timeline.reduce(
          (sum, item) => (item.kind === "usage" ? sum + item.totalTokens : sum),
          0,
        )
        appendSystem(
          [
            `session: ${sessionRef.current ?? "-"}`,
            `provider: ${preset?.label ?? "-"}`,
            `model: ${options.url ? "remote" : model}`,
            `mode: ${permissionMode}`,
            `tokens: ${tokens}`,
            `workspace: ${workspace}`,
          ].join("\n"),
        )
        return true
      }
      case "/exit":
      case "/quit":
        exit()
        return true
      default:
        appendSystem(`Unknown command: ${name}\n\n${HELP_TEXT}`)
        return true
    }
  }

  const chooseModel = () => {
    if (!preset) return
    const chosen = filteredModels[modelIndex]
    if (!chosen) return

    try {
      const resolvedBase = baseUrl || preset.baseUrl
      saveProviderConfig({
        provider: preset.id,
        baseUrl: resolvedBase,
        model: chosen,
      })

      const settings = resolveProviderSettings()
      const provider = createProvider({
        ...settings,
        provider: preset.id,
        baseUrl: resolvedBase,
        apiKey: apiKey || settings.apiKey,
        model: chosen,
      }).provider
      setModel(chosen)

      const existing = clientRef.current
      if (existing instanceof LocalSessionClient) {
        existing.setProvider(provider)
        setScreen("chat")
        return
      }

      const store = storeRef.current ?? createSessionStore({ workspace })
      storeRef.current = store
      const client = new LocalSessionClient({
        store,
        provider,
        workspace,
        permissionMode: "ask",
      })

      void (async () => {
        let sessionId = options.resume
        if (sessionId) {
          try {
            await client.getSession(sessionId)
          } catch {
            sessionId = undefined
          }
        }
        const session = sessionId
          ? { id: sessionId }
          : await client.createSession("OpenContinue TUI")
        attachSession(client, session.id)
        setScreen("chat")
      })().catch((cause) => {
        setError(cause instanceof Error ? cause.message : String(cause))
        setScreen("error")
      })
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setScreen("error")
    }
  }

  const setDraft = (value: string, at = value.length) => {
    setInput(value)
    setCursor(Math.max(0, Math.min(at, value.length)))
  }

  const startHistorySearch = () => {
    if (history.length === 0 || rows < 18) return
    setHistorySearch(true)
    setHistoryQuery("")
    setHistoryCursor(0)
    setHistorySearchIndex(0)
  }

  const closeHistorySearch = () => {
    setHistorySearch(false)
    setHistoryQuery("")
    setHistoryCursor(0)
    setHistorySearchIndex(0)
  }

  const chooseHistory = () => {
    const index = Math.min(historySearchIndex, Math.max(0, historyMatches.length - 1))
    const chosen = historyMatches[index]
    if (chosen === undefined) return
    setDraft(chosen)
    closeHistorySearch()
  }

  const completeMention = (file: string) => {
    const before = input.slice(0, cursor)
    const match = before.match(/(^|\s)@([^\s@]*)$/)
    if (!match) return
    const start = before.length - (match[0]?.length ?? 0) + (match[1]?.length ?? 0)
    const next = `${input.slice(0, start)}@${file} ${input.slice(cursor)}`
    setDraft(next, start + file.length + 2)
    setDismissedMention(null)
  }

  const send = (value: string) => {
    const text = value.trim()
    if (!text) return
    if (text.startsWith("/")) {
      setDraft("")
      setHistory((items) => [...items, text])
      setHistoryIndex(-1)
      handleCommand(text)
      return
    }

    const client = clientRef.current
    const sessionId = sessionRef.current
    if (!client || !sessionId) return

    if (busy) {
      queuedRef.current.push(text)
      setQueued((items) => [...items, text])
      setDraft("")
      setHistory((items) => [...items, text])
      setHistoryIndex(-1)
      return
    }

    setDraft("")
    setHistory((items) => [...items, text])
    setHistoryIndex(-1)
    setBusy(true)
    setLastDurationMs(null)

    const started = Date.now()
    setRunStartedAt(started)
    runStartedRef.current = started

    void client.sendMessage(sessionId, text).catch((error) => {
      runStartedRef.current = null
      setRunStartedAt(null)
      setBusy(false)
      appendSystem(
        `Send failed: ${error instanceof Error ? error.message : String(error)}`,
      )
    })
  }

  useEffect(() => {
    if (busy || permission || queuedRef.current.length === 0) return
    const next = queuedRef.current.shift()
    if (next === undefined) return
    setQueued((items) => items.slice(1))
    send(next)
  }, [busy, permission])

  const submitInput = (value: string) => {
    if (fileMenuOpen) {
      const chosen = fileMatches[activeFileIndex]
      if (chosen) {
        completeMention(chosen)
        return
      }
      if (filesLoading) return
    }
    if (menuOpen) {
      const chosen = slashMatches[activeSlashIndex]
      if (chosen) {
        send(chosen.name)
        return
      }
    }
    send(value)
  }

  useInput((character, key) => {
    if (key.ctrl && character === "c") {
      exit()
      return
    }

    if (key.tab && key.shift) {
      cycleMode()
      return
    }

    if (key.ctrl && character === "o") {
      setTranscriptMode((value) => !value)
      setTranscriptScroll(0)
      return
    }

    if (transcriptMode) {
      const page = Math.max(1, rows - 6)
      if (key.escape) {
        setTranscriptMode(false)
      } else if (key.upArrow) {
        setTranscriptScroll((value) =>
          Math.min(Math.max(0, lineCountRef.current - page), value + 1),
        )
      } else if (key.downArrow) {
        setTranscriptScroll((value) => Math.max(0, value - 1))
      } else if (key.pageUp) {
        setTranscriptScroll((value) =>
          Math.min(Math.max(0, lineCountRef.current - page), value + page),
        )
      } else if (key.pageDown) {
        setTranscriptScroll((value) => Math.max(0, value - page))
      }
      return
    }

    if (screen === "provider") {
      if (key.escape) {
        if (providerQuery) {
          setProviderQuery("")
          setProviderIndex(0)
        } else if (clientRef.current) {
          setScreen("chat")
        }
      } else if (key.backspace || key.delete) {
        setProviderQuery((query) => query.slice(0, -1))
        setProviderIndex(0)
      } else if (key.upArrow) {
        setProviderIndex((index) => Math.max(0, index - 1))
      } else if (key.downArrow) {
        setProviderIndex((index) =>
          Math.max(0, Math.min(filteredProviders.length - 1, index + 1)),
        )
      } else if (key.return) {
        chooseProvider()
      } else if (isPrintableInput(character, key)) {
        setProviderQuery((query) => query + character)
        setProviderIndex(0)
      }
      return
    }

    if (screen === "models") {
      if (key.escape) {
        if (modelQuery) {
          setModelQuery("")
          setModelIndex(Math.max(0, models.indexOf(model)))
        } else if (clientRef.current) {
          setScreen("chat")
        }
      } else if (key.backspace || key.delete) {
        setModelQuery((query) => query.slice(0, -1))
        setModelIndex(0)
      } else if (key.upArrow) {
        setModelIndex((index) => Math.max(0, index - 1))
      } else if (key.downArrow) {
        setModelIndex((index) =>
          Math.max(0, Math.min(filteredModels.length - 1, index + 1)),
        )
      } else if (key.return) {
        chooseModel()
      } else if (isPrintableInput(character, key)) {
        setModelQuery((query) => query + character)
        setModelIndex(0)
      }
      return
    }

    if (screen === "sessions") {
      if (key.escape) {
        if (sessionQuery) {
          setSessionQuery("")
          setSessionIndex(0)
        } else {
          setScreen("chat")
        }
      } else if (key.backspace || key.delete) {
        setSessionQuery((query) => query.slice(0, -1))
        setSessionIndex(0)
      } else if (key.upArrow) {
        setSessionIndex((index) => Math.max(0, index - 1))
      } else if (key.downArrow) {
        setSessionIndex((index) =>
          Math.max(0, Math.min(filteredSessions.length - 1, index + 1)),
        )
      } else if (key.return) {
        chooseSession()
      } else if (isPrintableInput(character, key)) {
        setSessionQuery((query) => query + character)
        setSessionIndex(0)
      }
      return
    }

    if (screen !== "chat") return

    if (permission) {
      const answer = character.toLowerCase()
      if (answer === "y") {
        answerPermission(true)
      } else if (answer === "a") {
        answerPermission(true, true)
      } else if (answer === "n" || key.escape) {
        answerPermission(false)
      }
      return
    }

    if (key.ctrl && character === "r") {
      startHistorySearch()
      return
    }

    if (historySearch) {
      if (key.upArrow) {
        setHistorySearchIndex((index) => Math.max(0, index - 1))
      } else if (key.downArrow) {
        setHistorySearchIndex((index) =>
          Math.max(0, Math.min(historyMatches.length - 1, index + 1)),
        )
      } else if (key.tab && !key.shift) {
        chooseHistory()
      } else if (key.escape) {
        closeHistorySearch()
      }
      return
    }

    if (fileMenuOpen) {
      if (key.upArrow) {
        setFileIndex((index) => Math.max(0, index - 1))
      } else if (key.downArrow) {
        setFileIndex((index) =>
          Math.max(0, Math.min(fileMatches.length - 1, index + 1)),
        )
      } else if (key.tab && !key.shift) {
        const chosen = fileMatches[activeFileIndex]
        if (chosen) completeMention(chosen)
      } else if (key.escape) {
        setDismissedMention(mentionQuery ?? "")
      }
      return
    }

    if (menuOpen) {
      if (key.upArrow) {
        setSlashIndex((index) => Math.max(0, index - 1))
        return
      }
      if (key.downArrow) {
        setSlashIndex((index) =>
          Math.max(0, Math.min(slashMatches.length - 1, index + 1)),
        )
        return
      }
      if (key.tab && !key.shift) {
        setDraft(slashMatches[activeSlashIndex]?.name ?? input)
        return
      }
      if (key.escape) {
        setDraft("")
        return
      }
    }

    if (key.escape && busy) {
      const client = clientRef.current
      const sessionId = sessionRef.current
      if (client && sessionId) void client.abort(sessionId).catch(() => {})
      return
    }

    if (key.escape && !busy && input.length > 0) {
      setDraft("")
      return
    }

    if (key.ctrl && character === "d" && input.length === 0) {
      exit()
      return
    }

    if (key.upArrow) {
      if (input.includes("\n")) return
      if (history.length === 0) return
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setDraft(history[next] ?? "")
      return
    }

    if (key.downArrow) {
      if (input.includes("\n")) return
      if (historyIndex < 0) return
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(-1)
        setDraft("")
      } else {
        setHistoryIndex(next)
        setDraft(history[next] ?? "")
      }
      return
    }

  })

  const committed: TimelineItem[] = []
  const live: TimelineItem[] = []
  timeline.forEach((item, index) => {
    if (item.kind === "usage") return
    if (isCommittedItem(item, index, timeline, busy)) committed.push(item)
    else live.push(item)
  })

  const activeTool = [...timeline]
    .reverse()
    .find((item) => item.kind === "tool" && item.status === "running")
  const totalTokens = timeline.reduce(
    (sum, item) => (item.kind === "usage" ? sum + item.totalTokens : sum),
    0,
  )
  const elapsedSeconds =
    runStartedAt !== null ? Math.floor((Date.now() - runStartedAt) / 1000) : 0
  const spinnerGlyph = ["✻", "✽", "✢", "·"][tick % 4] ?? "✻"

  const modeText =
    permissionMode === "auto"
      ? "⏵⏵ auto mode on (shift+tab to cycle)"
      : permissionMode === "readonly"
        ? "⛔ readonly mode (shift+tab to cycle)"
        : "? for shortcuts · shift+tab to cycle modes"

  const menuHint = historySearch
    ? "↑/↓ select · Enter use · Esc cancel"
    : fileMenuOpen
      ? "↑/↓ select · Tab/Enter insert · Esc close"
      : menuOpen
        ? "↑/↓ select · Tab complete · Enter run · Esc close"
        : null

  const footerLeft = transcriptMode
    ? "↑/↓ scroll · PgUp/PgDn page · ctrl+o close"
    : screen === "chat"
      ? (menuHint ??
        (permission
          ? "y allow · a allow for session · n deny"
          : modeText))
      : screen === "provider" || screen === "models" || screen === "sessions"
        ? "type to filter · ↑/↓ select · Enter confirm · Esc back"
        : screen === "key" || screen === "baseurl"
          ? "Enter submit · Ctrl+C exit"
          : screen === "loading"
            ? "Loading…"
            : "Ctrl+C exit"

  const durationText =
    lastDurationMs !== null ? formatDuration(lastDurationMs) : undefined
  const tokenText = totalTokens > 0 ? `${formatTokens(totalTokens)} tok` : undefined
  const rightStatus = [
    workspaceStatus.name,
    workspaceStatus.branch,
    `model: ${options.url ? "remote" : model}`,
    durationText,
    tokenText,
  ]
    .filter(Boolean)
    .join(" · ")
    .slice(0, Math.max(0, Math.floor(columns / 2)))

  const pickerWindow = Math.max(4, Math.min(12, rows - 6))
  const rule = "─".repeat(Math.max(1, columns))

  const screenBody = (() => {
    if (screen === "provider") {
      return (
        <Picker
          header={`Select a provider${providerQuery ? ` · /${providerQuery}/` : ""} (${providerIndex + 1}/${filteredProviders.length})`}
          items={filteredProviders.map((item) => ({
            key: item.id,
            label: item.label,
            note: item.note,
          }))}
          selectedIndex={providerIndex}
          windowSize={pickerWindow}
          emptyText={`No providers match “${providerQuery}”`}
        />
      )
    }

    if (screen === "models") {
      return (
        <Picker
          header={`Select a model · ${preset?.label ?? "provider"}${modelQuery ? ` · /${modelQuery}/` : ""} (${modelIndex + 1}/${filteredModels.length})`}
          items={filteredModels.map((item) => ({ key: item, label: item }))}
          selectedIndex={modelIndex}
          windowSize={pickerWindow}
          emptyText={`No models match “${modelQuery}”`}
        />
      )
    }

    if (screen === "sessions") {
      return (
        <Picker
          header={`Resume a session${sessionQuery ? ` · /${sessionQuery}/` : ""} (${sessionIndex + 1}/${filteredSessions.length})`}
          items={filteredSessions.map((item) => ({
            key: item.id,
            label: sessionLabels[item.id] ?? item.title,
            note: `${item.id === sessionRef.current ? "current · " : ""}${item.id.slice(0, 8)} · ${item.lastSeq} events`,
          }))}
          selectedIndex={sessionIndex}
          windowSize={pickerWindow}
          emptyText={sessionQuery ? `No sessions match “${sessionQuery}”` : "No sessions yet."}
        />
      )
    }

    if (screen === "key") {
      return (
        <>
          <Text bold wrap="truncate">
            {preset?.label} API key
          </Text>
          <Box marginTop={1} width={Math.max(10, columns - 4)}>
            <Text color={theme.assistant}>❯ </Text>
            <TextInput value={keyInput} onChange={setKeyInput} mask="*" onSubmit={submitKey} />
          </Box>
          <Text dimColor wrap="truncate">
            Stored in ~/.opencontinue/auth.json
          </Text>
        </>
      )
    }

    if (screen === "baseurl") {
      return (
        <>
          <Text bold wrap="truncate">
            {preset?.label} base URL
          </Text>
          <Box marginTop={1} width={Math.max(10, columns - 4)}>
            <Text color={theme.assistant}>❯ </Text>
            <TextInput
              value={baseInput}
              onChange={setBaseInput}
              onSubmit={submitBaseUrl}
              placeholder="https://example.com/v1"
            />
          </Box>
          <Text dimColor wrap="truncate">
            Use an OpenAI-compatible endpoint.
          </Text>
        </>
      )
    }

    if (screen === "loading") {
      return (
        <Text wrap="truncate">
          {options.url
            ? "Connecting to the OpenContinue server…"
            : `Loading ${preset?.label ?? "provider"} models…`}
        </Text>
      )
    }

    if (screen === "error") {
      return (
        <>
          <Text color="red" wrap="truncate">
            {error}
          </Text>
          <Text dimColor wrap="truncate">
            Ctrl+C to exit.
          </Text>
        </>
      )
    }

    return null
  })()

  const transcriptWidth = Math.max(20, columns - 2)
  const transcriptLines = transcriptMode
    ? timelineLines(timeline, transcriptWidth, true)
    : []
  lineCountRef.current = transcriptLines.length
  const transcriptPage = Math.max(1, rows - 6)
  const transcriptEnd = Math.max(0, transcriptLines.length - transcriptScroll)
  const transcriptStart = Math.max(0, transcriptEnd - transcriptPage)
  const visibleTranscript = transcriptLines.slice(transcriptStart, transcriptEnd)

  return (
    <Box flexDirection="column">
      <Static key={transcriptKey} items={committed}>
        {(item, index) => (
          <TranscriptItem
            key={item.id}
            item={item}
            columns={columns}
            expanded={false}
            leading={index > 0}
            permissionMode={permissionMode}
          />
        )}
      </Static>

      {transcriptMode ? (
        <Box flexDirection="column" height={rows} paddingX={1}>
          <Text dimColor wrap="truncate">
            Transcript · ctrl+o close · ↑/↓ PgUp/PgDn ·
            {transcriptScroll > 0 ? ` ${transcriptScroll} lines below` : " end"}
          </Text>
          {visibleTranscript.length === 0 ? (
            <Text dimColor>(empty)</Text>
          ) : (
            visibleTranscript.map((line, index) => (
              <Text
                key={`${transcriptStart + index}`}
                color={line.color}
                dimColor={line.dim}
                bold={line.bold}
                wrap="truncate"
              >
                {line.text}
              </Text>
            ))
          )}
        </Box>
      ) : (
        <>
          {live.length > 0 ? (
            <Transcript
              items={live}
              columns={columns}
              expanded={false}
              leading={committed.length > 0}
              permissionMode={permissionMode}
            />
          ) : null}

          {screen === "chat" ? (
            <>
              {busy && !permission ? (
                <Box marginTop={1} paddingX={2}>
                  <Text color={theme.brand}>{spinnerGlyph} </Text>
                  <Text>
                    {activeTool?.kind === "tool"
                      ? `Running ${toolDisplayName(activeTool.name)}…`
                      : "Thinking…"}
                  </Text>
                  <Text dimColor> ({formatDuration(elapsedSeconds * 1000)} · esc to interrupt)</Text>
                </Box>
              ) : null}

              {queued.length > 0 ? (
                <Box paddingX={2}>
                  <Text dimColor wrap="truncate">
                    ⏳ Queued: {queued.join(" · ")}
                  </Text>
                </Box>
              ) : null}

              {permission ? (
                <PermissionPrompt columns={columns} permission={permission} />
              ) : (
                <>
                  <Box marginTop={1}>
                    <Text dimColor wrap="truncate">
                      {rule}
                    </Text>
                  </Box>

                  {menuOpen ? (
                    <SlashMenu
                      commands={slashMatches}
                      selectedIndex={activeSlashIndex}
                    />
                  ) : null}

                  {fileMenuOpen ? (
                    <Box flexDirection="column" paddingX={2}>
                      <Picker
                        header={`Files${mentionQuery ? ` · /${mentionQuery}/` : ""} (${activeFileIndex + 1}/${fileMatches.length})`}
                        items={fileMatches.map((file) => ({ key: file, label: file }))}
                        selectedIndex={activeFileIndex}
                        windowSize={Math.min(8, Math.max(1, rows - 8))}
                        emptyText={filesLoading ? "Loading files…" : "No files match."}
                      />
                    </Box>
                  ) : null}

                  {historySearch ? (
                    <Box flexDirection="column" paddingX={2}>
                      <Picker
                        header={`History${historyQuery ? ` · /${historyQuery}/` : ""} (${activeHistoryIndex + 1}/${historyMatches.length})`}
                        items={historyMatches.map((text, index) => ({
                          key: `${index}:${text}`,
                          label: text.replace(/\n/g, " ⏎ "),
                        }))}
                        selectedIndex={activeHistoryIndex}
                        windowSize={Math.min(8, Math.max(1, rows - 8))}
                        emptyText="No matching history."
                      />
                    </Box>
                  ) : null}

                  <Prompt
                    columns={columns}
                    input={historySearch ? historyQuery : input}
                    cursor={historySearch ? historyCursor : cursor}
                    prefix={historySearch ? "search> " : undefined}
                    menuOpen={menuOpen}
                    onInput={
                      historySearch
                        ? (value, at) => {
                            setHistoryQuery(value)
                            setHistoryCursor(at)
                            setHistorySearchIndex(0)
                          }
                        : setDraft
                    }
                    onSubmit={historySearch ? chooseHistory : submitInput}
                  />

                  <Box>
                    <Text dimColor wrap="truncate">
                      {rule}
                    </Text>
                  </Box>
                </>
              )}
            </>
          ) : (
            <Box flexDirection="column" paddingX={2} marginTop={1}>
              {screenBody}
            </Box>
          )}

          <Box paddingX={2} justifyContent="space-between" overflow="hidden">
            <Text dimColor wrap="truncate">
              {footerLeft}
            </Text>
            {columns >= 50 ? (
              <Text dimColor wrap="truncate">
                {rightStatus}
              </Text>
            ) : null}
          </Box>
        </>
      )}
    </Box>
  )
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const instance = render(<App options={options} />, {
    kittyKeyboard: { mode: "auto" },
  })
  await instance.waitUntilExit()
}
