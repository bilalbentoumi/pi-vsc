import { RpcClient } from '../rpc/rpc-client';
import {
  buildSpawnEnv,
  buildStartupArgs,
  getAgentVersion,
  resolveBinaryPath,
} from './bootstrap';
import type { PiConfig } from '../config';
import type {
  ExtensionUiRequest,
  ExtensionUiResponse,
  ModelInfo,
  RpcEvent,
  RuntimeStatus,
  SessionState,
  ThinkingLevel,
} from '../../shared/protocol';

export interface Logger {
  info(msg: string): void;
  warn(msg: string): void;
  error(msg: string): void;
  show(): void;
}

type Listener<T> = (value: T) => void;

/**
 * A single pi runtime bound to one working directory. Owns the RpcClient,
 * applies startup settings, tracks status, and provides basic crash recovery.
 */
export class PiRuntime {
  private client: RpcClient | null = null;
  private status: RuntimeStatus = { phase: 'stopped' };
  private readonly eventListeners = new Set<Listener<RpcEvent>>();
  private readonly uiListeners = new Set<Listener<ExtensionUiRequest>>();
  private readonly statusListeners = new Set<Listener<RuntimeStatus>>();
  private disposed = false;
  private starting: Promise<void> | null = null;
  private restartAttempts = 0;
  /** Session path to resume on the next start(); survives a crash-recovery restart so the bypass isn't lost. */
  private pendingSessionPath: string | undefined;
  /** Cached `pi --version`, re-resolved only when the resolved binary changes. */
  private agentVersion = '';
  private agentVersionFor = '';

  constructor(
    readonly cwd: string,
    private readonly getConfig: () => PiConfig,
    private readonly log: Logger,
  ) {}

  getStatus(): RuntimeStatus {
    return this.status;
  }

  get isReady(): boolean {
    return this.status.phase === 'ready' && !!this.client?.running;
  }

