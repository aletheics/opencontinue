import { sep } from "node:path"

import { Box, Static, Text, render, useApp, useInput } from "ink"
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
  type ChatProvider,
  type ProviderPreset,
} from "@opencontinue/providers"
import type { SessionEvent, SessionSummary } from "@opencontinue/protocol"
import { listWorkspaceFiles } from "@opencontinue/tools"

import {
  completeMention as applyMention,
  displayMention,
  filterWorkspaceFiles,
  mentionQueryAt,
} from "./composer/mentions.js"
import { historyIndexAfterMove, searchHistory } from "./composer/history.js"
import { isPrintableInput } from "./composer/keys.js"
import { HELP_TEXT, matchSlashCommands } from "./composer/commands.js"
import { usePermissionPrompt } from "./permissions/use-permission-prompt.js"
import type { PermissionMode } from "./permissions/types.js"
import { useTerminalSize } from "./hooks/use-terminal-size.js"
import { glyphs } from "./glyphs.js"
import { LineText } from "./components/LineText.js"
import { Picker } from "./components/Picker.js"
import { PermissionPrompt } from "./components/PermissionPrompt.js"
import { Prompt } from "./components/Prompt.js"
import { SlashMenu } from "./components/SlashMenu.js"
import { SpinnerLine } from "./components/SpinnerLine.js"
import { Transcript, TranscriptItem } from "./components/Transcript.js"
import {
  filterModels,
  filterProviders,
  initialProviderIndex,
} from "./providers/selection.js"
import { timelineLines } from "./transcript/format/index.js"
import { filterSessions, sessionLabel } from "./session/labels.js"
import { stableStreamBoundary } from "./session/stream.js"
import { partitionTimeline } from "./session/transcript.js"
import { workspaceInfo } from "./session/workspace.js"
import { formatClock, formatDuration, formatTokens } from "./status/format.js"
import {
  pickSpinnerTip,
  pickSpinnerVerb,
  spinnerFrames,
  stallIntensity,
} from "./status/spinner.js"
import { theme } from "./theme.js"
import {
  reduceTimeline,
  type AssistantTimelineItem,
  type TimelineItem,
} from "./timeline.js"

const VERSION = "0.0.1"

