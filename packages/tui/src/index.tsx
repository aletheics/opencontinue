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

import {
  reduceTimeline,
  timelineFromEvents,
  toolLabel,
  type TimelineItem,
} from "./timeline.js"

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

function formatToolOutput(text: string, columns: number, expanded: boolean): string {
  const width = Math.max(20, columns - 8)
  const lines = text.trim().split(/\r?\n/)
  const maxLines = expanded ? 12 : 2
  const shown = lines
    .slice(0, maxLines)
    .map((line, index) => `${index === 0 ? "  ⎿ " : "    "}${line.slice(0, width)}`)
  if (lines.length > maxLines) {
    shown.push(`    … ${lines.length - maxLines} more lines · ctrl+o`)
  }
  return shown.join("\n")
}

function formatDiff(
  diff: string,
  columns: number,
  expanded: boolean,
): { line: string; color: "green" | "red" | "cyan" | undefined }[] {
  const width = Math.max(20, columns - 4)
  const all = diff
    .split(/\r?\n/)
    .filter(
      (line) =>
        !line.startsWith("Index: ") &&
        !line.startsWith("===================================================================") &&
        !line.startsWith("--- ") &&
        !line.startsWith("+++ "),
    )
  const maxLines = expanded ? 20 : 4
  const shown = all.slice(0, maxLines).map((line) => ({
    line: line.slice(0, width),
    color: line.startsWith("+")
      ? ("green" as const)
      : line.startsWith("-")
        ? ("red" as const)
        : line.startsWith("@@")
          ? ("cyan" as const)
          : undefined,
  }))
  if (all.length > maxLines) {
    shown.push({ line: `… ${all.length - maxLines} more diff lines · ctrl+o`, color: undefined })
  }
  return shown
}

function diffStats(diff: string): { added: number; removed: number } {
  let added = 0
  let removed = 0
  for (const line of diff.split(/\r?\n/)) {
    if (line.startsWith("+") && !line.startsWith("+++")) added++
    else if (line.startsWith("-") && !line.startsWith("---")) removed++
  }
  return { added, removed }
}

function formatTokens(value: number): string {
  return value >= 1000 ? `${(value / 1000).toFixed(1)}k` : String(value)
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
      borderStyle="round"
      borderColor="gray"
      paddingX={1}
      justifyContent="space-between"
    >
      <Text bold color="cyan">
        OpenContinue
      </Text>
      <Text dimColor>
        {provider} · model: {model} · {mode}
        {stats ? ` · ${stats}` : ""}
      </Text>
    </Box>
  )
}

