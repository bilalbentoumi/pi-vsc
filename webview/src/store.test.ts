import { describe, expect, it } from 'vitest';
import type { AppMessage, Attachment, HostMessage } from '../../shared/protocol';
import { initialState, reducer } from './store';

const host = (message: HostMessage) => ({ type: 'host' as const, message });

const att = (id: string): Attachment => ({
  id,
  name: `${id}.png`,
  mimeType: 'image/png',
  data: '',
  size: 10,
});

describe('reducer — host state messages', () => {
  it('leaves state untouched (same ref) for messages with no reducer case', () => {
    const next = reducer(
      initialState,
      host({ type: 'authStatus', status: { providers: [], path: '' } }),
    );
    expect(next).toBe(initialState);
  });

  it('applies runtimeStatus', () => {
    const next = reducer(
      initialState,
      host({ type: 'runtimeStatus', status: { phase: 'ready' } }),
    );
    expect(next.status.phase).toBe('ready');
  });

  it('applies models and config', () => {
    const models = [{ id: 'm', name: 'M', provider: 'p' }];
    expect(reducer(initialState, host({ type: 'models', models })).models).toEqual(
      models,
    );
    expect(
      reducer(
        initialState,
        host({ type: 'config', config: { thinkingLevel: 'high' } }),
      ).thinkingLevel,
    ).toBe('high');
  });

  it('derives streaming/compacting/thinkingLevel from session state', () => {
    const next = reducer(
      initialState,
      host({
        type: 'state',
        state: {
          model: null,
          thinkingLevel: 'low',
          isStreaming: true,
          isCompacting: false,
          steeringMode: '',
          followUpMode: '',
          autoCompactionEnabled: false,
          messageCount: 0,
          pendingMessageCount: 0,
        },
      }),
    );
    expect(next.streaming).toBe(true);
    expect(next.compacting).toBe(false);
    expect(next.thinkingLevel).toBe('low');
  });

  it('marks history loaded on sessions', () => {
    const next = reducer(initialState, host({ type: 'sessions', sessions: [] }));
    expect(next.hasLoadedHistory).toBe(true);
  });
});

describe('reducer — history', () => {
  it('keeps only displayable roles, seeds tools, and rebuilds attachments', () => {
    const messages = [
      { role: 'user', content: [{ type: 'text', text: 'hi' }] },
      {
        role: 'assistant',
        content: [{ type: 'toolCall', id: 't1', name: 'bash', arguments: { command: 'ls' } }],
      },
      { role: 'toolResult', toolCallId: 't1', toolName: 'bash', content: [{ type: 'text', text: 'out' }] },
      { role: 'tool', content: [] },
    ] as unknown as AppMessage[];

    const next = reducer(initialState, host({ type: 'history', messages }));

    // user + assistant kept; toolResult + tool filtered from the visible list
    expect(next.messages).toHaveLength(2);
    expect(next.messages.map((m) => m.role)).toEqual(['user', 'assistant']);
    // tool seeded from the toolCall then completed by the toolResult
    expect(next.tools['t1'].toolName).toBe('bash');
    expect(next.tools['t1'].status).toBe('done');
    expect(next.tools['t1'].resultText).toBe('out');
  });
});

describe('reducer — streaming lifecycle (rpcEvent)', () => {
  it('toggles streaming and bumps seq on agent_start/agent_end', () => {
    let s = reducer(
      initialState,
      host({ type: 'rpcEvent', event: { type: 'agent_start' } }),
    );
    expect(s.streaming).toBe(true);
    s = reducer(s, host({ type: 'rpcEvent', event: { type: 'agent_end' } }));
    expect(s.streaming).toBe(false);
    expect(s.seq).toBe(1);
  });

  it('appends, updates, and finalizes an assistant message', () => {
    let s = reducer(
      initialState,
      host({
        type: 'rpcEvent',
        event: { type: 'message_start', message: { role: 'assistant', content: [] } },
      }),
    );
    expect(s.messages).toHaveLength(1);
    expect(s.currentUid).not.toBeNull();
    expect(s.messages[0].streaming).toBe(true);

    s = reducer(
      s,
      host({
        type: 'rpcEvent',
        event: {
          type: 'message_update',
          message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
        },
      }),
    );
    expect(s.messages[0].content).toEqual([{ type: 'text', text: 'hello' }]);

    s = reducer(
      s,
      host({
        type: 'rpcEvent',
        event: {
          type: 'message_end',
          message: { role: 'assistant', content: [{ type: 'text', text: 'hello' }] },
        },
      }),
    );
    expect(s.messages[0].streaming).toBe(false);
    expect(s.currentUid).toBeNull();
  });

  it('links pending attachments to a new user message', () => {
    let s = reducer(initialState, {
      type: 'addPendingAttachments',
      attachments: [att('a1')],
    });
    s = reducer(
      s,
      host({
        type: 'rpcEvent',
        event: { type: 'message_start', message: { role: 'user', content: [] } },
      }),
    );
    expect(s.pendingAttachments).toHaveLength(0);
    expect(s.userAttachments.get(s.currentUid!)).toEqual([att('a1')]);
  });

  it('tracks a tool execution from start to end', () => {
    let s = reducer(
      initialState,
      host({
        type: 'rpcEvent',
        event: {
          type: 'tool_execution_start',
          toolCallId: 't1',
          toolName: 'bash',
          args: { command: 'ls' },
        },
      }),
    );
    expect(s.tools['t1'].status).toBe('running');
    s = reducer(
      s,
      host({
        type: 'rpcEvent',
        event: {
          type: 'tool_execution_end',
          toolCallId: 't1',
          toolName: 'bash',
          result: { content: [{ type: 'text', text: 'done' }] },
          isError: false,
        },
      }),
    );
    expect(s.tools['t1'].status).toBe('done');
    expect(s.tools['t1'].resultText).toBe('done');
  });
});

describe('reducer — local UI actions', () => {
  it('adds then dismisses a pending extension-UI request', () => {
    const withUi = reducer(
      initialState,
      host({
        type: 'extensionUiRequest',
        request: { type: 'extension_ui_request', id: 'u1', method: 'confirm' },
      }),
    );
    expect(withUi.pendingUi).toHaveLength(1);
    const cleared = reducer(withUi, { type: 'dismissUi', id: 'u1' });
    expect(cleared.pendingUi).toHaveLength(0);
  });

  it('sets, adds, and clears pending attachments', () => {
    const set = reducer(initialState, {
      type: 'setPendingAttachments',
      attachments: [att('a1')],
    });
    expect(set.pendingAttachments).toHaveLength(1);
    const added = reducer(set, {
      type: 'addPendingAttachments',
      attachments: [att('a2')],
    });
    expect(added.pendingAttachments).toHaveLength(2);
    const cleared = reducer(added, { type: 'clearPendingAttachments' });
    expect(cleared.pendingAttachments).toHaveLength(0);
  });
});
