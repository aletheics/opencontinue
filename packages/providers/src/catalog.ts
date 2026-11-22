export type ProviderPreset = {
  id: string
  label: string
  transport: "openai-compatible" | "anthropic" | "ollama" | "echo"
  baseUrl?: string
  defaultModel?: string
  needsKey: boolean
  askBaseUrl?: boolean
  note?: string
}

/**
 * Chat providers. The list follows the provider families used by OpenCode and
 * models.dev; OpenAI-compatible transports share one adapter.
 *
 * Native-only providers (Bedrock, Vertex, Azure, Cloudflare Workers AI) are
 * listed with askBaseUrl so users can point them at an OpenAI-compatible proxy.
 */
export const PROVIDER_PRESETS: ProviderPreset[] = [
  {
    id: "openai",
    label: "OpenAI (GPT)",
    transport: "openai-compatible",
    baseUrl: "https://api.openai.com/v1",
    defaultModel: "gpt-6.2",
    needsKey: true,
  },
  {
    id: "claude",
    label: "Claude (Anthropic)",
    transport: "anthropic",
    baseUrl: "https://api.anthropic.com",
    defaultModel: "claude-sonnet-5-5",
    needsKey: true,
  },
  {
    id: "deepseek",
    label: "DeepSeek",
    transport: "openai-compatible",
    baseUrl: "https://api.deepseek.com/v1",
    defaultModel: "deepseek-chat",
    needsKey: true,
  },
  {
    id: "kimi",
    label: "Kimi (Moonshot)",
    transport: "openai-compatible",
    baseUrl: "https://api.moonshot.cn/v1",
    defaultModel: "kimi-k2.5",
    needsKey: true,
    note: "China endpoint",
  },
  {
    id: "openrouter",
    label: "OpenRouter",
    transport: "openai-compatible",
    baseUrl: "https://openrouter.ai/api/v1",
    needsKey: true,
    note: "GPT, Claude, Kimi, DeepSeek",
  },
  {
    id: "groq",
    label: "Groq",
    transport: "openai-compatible",
    baseUrl: "https://api.groq.com/openai/v1",
    needsKey: true,
  },
  {
    id: "mistral",
    label: "Mistral",
    transport: "openai-compatible",
    baseUrl: "https://api.mistral.ai/v1",
    needsKey: true,
  },
  {
    id: "xai",
    label: "xAI (Grok)",
    transport: "openai-compatible",
    baseUrl: "https://api.x.ai/v1",
    needsKey: true,
  },
  {
    id: "togetherai",
    label: "Together AI",
    transport: "openai-compatible",
    baseUrl: "https://api.together.xyz/v1",
    needsKey: true,
  },
  {
    id: "fireworks",
    label: "Fireworks",
    transport: "openai-compatible",
    baseUrl: "https://api.fireworks.ai/inference/v1",
    needsKey: true,
  },
  {
    id: "cerebras",
    label: "Cerebras",
    transport: "openai-compatible",
    baseUrl: "https://api.cerebras.ai/v1",
    needsKey: true,
  },
  {
    id: "deepinfra",
    label: "DeepInfra",
    transport: "openai-compatible",
    baseUrl: "https://api.deepinfra.com/v1/openai",
    needsKey: true,
  },
  {
    id: "baseten",
    label: "Baseten",
    transport: "openai-compatible",
    baseUrl: "https://inference.baseten.co/v1",
    needsKey: true,
  },
  {
    id: "alibaba",
    label: "Alibaba (Qwen)",
    transport: "openai-compatible",
    baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1",
    needsKey: true,
    note: "DashScope",
  },
  {
    id: "volcengine",
    label: "Volcengine (Doubao)",
    transport: "openai-compatible",
    baseUrl: "https://ark.cn-beijing.volces.com/api/v3",
    needsKey: true,
    note: "China endpoint",
  },
  {
    id: "minimax",
    label: "MiniMax",
    transport: "openai-compatible",
    baseUrl: "https://api.minimaxi.com/v1",
    needsKey: true,
    note: "China endpoint",
  },
  {
    id: "zai",
    label: "Z.ai (GLM)",
    transport: "openai-compatible",
    baseUrl: "https://api.z.ai/api/paas/v4",
    needsKey: true,
  },
  {
    id: "zai-coding",
    label: "Z.ai Coding Plan",
    transport: "openai-compatible",
    baseUrl: "https://api.z.ai/api/coding/paas/v4",
    needsKey: true,
  },
  {
    id: "meta",
    label: "Meta Llama",
    transport: "openai-compatible",
    baseUrl: "https://api.llama.com/compat/v1/",
    needsKey: true,
  },
  {
    id: "venice",
    label: "Venice AI",
    transport: "openai-compatible",
    baseUrl: "https://api.venice.ai/api/v1",
    needsKey: true,
  },
  {
    id: "vercel-ai-gateway",
    label: "Vercel AI Gateway",
    transport: "openai-compatible",
    baseUrl: "https://ai-gateway.vercel.sh/v1",
    needsKey: true,
  },
  {
    id: "cohere",
    label: "Cohere",
    transport: "openai-compatible",
    baseUrl: "https://api.cohere.ai/compatibility/v1",
    needsKey: true,
  },
  {
    id: "google",
    label: "Google Gemini",
    transport: "openai-compatible",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta/openai/",
    needsKey: true,
    note: "OpenAI-compatible endpoint",
  },
  {
    id: "byteplus",
    label: "BytePlus ModelArk",
    transport: "openai-compatible",
    baseUrl: "https://ark.ap-southeast.bytepluses.com/api/v3",
    needsKey: true,
  },
  {
    id: "digitalocean",
    label: "DigitalOcean Gradient",
    transport: "openai-compatible",
    baseUrl: "https://inference.do-ai.run/v1",
    needsKey: true,
  },
  {
    id: "cloudflare-ai-gateway",
    label: "Cloudflare AI Gateway",
    transport: "openai-compatible",
    needsKey: true,
    askBaseUrl: true,
    note: "Account/gateway URL",
  },
  {
    id: "azure",
    label: "Azure OpenAI",
    transport: "openai-compatible",
    needsKey: true,
    askBaseUrl: true,
    note: "OpenAI-compatible proxy/deployment URL",
  },
  {
    id: "amazon-bedrock",
    label: "Amazon Bedrock",
    transport: "openai-compatible",
    needsKey: true,
    askBaseUrl: true,
    note: "OpenAI-compatible proxy URL",
  },
  {
    id: "google-vertex",
    label: "Google Vertex AI",
    transport: "openai-compatible",
    needsKey: true,
    askBaseUrl: true,
    note: "OpenAI-compatible proxy URL",
  },
  {
    id: "cloudflare-workers-ai",
    label: "Cloudflare Workers AI",
    transport: "openai-compatible",
    needsKey: true,
    askBaseUrl: true,
    note: "OpenAI-compatible proxy URL",
  },
  {
    id: "openai-compatible",
    label: "Custom OpenAI-compatible",
    transport: "openai-compatible",
    needsKey: true,
    askBaseUrl: true,
  },
  {
    id: "anthropic-compatible",
    label: "Custom Anthropic-compatible",
    transport: "anthropic",
    needsKey: true,
    askBaseUrl: true,
  },
  {
    id: "ollama",
    label: "Ollama (local)",
    transport: "ollama",
    baseUrl: "http://127.0.0.1:11434/v1",
    defaultModel: "qwen2.5-coder:7b",
    needsKey: false,
  },
  {
    id: "lmstudio",
    label: "LM Studio (local)",
    transport: "openai-compatible",
    baseUrl: "http://127.0.0.1:1234/v1",
    needsKey: false,
  },
  {
    id: "vllm",
    label: "vLLM (local)",
    transport: "openai-compatible",
    baseUrl: "http://127.0.0.1:8000/v1",
    needsKey: false,
  },
  {
    id: "echo",
    label: "Echo (offline)",
    transport: "echo",
    defaultModel: "echo",
    needsKey: false,
  },
]

export function findProviderPreset(id: string | undefined): ProviderPreset | undefined {
  if (!id) return undefined
  return PROVIDER_PRESETS.find((preset) => preset.id === id.toLowerCase())
}
