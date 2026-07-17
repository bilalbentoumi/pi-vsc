import * as vscode from 'vscode';
import { PiSidebarProvider } from './provider';
import { EditorChatManager } from './editor/panel-manager';
import { SessionManager } from './session/session-manager';
import { registerCommands } from './commands';
import { affectsRestart } from './config';
import type { Logger } from './runtime/pi-runtime';

function createLogger(channel: vscode.LogOutputChannel): Logger {
  return {
    info: (msg) => channel.info(msg),
    warn: (msg) => channel.warn(msg),
    error: (msg) => channel.error(msg),
    // vscode.LogOutputChannel has show(); expose it for the "Show Log" command.
    show: () => channel.show(),
  } as Logger & { show: () => void };
}

export function activate(context: vscode.ExtensionContext): void {
  const channel = vscode.window.createOutputChannel('Pintra', { log: true });
  context.subscriptions.push(channel);
  const log = createLogger(channel);
  log.info('Pintra extension activating.');

  const appVersion: string = context.extension.packageJSON.version ?? '';

  const sessions = new SessionManager(log);
  context.subscriptions.push({ dispose: () => void sessions.dispose() });

  const provider = new PiSidebarProvider(
    context.extensionUri,
    sessions,
    log,
    appVersion,
  );
  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      PiSidebarProvider.viewType,
      provider,
      {
        webviewOptions: { retainContextWhenHidden: true },
      },
    ),
  );

  const editorManager = new EditorChatManager(
    context.extensionUri,
    sessions,
    log,
    appVersion,
  );
  context.subscriptions.push(editorManager);

  registerCommands(context, sessions, provider, editorManager, log);

  // Restart the runtime when a restart-affecting setting changes.
  context.subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(async (e) => {
      if (affectsRestart(e)) {
        log.info('Restart-affecting setting changed; restarting runtime.');
        await sessions.restartAll();
        await provider.reconnect();
      }
    }),
  );

  // Webview-bundle changes hot-reload each surface in place, but the extension
  // host can't hot-swap its own code. In an F5 debug session, offer a window
  // reload when the host bundle rebuilds so it doesn't run stale behavior.
  if (context.extensionMode === vscode.ExtensionMode.Development) {
    const hostWatcher = vscode.workspace.createFileSystemWatcher(
      new vscode.RelativePattern(context.extensionUri, 'dist/extension.*'),
    );
    let timer: ReturnType<typeof setTimeout> | undefined;
    const promptReload = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        log.info('[hot-reload] host bundle changed.');
        const choice = await vscode.window.showInformationMessage(
          'Pintra host bundle changed — reload the window to apply.',
          'Reload Window',
        );
        if (choice === 'Reload Window') {
          await vscode.commands.executeCommand('workbench.action.reloadWindow');
        }
      }, 300);
    };
    hostWatcher.onDidChange(promptReload);
    hostWatcher.onDidCreate(promptReload);
    context.subscriptions.push(hostWatcher);
  }

  log.info('Pintra extension activated.');
}

export function deactivate(): Thenable<void> | void {
  // SessionManager disposal (killing child processes) is handled via subscriptions.
}
