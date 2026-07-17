/**
 * Content-block helpers shared by the extension host and the webview.
 *
 * pi content blocks are an intentionally open union (see `ContentBlock` in
 * `protocol.ts`): the runtime emits more block shapes than the UI renders. These
 * narrowing guards let call sites read the well-known fields (`text`,
 * `thinking`, tool-call `id`/`name`/`arguments`) without scattering `as any`
 * casts, while keeping the union open.
 *
 * Lives in `shared/` so it compiles for both bundle targets (host CJS + webview
 * IIFE); it imports types only.
 */
import type {
  ContentBlock,
  TextBlock,
  ThinkingBlock,
  ToolCallBlock,
} from './protocol';

/** Narrow a block to a text block, or null. */
export function asText(block: ContentBlock): TextBlock | null {
  return block.type === 'text' && typeof (block as TextBlock).text === 'string'
    ? (block as TextBlock)
    : null;
}

/** Narrow a block to a thinking block, or null. */
export function asThinking(block: ContentBlock): ThinkingBlock | null {
  return block.type === 'thinking' &&
    typeof (block as ThinkingBlock).thinking === 'string'
    ? (block as ThinkingBlock)
    : null;
}

/** Narrow a block to a tool-call block, or null. */
export function asToolCall(block: ContentBlock): ToolCallBlock | null {
  return block.type === 'toolCall' &&
    typeof (block as ToolCallBlock).id === 'string'
    ? (block as ToolCallBlock)
    : null;
}

/**
 * Concatenate the text of all text blocks in a message's content.
 *
 * Accepts the loosely-typed content shape the runtime produces (a string, an
 * array of blocks, or neither). `separator` defaults to `''` for reconstructing
 * streamed assistant text verbatim; pass `' '` for a readable one-line preview.
 */
export function textOfContent(content: unknown, separator = ''): string {
  if (typeof content === 'string') return content;
  if (!Array.isArray(content)) return '';
  return (content as ContentBlock[])
    .map((block) => asText(block)?.text ?? '')
    .join(separator);
}
