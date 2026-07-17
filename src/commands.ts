import * as vscode from 'vscode';
import type { PiSidebarProvider } from './provider';
import type { EditorChatManager } from './editor/panel-manager';
import type { SessionManager } from './session/session-manager';
import type { Logger } from './runtime/pi-runtime';

export function registerCommands(
  context: vscode.ExtensionContext,
  sessions: SessionManager,
  provider: PiSidebarProvider,
  editorManager: EditorChatManager,
  log: Logger,
): void {
  const reg = (id: string, fn: (...args: any[]) => any) =>
    context.subscriptions.push(vscode.commands.registerCommand(id, fn));

  reg('pintra.newChat', () => provider.dispatch({ type: 'newChat' }));
  reg('pintra.abort', () => provider.dispatch({ type: 'abort' }));
  reg('pintra.compact', () => provider.dispatch({ type: 'compact' }));
  reg('pintra.cycleModel', () => provider.dispatch({ type: 'cycleModel' }));
  reg('pintra.openChatInEditor', () => editorManager.open());
  reg('pintra.exportChat', () => provider.dispatch({ type: 'exportChat' }));
  reg('pintra.editMessage', () =>
    provider.dispatch({ type: 'openForkPicker' }),
  );

  reg('pintra.cycleThinkingLevel', async () => {
    const runtime = sessions.getActiveRuntime();
    if (!runtime.isReady) return;
    const result = await runtime.cycleThinkingLevel();
    if (result)
      vscode.window.setStatusBarMessage(
        `Pintra thinking: ${result.level}`,
        2000,
      );
    await provider.dispatch({ type: 'requestState' });
  });

  reg('pintra.focusInput', async () => {
    await provider.reveal();
    provider.focusInput();
  });

  reg('pintra.switchModel', () => switchModel(sessions, provider, log));

  reg('pintra.addFileToChat', async (uri?: vscode.Uri) => {
    const target = uri ?? vscode.window.activeTextEditor?.document.uri;
    if (!target) return;
    const rel = vscode.workspace.asRelativePath(target, false);
    await provider.reveal();
    provider.insertText(`@${rel} `);
    provider.focusInput();
  });

  reg('pintra.restartRuntime', async () => {
    await vscode.window.withProgress(
      {
        location: { viewId: 'pintra.chatView' },
        title: 'Restarting pi runtime…',
      },
      async () => {
        await sessions.restartAll();
        await provider.reconnect();
      },
    );
  });

  reg('pintra.showLog', () => log.show());
}

async function switchModel(
  sessions: SessionManager,
  provider: PiSidebarProvider,
  log: Logger,
): Promise<void> {
  const runtime = sessions.getActiveRuntime();
  if (!runtime.isReady) {
    void vscode.window.showWarningMessage('Pintra runtime is not ready yet.');
    return;
  }
  try {
    const models = await runtime.getAvailableModels();
    if (models.length === 0) {
      void vscode.window.showWarningMessage(
        'No models available. Check your pi auth configuration.',
      );
      return;
    }
    const current = (await runtime.getState()).model;
    const items: (vscode.QuickPickItem & {
      provider: string;
      modelId: string;
    })[] = models.map((m) => ({
      label: m.name || m.id,
      description: m.provider,
      detail:
        current && current.id === m.id && current.provider === m.provider
          ? '$(check) current'
          : undefined,
      provider: m.provider,
      modelId: m.id,
    }));
    const picked = await vscode.window.showQuickPick(items, {
      title: 'Switch Model',
      placeHolder: 'Select a model',
      matchOnDescription: true,
    });
    if (!picked) return;
    await provider.dispatch({
      type: 'setModel',
      provider: picked.provider,
      modelId: picked.modelId,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.error(`switchModel failed: ${message}`);
    void vscode.window.showErrorMessage(`Pintra: ${message}`);
  }
}
