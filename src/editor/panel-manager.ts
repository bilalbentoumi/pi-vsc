import * as vscode from 'vscode';
import type { Logger } from '../runtime/pi-runtime';
import type { SessionManager } from '../session/session-manager';
import { createWebviewSurface } from '../webview/webview-surface';

/** Opens and tracks full editor-tab chat panels, each reusing a ChatBridge. */
export class EditorChatManager implements vscode.Disposable {
  static readonly viewType = 'pintra.chatEditor';
  private readonly panels = new Set<vscode.WebviewPanel>();

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessions: SessionManager,
    private readonly log: Logger,
    private readonly appVersion: string = '',
  ) {}

  open(): vscode.WebviewPanel {
    const panel = vscode.window.createWebviewPanel(
      EditorChatManager.viewType,
      'Pintra',
      vscode.ViewColumn.Beside,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [
          vscode.Uri.joinPath(this.extensionUri, 'dist'),
          vscode.Uri.joinPath(this.extensionUri, 'media'),
        ],
      },
    );

    const surface = createWebviewSurface(
      panel.webview,
      this.extensionUri,
      this.sessions,
      this.log,
      this.appVersion,
      { isVisible: () => panel.visible },
    );

    panel.onDidDispose(() => {
      surface.dispose();
      this.panels.delete(panel);
    });
    this.panels.add(panel);
    return panel;
  }

  dispose(): void {
    for (const panel of this.panels) panel.dispose();
    this.panels.clear();
  }
}