export function App({ options }: { options: TuiOptions }) {
  const { exit } = useApp()
  const stdout = useStdout().stdout as unknown as { columns?: number; rows?: number }
  const columns = Math.max(40, (stdout.columns ?? 80) - 1)
  const rows = Math.max(12, (stdout.rows ?? 24) - 1)
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
    const contentCount = timeline.filter((item) => item.kind !== "usage").length

    if (key.pageUp) {
      setScrollOffset((value) => Math.min(Math.max(0, contentCount - page), value + page))
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
          ? "/exit to quit · Ctrl+C exit · ctrl+o expand · shift+tab mode · PgUp/PgDn scroll"
          : screen === "loading"
            ? "Loading models…"
            : "Ctrl+C exit"

  const slashMatches =
    screen === "chat" && input.startsWith("/")
      ? SLASH_COMMANDS.filter((command) =>
          command.name.startsWith(input.split(/\s+/)[0] ?? "/"),
        ).slice(0, 4)
      : []
  const footerText =
    slashMatches.length > 0
      ? slashMatches.map((command) => `${command.name} ${command.description}`).join("  ")
      : footer

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
          <Text dimColor>
            Select a provider ({providerIndex + 1}/{PROVIDER_PRESETS.length})
          </Text>
          {visible.map((item, offset) => {
            const index = start + offset
            return (
              <Text key={item.id} color={index === providerIndex ? "cyan" : undefined}>
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
          <Text bold>{preset?.label} API key</Text>
          <Box marginTop={1}>
            <TextInput value={keyInput} onChange={setKeyInput} mask="*" onSubmit={submitKey} />
          </Box>
          <Text dimColor>Stored in ~/.opencontinue/auth.json</Text>
        </>
      )
    }

    if (screen === "baseurl") {
      return (
        <>
          <Text bold>{preset?.label} base URL</Text>
          <Box marginTop={1}>
            <TextInput
              value={baseInput}
              onChange={setBaseInput}
              onSubmit={submitBaseUrl}
              placeholder="https://example.com/v1"
            />
          </Box>
          <Text dimColor>Use an OpenAI-compatible endpoint.</Text>
        </>
      )
    }

    if (screen === "loading") {
      return <Text>Loading {preset?.label ?? "provider"} models…</Text>
    }

    if (screen === "error") {
      return (
        <>
          <Text color="red">{error}</Text>
          <Text dimColor>Ctrl+C to exit.</Text>
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
          <Text dimColor>
            Select a model · {preset?.label} ({modelIndex + 1}/{models.length})
          </Text>
          {visible.map((item, offset) => {
            const index = start + offset
            return (
              <Text key={item} color={index === modelIndex ? "cyan" : undefined}>
                {index === modelIndex ? "› " : "  "}
                {item}
              </Text>
            )
          })}
        </>
      )
    }

    const contentItems = timeline.filter((item) => item.kind !== "usage")
    const maxItems = Math.max(1, Math.floor((bodyHeight - 4) / 2))
    const end = Math.max(0, contentItems.length - scrollOffset)
    const start = Math.max(0, end - maxItems)
    const visibleItems = contentItems.slice(start, end)
    const hiddenAbove = start
    const hiddenBelow = contentItems.length - end

    return (
      <>
        {hiddenAbove > 0 ? (
          <Text dimColor>… {hiddenAbove} older items · PgUp</Text>
        ) : null}
        {visibleItems.length === 0 ? (
          <Text dimColor>Type a message to start.</Text>
        ) : (
          visibleItems.map((item) => {
            if (item.kind === "system") {
              return (
                <Text key={item.id} dimColor>
                  {item.text}
                </Text>
              )
            }

            if (item.kind === "user") {
              return (
                <Box key={item.id}>
                  <Text color="green">{"you> "}</Text>
                  <Text>{item.text}</Text>
                </Box>
              )
            }

            if (item.kind === "assistant") {
              return item.text ? <Text key={item.id}>{item.text}</Text> : null
            }

            const stats = item.diff ? diffStats(item.diff) : undefined

            return (
              <Box key={item.id} flexDirection="column">
                <Text
                  color={
                    item.status === "failed"
                      ? "red"
                      : item.status === "running"
                        ? "yellow"
                        : "green"
                  }
                >
                  {item.status === "failed" ? "✗" : "●"}{" "}
                  {toolLabel(item).slice(0, Math.max(20, columns - 8))}
                  {stats ? (
                    <Text dimColor>
                      {"  "}+{stats.added} -{stats.removed}
                    </Text>
                  ) : null}
                </Text>
                {item.diff
                  ? formatDiff(item.diff, columns, expandAll).map((line, index) => (
                      <Text
                        key={`${item.id}-diff-${index}`}
                        color={line.color}
                        dimColor={line.color === undefined}
                      >
                        {line.line}
                      </Text>
                    ))
                  : item.output
                    ? (
                        <Text dimColor>
                          {formatToolOutput(item.output, columns, expandAll)}
                        </Text>
                      )
                    : null}
                {item.error ? (
                  <Text color="red">
                    {formatToolOutput(item.error, columns, expandAll)}
                  </Text>
                ) : null}
              </Box>
            )
          })
        )}
        {hiddenBelow > 0 ? (
          <Text dimColor>… {hiddenBelow} newer items · PgDn</Text>
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
        borderColor="gray"
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
          borderColor="cyan"
          paddingX={1}
          overflow="hidden"
        >
          {permission ? (
            <Text color="yellow">
              permission: {permission.tool} · Allow? [y/N]
            </Text>
          ) : busy ? (
            <Text dimColor>
              {spinner} Thinking…
            </Text>
          ) : (
            <Box>
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
      <Box paddingX={1} flexShrink={0}>
        <Text dimColor>{footerText}</Text>
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
