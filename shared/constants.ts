/** Constants shared by the extension host and the webview. */

/**
 * Maximum size of a single chat attachment. Enforced host-side when reading a
 * picked file (`chat-bridge.ts`) and webview-side when accepting a pasted image
 * (`composer.tsx`).
 */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
