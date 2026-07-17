import anthropic from '@lobehub/icons-static-svg/icons/anthropic.svg';
import azure from '@lobehub/icons-static-svg/icons/azure.svg';
import bedrock from '@lobehub/icons-static-svg/icons/bedrock.svg';
import claude from '@lobehub/icons-static-svg/icons/claude.svg';
import cohere from '@lobehub/icons-static-svg/icons/cohere.svg';
import copilot from '@lobehub/icons-static-svg/icons/copilot.svg';
import deepseek from '@lobehub/icons-static-svg/icons/deepseek.svg';
import fireworks from '@lobehub/icons-static-svg/icons/fireworks.svg';
import google from '@lobehub/icons-static-svg/icons/google.svg';
import grok from '@lobehub/icons-static-svg/icons/grok.svg';
import groq from '@lobehub/icons-static-svg/icons/groq.svg';
import huggingface from '@lobehub/icons-static-svg/icons/huggingface.svg';
import kimi from '@lobehub/icons-static-svg/icons/kimi.svg';
import meta from '@lobehub/icons-static-svg/icons/meta.svg';
import microsoft from '@lobehub/icons-static-svg/icons/microsoft.svg';
import minimax from '@lobehub/icons-static-svg/icons/minimax.svg';
import mistral from '@lobehub/icons-static-svg/icons/mistral.svg';
import moonshot from '@lobehub/icons-static-svg/icons/moonshot.svg';
import ollama from '@lobehub/icons-static-svg/icons/ollama.svg';
import openai from '@lobehub/icons-static-svg/icons/openai.svg';
import openrouter from '@lobehub/icons-static-svg/icons/openrouter.svg';
import perplexity from '@lobehub/icons-static-svg/icons/perplexity.svg';
import qwen from '@lobehub/icons-static-svg/icons/qwen.svg';
import together from '@lobehub/icons-static-svg/icons/together.svg';
import vertexai from '@lobehub/icons-static-svg/icons/vertexai.svg';
import xai from '@lobehub/icons-static-svg/icons/xai.svg';
import zai from '@lobehub/icons-static-svg/icons/zai.svg';
import zhipu from '@lobehub/icons-static-svg/icons/zhipu.svg';

function prep(raw: string): string {
  return raw.replace(/^<svg\s/, '<svg class="provider-icon-svg" ');
}

const ICONS = {
  anthropic: prep(anthropic),
  claude: prep(claude),
  openai: prep(openai),
  google: prep(google),
  vertexai: prep(vertexai),
  mistral: prep(mistral),
  deepseek: prep(deepseek),
  meta: prep(meta),
  ollama: prep(ollama),
  cohere: prep(cohere),
  openrouter: prep(openrouter),
  groq: prep(groq),
  moonshot: prep(moonshot),
  kimi: prep(kimi),
  azure: prep(azure),
  bedrock: prep(bedrock),
  zhipu: prep(zhipu),
  qwen: prep(qwen),
  perplexity: prep(perplexity),
  together: prep(together),
  fireworks: prep(fireworks),
  minimax: prep(minimax),
  xai: prep(xai),
  grok: prep(grok),
  microsoft: prep(microsoft),
  copilot: prep(copilot),
  huggingface: prep(huggingface),
  zai: prep(zai),
} as const;

type IconKey = keyof typeof ICONS;

const norm = (s?: string) => (s || '').toLowerCase().replace(/[^a-z0-9]/g, '');

const MODEL_KEYWORDS: [RegExp, IconKey][] = [
  [/claude/, 'claude'],
  [/gemini|gemma/, 'google'],
  [/gpt|davinci|^o[0-9]|^chatgpt/, 'openai'],
  [/deepseek/, 'deepseek'],
  [/mistral|mixtral|codestral|ministral|pixtral|magistral|devstral/, 'mistral'],
  [/llama/, 'meta'],
  [/qwen|qwq/, 'qwen'],
  [/grok/, 'grok'],
  [/kimi/, 'kimi'],
  [/command|cohere|aya/, 'cohere'],
  [/phi[0-9]/, 'microsoft'],
  [/glm/, 'zai'],
  [/minimax|abab/, 'minimax'],
];

const PROVIDER_MAP: Record<string, IconKey> = {
  anthropic: 'anthropic',
  openai: 'openai',
  azureopenai: 'azure',
  azure: 'azure',
  google: 'google',
  googleai: 'google',
  googlegenai: 'google',
  vertex: 'vertexai',
  vertexai: 'vertexai',
  meta: 'meta',
  ollama: 'ollama',
  cohere: 'cohere',
  openrouter: 'openrouter',
  groq: 'groq',
  moonshot: 'moonshot',
  moonshotai: 'moonshot',
  bedrock: 'bedrock',
  amazon: 'bedrock',
  aws: 'bedrock',
  zhipu: 'zhipu',
  zhipuai: 'zhipu',
  dashscope: 'qwen',
  alibaba: 'qwen',
  perplexity: 'perplexity',
  together: 'together',
  togetherai: 'together',
  fireworks: 'fireworks',
  fireworksai: 'fireworks',
  xai: 'xai',
  microsoft: 'microsoft',
  github: 'copilot',
  huggingface: 'huggingface',
  hf: 'huggingface',
};

export function getProviderIconSvg(
  provider?: string,
  model?: string,
): string | null {
  const m = norm(model);
  if (m) {
    for (const [re, key] of MODEL_KEYWORDS) if (re.test(m)) return ICONS[key];
  }
  const p = norm(provider);
  if (p) {
    if (PROVIDER_MAP[p]) return ICONS[PROVIDER_MAP[p]];
    for (const key of Object.keys(PROVIDER_MAP)) {
      if (p.includes(key)) return ICONS[PROVIDER_MAP[key]];
    }
  }
  return null;
}
