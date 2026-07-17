import { randomBytes } from 'node:crypto';

/**
 * Cryptographically-secure nonce for the webview Content-Security-Policy.
 * Must be unguessable so injected content cannot match the `nonce-` source.
 */
export function getNonce(): string {
  return randomBytes(16).toString('hex');
}
