import { Box, Text, render, useApp, useInput, useStdout } from "ink"
import TextInput from "ink-text-input"
import { useEffect, useMemo, useRef, useState } from "react"

import {
  loadAuthConfig,
  resolveProviderSettings,
  saveAuthConfig,
  saveProviderConfig,
} from "@opencontinue/config"
import { createSessionStore, type SessionStore } from "@opencontinue/core"
import {
  createProvider,
  listModels,
  PROVIDER_PRESETS,
  type ChatProvider,
  type ProviderPreset,
} from "@opencontinue/providers"
import type { SessionSummary } from "@opencontinue/protocol"
import { runAgent } from "@opencontinue/runtime"
import { ToolRegistry } from "@opencontinue/tools"

import { Header } from "./components/Header.js"
import { Picker } from "./components/Picker.js"
import { Prompt } from "./components/Prompt.js"
import { SlashMenu } from "./components/SlashMenu.js"
import { Timeline } from "./components/Timeline.js"
import {
  TuiPermissionGate,
  type PermissionMode,
  type PermissionRequest,
} from "./permission-gate.js"
import { timelineLines } from "./render.js"
import { theme } from "./theme.js"
import { reduceTimeline, timelineFromEvents, type TimelineItem } from "./timeline.js"

export type TuiOptions = {
  auto?: boolean
  readonly?: boolean
  resume?: string
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

export function App({ options }: { options: TuiOptions }) {
  const { exit } = useApp()
  const { columns, rows } = useTerminalSize()
  const [permissionMode, setPermissionMode] = useState<PermissionMode>(
    options.auto ? "auto" : options.readonly ? "readonly" : "ask",
  )

  const initial = useMemo(() => resolveProviderSettings(), [])
  const [screen, setScreen] = useState<Screen>("provider")
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
  const [sessionIndex, setSessionIndex] = useState(0)
  const [sessionQuery, setSessionQuery] = useState("")
  const [model, setModel] = useState(initial.model ?? "gpt-6.2")
  const [error, setError] = useState("")
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [input, setInput] = useState("")
  const [cursor, setCursor] = useState(0)
  const [slashIndex, setSlashIndex] = useState(0)
  const [busy, setBusy] = useState(false)
  const [tick, setTick] = useState(0)
  const [expandAll, setExpandAll] = useState(false)
  const [runStartedAt, setRunStartedAt] = useState<number | null>(null)
  const [lastDurationMs, setLastDurationMs] = useState<number | null>(null)
  const [permission, setPermission] = useState<PermissionRequest | null>(null)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [scrollOffset, setScrollOffset] = useState(0)

  const storeRef = useRef<SessionStore | null>(null)
  const sessionRef = useRef<string | null>(null)
  const providerRef = useRef<ChatProvider | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const runStartedRef = useRef<number | null>(null)
  const abortRef = useRef<AbortController | null>(null)
  const lineCountRef = useRef(0)
  const gateRef = useRef<TuiPermissionGate | null>(null)
  if (!gateRef.current) {
    gateRef.current = new TuiPermissionGate(permissionMode)
  }
  const gate = gateRef.current

  useEffect(() => {
    gate.onChange(() => setPermission(gate.pending))
  }, [gate])

  useEffect(() => {
    if (!busy) return
    const timer = setInterval(() => setTick((value) => value + 1), 100)
    return () => clearInterval(timer)
  }, [busy])

  useEffect(() => {
    setSlashIndex(0)
  }, [input])

  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][tick % 10] ?? "⠋"

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
      `${item.title} ${item.id}`.toLowerCase().includes(query),
    )
  }, [sessions, sessionQuery])

  useEffect(() => {
    return () => {
      unsubscribeRef.current?.()
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

  const cycleMode = () => {
    const next: PermissionMode =
      permissionMode === "ask" ? "auto" : permissionMode === "auto" ? "readonly" : "ask"
    setPermissionMode(next)
    gate.setMode(next)
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

  const attachSession = (store: SessionStore, sessionId: string) => {
    storeRef.current = store
    sessionRef.current = sessionId
    setTimeline(timelineFromEvents(store.events(sessionId)))
    setScrollOffset(0)
    unsubscribeRef.current?.()
    unsubscribeRef.current = store.subscribe(sessionId, (event) => {
      setTimeline((items) => reduceTimeline(items, event))
      if (event.type === "run.completed" || event.type === "run.failed") {
        const started = runStartedRef.current
        if (started !== null) setLastDurationMs(Date.now() - started)
        runStartedRef.current = null
        setRunStartedAt(null)
        abortRef.current = null
        setBusy(false)
      }
    })
  }

  const clearSession = () => {
    if (!providerRef.current) return
    abortRef.current?.abort()
    unsubscribeRef.current?.()
    storeRef.current?.close()

    const store = createSessionStore({ workspace: process.env.INIT_CWD ?? process.cwd() })
    const session = store.create("OpenContinue TUI")
    attachSession(store, session.id)
    setBusy(false)
    appendSystem("Started a new session.")
  }

  const openSessions = () => {
    const store = storeRef.current
    if (!store) return
    abortRef.current?.abort()
    abortRef.current = null
    if (gate.pending) gate.answer(false)
    setPermission(null)
    setBusy(false)
    setLastDurationMs(null)
    setRunStartedAt(null)
    runStartedRef.current = null
    setSessions([...store.list()].sort((left, right) => right.updatedAt.localeCompare(left.updatedAt)))
    setSessionQuery("")
    setSessionIndex(0)
    setScreen("sessions")
  }

  const chooseSession = () => {
    const store = storeRef.current
    const chosen = filteredSessions[sessionIndex]
    if (!store || !chosen) return
    attachSession(store, chosen.id)
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
            `model: ${model}`,
            `mode: ${permissionMode}`,
            `tokens: ${tokens}`,
            `workspace: ${process.env.INIT_CWD ?? process.cwd()}`,
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
      providerRef.current = provider
      setModel(chosen)

      if (storeRef.current && sessionRef.current) {
        setScreen("chat")
        return
      }

      const store = createSessionStore({ workspace: process.env.INIT_CWD ?? process.cwd() })
      const session = (options.resume ? store.get(options.resume) : undefined) ?? store.create(
        "OpenContinue TUI",
      )
      attachSession(store, session.id)
      setScreen("chat")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setScreen("error")
    }
  }

  const setDraft = (value: string, at = value.length) => {
    setInput(value)
    setCursor(Math.max(0, Math.min(at, value.length)))
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

    const store = storeRef.current
    const sessionId = sessionRef.current
    const provider = providerRef.current
    if (!store || !sessionId || !provider || busy) return

    setDraft("")
    setHistory((items) => [...items, text])
    setHistoryIndex(-1)
    setScrollOffset(0)
    setBusy(true)
    setLastDurationMs(null)

    const started = Date.now()
    setRunStartedAt(started)
    runStartedRef.current = started

    const controller = new AbortController()
    abortRef.current = controller

    store.append(sessionId, { type: "message.user", text })

    void runAgent({
      store,
      sessionId,
      provider,
      tools: new ToolRegistry(),
      permissions: gate,
      workspace: process.env.INIT_CWD ?? process.cwd(),
      systemPrompt:
        "You are OpenContinue, a concise coding assistant. Be concrete. Answer in the user's language.",
      signal: controller.signal,
    }).catch(() => {
      abortRef.current = null
      setBusy(false)
    })
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
      setExpandAll((value) => !value)
      return
    }

    if (screen === "provider") {
      if (key.escape) {
        if (providerQuery) {
          setProviderQuery("")
          setProviderIndex(0)
        } else if (storeRef.current) {
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
        } else if (storeRef.current) {
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
        gate.answer(true)
        setPermission(null)
      } else if (answer === "a") {
        gate.answer(true, true)
        setPermission(null)
      } else if (answer === "n" || key.escape) {
        gate.answer(false)
        setPermission(null)
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
      abortRef.current?.abort()
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

    const page = Math.max(1, Math.floor((rows - 9) / 2))

    if (key.pageUp) {
      setScrollOffset((value) =>
        Math.min(Math.max(0, lineCountRef.current - page), value + page),
      )
      return
    }

    if (key.pageDown) {
      setScrollOffset((value) => Math.max(0, value - page))
      return
    }
  })

  const headerProvider =
    screen === "provider"
      ? "select provider"
      : preset?.label ?? initial.provider ?? "OpenContinue"
  const headerModel =
    screen === "chat" ? model : screen === "models" ? "select model" : "—"
  const footer =
    screen === "provider" || screen === "models" || screen === "sessions"
      ? "type to filter · ↑/↓ select · Enter confirm · Esc back"
      : screen === "key" || screen === "baseurl"
        ? "Enter submit · Ctrl+C exit"
        : screen === "chat"
          ? "/exit · ctrl+o expand · shift+tab mode · PgUp/PgDn"
          : screen === "loading"
            ? "Loading models…"
            : "Ctrl+C exit"

  const slashQuery =
    screen === "chat" && input.startsWith("/") && !/\s/.test(input)
      ? (input.split(/\s+/)[0] ?? "/")
      : ""
  const slashMatches = slashQuery
    ? SLASH_COMMANDS.filter((command) => command.name.startsWith(slashQuery)).slice(0, 5)
    : []
  const menuOpen =
    screen === "chat" &&
    slashMatches.length > 0 &&
    !busy &&
    !permission &&
    rows >= 18
  const activeSlashIndex = Math.min(slashIndex, Math.max(0, slashMatches.length - 1))
  const menuHeight = menuOpen ? slashMatches.length + 2 : 0
  const footerText = menuOpen
    ? "↑/↓ select · Tab complete · Enter run · Esc close"
    : footer
  const footerLine = footerText.slice(0, Math.max(10, columns - 2))

  const maxInputHeight = Math.max(3, rows - 8 - menuHeight)
  const inputLines = input.split("\n").length
  const desiredInputHeight = permission
    ? 5
    : Math.min(6, Math.max(3, inputLines + 2))
  const inputHeight =
    screen === "chat" ? Math.min(desiredInputHeight, maxInputHeight) : 0
  const bodyHeight = Math.max(4, rows - 3 - inputHeight - menuHeight - 1)

  const submitInput = (value: string) => {
    if (menuOpen) {
      const chosen = slashMatches[activeSlashIndex]
      if (chosen) {
        send(chosen.name)
        return
      }
    }
    send(value)
  }

  const body = (() => {
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
          windowSize={Math.max(4, Math.min(12, bodyHeight - 4))}
          emptyText={`No providers match “${providerQuery}”`}
        />
      )
    }

    if (screen === "key") {
      return (
        <>
          <Text bold wrap="truncate">
            {preset?.label} API key
          </Text>
          <Box marginTop={1} width={Math.max(10, columns - 8)} overflow="hidden">
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
          <Box marginTop={1} width={Math.max(10, columns - 8)} overflow="hidden">
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
          Loading {preset?.label ?? "provider"} models…
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

    if (screen === "models") {
      return (
        <Picker
          header={`Select a model · ${preset?.label ?? "provider"}${modelQuery ? ` · /${modelQuery}/` : ""} (${modelIndex + 1}/${filteredModels.length})`}
          items={filteredModels.map((item) => ({ key: item, label: item }))}
          selectedIndex={modelIndex}
          windowSize={Math.max(4, Math.min(12, bodyHeight - 4))}
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
            label: item.title,
            note: `${item.id === sessionRef.current ? "current · " : ""}${item.id.slice(0, 8)} · ${item.lastSeq} events`,
          }))}
          selectedIndex={sessionIndex}
          windowSize={Math.max(4, Math.min(12, bodyHeight - 4))}
          emptyText={sessionQuery ? `No sessions match “${sessionQuery}”` : "No sessions yet."}
        />
      )
    }

    const lines = timelineLines(timeline, Math.max(20, columns - 4), expandAll)
    lineCountRef.current = lines.length
    return <Timeline lines={lines} bodyHeight={bodyHeight} scrollOffset={scrollOffset} />
  })()

  const totalTokens = timeline.reduce(
    (sum, item) => (item.kind === "usage" ? sum + item.totalTokens : sum),
    0,
  )
  const elapsedMs = runStartedAt !== null ? Date.now() - runStartedAt : lastDurationMs
  const stats = [
    elapsedMs !== null ? `${(elapsedMs / 1000).toFixed(1)}s` : undefined,
    totalTokens > 0 ? `${formatTokens(totalTokens)} tok` : undefined,
  ]
    .filter(Boolean)
    .join(" · ")

  return (
    <Box flexDirection="column" width={columns} height={rows} overflow="hidden">
      <Header provider={headerProvider} model={headerModel} mode={permissionMode} stats={stats} />
      <Box
        flexDirection="column"
        flexShrink={0}
        height={bodyHeight}
        borderStyle="round"
        borderColor={theme.border}
        paddingX={1}
        overflow="hidden"
      >
        {body}
      </Box>
      {menuOpen ? (
        <SlashMenu commands={slashMatches} selectedIndex={activeSlashIndex} />
      ) : null}
      {screen === "chat" ? (
        <Prompt
          columns={columns}
          height={inputHeight}
          input={input}
          cursor={cursor}
          menuOpen={menuOpen}
          onInput={setDraft}
          onSubmit={submitInput}
          permission={permission}
          busy={busy}
          spinner={spinner}
        />
      ) : null}
      <Box paddingX={1} flexShrink={0} height={1} overflow="hidden">
        <Text dimColor wrap="truncate">
          {footerLine}
        </Text>
      </Box>
    </Box>
  )
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const instance = render(<App options={options} />, {
    alternateScreen: Boolean(process.stdout.isTTY),
    kittyKeyboard: { mode: "auto" },
  })
  await instance.waitUntilExit()
}
