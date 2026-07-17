import type {
  AppMessage,
  Attachment,
  CommandInfo,
  ContentBlock,
  ExtensionUiRequest,
  HostMessage,
  ModelInfo,
  RpcEvent,
  RuntimeStatus,
  SessionInfo,
  SessionState,
  SessionStats,
  ThinkingLevel,
  ToolExecutionEnd,
  ToolExecutionStart,
  ToolExecutionUpdate,
} from '../../shared/protocol';
import { asToolCall, textOfContent } from '../../shared/blocks';

export type ToolStatus = 'running' | 'done' | 'error';

export interface ToolExec {
  toolCallId: string;
  toolName: string;
  args?: unknown;
  status: ToolStatus;
  resultText?: string;
  resultBlocks?: ContentBlock[];
  isError?: boolean;
}

export interface UiMessage {
  uid: string;
  role: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
  streaming: boolean;
  usage?: AppMessage['usage'];
  model?: string;
  timestamp?: number;
  attachments?: import('../../shared/protocol').Attachment[];
}

export interface ChatState {
  status: RuntimeStatus;
  models: ModelInfo[];
  session: SessionState | null;
  messages: UiMessage[];
  tools: Record<string, ToolExec>;
  streaming: boolean;
  compacting: boolean;
  thinkingLevel: ThinkingLevel;
  pendingUi: ExtensionUiRequest[];
  sessions: SessionInfo[];
  hasLoadedHistory: boolean;
  stats: SessionStats | null;
  commands: CommandInfo[];
  currentUid: string | null;
  seq: number;
  /** Local attachments for user messages (not stored by pi). Maps message uid -> attachments. */
  userAttachments: Map<string, Attachment[]>;
  /** Pending attachments waiting to be associated with the next user message. */
  pendingAttachments: Attachment[];
}

export const initialState: ChatState = {
  status: { phase: 'starting' },
  models: [],
  session: null,
  messages: [],
  tools: {},
  streaming: false,
  compacting: false,
  thinkingLevel: 'medium',
  pendingUi: [],
  sessions: [],
  hasLoadedHistory: false,
  stats: null,
  commands: [],
  currentUid: null,
  seq: 0,
  userAttachments: new Map(),
  pendingAttachments: [],
};

const DISPLAYABLE_ROLES = new Set(['user', 'assistant', 'system']);
function isDisplayableRole(role: string): boolean {
  return DISPLAYABLE_ROLES.has(role);
}

let uidCounter = 0;
function nextUid(): string {
  return `m${Date.now().toString(36)}_${uidCounter++}`;
}

function toUiMessage(m: AppMessage): UiMessage {
  return {
    uid: nextUid(),
    role: m.role,
    content: Array.isArray(m.content) ? m.content : [],
    streaming: false,
    usage: m.usage,
    model: m.model,
    timestamp: m.timestamp,
    attachments: m.attachments,
  };
}

function seedToolsFromHistory(
  messages: AppMessage[],
): Record<string, ToolExec> {
  const tools: Record<string, ToolExec> = {};
  for (const m of messages) {
    for (const block of m.content ?? []) {
      const call = asToolCall(block);
      if (call)
        tools[call.id] = {
          toolCallId: call.id,
          toolName: call.name,
          args: call.arguments,
          status: 'running',
        };
    }
  }
  for (const m of messages as any[]) {
    if (m.role === 'toolResult' && m.toolCallId) {
      const id = m.toolCallId as string;
      tools[id] = {
        toolCallId: id,
        toolName: m.toolName ?? tools[id]?.toolName ?? 'tool',
        args: tools[id]?.args,
        status: m.isError ? 'error' : 'done',
        isError: !!m.isError,
        resultBlocks: m.content,
        resultText: textOfContent(m.content),
      };
    }
  }
  return tools;
}

export type Action =
  | { type: 'host'; message: HostMessage }
  | { type: 'dismissUi'; id: string }
  | { type: 'setPendingAttachments'; attachments: Attachment[] }
  | { type: 'addPendingAttachments'; attachments: Attachment[] }
  | { type: 'clearPendingAttachments' };

