import { homedir } from 'node:os';
import * as vscode from 'vscode';
import { PiRuntime, type Logger } from '../runtime/pi-runtime';
import { readConfig } from '../config';

/**
 * Owns pi runtimes keyed by working directory (one per workspace folder).
 * For the single sidebar view we mostly use the active runtime, but the pool
 * keeps the door open for per-folder or editor-tab sessions later.
 */
export class SessionManager implements vscode.Disposable {
  private readonly runtimes = new Map<string, PiRuntime>();

  constructor(private readonly log: Logger) {}

  /** The cwd for the active workspace (first folder), falling back to home. */
  activeCwd(): string {
    const folder = vscode.workspace.workspaceFolders?.[0];
    if (folder && folder.uri.scheme === 'file') {
      return folder.uri.fsPath;
    }
    return homedir();
  }

  /** Get (creating if needed) the runtime for a given cwd. */
  getRuntime(cwd: string): PiRuntime {
    let runtime = this.runtimes.get(cwd);
    if (!runtime) {
      runtime = new PiRuntime(cwd, () => readConfig(), this.log);
      this.runtimes.set(cwd, runtime);
    }
    return runtime;
  }

  getActiveRuntime(): PiRuntime {
    return this.getRuntime(this.activeCwd());
  }

  async restartAll(): Promise<void> {
    await Promise.all(
      [...this.runtimes.values()].map((r) =>
        r.restart().catch(() => undefined),
      ),
    );
  }

  async dispose(): Promise<void> {
    await Promise.all(
      [...this.runtimes.values()].map((r) =>
        r.dispose().catch(() => undefined),
      ),
    );
    this.runtimes.clear();
  }
}
