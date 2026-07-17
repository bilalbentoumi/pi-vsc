import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import type { SessionInfo } from '../../shared/protocol';
import { textOfContent } from '../../shared/blocks';

/**
 * Reads pi session files directly from disk to power the history browser.
 * Mirrors the pi runtime's own storage layout and metadata extraction:
 *   <agentDir>/sessions/<encoded-cwd>/<timestamp>_<uuid>.jsonl
 * where encoded-cwd = `--` + cwd (leading slash stripped, / \ : -> -) + `--`.
 */

function agentDir(configuredAgentDir: string): string {
  if (configuredAgentDir) return resolve(configuredAgentDir);
  // Only use the env var if it was explicitly set by this extension, not
  // inherited from a different pi extension (which would point to a
  // different agent directory). The pi child process defaults to ~/.pi/agent
  // when PI_CODING_AGENT_DIR is absent, so we match that here.
  return join(homedir(), '.pi', 'agent');
}

function encodeCwd(cwd: string): string {
  const resolved = resolve(cwd);
  return `--${resolved.replace(/^[/\\]/, '').replace(/[/\\:]/g, '-')}--`;
}

export function sessionsDirForCwd(
  configuredAgentDir: string,
  cwd: string,
): string {
  return join(agentDir(configuredAgentDir), 'sessions', encodeCwd(cwd));
}

/** Parse one session file into metadata, or null if unreadable / not a session. */
function buildSessionInfo(filePath: string): SessionInfo | null {
  try {
    const stats = statSync(filePath);
    if (!stats.isFile() || stats.size > 64 * 1024 * 1024) return null;
    const lines = readFileSync(filePath, 'utf8').split('\n');
    let header: any = null;
    let name: string | undefined;
    let firstMessage = '';
    let messageCount = 0;
    let lastActivity = 0;

    for (const line of lines) {
      if (!line.trim()) continue;
      let entry: any;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (!header) {
        if (entry.type !== 'session' || typeof entry.id !== 'string')
          return null;
        header = entry;
        continue;
      }
      if (entry.type === 'session_info') {
        name = entry.name?.trim() || undefined;
        continue;
      }
      if (entry.type !== 'message') continue;
      messageCount++;
      const msg = entry.message;
      if (!msg || (msg.role !== 'user' && msg.role !== 'assistant')) continue;
      const ts =
        typeof msg.timestamp === 'number'
          ? msg.timestamp
          : Date.parse(entry.timestamp);
      if (!Number.isNaN(ts)) lastActivity = Math.max(lastActivity, ts);
      const text = textOfContent(msg.content, ' ').trim();
      if (text && !firstMessage && msg.role === 'user') firstMessage = text;
    }
    if (!header) return null;

    const created = Date.parse(header.timestamp) || stats.mtimeMs;
    const modified = lastActivity > 0 ? lastActivity : created;
    return {
      path: filePath,
      id: header.id,
      name,
      firstMessage: firstMessage || '(no messages)',
      messageCount,
      created,
      modified,
    };
  } catch {
    return null;
  }
}

/** List sessions for a cwd, newest first. Optionally mark the current one. */
export function listSessions(
  configuredAgentDir: string,
  cwd: string,
  currentPath?: string,
): SessionInfo[] {
  const dir = sessionsDirForCwd(configuredAgentDir, cwd);
  if (!existsSync(dir)) return [];
  let files: string[];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith('.jsonl'))
      .map((f) => join(dir, f));
  } catch {
    return [];
  }
  const infos = files
    .map(buildSessionInfo)
    .filter((s): s is SessionInfo => s !== null)
    .sort((a, b) => b.modified - a.modified);
  if (currentPath) {
    const resolvedCurrent = resolve(currentPath);
    for (const s of infos) {
      if (resolve(s.path) === resolvedCurrent) s.current = true;
    }
  }
  return infos;
}
