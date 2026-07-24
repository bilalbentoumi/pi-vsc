import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import * as vscode from 'vscode';
import type {
  AppMessage,
  Attachment,
  CommandInfo,
  ExtensionUiRequest,
  HostMessage,
  ProviderLoginRequest,
  SessionStats,
  WebviewMessage,
} from '../../shared/protocol';
import { MAX_ATTACHMENT_BYTES } from '../../shared/constants';
import { authFilePath, readAuthStatus, writeAuthEntry } from '../auth-store';
import { readConfig } from '../config';
import type { Logger, PiRuntime } from '../runtime/pi-runtime';
import { resolveBinaryPath } from '../runtime/bootstrap';
import type { SessionManager } from '../session/session-manager';
import { listSessions, sessionsDirForCwd } from '../session/session-store';
import { handleExtensionUiRequest } from './extension-ui';

const MODAL_UI_METHODS = new Set(['confirm', 'select', 'input', 'editor']);

export interface ChatBridgeOptions {
  /** Whether the bound webview is currently visible (drives in-webview vs native dialogs). */
  isVisible: () => boolean;
  /**
   * When true, the first connect opens on a fresh session instead of resuming
   * the active one. Non-destructive: any prior conversation is kept in session
   * history (it just isn't auto-resumed). Used by the sidebar so opening the
   * panel always lands on a new chat; the editor panel leaves this off so
   * "Open in editor" mirrors the current conversation.
   */
  openFresh?: boolean;
}

/**
 * Connects one webview surface to the active pi runtime: forwards runtime events
 * and status to the webview, translates webview messages into runtime calls, and
 * surfaces pi extension dialogs either in-webview (when visible) or natively.
 */
export class ChatBridge implements vscode.Disposable {
  private runtime: PiRuntime | null = null;
  private subscriptions: Array<() => void> = [];
  private disposed = false;
  /** Guards {@link ChatBridgeOptions.openFresh} so only the first connect starts fresh. */
  private consumedOpenFresh = false;
  /** extension_ui_request ids we've handed to the webview and are awaiting a reply for. */
  private readonly forwardedUi = new Set<string>();

  constructor(
    private readonly sessions: SessionManager,
    private readonly log: Logger,
    private readonly post: (message: HostMessage) => void,
    private readonly options: ChatBridgeOptions,
  ) {}

  async connect(): Promise<void> {
    this.detach();
    const runtime = this.sessions.getActiveRuntime();
    this.runtime = runtime;

    this.subscriptions.push(
      runtime.onStatus((status) =>
        this.post({ type: 'runtimeStatus', status }),
      ),
    );
    this.subscriptions.push(
      runtime.onEvent((event) => this.onRuntimeEvent(event)),
    );
    this.subscriptions.push(
      runtime.onExtensionUiRequest((req) => void this.onUiRequest(req)),
    );

    this.post({
      type: 'config',
      config: { thinkingLevel: readConfig().thinkingLevel },
    });
    this.post({ type: 'runtimeStatus', status: runtime.getStatus() });

    try {
      await runtime.start();
      // On the sidebar's first open, start a new session so the panel lands on
      // a clean chat. The previous conversation isn't discarded — it stays in
      // session history — it just isn't resumed. Skip if the active session is
      // already empty so we don't spawn redundant blank sessions.
      if (this.options.openFresh && !this.consumedOpenFresh) {
        this.consumedOpenFresh = true;
        const existing = await runtime.getMessages();
        if (existing.length > 0) await runtime.newSession();
      }
      await this.pushSnapshot();
    } catch {
      // Status already reflects the error.
    }
  }

  private onRuntimeEvent(event: { type: string }): void {
    this.post({ type: 'rpcEvent', event: event as any });
    // Refresh derived data when a turn completes or the session changes.
    if (event.type === 'agent_end' || event.type === 'compaction_end') {
      void this.pushStats();
    }
  }

