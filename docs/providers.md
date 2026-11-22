# Providers

OpenContinue supports OpenAI-compatible chat APIs and native Anthropic Claude. Provider families follow [OpenCode](https://github.com/anomalyco/opencode) and [models.dev](https://models.dev).

| Provider | ID | Transport | Base URL | Key |
|---|---|---|---|---|
| OpenAI (GPT) | `openai` | openai-compatible | `https://api.openai.com/v1` | yes |
| Claude (Anthropic) | `claude` | anthropic | `https://api.anthropic.com` | yes |
| DeepSeek | `deepseek` | openai-compatible | `https://api.deepseek.com/v1` | yes |
| Kimi (Moonshot) | `kimi` | openai-compatible | `https://api.moonshot.cn/v1` | yes |
| OpenRouter | `openrouter` | openai-compatible | `https://openrouter.ai/api/v1` | yes |
| Groq | `groq` | openai-compatible | `https://api.groq.com/openai/v1` | yes |
| Mistral | `mistral` | openai-compatible | `https://api.mistral.ai/v1` | yes |
| xAI (Grok) | `xai` | openai-compatible | `https://api.x.ai/v1` | yes |
| Together AI | `togetherai` | openai-compatible | `https://api.together.xyz/v1` | yes |
| Fireworks | `fireworks` | openai-compatible | `https://api.fireworks.ai/inference/v1` | yes |
| Cerebras | `cerebras` | openai-compatible | `https://api.cerebras.ai/v1` | yes |
| DeepInfra | `deepinfra` | openai-compatible | `https://api.deepinfra.com/v1/openai` | yes |
| Baseten | `baseten` | openai-compatible | `https://inference.baseten.co/v1` | yes |
| Alibaba (Qwen) | `alibaba` | openai-compatible | `https://dashscope.aliyuncs.com/compatible-mode/v1` | yes |
| Volcengine (Doubao) | `volcengine` | openai-compatible | `https://ark.cn-beijing.volces.com/api/v3` | yes |
| MiniMax | `minimax` | openai-compatible | `https://api.minimaxi.com/v1` | yes |
| Z.ai (GLM) | `zai` | openai-compatible | `https://api.z.ai/api/paas/v4` | yes |
| Z.ai Coding Plan | `zai-coding` | openai-compatible | `https://api.z.ai/api/coding/paas/v4` | yes |
| Meta Llama | `meta` | openai-compatible | `https://api.llama.com/compat/v1/` | yes |
| Venice AI | `venice` | openai-compatible | `https://api.venice.ai/api/v1` | yes |
| Vercel AI Gateway | `vercel-ai-gateway` | openai-compatible | `https://ai-gateway.vercel.sh/v1` | yes |
| Cohere | `cohere` | openai-compatible | `https://api.cohere.ai/compatibility/v1` | yes |
| Google Gemini | `google` | openai-compatible | `https://generativelanguage.googleapis.com/v1beta/openai/` | yes |
| BytePlus ModelArk | `byteplus` | openai-compatible | `https://ark.ap-southeast.bytepluses.com/api/v3` | yes |
| DigitalOcean Gradient | `digitalocean` | openai-compatible | `https://inference.do-ai.run/v1` | yes |
| Cloudflare AI Gateway | `cloudflare-ai-gateway` | openai-compatible | custom | yes |
| Azure OpenAI | `azure` | openai-compatible | custom | yes |
| Amazon Bedrock | `amazon-bedrock` | openai-compatible | custom | yes |
| Google Vertex AI | `google-vertex` | openai-compatible | custom | yes |
| Cloudflare Workers AI | `cloudflare-workers-ai` | openai-compatible | custom | yes |
| Custom OpenAI-compatible | `openai-compatible` | openai-compatible | custom | yes |
| Custom Anthropic-compatible | `anthropic-compatible` | anthropic | custom | yes |
| Ollama (local) | `ollama` | ollama | `http://127.0.0.1:11434/v1` | no |
| LM Studio (local) | `lmstudio` | openai-compatible | `http://127.0.0.1:1234/v1` | no |
| vLLM (local) | `vllm` | openai-compatible | `http://127.0.0.1:8000/v1` | no |
| Echo (offline) | `echo` | echo | — | no |

## Notes

- Native-only providers (Azure, Bedrock, Vertex, Cloudflare Workers AI) ask for a base URL; point them at an OpenAI-compatible proxy.
- Audio-only providers (AssemblyAI, Cartesia, Deepgram, ElevenLabs) are not part of the chat catalog.
- The catalog lives in [`packages/providers/src/catalog.ts`](../packages/providers/src/catalog.ts).
- The TUI reads this catalog directly: choose a provider, enter its key, then pick from its `/models` response.
