import hljs from 'highlight.js/lib/common';
import { useMemo } from 'react';

/** Map a file extension to a highlight.js language id (common bundle only). */
const EXT_LANG: Record<string, string> = {
  js: 'javascript',
  jsx: 'javascript',
  mjs: 'javascript',
  cjs: 'javascript',
  ts: 'typescript',
  tsx: 'typescript',
  mts: 'typescript',
  cts: 'typescript',
  json: 'json',
  jsonc: 'json',
  py: 'python',
  rb: 'ruby',
  go: 'go',
  rs: 'rust',
  java: 'java',
  kt: 'kotlin',
  kts: 'kotlin',
  swift: 'swift',
  c: 'c',
  h: 'c',
  cpp: 'cpp',
  cc: 'cpp',
  cxx: 'cpp',
  hpp: 'cpp',
  hxx: 'cpp',
  cs: 'csharp',
  php: 'php',
  sh: 'bash',
  bash: 'bash',
  zsh: 'bash',
  fish: 'bash',
  yml: 'yaml',
  yaml: 'yaml',
  toml: 'ini',
  ini: 'ini',
  cfg: 'ini',
  conf: 'ini',
  xml: 'xml',
  html: 'xml',
  htm: 'xml',
  svg: 'xml',
  vue: 'xml',
  css: 'css',
  scss: 'scss',
  sass: 'scss',
  less: 'less',
  sql: 'sql',
  md: 'markdown',
  markdown: 'markdown',
  mdx: 'markdown',
  diff: 'diff',
  patch: 'diff',
  lua: 'lua',
  r: 'r',
  pl: 'perl',
  pm: 'perl',
  graphql: 'graphql',
  gql: 'graphql',
};

/** Highlighting arbitrary output above this size is skipped (rendered plain). */
const MAX_HIGHLIGHT_CHARS = 100_000;

function langFromPath(path?: string): string | undefined {
  if (!path) return undefined;
  const clean = path.split(/[?#]/)[0];
  const base = clean.slice(clean.lastIndexOf('/') + 1);
  const dot = base.lastIndexOf('.');
  if (dot <= 0) return undefined;
  return EXT_LANG[base.slice(dot + 1).toLowerCase()];
}

interface HighlightedCodeProps {
  code: string;
  /** File path used to infer the language from its extension. */
  path?: string;
  /** Explicit highlight.js language id; takes precedence over `path`. */
  language?: string;
  /** Class applied to the wrapping <pre> (e.g. `tool-output`). */
  className?: string;
}

/**
 * Renders a code block with highlight.js syntax highlighting. The language is
 * taken from `language`, falls back to the file extension in `path`, and
 * finally to hljs auto-detection. Falls back to plain text when highlighting
 * fails or the content is very large.
 */
export function CodeBlock({
  code,
  path,
  language,
  className,
}: HighlightedCodeProps) {
  const { html, lang } = useMemo(() => {
    if (code.length > MAX_HIGHLIGHT_CHARS)
      return { html: null, lang: undefined };
    const hint = language ?? langFromPath(path);
    try {
      if (hint && hljs.getLanguage(hint)) {
        return {
          html: hljs.highlight(code, { language: hint }).value,
          lang: hint,
        };
      }
      const auto = hljs.highlightAuto(code);
      return { html: auto.value, lang: auto.language };
    } catch {
      return { html: null, lang: undefined };
    }
  }, [code, path, language]);

  return (
    <pre className={className}>
      {html != null ? (
        <code
          className={`hljs${lang ? ` language-${lang}` : ''}`}
          // Trusted: HTML is produced by highlight.js from local tool output.
          dangerouslySetInnerHTML={{ __html: html }}
        />
      ) : (
        <code className="hljs">{code}</code>
      )}
    </pre>
  );
}
