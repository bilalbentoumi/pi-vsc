import { RpcProcess, type RpcProcessOptions } from './rpc-process';
import type {
  ExtensionUiRequest,
  ExtensionUiResponse,
  ModelInfo,
  RpcCommand,
  RpcEvent,
  RpcResponse,
  SessionState,
  ThinkingLevel,
} from '../../shared/protocol';

type EventListener = (event: RpcEvent) => void;
type ExtensionUiListener = (request: ExtensionUiRequest) => void;
type ExitListener = (
  code: number | null,
  signal: NodeJS.Signals | null,
) => void;

interface PendingRequest {
  resolve: (response: RpcResponse) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}

export interface RpcClientOptions extends RpcProcessOptions {
  /** Per-request response timeout in ms (default 30s). */
  requestTimeoutMs?: number;
}

/**
 * Typed client over a `pi --mode rpc` process.
 *
 * - `send()` correlates a request id to its `response` line.
 * - Non-response lines are dispatched to event / extension-UI listeners.
 * - The process is long-lived; the client stays usable until `stop()` or exit.
 */
export class RpcClient {
  private readonly proc: RpcProcess;
  private readonly pending = new Map<string, PendingRequest>();
  private readonly eventListeners = new Set<EventListener>();
  private readonly uiListeners = new Set<ExtensionUiListener>();
  private readonly exitListeners = new Set<ExitListener>();
  private readonly requestTimeoutMs: number;
  private requestSeqId = 0;
  private exitError: Error | null = null;

  constructor(options: RpcClientOptions) {
    this.requestTimeoutMs = options.requestTimeoutMs ?? 30_000;
    this.proc = new RpcProcess(options);
    this.proc.on('line', (obj) => this.handleLine(obj));
    this.proc.on('error', (err) => this.fail(err));
    this.proc.on('exit', (code, signal) => {
      this.fail(
        new Error(
          `pi process exited (code=${code} signal=${signal}). ${this.tailStderr()}`,
        ),
      );
      for (const listener of this.exitListeners) {
        listener(code, signal);
      }
    });
  }

  get stderr(): string {
    return this.proc.stderr;
  }

  get running(): boolean {
    return this.proc.running;
  }

  start(): void {
    this.exitError = null;
    this.proc.start();
  }

  async stop(): Promise<void> {
    await this.proc.stop();
    this.rejectAll(new Error('RPC client stopped'));
  }

  onEvent(listener: EventListener): () => void {
    this.eventListeners.add(listener);
    return () => this.eventListeners.delete(listener);
  }

  onExtensionUiRequest(listener: ExtensionUiListener): () => void {
    this.uiListeners.add(listener);
    return () => this.uiListeners.delete(listener);
  }

  onExit(listener: ExitListener): () => void {
    this.exitListeners.add(listener);
    return () => this.exitListeners.delete(listener);
  }

  /** Reply to an extension UI request (fire-and-forget). */
  respondToExtensionUi(response: ExtensionUiResponse): void {
    if (!this.proc.running) return;
    try {
      this.proc.write(response);
    } catch {
      /* process is gone; ignore */
    }
  }

