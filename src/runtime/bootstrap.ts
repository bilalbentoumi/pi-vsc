import { spawnSync } from 'node:child_process';
import { accessSync, constants, existsSync, readdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { delimiter, isAbsolute, join } from 'node:path';
import type { PiConfig } from '../config';

export const ENV_AGENT_DIR = 'PI_CODING_AGENT_DIR';

function candidateBinDirs(): string[] {
  const home = homedir();
  const dirs: string[] = [];
  const push = (d: string) => {
    if (d && !dirs.includes(d)) dirs.push(d);
  };

  for (const entry of (process.env.PATH ?? '').split(delimiter)) {
    if (entry) push(entry);
  }

  push('/opt/homebrew/bin');
  push('/usr/local/bin');
  push('/usr/bin');
  push(join(home, '.local', 'bin'));
  push(join(home, '.bun', 'bin'));
  push(join(home, '.volta', 'bin'));

  const nvmVersions = join(home, '.nvm', 'versions', 'node');
  try {
    const versions = readdirSync(nvmVersions).sort();
    for (const v of versions) {
      push(join(nvmVersions, v, 'bin'));
    }
  } catch {}
  const fnmDir = join(home, '.local', 'state', 'fnm_multishells');
  try {
    for (const d of readdirSync(fnmDir)) {
      push(join(fnmDir, d, 'bin'));
    }
  } catch {}
  return dirs;
}

function isExecutable(file: string): boolean {
  try {
    accessSync(file, constants.X_OK);
    return true;
  } catch {
    return false;
  }
}

export interface ResolvedBinary {
  command: string;
  resolved: boolean;
  searchedDirs: string[];
}

export function resolveBinaryPath(binaryPath: string): ResolvedBinary {
  if (isAbsolute(binaryPath)) {
    return {
      command: binaryPath,
      resolved: existsSync(binaryPath),
      searchedDirs: [],
    };
  }
  const dirs = candidateBinDirs();
  const names =
    process.platform === 'win32'
      ? [binaryPath, `${binaryPath}.cmd`, `${binaryPath}.exe`]
      : [binaryPath];
  for (const dir of dirs) {
    for (const name of names) {
      const full = join(dir, name);
      if (existsSync(full) && isExecutable(full)) {
        return { command: full, resolved: true, searchedDirs: dirs };
      }
    }
  }
  return { command: binaryPath, resolved: false, searchedDirs: dirs };
}

export function buildSpawnEnv(
  config: PiConfig,
): Record<string, string | undefined> {
  const env: Record<string, string | undefined> = {};
  const augmentedPath = candidateBinDirs().join(delimiter);
  env.PATH = augmentedPath;
  if (process.platform === 'win32') {
    env.Path = augmentedPath;
  }
  if (config.agentDir) {
    env[ENV_AGENT_DIR] = config.agentDir;
  }
  return env;
}

export function getAgentVersion(binaryPath: string): string {
  try {
    // SECURITY: never interpolate binaryPath into a shell string (command
    // injection via the workspace-settable pintra.binaryPath setting). Use
    // spawnSync with an argv array and shell:false, mirroring rpc-process.ts.
    const result = spawnSync(binaryPath, ['--version'], {
      encoding: 'utf-8',
      timeout: 5000,
      shell: false,
    });
    return (result.stdout ?? '').trim().split('\n')[0].trim();
  } catch {
    return '';
  }
}

export function buildStartupArgs(
  config: PiConfig,
  sessionPath?: string,
): string[] {
  const args: string[] = [];
  if (sessionPath) {
    // Resume a specific session file by path. Bypasses the `switch_session`
    // RPC handler, which hangs in pi 0.80.x (never sends a response).
    args.push('--session', sessionPath);
  }
  if (config.defaultModel) {
    args.push('--model', config.defaultModel);
  }
  if (config.extraArgs.length > 0) {
    args.push(...config.extraArgs);
  }
  return args;
}
