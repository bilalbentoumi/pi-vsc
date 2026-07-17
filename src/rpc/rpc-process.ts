import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { EventEmitter } from 'node:events';
import { attachJsonlLineReader, serializeJsonLine } from './jsonl';

export interface RpcProcessOptions {
  /** Command or absolute path to the pi-compatible executable. */
  binaryPath: string;
  /** Working directory for the agent (the workspace root). */
  cwd: string;
  /** Extra CLI args appended after `--mode rpc`. */
  args?: string[];
  /** Environment overrides merged over `process.env`. */
  env?: Record<string, string | undefined>;
}

export interface RpcProcessEvents {
  /** A parsed JSON object (response, event, or extension UI request). */
  line: (obj: any) => void;
  /** Raw stderr text (for diagnostics). */
  stderr: (text: string) => void;
  /** Process exited. */
  exit: (code: number | null, signal: NodeJS.Signals | null) => void;
  /** Failed to spawn or write. */
  error: (error: Error) => void;
}

/**
 * Owns a single `pi --mode rpc` child process: spawn, JSONL framing on stdout,
 * stderr capture, and lifecycle events. Knows nothing about the RPC semantics.
 */
export class RpcProcess extends EventEmitter {
  private child: ChildProcessWithoutNullStreams | null = null;
  private detachStdout: (() => void) | null = null;
  private stderrBuffer = '';
  private exited = false;

  constructor(private readonly options: RpcProcessOptions) {
    super();
  }

  get running(): boolean {
    return this.child !== null && !this.exited && this.child.exitCode === null;
  }

  get stderr(): string {
    return this.stderrBuffer;
  }

  start(): void {
    if (this.child) {
      throw new Error('RpcProcess already started');
    }
    const args = ['--mode', 'rpc', ...(this.options.args ?? [])];
    const env: NodeJS.ProcessEnv = { ...process.env, ...this.options.env };

    let child: ChildProcessWithoutNullStreams;
    try {
      child = spawn(this.options.binaryPath, args, {
        cwd: this.options.cwd,
        env,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
      });
    } catch (err) {
      this.emit('error', err instanceof Error ? err : new Error(String(err)));
      return;
    }
    this.child = child;

    child.stdout.setEncoding('utf8');
    this.detachStdout = attachJsonlLineReader(child.stdout, (line) => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(line);
      } catch {
        // Non-JSON output on stdout is treated as diagnostic noise.
        this.emit('stderr', line + '\n');
        return;
      }
      this.emit('line', parsed);
    });

    child.stderr.setEncoding('utf8');
    child.stderr.on('data', (text: string) => {
      this.stderrBuffer += text;
      if (this.stderrBuffer.length > 64 * 1024) {
        this.stderrBuffer = this.stderrBuffer.slice(-32 * 1024);
      }
      this.emit('stderr', text);
    });

    child.once('error', (err) => {
      this.emit('error', err);
    });
    child.once('exit', (code, signal) => {
      this.exited = true;
      this.emit('exit', code, signal);
    });
    child.stdin.on('error', (err) => {
      this.emit('error', err);
    });
  }

  /** Write a single JSON object as a line to the agent's stdin. */
  write(obj: unknown): void {
    const child = this.child;
    if (!child || !child.stdin.writable) {
      throw new Error('RPC process stdin is not writable');
    }
    child.stdin.write(serializeJsonLine(obj));
  }

  async stop(timeoutMs = 1500): Promise<void> {
    const child = this.child;
    this.detachStdout?.();
    this.detachStdout = null;
    if (!child || this.exited) {
      this.child = null;
      return;
    }
    await new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        try {
          child.kill('SIGKILL');
        } catch {
          /* ignore */
        }
        resolve();
      }, timeoutMs);
      child.once('exit', () => {
        clearTimeout(timer);
        resolve();
      });
      try {
        // Ending stdin triggers the agent's graceful shutdown path.
        child.stdin.end();
        child.kill('SIGTERM');
      } catch {
        clearTimeout(timer);
        resolve();
      }
    });
    this.child = null;
  }

  override on<K extends keyof RpcProcessEvents>(
    event: K,
    listener: RpcProcessEvents[K],
  ): this {
    return super.on(event, listener as (...args: any[]) => void);
  }
  override emit<K extends keyof RpcProcessEvents>(
    event: K,
    ...args: Parameters<RpcProcessEvents[K]>
  ): boolean {
    return super.emit(event, ...args);
  }
}
