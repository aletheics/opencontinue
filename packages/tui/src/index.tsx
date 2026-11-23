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
import type {
  ReasoningEffort,
  SessionEvent,
  SessionSummary,
} from "@opencontinue/protocol"
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
import { formatPermissions } from "./permissions/format.js"
import { usePermissionPrompt } from "./permissions/use-permission-prompt.js"
import { modeName, type PermissionMode } from "./permissions/types.js"
import { useTerminalSize } from "./hooks/use-terminal-size.js"
import { TAGLINE } from "./brand.js"
import { formatEffort } from "./header.js"
import { FullscreenTranscript } from "./components/FullscreenTranscript.js"
import { glyphs } from "./glyphs.js"
import { LineText } from "./components/LineText.js"
import { Picker } from "./components/Picker.js"
import { PermissionPrompt } from "./components/PermissionPrompt.js"
import { Prompt } from "./components/Prompt.js"
import { SlashMenu } from "./components/SlashMenu.js"
import { SpinnerLine } from "./components/SpinnerLine.js"
import { TodoPanel } from "./components/TodoPanel.js"
import { Transcript, TranscriptItem } from "./components/Transcript.js"
import { Welcome } from "./components/Welcome.js"
import {
  fullscreenViewportHeight,
  scrollViewport,
} from "./fullscreen/layout.js"
import {
  filterModels,
  filterProviders,
  initialProviderIndex,
} from "./providers/selection.js"
import { timelineLines } from "./transcript/format/index.js"
import { filterSessions, sessionLabel } from "./session/labels.js"
import { stableStreamBoundary } from "./session/stream.js"
import { partitionTimeline } from "./session/transcript.js"
import {
  checkpointLabel,
  formatCheckpoints,
  type Checkpoint,
} from "./session/checkpoints.js"
import { formatWorkspaceDiff, workspaceDiff } from "./session/git.js"
import { summarizeRun, type RunToolResult } from "./session/summary.js"
import { activeTodo, latestTodos, todoProgress } from "./session/todos.js"
import { workspaceInfo } from "./session/workspace.js"
import {
  activityLabel,
  activityThresholds,
  progressState,
} from "./status/activity.js"
import { footerLayout, modeTint } from "./status/footer.js"
import { formatClock, formatDuration } from "./status/format.js"
import { pickSpinnerTip } from "./status/spinner.js"
import { theme } from "./theme.js"
import {
  reduceTimeline,
  type AssistantTimelineItem,
  type TimelineItem,
  type ToolTimelineItem,
} from "./timeline.js"

const VERSION = "0.0.1"

export type TuiOptions = {
  auto?: boolean
  plan?: boolean
  /** Legacy alias for plan. */
  readonly?: boolean
  resume?: string
  url?: string
  fullscreen?: boolean
}

type Screen =
  | "provider"
  | "key"
  | "baseurl"
  | "loading"
  | "models"
  | "sessions"
  | "checkpoints"
  | "chat"
  | "error"
