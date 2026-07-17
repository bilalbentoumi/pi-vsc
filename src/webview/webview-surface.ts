import * as vscode from 'vscode';
import type { HostMessage, WebviewMessage } from '../../shared/protocol';
import type { Logger } from '../runtime/pi-runtime';
import type { SessionManager } from '../session/session-manager';
import { ChatBridge } from './chat-bridge';
import { renderWebviewHtml } from './html';

export interface WebviewSurface {
  /** The bridge connecting this webview to the active runtime. */
  bridge: ChatBridge;
  /** Re-render the webview HTML (also invoked by bundle hot-reload). */
  reload: () => void;
  dispose: () => void;
}

export interface CreateWebviewSurfaceOptions {
  /** Whether the bound webview is currently visible (drives dialog routing). */
  isVisible: () => boolean;
  /** When true, the surface opens on a fresh session instead of resuming (see {@link ChatBridge}). */
  openFresh?: boolean;
}

/**
 * Wire a webview surface — the sidebar view or an editor-tab panel — to a
 * {@link ChatBridge}: render the HTML, forward host→webview posts, pipe
 * webview→host messages into the bridge, and hot-reload on webview-bundle
 * changes. Both surfaces share this so their setup and reload behavior can't
 * drift apart.
 */
export function createWebviewSurface(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  sessions: SessionManager,
  log: Logger,
  appVersion: string,
  options: CreateWebviewSurfaceOptions,
): WebviewSurface {
  const reload = () => {
    webview.html = renderWebviewHtml(webview, extensionUri, appVersion);
  };
  reload();

  const bridge = new ChatBridge(
    sessions,
    log,
    (message: HostMessage) => void webview.postMessage(message),
    { isVisible: options.isVisible, openFresh: options.openFresh },
  );

  const sub = webview.onDidReceiveMessage((message: WebviewMessage) => {
    void bridge.handleMessage(message);
  });

  const hotReload = watchWebviewBundle(extensionUri, log, reload);

  return {
    bridge,
    reload,
    dispose: () => {
      hotReload.dispose();
      sub.dispose();
      bridge.dispose();
    },
  };
}

/**
 * Re-render the webview whenever the webview bundle (`dist/webview.*`) changes,
 * so an F5 debug session picks up UI edits without reopening the surface.
 */
function watchWebviewBundle(
  extensionUri: vscode.Uri,
  log: Logger,
  reload: () => void,
): vscode.Disposable {
  const pattern = new vscode.RelativePattern(
    vscode.Uri.joinPath(extensionUri, 'dist'),
    'webview.*',
  );
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  let timer: ReturnType<typeof setTimeout> | undefined;
  const debounced = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => {
      log.info('[hot-reload] webview bundle changed, reloading…');
      reload();
    }, 200);
  };
  watcher.onDidChange(debounced);
  watcher.onDidCreate(debounced);
  return {
    dispose: () => {
      if (timer) clearTimeout(timer);
      watcher.dispose();
    },
  };
}