  onEvent(listener: Listener<RpcEvent>): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }
  onExtensionUiRequest(listener: Listener<ExtensionUiRequest>): () => void {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }
  onStatus(listener: Listener<RuntimeStatus>): () => void {
    this.statusListeners.add(listener);
    return () => this.statusListeners.delete(listener);
  }

  async start(sessionPath?: string): Promise<void> {
    if (this.starting) return this.starting;
    if (this.isReady && !sessionPath) return;
    this.starting = this.doStart(sessionPath);
    try {
      await this.starting;
    } finally {
      this.starting = null;
    }
  }

  private async doStart(sessionPath?: string): Promise<void> {
    const config = this.getConfig();
    const resolved = resolveBinaryPath(config.binaryPath);
    // Re-resolve the version only when the binary path actually changes, so a
    // restart with the same binary doesn't pay for another `pi --version` spawn.
    if (this.agentVersionFor !== resolved.command) {
      this.agentVersion = getAgentVersion(resolved.command);
      this.agentVersionFor = resolved.command;
    }
    this.setStatus({
      phase: 'starting',
      binaryPath: resolved.command,
      cwd: this.cwd,
    });
    this.log.info(
      `Starting pi runtime: ${resolved.command} (cwd: ${this.cwd})`,
    );
    if (!resolved.resolved) {
      this.log.warn(
        `Could not resolve "${config.binaryPath}" to an absolute path. Relying on PATH. ` +
          `Searched: ${resolved.searchedDirs.slice(0, 8).join(', ')}…`,
      );
    }

    const client = new RpcClient({
      binaryPath: resolved.command,
      cwd: this.cwd,
      args: buildStartupArgs(config, sessionPath),
      env: buildSpawnEnv(config),
    });
    this.client = client;

    client.onEvent((event) => this.dispatchEvent(event));
    client.onExtensionUiRequest((req) => {
      for (const l of this.uiListeners) l(req);
    });
    client.onExit((code, signal) => this.handleExit(code, signal));

    client.start();

    try {
      // Confirm the process is live and apply session settings.
      const state = await client.getState();
      await this.applySettings(client, config);
      this.restartAttempts = 0;
      // Session successfully loaded; drop the pending path so a later
      // crash-recovery restart doesn't re-resume an outdated session file.
      this.pendingSessionPath = undefined;
      this.setStatus({
        phase: 'ready',
        binaryPath: resolved.command,
        cwd: this.cwd,
      });
      this.log.info(
        `pi runtime ready. Model: ${state.model?.name ?? '(none)'}.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.log.error(`Failed to start pi runtime: ${message}`);
      await client.stop().catch(() => undefined);
      this.client = null;
      this.setStatus({
        phase: 'error',
        message: this.friendlyStartupError(config.binaryPath, message),
        binaryPath: resolved.command,
        cwd: this.cwd,
      });
      throw err;
    }
  }

  private async applySettings(
    client: RpcClient,
    config: PiConfig,
  ): Promise<void> {
    try {
      await client.setThinkingLevel(config.thinkingLevel);
      await client.setAutoCompaction(config.autoCompact);
      await client.setAutoRetry(config.autoRetry);
    } catch (err) {
      this.log.warn(
        `Failed to apply some settings: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private friendlyStartupError(binaryPath: string, raw: string): string {
    if (/ENOENT|not running|spawn/i.test(raw)) {
      return `Could not launch "${binaryPath}". Make sure the pi runtime is installed and on your PATH, or set an absolute path in "pintra.binaryPath".`;
    }
    return raw;
  }

  private handleExit(code: number | null, signal: NodeJS.Signals | null): void {
    if (this.disposed) return;
    const wasReady = this.status.phase === 'ready';
    this.client = null;
    this.log.warn(`pi runtime exited (code=${code}, signal=${signal}).`);
    this.setStatus({
      phase: 'error',
      message: `Runtime exited (code=${code}). Use "Restart Runtime" to reconnect.`,
    });

    // Auto-recover a previously-healthy runtime a couple of times.
    if (wasReady && this.restartAttempts < 2) {
      this.restartAttempts++;
      this.log.info(
        `Auto-restarting pi runtime (attempt ${this.restartAttempts})…`,
      );
      void this.start(this.pendingSessionPath).catch(() => undefined);
    }
  }

  async restart(): Promise<void> {
    this.restartAttempts = 0;
    await this.stopClient();
    await this.start();
  }

  private async stopClient(): Promise<void> {
    const client = this.client;
    this.client = null;
    if (client) {
      await client.stop().catch(() => undefined);
    }
  }

  async dispose(): Promise<void> {
    this.disposed = true;
    await this.stopClient();
    this.eventListeners.clear();
    this.uiListeners.clear();
    this.statusListeners.clear();
    this.setStatus({ phase: 'stopped' });
  }

  // --- Operations (guarded) ------------------------------------------------

  private requireClient(): RpcClient {
    if (!this.client || !this.client.running) {
      throw new Error('pi runtime is not running');
    }
    return this.client;
  }

  prompt(message: string, images?: unknown[]): Promise<unknown> {
    return this.requireClient().prompt(message, images);
  }
  steer(message: string): Promise<unknown> {
    return this.requireClient().steer(message);
  }
  abort(): Promise<unknown> {
    return this.requireClient().abort();
  }
  getState(): Promise<SessionState> {
    return this.requireClient().getState();
  }
  getAvailableModels(): Promise<ModelInfo[]> {
    return this.requireClient().getAvailableModels();
  }
  setModel(provider: string, modelId: string): Promise<ModelInfo> {
    return this.requireClient().setModel(provider, modelId);
  }
  cycleModel(): Promise<ModelInfo | null> {
    return this.requireClient().cycleModel();
  }
  setThinkingLevel(level: ThinkingLevel): Promise<unknown> {
    return this.requireClient().setThinkingLevel(level);
  }
  setAutoCompaction(enabled: boolean): Promise<unknown> {
    return this.requireClient().setAutoCompaction(enabled);
  }
  cycleThinkingLevel(): Promise<{ level: ThinkingLevel } | null> {
    return this.requireClient().cycleThinkingLevel();
  }
  compact(customInstructions?: string): Promise<unknown> {
    return this.requireClient().compact(customInstructions);
  }
  async newSession(): Promise<void> {
    // Starting a fresh session drops any pending resume path.
    this.pendingSessionPath = undefined;
    await this.requireClient().newSession();
  }
  setSessionName(name: string): Promise<unknown> {
    return this.requireClient().setSessionName(name);
  }
  getMessages(): Promise<unknown[]> {
    return this.requireClient().getMessages();
  }
  async switchSession(sessionPath: string): Promise<{ cancelled?: boolean }> {
    // Bypass: pi 0.80.x's `switch_session` RPC handler hangs (never responds).
    // Restart the child with `--session <path>`, which loads the session file
    // in ~1-2s and responds normally. Verified against get_state.
    // Stash the path so a crash-recovery restart (handleExit) preserves it.
    this.pendingSessionPath = sessionPath;
    this.restartAttempts = 0;
    await this.stopClient();
    await this.start(sessionPath);
    return {};
  }
  fork(entryId: string): Promise<{ text?: string; cancelled?: boolean }> {
    return this.requireClient().fork(entryId);
  }
  getForkMessages(): Promise<Array<{ entryId: string; text: string }>> {
    return this.requireClient().getForkMessages();
  }
  getSessionStats(): Promise<unknown> {
    return this.requireClient().getSessionStats();
  }
  exportHtml(outputPath?: string): Promise<{ path: string }> {
    return this.requireClient().exportHtml(outputPath);
  }
  getCommands(): Promise<
    Array<{ name: string; description?: string; source: string }>
  > {
    return this.requireClient().getCommands();
  }
  respondToExtensionUi(response: ExtensionUiResponse): void {
    this.client?.respondToExtensionUi(response);
  }

  // --- Internal ------------------------------------------------------------

  private dispatchEvent(event: RpcEvent): void {
    for (const l of this.eventListeners) l(event);
  }

  private setStatus(status: RuntimeStatus): void {
    this.status = {
      ...status,
      agentVersion: status.agentVersion ?? this.agentVersion,
    };
    for (const l of this.statusListeners) l(this.status);
  }
}
