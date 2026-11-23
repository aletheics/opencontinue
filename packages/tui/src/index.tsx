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
import { runAgent } from "@opencontinue/runtime"
import { ToolRegistry, type PermissionGate, type Tool } from "@opencontinue/tools"

import { timelineLines } from "./render.js"
import { reduceTimeline, timelineFromEvents, type TimelineItem } from "./timeline.js"
import { theme } from "./theme.js"

export type TuiOptions = {
  auto?: boolean
  readonly?: boolean
  resume?: string
}

type Screen = "provider" | "key" | "baseurl" | "loading" | "models" | "chat" | "error"
type PermissionMode = "ask" | "auto" | "readonly"

type PermissionRequest = {
  tool: string
  input: string
  resolve: (approved: boolean) => void
}

const SLASH_COMMANDS = [
  { name: "/help", description: "show commands" },
  { name: "/clear", description: "new session" },
  { name: "/model", description: "change model" },
  { name: "/provider", description: "change provider" },
  { name: "/mode", description: "cycle permissions" },
  { name: "/status", description: "session status" },
  { name: "/exit", description: "quit" },
]

const HELP_TEXT = SLASH_COMMANDS.map((command) => `${command.name} — ${command.description}`).join(
  "\n",
)

class TuiPermissionGate implements PermissionGate {
  pending: PermissionRequest | null = null
  private listener: (() => void) | undefined

  constructor(private mode: PermissionMode) {}

  setMode(mode: PermissionMode): void {
    this.mode = mode
  }

  onChange(listener: () => void): void {
    this.listener = listener
  }

  async authorize(tool: Tool, input: unknown): Promise<boolean> {
    if (this.mode === "auto") return true
    if (tool.capability === "read") return true
    if (this.mode === "readonly") return false

    return new Promise<boolean>((resolve) => {
      this.pending = {
        tool: tool.name,
        input: JSON.stringify(input).slice(0, 200),
        resolve,
      }
      this.listener?.()
    })
  }

  answer(approved: boolean): void {
    const pending = this.pending
    if (!pending) return
    this.pending = null
    pending.resolve(approved)
    this.listener?.()
  }
}

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

