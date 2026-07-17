import * as vscode from 'vscode';
import type { HostMessage, WebviewMessage } from '../shared/protocol';
import type { Logger } from './runtime/pi-runtime';
import type { SessionManager } from './session/session-manager';
import {
  createWebviewSurface,
  type WebviewSurface,
} from './webview/webview-surface';

export class PiSidebarProvider implements vscode.WebviewViewProvider {
  static readonly viewType = 'pintra.chatView';

  private view: vscode.WebviewView | undefined;
  private surface: WebviewSurface | undefined;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly sessions: SessionManager,
    private readonly log: Logger,
    private readonly appVersion: string = '',
  ) {}

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;
    const webview = webviewView.webview;
    webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.extensionUri, 'dist'),
        vscode.Uri.joinPath(this.extensionUri, 'media'),
      ],
    };

    const surface = createWebviewSurface(
      webview,
      this.extensionUri,
      this.sessions,
      this.log,
      this.appVersion,
      // The sidebar always opens on a fresh chat; the prior conversation stays
      // in session history (non-destructive), reachable via the history dropdown.
      { isVisible: () => webviewView.visible, openFresh: true },
    );
    this.surface = surface;

    webviewView.onDidDispose(() => {
      surface.dispose();
      if (this.surface === surface) this.surface = undefined;
      if (this.view === webviewView) this.view = undefined;
    });
  }

  post(message: HostMessage): void {
    void this.view?.webview.postMessage(message);
  }

  async reveal(): Promise<void> {
    await vscode.commands.executeCommand('pintra.chatView.focus');
  }

  focusInput(): void {
    this.post({ type: 'focusInput' });
  }

  insertText(text: string): void {
    this.post({ type: 'insertText', text });
  }

  async reconnect(): Promise<void> {
    await this.surface?.bridge.connect();
  }

  async dispatch(message: WebviewMessage): Promise<void> {
    await this.reveal();
    if (!this.surface) {
      await new Promise((r) => setTimeout(r, 0));
    }
    await this.surface?.bridge.handleMessage(message);
  }
}