export function reducer(state: ChatState, action: Action): ChatState {
  if (action.type === 'dismissUi') {
    return {
      ...state,
      pendingUi: state.pendingUi.filter((u) => u.id !== action.id),
    };
  }
  if (action.type === 'setPendingAttachments') {
    return { ...state, pendingAttachments: action.attachments };
  }
  if (action.type === 'addPendingAttachments') {
    return {
      ...state,
      pendingAttachments: [...state.pendingAttachments, ...action.attachments],
    };
  }
  if (action.type === 'clearPendingAttachments') {
    return { ...state, pendingAttachments: [] };
  }
  const message = action.message;
  switch (message.type) {
    case 'runtimeStatus':
      return { ...state, status: message.status };
    case 'models':
      return { ...state, models: message.models };
    case 'config':
      return { ...state, thinkingLevel: message.config.thinkingLevel };
    case 'state':
      return {
        ...state,
        session: message.state,
        streaming: message.state.isStreaming,
        compacting: message.state.isCompacting,
        thinkingLevel: message.state.thinkingLevel,
      };
    case 'history': {
      const newMessages = message.messages
        .filter((m) => isDisplayableRole(m.role))
        .map(toUiMessage);

      // Rebuild the uid->attachments map from this history: uids are freshly
      // minted on every load, so any prior mapping is stale. Only messages that
      // carry their own attachments (e.g. a persisted session) repopulate it.
      const userAttachments = new Map<string, Attachment[]>();
      for (const msg of newMessages) {
        if (msg.role === 'user' && msg.attachments?.length) {
          userAttachments.set(msg.uid, msg.attachments);
        }
      }

      return {
        ...state,
        messages: newMessages,
        tools: seedToolsFromHistory(message.messages),
        currentUid: null,
        streaming: false,
        userAttachments,
      };
    }
    case 'extensionUiRequest':
      return { ...state, pendingUi: [...state.pendingUi, message.request] };
    case 'sessions':
      return { ...state, sessions: message.sessions, hasLoadedHistory: true };
    case 'stats':
      return { ...state, stats: message.stats };
    case 'commands':
      return { ...state, commands: message.commands };
    case 'rpcEvent':
      return applyRpcEvent(state, message.event);
    // focusInput / insertText / enterForkMode / pickedFiles are handled in the
    // Shell before reaching the reducer; anything else is a no-op here.
    default:
      return state;
  }
}

function applyRpcEvent(state: ChatState, event: RpcEvent): ChatState {
  switch (event.type) {
    case 'agent_start':
      return { ...state, streaming: true };
    case 'agent_end':
      return {
        ...state,
        streaming: false,
        currentUid: null,
        seq: state.seq + 1,
      };
    case 'message_start': {
      const msg = (event as any).message as AppMessage;
      if (!isDisplayableRole(msg.role)) {
        return { ...state, currentUid: null };
      }
      const ui = toUiMessage(msg);
      ui.streaming = msg.role === 'assistant';
      if (ui.timestamp == null) ui.timestamp = Date.now();

      // For user messages, attach any pending attachments
      if (msg.role === 'user' && state.pendingAttachments.length > 0) {
        const newMap = new Map(state.userAttachments);
        newMap.set(ui.uid, state.pendingAttachments);
        return {
          ...state,
          messages: [...state.messages, ui],
          currentUid: ui.uid,
          userAttachments: newMap,
          pendingAttachments: [],
        };
      }

      return {
        ...state,
        messages: [...state.messages, ui],
        currentUid: ui.uid,
      };
    }
    case 'message_update': {
      const msg = (event as any).message as AppMessage;
      if (!state.currentUid) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.uid === state.currentUid
            ? {
                ...m,
                content: msg.content ?? m.content,
                usage: msg.usage ?? m.usage,
              }
            : m,
        ),
      };
    }
    case 'message_end': {
      const msg = (event as any).message as AppMessage;
      if (!state.currentUid) return state;
      return {
        ...state,
        messages: state.messages.map((m) =>
          m.uid === state.currentUid
            ? {
                ...m,
                content: msg.content ?? m.content,
                usage: msg.usage ?? m.usage,
                model: msg.model ?? m.model,
                streaming: false,
              }
            : m,
        ),
        currentUid: null,
      };
    }
    case 'tool_execution_start': {
      const e = event as ToolExecutionStart;
      return {
        ...state,
        tools: {
          ...state.tools,
          [e.toolCallId]: {
            toolCallId: e.toolCallId,
            toolName: e.toolName,
            args: e.args,
            status: 'running',
          },
        },
      };
    }
    case 'tool_execution_update': {
      const e = event as ToolExecutionUpdate;
      const existing = state.tools[e.toolCallId];
      return {
        ...state,
        tools: {
          ...state.tools,
          [e.toolCallId]: {
            toolCallId: e.toolCallId,
            toolName: e.toolName,
            args: e.args ?? existing?.args,
            status: 'running',
            resultBlocks: e.partialResult?.content ?? existing?.resultBlocks,
            resultText:
              textOfContent(e.partialResult?.content) || existing?.resultText,
          },
        },
      };
    }
    case 'tool_execution_end': {
      const e = event as ToolExecutionEnd;
      const existing = state.tools[e.toolCallId];
      return {
        ...state,
        tools: {
          ...state.tools,
          [e.toolCallId]: {
            toolCallId: e.toolCallId,
            toolName: e.toolName,
            args: existing?.args,
            status: e.isError ? 'error' : 'done',
            isError: e.isError,
            resultBlocks: e.result?.content ?? existing?.resultBlocks,
            resultText: textOfContent(e.result?.content),
          },
        },
      };
    }
    case 'compaction_start':
      return { ...state, compacting: true };
    case 'compaction_end':
      return { ...state, compacting: false };
    default:
      return state;
  }
}
