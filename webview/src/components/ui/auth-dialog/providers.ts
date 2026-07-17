/**
 * Provider catalogue for the Provider Login dialog.
 *
 * `id` is the key written into auth.json. `aliases` are alternative keys that
 * should also count as "already configured" (auth.json naming varies a little
 * by pi version / provider).
 */
export interface ProviderDef {
  id: string;
  label: string;
  aliases?: string[];
}

/** OAuth / account-based sign-ins. */
export const SUBSCRIPTION_PROVIDERS: ProviderDef[] = [
  { id: 'anthropic', label: 'Anthropic (Claude Pro/Max)' },
  {
    id: 'openai',
    label: 'ChatGPT Plus/Pro (Codex Subscription)',
    aliases: ['chatgpt', 'codex'],
  },
  {
    id: 'github-copilot',
    label: 'GitHub Copilot',
    aliases: ['copilot', 'github'],
  },
];

/**
 * API-key providers (also used by the generic "Log in to a provider" method).
 *
 * `id` is written verbatim as the auth.json key, so it MUST match the key pi
 * expects — see the "auth.json key" column in pi's Providers docs. Retired ids
 * are kept as `aliases` so credentials saved under an older key still show as
 * configured. Sorted by label; mirrors pi's `/login` configure list. A few
 * entries (e.g. Google Vertex AI) authenticate via ambient credentials rather
 * than a pasted key, but are listed for parity with pi.
 */
export const API_KEY_PROVIDERS: ProviderDef[] = [
  {
    id: 'amazon-bedrock',
    label: 'Amazon Bedrock',
    aliases: ['bedrock', 'amazon', 'aws'],
  },
  {
    id: 'ant-ling',
    label: 'Ant Ling',
    aliases: ['antling', 'ling', 'inclusionai'],
  },
  { id: 'anthropic', label: 'Anthropic' },
  {
    id: 'azure-openai-responses',
    label: 'Azure OpenAI Responses',
    aliases: ['azure', 'azureopenai'],
  },
  { id: 'cerebras', label: 'Cerebras' },
  { id: 'cloudflare-ai-gateway', label: 'Cloudflare AI Gateway' },
  { id: 'cloudflare-workers-ai', label: 'Cloudflare Workers AI' },
  { id: 'deepseek', label: 'DeepSeek' },
  { id: 'fireworks', label: 'Fireworks', aliases: ['fireworksai'] },
  { id: 'google', label: 'Google Gemini', aliases: ['googleai', 'gemini'] },
  {
    id: 'google-vertex',
    label: 'Google Vertex AI',
    aliases: ['vertexai', 'vertex'],
  },
  { id: 'groq', label: 'Groq' },
  { id: 'huggingface', label: 'Hugging Face', aliases: ['hf'] },
  { id: 'kimi-coding', label: 'Kimi For Coding', aliases: ['kimi'] },
  { id: 'minimax', label: 'MiniMax' },
  { id: 'minimax-cn', label: 'MiniMax (China)' },
  { id: 'mistral', label: 'Mistral' },
  { id: 'moonshotai', label: 'Moonshot AI', aliases: ['moonshot'] },
  {
    id: 'moonshotai-cn',
    label: 'Moonshot AI (China)',
    aliases: ['moonshot-cn'],
  },
  { id: 'nvidia', label: 'NVIDIA NIM', aliases: ['nim'] },
  { id: 'openai', label: 'OpenAI' },
  { id: 'opencode', label: 'OpenCode Zen', aliases: ['opencode-zen'] },
  { id: 'opencode-go', label: 'OpenCode Go' },
  { id: 'openrouter', label: 'OpenRouter' },
  { id: 'together', label: 'Together AI', aliases: ['togetherai'] },
  { id: 'vercel-ai-gateway', label: 'Vercel AI Gateway', aliases: ['vercel'] },
  { id: 'xai', label: 'xAI', aliases: ['grok'] },
  { id: 'xiaomi', label: 'Xiaomi MiMo', aliases: ['mimo'] },
  { id: 'xiaomi-token-plan-ams', label: 'Xiaomi MiMo Token Plan (Amsterdam)' },
  { id: 'xiaomi-token-plan-cn', label: 'Xiaomi MiMo Token Plan (China)' },
  { id: 'xiaomi-token-plan-sgp', label: 'Xiaomi MiMo Token Plan (Singapore)' },
  {
    id: 'zai',
    label: 'ZAI Coding Plan (Global)',
    aliases: ['zhipu', 'zhipuai', 'glm'],
  },
  { id: 'zai-coding-cn', label: 'ZAI Coding Plan (China)' },
];

/** Whether a provider already has an entry in auth.json. */
export function isConfigured(
  provider: ProviderDef,
  configured: readonly string[],
): boolean {
  const keys = new Set(configured.map((k) => k.toLowerCase()));
  if (keys.has(provider.id.toLowerCase())) return true;
  return (provider.aliases ?? []).some((a) => keys.has(a.toLowerCase()));
}
