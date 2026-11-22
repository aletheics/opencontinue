import { Box, Text, render, useApp, useInput } from "ink"
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
import { runAgent } from "@opencontinue/server"
import { ToolRegistry, type PermissionGate, type Tool } from "@opencontinue/tools"

export type TuiOptions = {
  auto?: boolean
  readonly?: boolean
  resume?: string
}

type Screen = "provider" | "key" | "baseurl" | "loading" | "models" | "chat" | "error"

type Message = {
  role: "user" | "assistant"
  text: string
}

type PermissionRequest = {
  tool: string
  input: string
  resolve: (approved: boolean) => void
}

class TuiPermissionGate implements PermissionGate {
  pending: PermissionRequest | null = null
  private listener: (() => void) | undefined

  constructor(
    private readonly auto: boolean,
    private readonly readonlyMode: boolean,
  ) {}

  onChange(listener: () => void): void {
    this.listener = listener
  }

  async authorize(tool: Tool, input: unknown): Promise<boolean> {
    if (this.auto) return true
    if (tool.capability === "read") return true
    if (this.readonlyMode) return false

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

function initialProviderIndex(provider: string | undefined): number {
  const index = PROVIDER_PRESETS.findIndex(
    (item) =>
      item.id === provider ||
      (provider === "openai-compatible" && item.id === "openai") ||
      (provider === "anthropic" && item.id === "claude"),
  )
  return index >= 0 ? index : 0
}

export function App({ options }: { options: TuiOptions }) {
  const { exit } = useApp()
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
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState("")
  const [busy, setBusy] = useState(false)
  const [activity, setActivity] = useState("")
  const [permission, setPermission] = useState<PermissionRequest | null>(null)

  const storeRef = useRef<SessionStore | null>(null)
  const sessionRef = useRef<string | null>(null)
  const providerRef = useRef<ChatProvider | null>(null)
  const unsubscribeRef = useRef<(() => void) | null>(null)
  const gateRef = useRef<TuiPermissionGate | null>(null)
  if (!gateRef.current) {
    gateRef.current = new TuiPermissionGate(Boolean(options.auto), Boolean(options.readonly))
  }
  const gate = gateRef.current

  useEffect(() => {
    gate.onChange(() => setPermission(gate.pending))
  }, [gate])

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
      const store = createSessionStore({ workspace: process.env.INIT_CWD ?? process.cwd() })
      const session = (options.resume ? store.get(options.resume) : undefined) ?? store.create(
        "OpenContinue TUI",
      )

      storeRef.current = store
      sessionRef.current = session.id
      providerRef.current = provider
      setModel(chosen)
      setMessages(
        (store.snapshot(session.id)?.messages ?? []).map((message) => ({
          role: message.role,
          text: message.text,
        })),
      )

      unsubscribeRef.current?.()
      unsubscribeRef.current = store.subscribe(session.id, (event) => {
        const snapshot = store.snapshot(session.id)
        if (snapshot) {
          setMessages(
            snapshot.messages.map((message) => ({
              role: message.role,
              text: message.text,
            })),
          )
        }

        if (event.type === "tool.started") setActivity(`tool: ${event.name}`)
        else if (event.type === "tool.completed") setActivity("")
        else if (event.type === "tool.failed") setActivity(`tool failed: ${event.error}`)
        else if (event.type === "run.completed") {
          setBusy(false)
          setActivity("")
        } else if (event.type === "run.failed") {
          setBusy(false)
          setActivity(`error: ${event.error}`)
        }
      })

      setScreen("chat")
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause))
      setScreen("error")
    }
  }

  const send = (value: string) => {
    const text = value.trim()
    if (!text) return
    if (text === "/exit" || text === "/quit") {
      exit()
      return
    }

    const store = storeRef.current
    const sessionId = sessionRef.current
    const provider = providerRef.current
    if (!store || !sessionId || !provider || busy) return

    setInput("")
    setBusy(true)
    setActivity("")
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
    }).catch((cause) => {
      setBusy(false)
      setActivity(cause instanceof Error ? cause.message : String(cause))
    })
  }

  useInput((character, key) => {
    if (key.ctrl && character === "c") {
      exit()
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

    if (screen === "chat" && permission) {
      if (character.toLowerCase() === "y") {
        gate.answer(true)
        setPermission(null)
      } else if (character.toLowerCase() === "n" || key.escape) {
        gate.answer(false)
        setPermission(null)
      }
    }
  })

  if (screen === "provider") {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          OpenContinue
        </Text>
        <Text>Select a provider</Text>
        {PROVIDER_PRESETS.map((item, index) => (
          <Text key={item.id} color={index === providerIndex ? "cyan" : undefined}>
            {index === providerIndex ? "› " : "  "}
            {item.label}
            {item.note ? ` — ${item.note}` : ""}
          </Text>
        ))}
        <Text dimColor>↑/↓ select · Enter confirm · Ctrl+C exit</Text>
      </Box>
    )
  }

  if (screen === "key") {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          OpenContinue
        </Text>
        <Text>{preset?.label} API key</Text>
        <TextInput value={keyInput} onChange={setKeyInput} mask="*" onSubmit={submitKey} />
        <Text dimColor>Saved to ~/.opencontinue/auth.json</Text>
      </Box>
    )
  }

  if (screen === "baseurl") {
    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          OpenContinue
        </Text>
        <Text>{preset?.label} base URL</Text>
        <TextInput
          value={baseInput}
          onChange={setBaseInput}
          onSubmit={submitBaseUrl}
          placeholder="https://example.com/v1"
        />
      </Box>
    )
  }

  if (screen === "loading") {
    return <Text>Loading {preset?.label ?? "provider"} models…</Text>
  }

  if (screen === "error") {
    return (
      <Box flexDirection="column">
        <Text color="red">{error}</Text>
        <Text dimColor>Ctrl+C to exit.</Text>
      </Box>
    )
  }

  if (screen === "models") {
    const windowSize = 12
    const start = Math.max(
      0,
      Math.min(modelIndex - Math.floor(windowSize / 2), Math.max(0, models.length - windowSize)),
    )
    const visible = models.slice(start, start + windowSize)

    return (
      <Box flexDirection="column">
        <Text bold color="cyan">
          OpenContinue
        </Text>
        <Text>Select a model · {preset?.label}</Text>
        {visible.map((item, offset) => {
          const index = start + offset
          return (
            <Text key={item} color={index === modelIndex ? "cyan" : undefined}>
              {index === modelIndex ? "› " : "  "}
              {item}
            </Text>
          )
        })}
        <Text dimColor>↑/↓ select · Enter confirm</Text>
      </Box>
    )
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        OpenContinue
      </Text>
      <Text dimColor>
        {preset?.label} · model: {model} · /exit to quit
      </Text>
      {messages.map((message, index) => (
        <Box key={`${index}-${message.role}`}>
          <Text color={message.role === "user" ? "green" : "white"}>
            {message.role === "user" ? "you> " : "ai> "}
          </Text>
          <Text>{message.text}</Text>
        </Box>
      ))}
      {activity ? <Text color="yellow">{activity}</Text> : null}
      {permission ? (
        <Box flexDirection="column">
          <Text color="yellow">
            permission: {permission.tool} {permission.input}
          </Text>
          <Text>Allow? [y/N]</Text>
        </Box>
      ) : busy ? (
        <Text dimColor>thinking…</Text>
      ) : (
        <Box>
          <Text color="green">{"you> "}</Text>
          <TextInput value={input} onChange={setInput} onSubmit={send} />
        </Box>
      )}
    </Box>
  )
}

export async function runTui(options: TuiOptions = {}): Promise<void> {
  const instance = render(<App options={options} />)
  await instance.waitUntilExit()
}