export type TuiOptions = {
  auto?: boolean
  plan?: boolean
  /** Legacy alias for plan. */
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
export function App({ options }: { options: TuiOptions }) {
  const { exit } = useApp()
  const { columns, rows } = useTerminalSize()
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    options.auto ? "auto" : options.plan || options.readonly ? "plan" : "confirm",
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
  const [streamChunks, setStreamChunks] = useState<AssistantTimelineItem[]>([])
  const [input, setInput] = useState("")
  const [cursor, setCursor] = useState(0)
  const [queued, setQueued] = useState<string[]>([])
  const queuedRef = useRef<string[]>([])
  const [slashIndex, setSlashIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [, setTick] = useState(0)
  const [transcriptMode, setTranscriptMode] = useState(false)
  const [transcriptScroll, setTranscriptScroll] = useState(0)
  const [transcriptKey, setTranscriptKey] = useState(0)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null)
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
  const autoStartedRef = useRef(false)
  const spinnerVerbRef = useRef<string>(pickSpinnerVerb())
  const spinnerTipRef = useRef<string>(pickSpinnerTip())
  const activeRunIdRef = useRef<string | null>(null)
  const streamRef = useRef(
    new Map<string, { committed: number; chunk: number }>(),
  )
  const stallRef = useRef(0)
  const spinnerFrameSet = useMemo(() => spinnerFrames(), [])
  const lastActivityRef = useRef(Date.now())
  const permissionModeRef = useRef<PermissionMode>(permissionMode)
  permissionModeRef.current = permissionMode
  const {
    permission,
    answer: answerPermission,
    handleRequest: handlePermissionRequest,
    handleResolved: handlePermissionResolved,
    reset: resetPermissions,
  } = usePermissionPrompt({
    getClient: () => clientRef.current,
    getSessionId: () => sessionRef.current,
    getWorkspace: () => workspace,
  })

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setTick((value) => value + 1), 50)
    return () => clearInterval(timer)
  }, [busy])

  /**
   * Stream completed lines into scrollback instead of holding the whole
   * assistant message in the clipped live viewport. Only the current partial
   * line stays live, which is what Claude Code's streaming transcript does.
   */
  useEffect(() => {
    let lastIndex = -1
    for (let index = timeline.length - 1; index >= 0; index--) {
      if (timeline[index]?.kind !== "usage") {
        lastIndex = index
        break
      }
    }
    const active = timeline[lastIndex]
    if (!active || active.kind !== "assistant") return

    const states = streamRef.current
    let state = states.get(active.id)
    if (!state) {
      state = { committed: 0, chunk: 0 }
      states.set(active.id, state)
    }

    const boundary = stableStreamBoundary(active.text)
    if (boundary <= state.committed) return

    const raw = active.text.slice(state.committed, boundary)
    const text = raw.endsWith("\n") ? raw.slice(0, -1) : raw
    state.committed = boundary
    const chunk: AssistantTimelineItem = {
      kind: "assistant",
      id: `stream:${active.id}:${state.chunk}`,
      runId: active.runId,
      text,
      continuation: state.chunk > 0,
    }
    state.chunk += 1
    setStreamChunks((current) => [...current, chunk])
  }, [timeline])

  useEffect(() => {
    setSlashIndex(0)
  }, [input])

  useEffect(() => {
    if (screen !== "chat" || filesLoadedRef.current) return
    filesLoadedRef.current = true
    setFilesLoading(true)
    void listWorkspaceFiles(workspace, { includeDirectories: true })
      .then(setWorkspaceFiles)
      .catch(() => setWorkspaceFiles([]))
      .finally(() => setFilesLoading(false))
  }, [screen])

  const filteredProviders = useMemo(
    () => filterProviders(providerQuery),
    [providerQuery],
  )
  const filteredModels = useMemo(
    () => filterModels(models, modelQuery),
    [models, modelQuery],
  )
  const filteredSessions = useMemo(
    () => filterSessions(sessions, sessionLabels, sessionQuery),
    [sessionLabels, sessions, sessionQuery],
  )

  const historyMatches = useMemo(
    () => (historySearch ? searchHistory(history, historyQuery) : []),
    [history, historyQuery, historySearch],
  )

  const mentionQuery = screen === "chat" ? mentionQueryAt(input, cursor) : null

  const fileMatches = useMemo(
    () =>
      mentionQuery === null
        ? []
        : filterWorkspaceFiles(workspaceFiles, mentionQuery),
    [mentionQuery, workspaceFiles],
  )

  useEffect(() => {
    setFileIndex(0)
  }, [mentionQuery])

  const slashMatches = screen === "chat" ? matchSlashCommands(input, 8) : []
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

  const applyMode = (next: PermissionMode) => {
    setPermissionMode(next)
    permissionModeRef.current = next
    if (permission) {
      if (next === "auto") answerPermission(true)
      else if (next === "plan") answerPermission(false)
    }
  }

  const cycleMode = () => {
    const next: PermissionMode =
      permissionMode === "plan"
        ? "confirm"
        : permissionMode === "confirm"
          ? "auto"
          : "plan"
    const client = clientRef.current
    if (!client) {
      applyMode(next)
      return
    }
    if (!client.setPermissionMode) {
      appendSystem("Permission mode is managed by the server.")
      return
    }
    void Promise.resolve(client.setPermissionMode(next))
      .then(() => applyMode(next))
      .catch((error) => {
        appendSystem(
          `Could not change permission mode: ${error instanceof Error ? error.message : String(error)}`,
        )
      })
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

  const attachSession = (
    client: OpenContinueClient,
    sessionId: string,
    bannerModel: string,
    bannerProvider: string,
  ) => {
    clientRef.current = client
    sessionRef.current = sessionId
    subscriptionRef.current?.close()
    resetPermissions()
    streamRef.current = new Map()
    setStreamChunks([])
    setTimeline([
      {
        kind: "banner",
        id: `banner:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        version: VERSION,
        model: bannerModel,
        provider: bannerProvider,
        workspace,
      },
    ])
    setTranscriptKey((key) => key + 1)
    setTranscriptScroll(0)
    setTranscriptMode(false)
    setBusy(false)

    const subscription = client.subscribe(sessionId, -1, (event) => {
      lastActivityRef.current = Date.now()
      setTimeline((items) => reduceTimeline(items, event))

      if (event.type === "permission.requested") {
        handlePermissionRequest(event)
        return
      }
      if (event.type === "run.started") {
        activeRunIdRef.current = event.runId
        return
      }
      if (event.type === "permission.resolved") {
        handlePermissionResolved(event)
        return
      }
      if (event.type === "run.completed" || event.type === "run.failed") {
        const started = runStartedRef.current
        if (started !== null) {
          const elapsed = Date.now() - started
          setLastDurationMs(elapsed)
          const symbol =
            event.type === "run.completed" ? glyphs.done : glyphs.failed
          const outcome =
            event.type === "run.completed" ? "Completed" : "Failed"
          appendMeta(
            `${symbol} ${outcome} in ${formatDuration(elapsed)} · ${formatClock()}`,
          )
        }
        activeRunIdRef.current = null
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

  const openLocalSession = (
    provider: ChatProvider,
    modelName: string,
    providerLabel: string,
    resumeId?: string,
  ) => {
    const store = storeRef.current ?? createSessionStore({ workspace })
    storeRef.current = store
    const client = new LocalSessionClient({
      store,
      provider,
      workspace,
      permissionMode: permissionModeRef.current,
    })

    void (async () => {
      let sessionId = resumeId
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
      attachSession(client, session.id, modelName, providerLabel)
      setScreen("chat")
    })().catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause))
      setScreen("error")
    })
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
      attachSession(client, session.id, "remote", "server")
      setModel("remote")
      setScreen("chat")
      const health = await client.health().catch(() => null)
      if (health?.permissionMode) {
        setPermissionMode(health.permissionMode)
        permissionModeRef.current = health.permissionMode
      }
    })().catch((cause) => {
      setError(cause instanceof Error ? cause.message : String(cause))
      setScreen("error")
    })

    return () => client.close()
  }, [])

  useEffect(() => {
    if (options.url || autoStartedRef.current) return
    autoStartedRef.current = true
    if (!initial.provider || !initial.model) return

    const savedPreset = PROVIDER_PRESETS.find((item) => item.id === initial.provider)
    if (savedPreset?.needsKey && !initial.apiKey) return

    try {
      const selection = createProvider(initial)
      if (selection.fallback && initial.provider !== "echo") return

      setPreset(savedPreset ?? null)
      setApiKey(initial.apiKey ?? "")
      setBaseUrl(initial.baseUrl ?? savedPreset?.baseUrl ?? "")
      setModel(initial.model)
      setScreen("loading")
      openLocalSession(
        selection.provider,
        initial.model,
        savedPreset?.label ?? initial.provider,
        options.resume,
      )
    } catch {
      // Stay on the provider picker.
    }
  }, [])

  const clearSession = () => {
    const client = clientRef.current
    if (!client) return

    const current = sessionRef.current
    if (current) void client.abort(current).catch(() => {})

    void (async () => {
      const session = await client.createSession("OpenContinue TUI")
      attachSession(
        client,
        session.id,
        options.url ? "remote" : model,
        options.url ? "server" : (preset?.label ?? initial.provider ?? "configured provider"),
      )
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
    resetPermissions()
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
    attachSession(
      client,
      chosen.id,
      options.url ? "remote" : model,
      options.url ? "server" : (preset?.label ?? initial.provider ?? "configured provider"),
    )
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

      openLocalSession(provider, chosen, preset.label, options.resume)
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
    const next = applyMention(input, cursor, file)
    if (!next) return
    setDraft(next.value, next.cursor)
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
    if (!client || !sessionId) {
      appendSystem("Not connected to a session yet.")
      return
    }

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
    spinnerVerbRef.current = pickSpinnerVerb()
    spinnerTipRef.current = pickSpinnerTip()
    activeRunIdRef.current = null
    stallRef.current = 0
    lastActivityRef.current = Date.now()

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
      const typed = value.trim()
      if (slashMatches.some((command) => command.name === typed)) {
        send(typed)
        return
      }
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

    if (
      character === "?" &&
      input.length === 0 &&
      !busy &&
      !menuOpen &&
      !fileMenuOpen
    ) {
      appendSystem(HELP_TEXT)
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

  const chunksByItem = useMemo(() => {
    const byItem = new Map<string, AssistantTimelineItem[]>()
    for (const chunk of streamChunks) {
      const match = /^stream:(.*):\d+$/.exec(chunk.id)
      const itemId = match?.[1]
      if (!itemId) continue
      const list = byItem.get(itemId) ?? []
      list.push(chunk)
      byItem.set(itemId, list)
    }
    return byItem
  }, [streamChunks])

  const displayTimeline = useMemo(
    () =>
      timeline.flatMap((item): TimelineItem[] => {
        if (item.kind !== "assistant") return [item]
        const state = streamRef.current.get(item.id)
        if (!state || state.committed <= 0) return [item]

        const chunks = chunksByItem.get(item.id) ?? []
        const suffix = item.text.slice(state.committed)
        return suffix.length > 0
          ? [...chunks, { ...item, text: suffix, continuation: true }]
          : chunks
      }),
    [timeline, chunksByItem],
  )

  const { committed, live } = partitionTimeline(displayTimeline, busy)

  const activeTool = [...timeline]
    .reverse()
    .find((item) => item.kind === "tool" && item.status === "running")
  const totalTokens = timeline.reduce(
    (sum, item) => (item.kind === "usage" ? sum + item.totalTokens : sum),
    0,
  )
  const elapsedMs = runStartedAt !== null ? Date.now() - runStartedAt : 0
  const idleMs = busy ? Date.now() - lastActivityRef.current : 0
  const targetStall = busy ? stallIntensity(idleMs, Boolean(activeTool)) : 0
  if (busy) stallRef.current += (targetStall - stallRef.current) * 0.1
  else stallRef.current = 0
  const stalled = stallRef.current
  const activeRunId = activeRunIdRef.current
  const runChars = activeRunId
    ? timeline.reduce(
        (sum, item) =>
          item.kind === "assistant" && item.runId === activeRunId
            ? sum + item.text.length
            : sum,
        0,
      )
    : 0
  const runTokens = Math.round(runChars / 4)

  const modeText =
    permissionMode === "auto"
      ? `${glyphs.auto} Auto · no per-action prompts · shift+tab to cycle`
      : permissionMode === "plan"
        ? `${glyphs.plan} Plan · read-only · shift+tab to cycle`
        : `${glyphs.confirm} Confirm · approve writes/bash · shift+tab to cycle`

  const menuHint = historySearch
    ? "↑/↓ select · Enter use · Esc cancel"
    : fileMenuOpen
      ? "↑/↓ select · Tab/Enter insert · Esc close"
      : menuOpen
        ? "↑/↓ select · Tab complete · Enter run · Esc close"
        : null

  const busyHint = busy ? " · esc to interrupt" : ""
  const footerTint =
    screen === "chat" && !transcriptMode && !menuHint && !permission
      ? permissionMode === "auto"
        ? theme.tool
        : theme.brand
      : undefined
  const footerLeft = transcriptMode
    ? "↑/↓ scroll · PgUp/PgDn page · ctrl+o close"
    : screen === "chat"
      ? (menuHint ??
        (permission
          ? "y allow once · a always allow this tool · n deny"
          : `${modeText}${busyHint}`))
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
    `${glyphs.approval} help`,
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
            <Text color={theme.assistant}>› </Text>
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
            <Text color={theme.assistant}>› </Text>
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
    ? timelineLines(timeline, transcriptWidth, true, workspace)
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
            workspace={workspace}
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
              <LineText key={`${transcriptStart + index}`} line={line} />
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
              maxLines={Math.max(2, rows - 14)}
              workspace={workspace}
            />
          ) : null}

          {screen === "chat" ? (
            <>
              {busy && !permission ? (
                <SpinnerLine
                  verb={spinnerVerbRef.current}
                  tip={spinnerTipRef.current}
                  elapsedMs={elapsedMs}
                  tokens={runTokens}
                  stalled={stalled}
                  columns={columns}
                  frames={spinnerFrameSet}
                />
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

                  {menuOpen ? (
                    <SlashMenu
                      commands={slashMatches}
                      selectedIndex={activeSlashIndex}
                      columns={columns}
                    />
                  ) : null}

                  {fileMenuOpen ? (
                    <Box flexDirection="column" paddingX={2}>
                      <Picker
                        marker="+"
                        items={fileMatches.map((file) => ({
                          key: file,
                          label: displayMention(file, sep),
                        }))}
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

                </>
              )}
            </>
          ) : (
            <Box flexDirection="column" paddingX={2} marginTop={1}>
              {screenBody}
            </Box>
          )}

          <Box paddingX={2} justifyContent="space-between" overflow="hidden">
            <Text color={footerTint} dimColor={footerTint === undefined} wrap="truncate">
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
