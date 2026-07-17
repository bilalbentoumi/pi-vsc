import { describe, expect, it } from 'vitest';
import { asText, asThinking, asToolCall, textOfContent } from './blocks';

describe('textOfContent', () => {
  it('concatenates text blocks with no separator by default', () => {
    expect(
      textOfContent([
        { type: 'text', text: 'a' },
        { type: 'text', text: 'b' },
      ]),
    ).toBe('ab');
  });

  it('joins with the given separator', () => {
    expect(
      textOfContent(
        [
          { type: 'text', text: 'a' },
          { type: 'text', text: 'b' },
        ],
        ' ',
      ),
    ).toBe('a b');
  });

  it('ignores non-text blocks', () => {
    expect(
      textOfContent([
        { type: 'text', text: 'a' },
        { type: 'thinking', thinking: 'secret' },
        { type: 'toolCall', id: '1', name: 'bash' },
        { type: 'text', text: 'b' },
      ]),
    ).toBe('ab');
  });

  it('passes strings through unchanged', () => {
    expect(textOfContent('hello')).toBe('hello');
  });

  it('returns empty string for non-array, non-string input', () => {
    expect(textOfContent(undefined)).toBe('');
    expect(textOfContent(null)).toBe('');
    expect(textOfContent(42)).toBe('');
    expect(textOfContent({})).toBe('');
  });
});

describe('block guards', () => {
  it('asText narrows only well-formed text blocks', () => {
    expect(asText({ type: 'text', text: 'a' })?.text).toBe('a');
    expect(asText({ type: 'thinking', thinking: 'x' })).toBeNull();
    expect(asText({ type: 'text' })).toBeNull(); // missing text field
  });

  it('asThinking narrows only well-formed thinking blocks', () => {
    expect(asThinking({ type: 'thinking', thinking: 'x' })?.thinking).toBe('x');
    expect(asThinking({ type: 'text', text: 'a' })).toBeNull();
  });

  it('asToolCall narrows only well-formed tool-call blocks', () => {
    const call = asToolCall({ type: 'toolCall', id: 't1', name: 'bash' });
    expect(call?.id).toBe('t1');
    expect(call?.name).toBe('bash');
    expect(asToolCall({ type: 'toolCall' })).toBeNull(); // missing id
    expect(asToolCall({ type: 'text', text: 'a' })).toBeNull();
  });
});