function Header({
  provider,
  model,
  mode,
  stats,
}: {
  provider: string
  model: string
  mode: string
  stats?: string
}) {
  return (
    <Box
      flexShrink={0}
      height={3}
      borderStyle="round"
      borderColor={theme.border}
      paddingX={1}
      justifyContent="space-between"
      overflow="hidden"
    >
      <Box flexShrink={0}>
        <Text bold color={theme.brand} wrap="truncate">
          OpenContinue
        </Text>
      </Box>
      <Box flexShrink={1} overflow="hidden">
        <Text dimColor wrap="truncate">
          {provider} · model: {model} · {mode}
          {stats ? ` · ${stats}` : ""}
        </Text>
      </Box>
    </Box>
  )
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
  const [preset, setPreset] = useState<ProviderPreset | null>(null)
  const [apiKey, setApiKey] = useState(initial.apiKey ?? "")
  const [baseUrl, setBaseUrl] = useState("")
  const [keyInput, setKeyInput] = useState("")
  const [baseInput, setBaseInput] = useState("")
  const [models, setModels] = useState<string[]>([])
  const [modelIndex, setModelIndex] = useState(0)
  const [model, setModel] = useState(initial.model ?? "gpt-6.2")
  const [error, setError] = useState("")
  const [timeline, setTimeline] = useState<TimelineItem[]>([])
  const [input, setInput] = useState("")
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

  const spinner = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"][tick % 10]

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
    const selected = PROVIDER_PRESETS[providerIndex]
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
        setScreen(models.length > 0 ? "models" : "provider")
        return true
      case "/provider":
        setScreen("provider")
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
    const chosen = models[modelIndex]
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

  const send = (value: string) => {
    const text = value.trim()
    if (!text) return
    if (text.startsWith("/")) {
      setInput("")
      setHistory((items) => [...items, text])
      setHistoryIndex(-1)
      handleCommand(text)
      return
    }

    const store = storeRef.current
    const sessionId = sessionRef.current
    const provider = providerRef.current
    if (!store || !sessionId || !provider || busy) return

    setInput("")
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
      if (key.upArrow) setProviderIndex((index) => Math.max(0, index - 1))
      else if (key.downArrow) {
        setProviderIndex((index) => Math.min(PROVIDER_PRESETS.length - 1, index + 1))
      } else if (key.return) chooseProvider()
      return
    }

    if (screen === "models") {
      if (key.upArrow) setModelIndex((index) => Math.max(0, index - 1))
      else if (key.downArrow) setModelIndex((index) => Math.min(models.length - 1, index + 1))
      else if (key.return) chooseModel()
      return
    }

    if (screen !== "chat") return

    if (permission) {
      if (character.toLowerCase() === "y") {
        gate.answer(true)
        setPermission(null)
      } else if (character.toLowerCase() === "n" || key.escape) {
        gate.answer(false)
        setPermission(null)
      }
      return
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
      if (history.length === 0) return
      const next = historyIndex < 0 ? history.length - 1 : Math.max(0, historyIndex - 1)
      setHistoryIndex(next)
      setInput(history[next] ?? "")
      return
    }

    if (key.downArrow) {
      if (historyIndex < 0) return
      const next = historyIndex + 1
      if (next >= history.length) {
        setHistoryIndex(-1)
        setInput("")
      } else {
        setHistoryIndex(next)
        setInput(history[next] ?? "")
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
    screen === "provider" || screen === "models"
      ? "↑/↓ select · Enter confirm · Ctrl+C exit"
      : screen === "key" || screen === "baseurl"
        ? "Enter submit · Ctrl+C exit"
        : screen === "chat"
          ? "/exit · ctrl+o expand · shift+tab mode · PgUp/PgDn"
          : screen === "loading"
            ? "Loading models…"
            : "Ctrl+C exit"

  const slashMatches =
    screen === "chat" && input.startsWith("/")
      ? SLASH_COMMANDS.filter((command) =>
          command.name.startsWith(input.split(/\s+/)[0] ?? "/"),
        ).slice(0, 3)
      : []
  const footerText =
    slashMatches.length > 0
      ? slashMatches.map((command) => command.name).join("  ")
      : footer
  const footerLine = footerText.slice(0, Math.max(10, columns - 2))

  const inputHeight = screen === "chat" ? 3 : 0
  const bodyHeight = Math.max(4, rows - 3 - inputHeight - 1)

  const body = (() => {
    if (screen === "provider") {
      const windowSize = Math.max(4, Math.min(12, bodyHeight - 4))
      const start = Math.max(
        0,
        Math.min(
          providerIndex - Math.floor(windowSize / 2),
          Math.max(0, PROVIDER_PRESETS.length - windowSize),
        ),
      )
      const visible = PROVIDER_PRESETS.slice(start, start + windowSize)

      return (
        <>
          <Text dimColor wrap="truncate">
            Select a provider ({providerIndex + 1}/{PROVIDER_PRESETS.length})
          </Text>
          {visible.map((item, offset) => {
            const index = start + offset
            return (
              <Text
                key={item.id}
                color={index === providerIndex ? "cyan" : undefined}
                wrap="truncate"
              >
                {index === providerIndex ? "› " : "  "}
                {item.label}
                {item.note ? ` — ${item.note}` : ""}
              </Text>
            )
          })}
        </>
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
      const windowSize = Math.max(4, Math.min(12, bodyHeight - 4))
      const start = Math.max(
        0,
        Math.min(modelIndex - Math.floor(windowSize / 2), Math.max(0, models.length - windowSize)),
      )
      const visible = models.slice(start, start + windowSize)

      return (
        <>
          <Text dimColor wrap="truncate">
            Select a model · {preset?.label} ({modelIndex + 1}/{models.length})
          </Text>
          {visible.map((item, offset) => {
            const index = start + offset
            return (
              <Text
                key={item}
                color={index === modelIndex ? "cyan" : undefined}
                wrap="truncate"
              >
                {index === modelIndex ? "› " : "  "}
                {item}
              </Text>
            )
          })}
        </>
      )
    }

    const lines = timelineLines(timeline, Math.max(20, columns - 4), expandAll)
    lineCountRef.current = lines.length
    const maxLines = Math.max(1, bodyHeight - 4)
    const end = Math.max(0, lines.length - scrollOffset)
    const start = Math.max(0, end - maxLines)
    const visibleLines = lines.slice(start, end)
    const hiddenAbove = start
    const hiddenBelow = lines.length - end

    return (
      <>
        {hiddenAbove > 0 ? (
          <Text dimColor wrap="truncate">
            … {hiddenAbove} older lines · PgUp
          </Text>
        ) : null}
        {visibleLines.length === 0 ? (
          <Text dimColor wrap="truncate">
            Type a message to start.
          </Text>
        ) : (
          visibleLines.map((line, index) => (
            <Text
              key={`${start + index}`}
              color={line.color}
              dimColor={line.dim}
              wrap="truncate"
            >
              {line.text}
            </Text>
          ))
        )}
        {hiddenBelow > 0 ? (
          <Text dimColor wrap="truncate">
            … {hiddenBelow} newer lines · PgDn
          </Text>
        ) : null}
      </>
    )
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
      {screen === "chat" ? (
        <Box
          flexShrink={0}
          height={3}
          borderStyle="round"
          borderColor={theme.inputBorder}
          paddingX={1}
          overflow="hidden"
        >
          {permission ? (
            <Text color="yellow" wrap="truncate">
              permission: {permission.tool} · Allow? [y/N]
            </Text>
          ) : busy ? (
            <Text dimColor wrap="truncate">
              {spinner} Thinking…
            </Text>
          ) : (
            <Box width={Math.max(10, columns - 8)} overflow="hidden">
              <Text color="green">{"you> "}</Text>
              <TextInput
                value={input}
                onChange={setInput}
                onSubmit={send}
                placeholder="Type a message…"
                focus={!busy && !permission}
              />
            </Box>
          )}
        </Box>
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
  const fullscreen = Boolean(process.stdout.isTTY)
  if (fullscreen) process.stdout.write("\x1b[?1049h\x1b[2J\x1b[H")

  try {
    const instance = render(<App options={options} />)
    await instance.waitUntilExit()
  } finally {
    if (fullscreen) process.stdout.write("\x1b[?1049l")
  }
}
