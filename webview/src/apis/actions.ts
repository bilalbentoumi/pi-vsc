import type {
  Attachment,
  ExtensionUiResponse,
  ProviderLoginRequest,
  ThinkingLevel,
} from '../../../shared/protocol';
import { postMessage } from './vscode';

/**
 * Semantic wrappers over the raw host `postMessage` channel.
 *
 * Any component can import `actions` directly instead of receiving a callback
 * prop from `App`. This removes the need to thread `onStop`, `onSelectModel`,
 * `onCompact`, `onNewChat`, etc. down the tree.
 */
export const actions = {
  ready: () => postMessage({ type: 'ready' }),

  // conversation
  sendMessage: (text: string, attachments?: Attachment[]) =>
    postMessage({ type: 'sendMessage', text, attachments }),
  pickFiles: () => postMessage({ type: 'pickFiles' }),
  steer: (text: string) => postMessage({ type: 'steer', text }),
  abort: () => postMessage({ type: 'abort' }),
  compact: () => postMessage({ type: 'compact' }),
  editAndFork: (entryId: string, text: string) =>
    postMessage({ type: 'editAndFork', entryId, text }),

  // model / thinking config
  setModel: (provider: string, modelId: string) =>
    postMessage({ type: 'setModel', provider, modelId }),
  requestModels: () => postMessage({ type: 'requestModels' }),
  setThinkingLevel: (level: ThinkingLevel) =>
    postMessage({ type: 'setThinkingLevel', level }),
  setAutoCompaction: (enabled: boolean) =>
    postMessage({ type: 'setAutoCompaction', enabled }),

  // sessions
  newChat: () => postMessage({ type: 'newChat' }),
  switchSession: (path: string) => postMessage({ type: 'switchSession', path }),
  deleteSession: (path: string) => postMessage({ type: 'deleteSession', path }),
  deleteAllSessions: () => postMessage({ type: 'deleteAllSessions' }),
  renameSession: (path: string, name: string) =>
    postMessage({ type: 'renameSession', path, name }),
  openSessionInEditor: (path: string) =>
    postMessage({ type: 'openSessionInEditor', path }),
  requestSessions: () => postMessage({ type: 'requestSessions' }),
  requestCommands: () => postMessage({ type: 'requestCommands' }),
  openForkPicker: () => postMessage({ type: 'openForkPicker' }),
  openInEditor: () => postMessage({ type: 'openInEditor' }),

  // info menu
  exportChat: () => postMessage({ type: 'exportChat' }),
  restart: () => postMessage({ type: 'restart' }),
  showSessionInfo: () => postMessage({ type: 'showSessionInfo' }),
  openPiFolder: () => postMessage({ type: 'openPiFolder' }),
  openSettings: () => postMessage({ type: 'openSettings' }),
  openExternal: (url: string) => postMessage({ type: 'openExternal', url }),
  copyText: (text: string) => postMessage({ type: 'copyText', text }),

  // provider login / auth.json
  requestAuthStatus: () => postMessage({ type: 'requestAuthStatus' }),
  openAuthFile: () => postMessage({ type: 'openAuthFile' }),
  providerLogin: (request: ProviderLoginRequest) =>
    postMessage({ type: 'providerLogin', request }),

  // dialogs
  extensionUiResponse: (response: ExtensionUiResponse) =>
    postMessage({ type: 'extensionUiResponse', response }),
};
