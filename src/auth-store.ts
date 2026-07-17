import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import type { AuthStatus } from '../shared/protocol';

function expandHome(p: string): string {
  if (p === '~') return homedir();
  if (p.startsWith('~/') || p.startsWith('~\\')) {
    return join(homedir(), p.slice(2));
  }
  return p;
}

function resolveAgentDir(configuredAgentDir: string): string {
  if (configuredAgentDir) return resolve(expandHome(configuredAgentDir));
  return join(homedir(), '.pi', 'agent');
}

export function authFilePath(configuredAgentDir: string): string {
  return join(resolveAgentDir(configuredAgentDir), 'auth.json');
}

export type AuthEntry =
  | { type: 'api_key'; key: string }
  | { type: 'oauth'; refresh?: string; access?: string; expires?: number }
  | Record<string, unknown>;

type AuthFile = Record<string, AuthEntry>;

function readAuthFile(path: string): AuthFile {
  if (!existsSync(path)) return {};
  const raw = readFileSync(path, 'utf8').trim();
  if (!raw) return {};
  const parsed = JSON.parse(raw);
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('auth.json is not a JSON object');
  }
  return parsed as AuthFile;
}

export function readAuthStatus(configuredAgentDir: string): AuthStatus {
  const path = authFilePath(configuredAgentDir);
  try {
    return { providers: Object.keys(readAuthFile(path)), path };
  } catch {
    return { providers: [], path };
  }
}

export function writeAuthEntry(
  configuredAgentDir: string,
  providerId: string,
  entry: AuthEntry,
): string {
  const path = authFilePath(configuredAgentDir);
  const data = readAuthFile(path);
  data[providerId] = entry;
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(data, null, 2)}\n`, { mode: 0o600 });
  return path;
}