  private async pushSnapshot(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    try {
      const [models, messages, state] = await Promise.all([
        runtime.getAvailableModels(),
        runtime.getMessages(),
        runtime.getState(),
      ]);
      this.post({ type: 'models', models });
      this.post({ type: 'history', messages: messages as AppMessage[] });
      this.post({ type: 'state', state });
      await Promise.all([
        this.pushStats(),
        this.pushCommands(),
        this.pushSessions(),
      ]);
    } catch (err) {
      this.log.warn(
        `Failed to push snapshot: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  async handleMessage(message: WebviewMessage): Promise<void> {
    const runtime = this.runtime;
    try {
      switch (message.type) {
        case 'ready':
          await this.connect();
          return;
        case 'sendMessage': {
          // Separate image attachments (passed via `images` in the RPC) from
          // text-file attachments (inlined into the prompt so the AI can see
          // them). Non-image entries in `images` are ignored by the pi runtime.
          let promptText = message.text;
          const rpcImages: { type: 'image'; data: string; mimeType: string }[] = [];
          if (message.attachments) {
            for (const a of message.attachments) {
              if (a.mimeType.startsWith('image/')) {
                rpcImages.push({ type: 'image', data: a.data, mimeType: a.mimeType });
              } else {
                // Inline text files into the prompt with a clear header.
                const decoded = Buffer.from(a.data, 'base64').toString('utf8');
                const fence = '```';
                promptText += `\n\n<file path="${a.name}">\n${fence}\n${decoded}\n${fence}\n</file>`;
              }
            }
          }
          await runtime?.prompt(promptText, rpcImages.length > 0 ? rpcImages : undefined);
          return;
        }
        case 'steer':
          await runtime?.steer(message.text);
          return;
        case 'abort':
          await runtime?.abort();
          return;
        case 'newChat':
          await runtime?.newSession();
          this.post({ type: 'history', messages: [] });
          await this.pushState();
          await Promise.all([this.pushStats(), this.pushSessions()]);
          return;
        case 'setModel':
          await runtime?.setModel(message.provider, message.modelId);
          await this.pushState();
          return;
        case 'cycleModel':
          await runtime?.cycleModel();
          await this.pushState();
          return;
        case 'setThinkingLevel':
          await runtime?.setThinkingLevel(message.level);
          await this.pushState();
          return;
        case 'compact':
          await runtime?.compact();
          await this.pushState();
          await this.pushStats();
          return;
        case 'requestModels': {
          const models = await runtime?.getAvailableModels();
          if (models) this.post({ type: 'models', models });
          return;
        }
        case 'requestState':
          await this.pushState();
          return;
        case 'requestStats':
          await this.pushStats();
          return;
        case 'requestCommands':
          await this.pushCommands();
          return;
        case 'requestSessions':
          await this.pushSessions();
          return;
        case 'switchSession':
          await this.switchSession(message.path);
          return;
        case 'deleteSession':
          await this.deleteSession(message.path);
          return;
        case 'deleteAllSessions':
          await this.deleteAllSessions();
          return;
        case 'renameSession':
          await this.renameSession(message.path, message.name);
          return;
        case 'openSessionInEditor':
          await this.openSessionInEditor(message.path);
          return;
        case 'openForkPicker':
          await this.openForkPicker();
          return;
        case 'editAndFork':
          await this.editAndFork(message.entryId, message.text);
          return;
        case 'exportChat':
          await this.exportChat();
          return;
        case 'openInEditor':
          await vscode.commands.executeCommand('pintra.openChatInEditor');
          return;
        case 'setAutoCompaction':
          await runtime?.setAutoCompaction(message.enabled);
          await this.pushState();
          return;
        case 'openPiFolder': {
          const dir = path.join(os.homedir(), '.pi');
          if (fs.existsSync(dir)) {
            await vscode.commands.executeCommand(
              'revealFileInOS',
              vscode.Uri.file(dir),
            );
          } else {
            void vscode.window.showWarningMessage(
              `Pintra: Pi folder not found at ${dir}`,
            );
          }
          return;
        }
        case 'showSessionInfo': {
          if (!runtime?.isReady) {
            void vscode.window.showInformationMessage(
              'Pintra: no active session.',
            );
            return;
          }
          const s = await runtime.getState();
          const summary = [
            s.sessionName || 'Untitled session',
            s.model ? s.model.name || s.model.id : null,
            `${s.messageCount} message${s.messageCount === 1 ? '' : 's'}`,
          ]
            .filter(Boolean)
            .join(' · ');
          void vscode.window.showInformationMessage(summary, {
            detail: s.sessionFile
              ? `Session file: ${s.sessionFile}`
              : undefined,
            modal: false,
          } as vscode.MessageOptions);
          return;
        }
        case 'openSettings':
          await vscode.commands.executeCommand(
            'workbench.action.openSettings',
            '@ext:bilalbentoumi.pi-vsc',
          );
          return;
        case 'restart':
          await runtime?.restart();
          await this.connect();
          return;
        case 'showLog':
          this.log.show();
          return;
        case 'pickFiles':
          await this.pickFiles();
          return;
        case 'openExternal': {
          // SECURITY: the URL originates from assistant markdown output
          // (prompt-influenceable). Restrict to http/https/mailto so a crafted
          // link can't invoke arbitrary OS handlers (file://, vscode://, ...).
          let target: vscode.Uri;
          try {
            target = vscode.Uri.parse(message.url, true);
          } catch {
            return;
          }
          if (
            target.scheme !== 'http' &&
            target.scheme !== 'https' &&
            target.scheme !== 'mailto'
          ) {
            return;
          }
          void vscode.env.openExternal(target);
          return;
        }
        case 'copyText':
          void vscode.env.clipboard.writeText(message.text);
          return;
        case 'requestAuthStatus':
          this.post({
            type: 'authStatus',
            status: readAuthStatus(readConfig().agentDir),
          });
          return;
        case 'openAuthFile': {
          const authPath = authFilePath(readConfig().agentDir);
          if (fs.existsSync(authPath)) {
            await vscode.window.showTextDocument(vscode.Uri.file(authPath));
          } else {
            void vscode.window.showWarningMessage(
              `Pintra: auth.json not found at ${authPath}`,
            );
          }
          return;
        }
        case 'providerLogin':
          await this.providerLogin(message.request);
          return;
        case 'log':
          this.log[message.level](`[webview] ${message.text}`);
          return;
        case 'extensionUiResponse':
          this.forwardedUi.delete(message.response.id);
          runtime?.respondToExtensionUi(message.response);
          return;
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.log.error(`Command "${message.type}" failed: ${text}`);
      void vscode.window.showErrorMessage(`Pintra: ${text}`);
    }
  }

  // --- Derived data pushes -------------------------------------------------

  private async pushState(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    try {
      this.post({ type: 'state', state: await runtime.getState() });
    } catch {
      /* ignore */
    }
  }

  private async pushStats(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    try {
      this.post({
        type: 'stats',
        stats: (await runtime.getSessionStats()) as SessionStats,
      });
    } catch {
      /* ignore */
    }
  }

  private async pushCommands(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    try {
      this.post({
        type: 'commands',
        commands: (await runtime.getCommands()) as CommandInfo[],
      });
    } catch {
      /* ignore */
    }
  }

  private async pushSessions(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime) return;
    try {
      const current = runtime.isReady
        ? (await runtime.getState()).sessionFile
        : undefined;
      const sessions = listSessions(
        readConfig().agentDir,
        runtime.cwd,
        current,
      );
      this.post({ type: 'sessions', sessions });
    } catch (err) {
      this.log.warn(
        `Failed to list sessions: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  // --- Session / fork / export --------------------------------------------

  private async switchSession(path: string): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    // SECURITY: confine switch to the sessions dir; the webview is untrusted.
    const resolved = this.assertSessionPath(path);
    if (!resolved) {
      this.log.warn(`Refused to switch session outside sessions dir: ${path}`);
      return;
    }
    const result = await runtime.switchSession(resolved);
    if (!result.cancelled) {
      await this.pushSnapshot();
    }
  }

  /** Whether the given session file is the one the runtime currently has loaded. */
  private async isCurrentSession(sessionPath: string): Promise<boolean> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return false;
    const current = (await runtime.getState()).sessionFile;
    return !!current && path.resolve(current) === path.resolve(sessionPath);
  }

  /** Reset to a fresh session and refresh the webview (used after deleting the active session). */
  private async resetToNewSession(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) {
      await this.pushSessions();
      return;
    }
    await runtime.newSession();
    this.post({ type: 'history', messages: [] });
    await this.pushSnapshot();
  }

  /** Resolve a session path only if it lies within the sessions dir; else null. */
  private assertSessionPath(sessionPath: string): string | null {
    const cwd = this.runtime?.cwd ?? this.sessions.activeCwd();
    const dir = path.resolve(sessionsDirForCwd(readConfig().agentDir, cwd));
    const resolved = path.resolve(sessionPath);
    if (resolved === dir || resolved.startsWith(dir + path.sep))
      return resolved;
    return null;
  }

  private async deleteSession(sessionPath: string): Promise<void> {
    // SECURITY: confine deletion to the sessions dir; the webview is untrusted.
    const resolved = this.assertSessionPath(sessionPath);
    if (!resolved) {
      this.log.warn(
        `Refused to delete session outside sessions dir: ${sessionPath}`,
      );
      return;
    }
    const wasCurrent = await this.isCurrentSession(resolved);
    try {
      fs.rmSync(resolved, { force: true });
    } catch (err) {
      this.log.warn(
        `Failed to delete session: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    if (wasCurrent) {
      await this.resetToNewSession();
    } else {
      await this.pushSessions();
    }
  }

  private async deleteAllSessions(): Promise<void> {
    const runtime = this.runtime;
    const confirmed = await vscode.window.showWarningMessage(
      'Delete all chat sessions for this workspace? This cannot be undone.',
      { modal: true },
      'Delete All',
    );
    if (confirmed !== 'Delete All') return;
    const cwd = runtime?.cwd ?? this.sessions.activeCwd();
    const dir = sessionsDirForCwd(readConfig().agentDir, cwd);
    try {
      if (fs.existsSync(dir)) {
        for (const file of fs.readdirSync(dir)) {
          if (file.endsWith('.jsonl')) {
            fs.rmSync(path.join(dir, file), { force: true });
          }
        }
      }
    } catch (err) {
      this.log.warn(
        `Failed to delete all sessions: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    await this.resetToNewSession();
  }

  private async renameSession(
    sessionPath: string,
    rawName: string,
  ): Promise<void> {
    // SECURITY: confine rename/append to the sessions dir; the webview is untrusted.
    const resolved = this.assertSessionPath(sessionPath);
    if (!resolved) {
      this.log.warn(
        `Refused to rename session outside sessions dir: ${sessionPath}`,
      );
      return;
    }
    const name = rawName.trim();
    if (await this.isCurrentSession(resolved)) {
      await this.runtime?.setSessionName(name);
      await this.pushState();
    } else {
      this.appendSessionName(resolved, name);
    }
    await this.pushSessions();
  }

  /**
   * Persist a name onto a non-active session by appending a `session_info`
   * metadata line — the same append-only entry pi writes for `set_session_name`.
   * The session store reads the last such entry as the session's name.
   */
  private appendSessionName(sessionPath: string, name: string): void {
    try {
      let leading = '';
      try {
        const existing = fs.readFileSync(sessionPath, 'utf8');
        if (existing.length > 0 && !existing.endsWith('\n')) leading = '\n';
      } catch {
        /* new/unreadable file — append as-is */
      }
      const entry = JSON.stringify({
        type: 'session_info',
        timestamp: new Date().toISOString(),
        name,
      });
      fs.appendFileSync(sessionPath, `${leading}${entry}\n`);
    } catch (err) {
      this.log.warn(
        `Failed to rename session: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
  }

  private async openSessionInEditor(sessionPath: string): Promise<void> {
    await this.switchSession(sessionPath);
    await vscode.commands.executeCommand('pintra.openChatInEditor');
  }

  private async openForkPicker(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    const messages = await runtime.getForkMessages();
    if (messages.length === 0) {
      void vscode.window.showInformationMessage(
        'No earlier messages to edit in this session.',
      );
      return;
    }
    const items = messages
      .map((m) => ({
        label: m.text.replace(/\s+/g, ' ').slice(0, 80),
        entryId: m.entryId,
        text: m.text,
      }))
      .reverse();
    const picked = await vscode.window.showQuickPick(items, {
      title: 'Edit a previous message (forks the conversation)',
      placeHolder: 'Select a message to edit and resend',
    });
    if (picked) {
      this.post({
        type: 'enterForkMode',
        entryId: picked.entryId,
        text: picked.text,
      });
    }
  }

  private async editAndFork(entryId: string, text: string): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    const result = await runtime.fork(entryId);
    if (result.cancelled) return;
    // Refresh history to reflect the truncated branch, then send the edited text.
    const messages = await runtime.getMessages();
    this.post({ type: 'history', messages: messages as AppMessage[] });
    await runtime.prompt(text);
  }

  private async exportChat(): Promise<void> {
    const runtime = this.runtime;
    if (!runtime?.isReady) return;
    const { path } = await runtime.exportHtml();
    const uri = vscode.Uri.file(path);
    const open = await vscode.window.showInformationMessage(
      `Chat exported to ${path}`,
      'Open',
      'Reveal',
    );
    if (open === 'Open') void vscode.env.openExternal(uri);
    else if (open === 'Reveal')
      void vscode.commands.executeCommand('revealFileInOS', uri);
  }

  // --- Provider login (auth.json) ------------------------------------------

  private async providerLogin(request: ProviderLoginRequest): Promise<void> {
    const agentDir = readConfig().agentDir;

    if (request.kind === 'oauth') {
      // OAuth tokens can't be minted from the webview — hand off to pi's own
      // interactive login, which performs the handshake and writes the token
      // entry to the same auth.json.
      this.launchProviderLoginCli(request);
      return;
    }

    const finish = (ok: boolean, error?: string): void => {
      this.post({
        type: 'providerLoginResult',
        result: {
          providerId: request.providerId,
          providerLabel: request.providerLabel,
          ok,
          error,
        },
      });
    };

    const key = request.apiKey.trim();
    if (!key) {
      finish(false, 'No API key provided.');
      return;
    }

    try {
      const authPath = writeAuthEntry(agentDir, request.providerId, {
        type: 'api_key',
        key,
      });
      this.log.info(`Saved ${request.providerLabel} API key to ${authPath}`);
      this.post({ type: 'authStatus', status: readAuthStatus(agentDir) });

      // Restart only the pi runtime (its event/status subscriptions survive a
      // restart) so it re-reads auth.json — then refresh the model list and
      // state in place. We deliberately avoid connect()/pushSnapshot here: that
      // re-pushes history and resets the whole webview session.
      await this.runtime?.restart();
      if (this.runtime?.isReady) {
        const models = await this.runtime.getAvailableModels();
        this.post({ type: 'models', models });
        await this.pushState();
        finish(true);
      } else {
        finish(
          false,
          this.runtime?.getStatus().message ??
            'Pi failed to restart. Check the log for details.',
        );
      }
    } catch (err) {
      const text = err instanceof Error ? err.message : String(err);
      this.log.error(`providerLogin failed: ${text}`);
      finish(false, text);
      void vscode.window.showErrorMessage(
        `Pintra: could not complete provider login — ${text}`,
      );
    }
  }

  private launchProviderLoginCli(request: ProviderLoginRequest): void {
    // SECURITY: resolve the binary to an absolute path on disk and strip any
    // control chars so a malicious workspace setting can't inject commands
    // via terminal.sendText (newlines would auto-execute).
    const resolved = resolveBinaryPath(readConfig().binaryPath || 'pi');
    if (!resolved.resolved) {
      void vscode.window.showErrorMessage(
        `Pintra: could not find the pi runtime at "${readConfig().binaryPath || 'pi'}". Set "pintra.binaryPath" to an absolute path before signing in.`,
      );
      return;
    }
    const binary = resolved.command.replace(/[\r\n\t]/g, '');
    const terminal = vscode.window.createTerminal({ name: 'pi · login' });
    terminal.show();
    // Pre-typed but NOT executed: the exact `auth` subcommand is pi-version
    // dependent, so the user reviews/runs it. pi's own TUI then drives the
    // OAuth flow and writes the token entry to auth.json.
    terminal.sendText(`"${binary}" auth login`, false);
    const detail =
      request.kind === 'oauth' && request.gheHost
        ? ` (host: ${request.gheHost})`
        : '';
    void vscode.window.showInformationMessage(
      `Pintra: finish signing in to ${request.providerLabel}${detail} in the terminal, then reload Pi.`,
    );
  }

  // --- File attachments ----------------------------------------------------

  private async pickFiles(): Promise<void> {
    const uris = await vscode.window.showOpenDialog({
      canSelectMany: true,
      openLabel: 'Attach',
      filters: {
        Images: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'bmp', 'svg'],
        Text: [
          'txt',
          'md',
          'json',
          'ts',
          'tsx',
          'js',
          'jsx',
          'py',
          'rb',
          'go',
          'rs',
          'java',
          'c',
          'cpp',
          'h',
          'css',
          'scss',
          'html',
          'xml',
          'yaml',
          'yml',
          'toml',
          'csv',
        ],
        'All Files': ['*'],
      },
    });
    if (!uris || uris.length === 0) return;

    const attachments: Attachment[] = [];
    for (const uri of uris) {
      try {
        const stat = await vscode.workspace.fs.stat(uri);
        // Skip files larger than the shared attachment cap.
        if (stat.size > MAX_ATTACHMENT_BYTES) {
          void vscode.window.showWarningMessage(
            `Pintra: skipping ${uri.path.split('/').pop()} — file too large (${Math.round(stat.size / 1024 / 1024)} MB).`,
          );
          continue;
        }
        const bytes = await vscode.workspace.fs.readFile(uri);
        const ext = uri.path.split('.').pop()?.toLowerCase() ?? '';
        const isImage = [
          'png',
          'jpg',
          'jpeg',
          'gif',
          'webp',
          'bmp',
          'svg',
        ].includes(ext);
        const mimeType = getMimeType(ext, isImage);
        const base64 = Buffer.from(bytes).toString('base64');
        const fileName = uri.path.split('/').pop() ?? 'file';

        attachments.push({
          id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
          name: fileName,
          mimeType,
          filePath: uri.fsPath,
          data: base64,
          dataUrl: isImage ? `data:${mimeType};base64,${base64}` : undefined,
          size: stat.size,
        });
      } catch (err) {
        this.log.warn(
          `Failed to read file ${uri.fsPath}: ${err instanceof Error ? err.message : String(err)}`,
        );
      }
    }

    if (attachments.length > 0) {
      this.post({ type: 'pickedFiles', files: attachments });
    }
  }

  // --- Extension UI dialogs ------------------------------------------------

  private async onUiRequest(req: ExtensionUiRequest): Promise<void> {
    if (MODAL_UI_METHODS.has(req.method) && this.options.isVisible()) {
      this.forwardedUi.add(req.id);
      this.post({ type: 'extensionUiRequest', request: req });
      return;
    }
    const response = await handleExtensionUiRequest(req, this.log);
    if (response && !this.disposed) {
      this.runtime?.respondToExtensionUi(response);
    }
  }

  private detach(): void {
    for (const unsub of this.subscriptions) unsub();
    this.subscriptions = [];
  }

  dispose(): void {
    this.disposed = true;
    // Answer any dialogs still open in the (now gone) webview so pi doesn't hang.
    for (const id of this.forwardedUi) {
      this.runtime?.respondToExtensionUi({
        type: 'extension_ui_response',
        id,
        cancelled: true,
      });
    }
    this.forwardedUi.clear();
    this.detach();
    this.runtime = null;
  }
}

function getMimeType(ext: string, isImage: boolean): string {
  if (isImage) {
    const map: Record<string, string> = {
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      webp: 'image/webp',
      bmp: 'image/bmp',
      svg: 'image/svg+xml',
    };
    return map[ext] ?? 'application/octet-stream';
  }
  const textMap: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/markdown',
    json: 'application/json',
    ts: 'text/typescript',
    tsx: 'text/typescript',
    js: 'text/javascript',
    jsx: 'text/javascript',
    py: 'text/x-python',
    rb: 'text/x-ruby',
    go: 'text/x-go',
    rs: 'text/x-rust',
    java: 'text/x-java',
    c: 'text/x-c',
    cpp: 'text/x-c++',
    h: 'text/x-c',
    css: 'text/css',
    scss: 'text/x-scss',
    html: 'text/html',
    xml: 'text/xml',
    yaml: 'text/yaml',
    yml: 'text/yaml',
    toml: 'text/toml',
    csv: 'text/csv',
  };
  return textMap[ext] ?? 'text/plain';
}
