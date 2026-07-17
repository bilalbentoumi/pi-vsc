import type { Readable } from 'node:stream';

/**
 * Attach a strict JSON-lines reader to a readable stream. Invokes `onLine` for
 * each complete `\n`-terminated line. Returns a detach function.
 */
export function attachJsonlLineReader(
  stream: Readable,
  onLine: (line: string) => void,
): () => void {
  let buffer = '';
  const onData = (chunk: Buffer | string) => {
    buffer += typeof chunk === 'string' ? chunk : chunk.toString('utf8');
    let newlineIndex: number;
    while ((newlineIndex = buffer.indexOf('\n')) >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      const trimmed = line.endsWith('\r') ? line.slice(0, -1) : line;
      if (trimmed.length > 0) {
        onLine(trimmed);
      }
    }
  };
  stream.on('data', onData);
  return () => stream.off('data', onData);
}

/** Serialize an object to a single JSON line terminated with `\n`. */
export function serializeJsonLine(obj: unknown): string {
  return JSON.stringify(obj) + '\n';
}