  /** Send a command and await its correlated response. */
  send(command: RpcCommand): Promise<RpcResponse> {
    if (this.exitError) {
      return Promise.reject(this.exitError);
    }
    if (!this.proc.running) {
      return Promise.reject(new Error('RPC process is not running'));
    }
    const id = `req_${++this.requestSeqId}`;
    const request = { ...command, id };
    return new Promise<RpcResponse>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(
          new Error(
            `Timeout waiting for response to "${command.type}". ${this.tailStderr()}`,
          ),
        );
      }, this.requestTimeoutMs);
      this.pending.set(id, { resolve, reject, timer });
      try {
        this.proc.write(request);
      } catch (err) {
        clearTimeout(timer);
        this.pending.delete(id);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }

  /** Send a command and unwrap `data`, throwing on failure. */
  async call<T = unknown>(command: RpcCommand): Promise<T> {
    const response = await this.send(command);
    if (!response.success) {
      throw new Error(response.error || `Command "${command.type}" failed`);
    }
    return response.data as T;
  }

  // --- Typed convenience wrappers ------------------------------------------
  //
  // Wrappers unwrap `data` and throw on RPC-level failure via `call()`. Use the
  // raw `send()`/`call()` directly only when a caller genuinely needs the full
  // response envelope.

  async prompt(message: string, images?: unknown[]): Promise<void> {
    await this.call({ type: 'prompt', message, images });
  }
  async steer(message: string, images?: unknown[]): Promise<void> {
    await this.call({ type: 'steer', message, images });
  }
  async abort(): Promise<void> {
    await this.call({ type: 'abort' });
  }
  getState(): Promise<SessionState> {
    return this.call<SessionState>({ type: 'get_state' });
  }
  getAvailableModels(): Promise<ModelInfo[]> {
    return this.call<{ models: ModelInfo[] }>({
      type: 'get_available_models',
    }).then((d) => d.models);
  }
  setModel(provider: string, modelId: string): Promise<ModelInfo> {
    return this.call<ModelInfo>({ type: 'set_model', provider, modelId });
  }
  cycleModel(): Promise<ModelInfo | null> {
    return this.call<ModelInfo | null>({ type: 'cycle_model' });
  }
  async setThinkingLevel(level: ThinkingLevel): Promise<void> {
    await this.call({ type: 'set_thinking_level', level });
  }
  cycleThinkingLevel(): Promise<{ level: ThinkingLevel } | null> {
    return this.call<{ level: ThinkingLevel } | null>({
      type: 'cycle_thinking_level',
    });
  }
  compact(customInstructions?: string): Promise<unknown> {
    return this.call({ type: 'compact', customInstructions });
  }
  newSession(parentSession?: string): Promise<{ cancelled?: boolean }> {
    return this.call<{ cancelled?: boolean }>({
      type: 'new_session',
      parentSession,
    });
  }
  getMessages(): Promise<unknown[]> {
    return this.call<{ messages: unknown[] }>({ type: 'get_messages' }).then(
      (d) => d.messages,
    );
  }
  async setAutoCompaction(enabled: boolean): Promise<void> {
    await this.call({ type: 'set_auto_compaction', enabled });
  }
  async setAutoRetry(enabled: boolean): Promise<void> {
    await this.call({ type: 'set_auto_retry', enabled });
  }
  switchSession(sessionPath: string): Promise<{ cancelled?: boolean }> {
    return this.call<{ cancelled?: boolean }>({
      type: 'switch_session',
      sessionPath,
    });
  }
  fork(entryId: string): Promise<{ text?: string; cancelled?: boolean }> {
    return this.call<{ text?: string; cancelled?: boolean }>({
      type: 'fork',
      entryId,
    });
  }
  getForkMessages(): Promise<Array<{ entryId: string; text: string }>> {
    return this.call<{ messages: Array<{ entryId: string; text: string }> }>({
      type: 'get_fork_messages',
    }).then((d) => d.messages);
  }
  getTree(): Promise<{ tree: unknown; leafId: string | null }> {
    return this.call<{ tree: unknown; leafId: string | null }>({
      type: 'get_tree',
    });
  }
  getSessionStats(): Promise<unknown> {
    return this.call({ type: 'get_session_stats' });
  }
  exportHtml(outputPath?: string): Promise<{ path: string }> {
    return this.call<{ path: string }>({ type: 'export_html', outputPath });
  }
  getCommands(): Promise<
    Array<{ name: string; description?: string; source: string }>
  > {
    return this.call<{
      commands: Array<{ name: string; description?: string; source: string }>;
    }>({
      type: 'get_commands',
    }).then((d) => d.commands);
  }
  async setSessionName(name: string): Promise<void> {
    await this.call({ type: 'set_session_name', name });
  }

  // --- Internal ------------------------------------------------------------

  private handleLine(obj: any): void {
    if (
      obj &&
      typeof obj === 'object' &&
      obj.type === 'response' &&
      typeof obj.id === 'string'
    ) {
      const pending = this.pending.get(obj.id);
      if (pending) {
        clearTimeout(pending.timer);
        this.pending.delete(obj.id);
        pending.resolve(obj as RpcResponse);
      }
      return;
    }
    if (obj && typeof obj === 'object' && obj.type === 'extension_ui_request') {
      for (const listener of this.uiListeners) {
        listener(obj as ExtensionUiRequest);
      }
      return;
    }
    // Everything else is a streamed session event.
    for (const listener of this.eventListeners) {
      listener(obj as RpcEvent);
    }
  }

  private fail(error: Error): void {
    this.exitError = error;
    this.rejectAll(error);
  }

  private rejectAll(error: Error): void {
    for (const pending of this.pending.values()) {
      clearTimeout(pending.timer);
      pending.reject(error);
    }
    this.pending.clear();
  }

  private tailStderr(): string {
    const s = this.proc.stderr.trim();
    if (!s) return '';
    return `stderr: ${s.slice(-500)}`;
  }
}