export function App({ options }: { options: TuiOptions }) {
  const { exit } = useApp()
  const { columns, rows } = useTerminalSize()
  const initial = useMemo(() => resolveProviderSettings(), [])
  const configuredMode = useMemo<PermissionMode | undefined>(
    () =>
      options.auto
        ? "auto"
        : options.plan || options.readonly
          ? "plan"
          : initial.permissionMode,
    [],
  )
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    configuredMode ?? "confirm",
  )
  const [reasoningEffort, setReasoningEffort] = useState<ReasoningEffort>(
    initial.reasoningEffort ?? "auto",
  )
  const [reasoningLevels, setReasoningLevels] = useState<
    readonly ReasoningEffort[]
  >([])
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
  const [rewindList, setRewindList] = useState<Checkpoint[]>([])
  const [checkpointIndex, setCheckpointIndex] = useState(0)
  const [showTodos, setShowTodos] = useState(true)
  const [fullscreen, setFullscreen] = useState(
    options.fullscreen ?? process.env.OPENCONTINUE_FULLSCREEN === "1",
  )
  const [viewportScroll, setViewportScroll] = useState(0)
  const fullscreenViewportRef = useRef({ total: 0, height: 3 })
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
  const interruptedRef = useRef(false)
  const lineCountRef = useRef(0)
  const autoStartedRef = useRef(false)
  const spinnerTipRef = useRef<string>(pickSpinnerTip())
  const activeRunIdRef = useRef<string | null>(null)
  const runToolsRef = useRef(new Map<string, RunToolResult>())
  const checkpointsRef = useRef<Checkpoint[]>([])
  const runStartsRef = useRef(new Map<string, string>())
  const streamRef = useRef(
    new Map<string, { committed: number; chunk: number }>(),
  )
  const activityLimits = useMemo(() => activityThresholds(), [])
  const reducedMotion = process.env.OPENCONTINUE_REDUCED_MOTION === "1"
  const manualAltExitRef = useRef(false)
  const lastActivityRef = useRef(Date.now())
  const permissionModeRef = useRef<PermissionMode>(permissionMode)
  permissionModeRef.current = permissionMode
  const reasoningEffortRef = useRef<ReasoningEffort>(reasoningEffort)
  reasoningEffortRef.current = reasoningEffort
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
    const timer = setInterval(() => setTick((value) => value + 1), 500)
    return () => clearInterval(timer)
  }, [busy])

  /** Alternate-screen lifecycle for the fullscreen renderer. */
  useEffect(() => {
    if (!process.stdout.isTTY) return
    if (!fullscreen) return

    process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H")
    return () => {
      if (manualAltExitRef.current) {
        manualAltExitRef.current = false
        return
      }
      process.stdout.write("\x1b[?1049l\x1b[H")
    }
  }, [fullscreen])

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
      saveProviderConfig({ permissionMode: next })
      applyMode(next)
      return
    }
    if (!client.setPermissionMode) {
      appendSystem("Permission mode is managed by the server.")
      return
    }
    void Promise.resolve(client.setPermissionMode(next))
      .then(() => {
        saveProviderConfig({ permissionMode: next })
        applyMode(next)
      })
      .catch((error) => {
        appendSystem(
          `Could not change permission mode: ${error instanceof Error ? error.message : String(error)}`,
        )
      })
  }

  const applyClientCapabilities = (result: {
    permissionMode?: PermissionMode
    reasoningEffort?: ReasoningEffort
    reasoningEfforts?: readonly ReasoningEffort[]
  }) => {
    if (result.permissionMode) {
      setPermissionMode(result.permissionMode)
      permissionModeRef.current = result.permissionMode
    }

    const levels = result.reasoningEfforts ?? []
    setReasoningLevels(levels)
    if (result.reasoningEffort) {
      setReasoningEffort(
        levels.length === 0 || levels.includes(result.reasoningEffort)
          ? result.reasoningEffort
          : "auto",
      )
    }
  }

  const cycleReasoning = () => {
    if (reasoningLevels.length === 0) {
      appendSystem(
        "Reasoning effort is not supported by the active provider/model.",
      )
      return
    }

    const index = reasoningLevels.indexOf(reasoningEffort)
    const next =
      reasoningLevels[(index + 1) % reasoningLevels.length] ?? "auto"
    const client = clientRef.current
    if (!client?.setReasoningEffort) return

    void Promise.resolve(client.setReasoningEffort(next))
      .then(() => {
        saveProviderConfig({ reasoningEffort: next })
        setReasoningEffort(next)
        appendSystem(
          `${glyphs.brand} Reasoning effort: ${formatEffort(next) ?? "Auto"}`,
        )
      })
      .catch((error) => {
        appendSystem(
          `Could not change reasoning effort: ${error instanceof Error ? error.message : String(error)}`,
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
    restoredEvents?: number,
    restoreNotice?: string,
  ) => {
    clientRef.current = client
    sessionRef.current = sessionId
    subscriptionRef.current?.close()
    resetPermissions()
    streamRef.current = new Map()
    setStreamChunks([])
    interruptedRef.current = false
    setViewportScroll(0)
    checkpointsRef.current = []
    runStartsRef.current = new Map()
    setTimeline([
      {
        kind: "banner",
        id: `banner:${Date.now()}:${Math.random().toString(36).slice(2)}`,
        version: VERSION,
        model: bannerModel,
        effort: formatEffort(reasoningEffortRef.current),
        provider: bannerProvider,
        workspace,
      },
    ])
    setTranscriptKey((key) => key + 1)
    setTranscriptScroll(0)
    setTranscriptMode(false)
    setBusy(false)
    if (restoreNotice) {
      appendSystem(restoreNotice)
    } else if (restoredEvents && restoredEvents > 0) {
      appendSystem(
        `${glyphs.checkpoint} Restored session · ${restoredEvents} event${restoredEvents === 1 ? "" : "s"}`,
      )
    }

    const subscription = client.subscribe(sessionId, -1, (event) => {
      lastActivityRef.current = Date.now()
      setTimeline((items) => reduceTimeline(items, event))

      if (event.type === "permission.requested") {
        handlePermissionRequest(event)
        return
      }
      if (event.type === "run.started") {
        activeRunIdRef.current = event.runId
        runToolsRef.current = new Map()
        runStartsRef.current.set(event.runId, event.at)
        return
      }
      if (event.type === "permission.resolved") {
        handlePermissionResolved(event)
        return
      }
      if (event.type === "tool.started") {
        runToolsRef.current.set(event.callId, {
          name: event.name,
          status: "running",
          input: event.input,
        })
        return
      }
      if (event.type === "tool.completed") {
        const tool = runToolsRef.current.get(event.callId)
        runToolsRef.current.set(event.callId, {
          name: tool?.name ?? "tool",
          input: tool?.input,
          status: event.failed ? "failed" : "done",
          diff: event.diff,
        })
        return
      }
      if (event.type === "tool.failed") {
        const tool = runToolsRef.current.get(event.callId)
        runToolsRef.current.set(event.callId, {
          name: tool?.name ?? "tool",
          input: tool?.input,
          status: "failed",
          error: event.error,
        })
        return
      }
      if (event.type === "run.completed" || event.type === "run.failed") {
        const startAt = runStartsRef.current.get(event.runId)
        const startMs = startAt ? Date.parse(startAt) : Number.NaN
        const endMs = Date.parse(event.at)
        const durationMs =
          Number.isNaN(startMs) || Number.isNaN(endMs)
            ? undefined
            : Math.max(0, endMs - startMs)
        checkpointsRef.current = [
          ...checkpointsRef.current.slice(-49),
          {
            seq: event.seq,
            at: event.at,
            status:
              event.type === "run.completed" ? "completed" : "failed",
            durationMs,
          },
        ]

        const started = runStartedRef.current
        if (started !== null) {
          const elapsed = Date.now() - started
          const interrupted =
            event.type === "run.failed" && interruptedRef.current
          interruptedRef.current = false
          const symbol = interrupted
            ? glyphs.interrupted
            : event.type === "run.completed"
              ? glyphs.done
              : glyphs.failed
          const outcome = interrupted
            ? "Interrupted"
            : event.type === "run.completed"
              ? "Completed"
              : "Failed"
          const summary = summarizeRun([...runToolsRef.current.values()])
          const lines = [
            `${symbol} ${outcome} in ${formatDuration(elapsed)} · ${formatClock()}`,
          ]
          if (summary) lines.push(summary)
          lines.push(`${glyphs.checkpoint} Checkpoint saved`)
          appendMeta(lines.join("\n"))
        }
        runToolsRef.current = new Map()
        runStartsRef.current.delete(event.runId)
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

    void client
      .health()
      .then(applyClientCapabilities)
      .catch(() => {})
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
      permissionMode: configuredMode,
      reasoningEffort: initial.reasoningEffort ?? "auto",
    })

    void (async () => {
      let sessionId = resumeId
      let restoredEvents: number | undefined
      if (sessionId) {
        try {
          const snapshot = await client.getSession(sessionId)
          restoredEvents = snapshot.lastSeq
        } catch {
          sessionId = undefined
        }
      }
      const session = sessionId
        ? { id: sessionId }
        : await client.createSession("OpenContinue TUI")
      attachSession(
        client,
        session.id,
        modelName,
        providerLabel,
        restoredEvents,
      )
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
      let restoredEvents: number | undefined
      if (sessionId) {
        try {
          const snapshot = await client.getSession(sessionId)
          restoredEvents = snapshot.lastSeq
        } catch {
          sessionId = undefined
        }
      }
      const session = sessionId
        ? { id: sessionId }
        : await client.createSession("OpenContinue TUI")
      attachSession(
        client,
        session.id,
        "remote",
        "server",
        restoredEvents,
      )
      setModel("remote")
      setScreen("chat")
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

  const openRewind = () => {
    const list = [...checkpointsRef.current].reverse()
    if (list.length === 0) {
      appendSystem(`${glyphs.checkpoint} No checkpoints yet.`)
      return
    }
    setRewindList(list)
    setCheckpointIndex(0)
    setScreen("checkpoints")
  }

  const forkAtCheckpoint = () => {
    const client = clientRef.current
    const sessionId = sessionRef.current
    const chosen = rewindList[checkpointIndex]
    if (!client || !sessionId || !chosen) return
    if (!client.forkSession) {
      appendSystem("This transport does not support forking.")
      return
    }

    const modelName = options.url ? "remote" : model
    const providerLabel = options.url
      ? "server"
      : (preset?.label ?? initial.provider ?? "configured provider")

    void client
      .forkSession(sessionId, chosen.seq)
      .then((fork) => {
        attachSession(
          client,
          fork.id,
          modelName,
          providerLabel,
          undefined,
          `${glyphs.checkpoint} Forked session · working tree unchanged`,
        )
        setScreen("chat")
      })
      .catch((error) => {
        appendSystem(
          `Could not fork the session: ${error instanceof Error ? error.message : String(error)}`,
        )
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
      chosen.lastSeq,
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
      case "/reasoning":
        cycleReasoning()
        return true
      case "/diff":
        void workspaceDiff(workspace)
          .then((diff) => appendSystem(formatWorkspaceDiff(diff)))
          .catch((error) => {
            appendSystem(
              `Could not read the working tree: ${error instanceof Error ? error.message : String(error)}`,
            )
          })
        return true
      case "/checkpoints":
        appendSystem(formatCheckpoints(checkpointsRef.current))
        return true
      case "/rewind":
        openRewind()
        return true
      case "/tui": {
        const mode = text.split(/\s+/)[1]
        if (mode === "fullscreen" || mode === "default") {
          if (
            mode === "default" &&
            fullscreen &&
            process.stdout.isTTY
          ) {
            // Leave the alternate screen and clear its shadow before the
            // inline Static view reprints the transcript once.
            process.stdout.write("\x1b[?1049l\x1b[2J\x1b[3J\x1b[H")
            manualAltExitRef.current = true
          }
          setFullscreen(mode === "fullscreen")
          setViewportScroll(0)
          setTranscriptKey((key) => key + 1)
          appendSystem(
            mode === "fullscreen"
              ? "Fullscreen renderer enabled. PgUp/PgDn scroll."
              : "Inline renderer enabled.",
          )
        } else {
          appendSystem("Usage: /tui fullscreen | /tui default")
        }
        return true
      }
      case "/permissions": {
        const client = clientRef.current
        if (!client) {
          appendSystem(formatPermissions(permissionMode))
          return true
        }
        void client
          .health()
          .then((result) =>
            appendSystem(
              formatPermissions(
                result.permissionMode ?? permissionMode,
                result.permissions,
              ),
            ),
          )
          .catch((error) => {
            appendSystem(
              `Could not read permissions: ${error instanceof Error ? error.message : String(error)}`,
            )
          })
        return true
      }
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
            `effort: ${reasoningEffort}`,
            `mode: ${modeName(permissionMode)}`,
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
        void existing.health().then(applyClientCapabilities).catch(() => {})
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
    spinnerTipRef.current = pickSpinnerTip()
    interruptedRef.current = false
    activeRunIdRef.current = null
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

    if (screen === "checkpoints") {
      if (key.escape) {
        setScreen("chat")
      } else if (key.upArrow) {
        setCheckpointIndex((index) => Math.max(0, index - 1))
      } else if (key.downArrow) {
        setCheckpointIndex((index) =>
          Math.max(0, Math.min(rewindList.length - 1, index + 1)),
        )
      } else if (key.return) {
        forkAtCheckpoint()
      }
      return
    }

    if (screen !== "chat") return

    if (key.ctrl && character === "t") {
      setShowTodos((value) => !value)
      return
    }

    if (
      fullscreen &&
      !permission &&
      !menuOpen &&
      !fileMenuOpen &&
      !historySearch &&
      (key.pageUp || key.pageDown)
    ) {
      const view = fullscreenViewportRef.current
      const page = Math.max(1, view.height - 2)
      const delta = key.pageUp ? page : -page
      setViewportScroll((scroll) =>
        scrollViewport(scroll, view.total, view.height, delta),
      )
      return
    }

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

    if (
      (character === "R" || (key.shift && character.toLowerCase() === "r")) &&
      input.length === 0 &&
      !busy &&
      !menuOpen &&
      !fileMenuOpen
    ) {
      cycleReasoning()
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
      interruptedRef.current = true
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
  const todos = useMemo(() => latestTodos(timeline), [timeline])
  const todoCounts = useMemo(() => todoProgress(todos), [todos])

  const now = Date.now()
  const activeTool = [...timeline]
    .reverse()
    .find(
      (item): item is ToolTimelineItem =>
        item.kind === "tool" && item.status === "running",
    )
  const elapsedMs = runStartedAt !== null ? now - runStartedAt : 0
  const idleMs = busy ? now - lastActivityRef.current : 0
  const progress = busy
    ? progressState(idleMs, Boolean(activeTool), activityLimits)
    : "active"
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

  const todoActive = activeTodo(todos)
  const activity = activityLabel({
    activeTool,
    hasText: runChars > 0,
    todoLabel: todoActive
      ? (todoActive.activeForm ?? todoActive.content)
      : undefined,
  })
  const toolStart = activeTool?.startedAt
    ? Date.parse(activeTool.startedAt)
    : Number.NaN
  const activityElapsed = Number.isNaN(toolStart)
    ? elapsedMs
    : Math.max(0, now - toolStart)
  const effortLabel =
    reasoningLevels.length > 0 ? formatEffort(reasoningEffort) : undefined
  const pulse = !reducedMotion && Math.floor(now / 800) % 2 === 0

  const menuHint = historySearch
    ? "↑/↓ select · Enter use · Esc cancel"
    : fileMenuOpen
      ? "↑/↓ select · Tab/Enter insert · Esc close"
      : menuOpen
        ? "↑/↓ select · Tab complete · Enter run · Esc close"
        : null

  const normalFooter = footerLayout({
    mode: permissionMode,
    branch: workspaceStatus.branch ?? undefined,
    columns: Math.max(1, columns - 4),
  })

  const footerTint =
    screen === "chat" && !transcriptMode && !menuHint && !permission
      ? modeTint(permissionMode)
      : undefined
  const footerLeft = transcriptMode
    ? "↑/↓ scroll · PgUp/PgDn page · ctrl+o close"
    : screen === "chat"
      ? (menuHint ??
        (permission
          ? "y allow once · a always allow this tool · n deny"
          : normalFooter.left))
      : screen === "checkpoints"
        ? "↑/↓ select · Enter fork · Esc back"
        : screen === "provider" || screen === "models" || screen === "sessions"
          ? "type to filter · ↑/↓ select · Enter confirm · Esc back"
        : screen === "key" || screen === "baseurl"
          ? "Enter submit · Ctrl+C exit"
          : screen === "loading"
            ? "Loading…"
            : "Ctrl+C exit"
  const footerRight =
    screen === "chat" && !transcriptMode && !menuHint && !permission
      ? normalFooter.right
      : ""

  const pickerWindow = Math.max(4, Math.min(12, rows - 6))
  const rule = "─".repeat(Math.max(1, columns))

  const screenBody = (() => {
    if (screen === "provider") {
      return (
        <>
          <Text wrap="truncate">
            <Text color={theme.brand}>{glyphs.brand}</Text>
            <Text bold> OpenContinue</Text>
            <Text color={theme.textMuted}>{"  "}v{VERSION}</Text>
          </Text>
          <Text color={theme.textSecondary} wrap="truncate">
            {TAGLINE}
          </Text>
          <Box height={1} />
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
        </>
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

    if (screen === "checkpoints") {
      return (
        <Picker
          header={`Fork from a checkpoint · working tree unchanged (${checkpointIndex + 1}/${rewindList.length})`}
          items={rewindList.map((checkpoint) => ({
            key: String(checkpoint.seq),
            label: checkpointLabel(checkpoint),
          }))}
          selectedIndex={checkpointIndex}
          windowSize={pickerWindow}
          emptyText="No checkpoints yet."
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

  const fullscreenLines = useMemo(
    () =>
      fullscreen
        ? timelineLines(
            timeline.filter((item) => item.kind !== "banner"),
            Math.max(20, columns - 2),
            false,
            workspace,
          )
        : [],
    [fullscreen, timeline, columns, workspace],
  )
  const promptRows = Math.min(6, Math.max(1, input.split("\n").length))
  const menuRows = menuOpen
    ? Math.min(slashMatches.length, 8)
    : fileMenuOpen
      ? Math.min(fileMatches.length, 8)
      : historySearch
        ? Math.min(historyMatches.length, 8) + 1
        : 0
  const visibleTodoRows = Math.min(todos.length, 5)
  const todoRows =
    showTodos && todos.length > 0
      ? 2 + visibleTodoRows + (todos.length > visibleTodoRows ? 1 : 0)
      : !showTodos && todos.length > 0
        ? 2
        : 0
  const activityRows = busy && !permission ? 3 : 0
  const queuedRows = queued.length > 0 ? 1 : 0
  const fullscreenHeight =
    fullscreen && screen === "chat" && !permission
      ? fullscreenViewportHeight({
          rows,
          header: 3,
          activity: activityRows,
          todos: todoRows,
          queued: queuedRows,
          composer: 3 + promptRows,
          menus: menuRows,
          footer: 1,
        })
      : 0
  fullscreenViewportRef.current = {
    total: fullscreenLines.length,
    height: Math.max(1, fullscreenHeight),
  }
  const footerLeftText =
    fullscreen && viewportScroll > 0
      ? `${footerLeft} · ↑${viewportScroll}`
      : footerLeft

  return (
    <Box
      flexDirection="column"
      height={fullscreen ? rows : undefined}
      overflow={fullscreen ? "hidden" : undefined}
    >
      {fullscreen && !transcriptMode && screen === "chat" ? (
        <Welcome
          version={VERSION}
          model={options.url ? "remote" : model}
          effort={effortLabel}
          provider={
            options.url
              ? "server"
              : (preset?.label ?? initial.provider ?? "configured provider")
          }
          workspace={workspace}
          columns={columns}
        />
      ) : null}

      {!fullscreen ? (
        <Static key={transcriptKey} items={committed}>
          {(item, index) => (
            <TranscriptItem
              key={item.id}
              item={item}
              columns={columns}
              expanded={false}
              leading={index > 0}
              workspace={workspace}
            />
          )}
        </Static>
      ) : null}

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
          {fullscreen ? (
            screen === "chat" && !permission ? (
              <FullscreenTranscript
                lines={fullscreenLines}
                height={Math.max(3, fullscreenHeight)}
                scrollFromBottom={viewportScroll}
              />
            ) : null
          ) : live.length > 0 ? (
            <Transcript
              items={live}
              columns={columns}
              expanded={false}
              leading={committed.length > 0}
              maxLines={Math.max(2, rows - 14)}
              workspace={workspace}
            />
          ) : null}

          {screen === "chat" ? (
            <>
              {busy && !permission ? (
                <SpinnerLine
                  label={activity}
                  state={progress}
                  elapsedMs={activityElapsed}
                  tokens={runTokens}
                  effort={effortLabel}
                  columns={columns}
                  tip={spinnerTipRef.current}
                  pulse={pulse}
                />
              ) : null}

              {queued.length > 0 ? (
                <Box paddingX={2}>
                  <Text dimColor wrap="truncate">
                    ⏳ Queued: {queued.join(" · ")}
                  </Text>
                </Box>
              ) : null}

              {showTodos ? (
                <TodoPanel
                  todos={todos}
                  maxItems={fullscreen ? 5 : undefined}
                />
              ) : todos.length > 0 ? (
                <Box paddingX={2} marginTop={1}>
                  <Text dimColor wrap="truncate">
                    {glyphs.brand} Tasks {todoCounts.done}/{todoCounts.total} ·
                    ctrl+t to show
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
              {footerLeftText}
            </Text>
            {footerRight ? (
              <Text dimColor wrap="truncate">
                {footerRight}
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
