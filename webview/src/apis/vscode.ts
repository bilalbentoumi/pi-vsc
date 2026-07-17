import type { HostMessage, WebviewMessage } from '../../../shared/protocol';

interface VsCodeApi {
  postMessage(message: unknown): void;
}

declare function acquireVsCodeApi(): VsCodeApi;

const api: VsCodeApi = acquireVsCodeApi();

export function postMessage(message: WebviewMessage): void {
  api.postMessage(message);
}

export function onHostMessage(
  handler: (message: HostMessage) => void,
): () => void {
  const listener = (event: MessageEvent) => handler(event.data as HostMessage);
  window.addEventListener('message', listener);
  return () => window.removeEventListener('message', listener);
}

export function log(level: 'info' | 'warn' | 'error', text: string): void {
  postMessage({ type: 'log', level, text });
}
