/**
 * Shared protocol definitions.
 *
 * Two protocols live here:
 *  1. The pi RPC protocol — JSON-lines over stdin/stdout between the extension
 *     host and the `pi --mode rpc` child process. Command/event names mirror the
 *     pi runtime's rpc-mode contract.
 *  2. The Host <-> Webview protocol — postMessage payloads between the extension
 *     host and the React webview.
 *
 * These types are intentionally structural/loose where the runtime payloads are
 * large or version-dependent (models, entries, stats): we forward them as-is.
 */

// ============================================================================
// pi content blocks & messages
// ============================================================================

export type ThinkingLevel = 'off' | 'low' | 'medium' | 'high';

export interface TextBlock {
  type: 'text';
  text: string;
}
export interface ThinkingBlock {
  type: 'thinking';
  thinking: string;
  thinkingSignature?: string;
}
export interface ToolCallBlock {
  type: 'toolCall';
  id: string;
  name: string;
  arguments?: unknown;
  partialArgs?: string;
  streamIndex?: number;
}
export type ContentBlock =
  | TextBlock
  | ThinkingBlock
  | ToolCallBlock
  | { type: string; [k: string]: unknown };

export interface Usage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  reasoning?: number;
  totalTokens: number;
  cost?: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
}

export interface Attachment {
  /** Unique id for the webview to track this attachment. */
  id: string;
  /** Original filename. */
  name: string;
  /** MIME type, e.g. "image/png", "text/plain". */
  mimeType: string;
  /** Absolute path on disk, when the attachment came from a file (absent for clipboard pastes). */
  filePath?: string;
  /** Base64-encoded content (images) or text content (text files). */
  data: string;
  /** For images, the data URL ready for <img src>. */
  dataUrl?: string;
  /** File size in bytes. */
  size: number;
}

export interface AppMessage {
  role: 'user' | 'assistant' | 'system';
  content: ContentBlock[];
  timestamp?: number;
  api?: string;
  provider?: string;
  model?: string;
  usage?: Usage;
  stopReason?: string;
  responseId?: string;
  responseModel?: string;
  /** Attachments sent with a user message. */
  attachments?: Attachment[];
}

export interface ModelInfo {
  id: string;
  name: string;
  provider: string;
  api?: string;
  baseUrl?: string;
  /** Whether the model supports reasoning / thinking. */
  reasoning?: boolean;
  /** Context window size in tokens. */
  contextWindow?: number;
  [k: string]: unknown;
}

// ============================================================================
// pi RPC — commands (host -> pi)
// ============================================================================

export type RpcCommand =
  | {
      type: 'prompt';
      message: string;
      images?: unknown[];
      streamingBehavior?: unknown;
    }
  | { type: 'steer'; message: string; images?: unknown[] }
  | { type: 'follow_up'; message: string; images?: unknown[] }
  | { type: 'abort' }
  | { type: 'new_session'; parentSession?: string }
  | { type: 'get_state' }
  | { type: 'set_model'; provider: string; modelId: string }
  | { type: 'cycle_model' }
  | { type: 'get_available_models' }
  | { type: 'set_thinking_level'; level: ThinkingLevel }
  | { type: 'cycle_thinking_level' }
  | { type: 'set_steering_mode'; mode: string }
  | { type: 'set_follow_up_mode'; mode: string }
  | { type: 'compact'; customInstructions?: string }
  | { type: 'set_auto_compaction'; enabled: boolean }
  | { type: 'set_auto_retry'; enabled: boolean }
  | { type: 'abort_retry' }
  | { type: 'bash'; command: string; excludeFromContext?: boolean }
  | { type: 'abort_bash' }
  | { type: 'get_session_stats' }
  | { type: 'export_html'; outputPath?: string }
  | { type: 'switch_session'; sessionPath: string }
  | { type: 'fork'; entryId: string }
  | { type: 'clone' }
  | { type: 'get_fork_messages' }
  | { type: 'get_entries'; since?: string }
  | { type: 'get_tree' }
  | { type: 'get_last_assistant_text' }
  | { type: 'set_session_name'; name: string }
  | { type: 'get_messages' }
  | { type: 'get_commands' };

export type RpcCommandType = RpcCommand['type'];

/** A command as actually written to the wire, with correlation id. */
export type RpcRequest = RpcCommand & { id: string };

// ============================================================================
// pi RPC — responses & events (pi -> host)
// ============================================================================

export interface RpcResponse {
  id: string;
  type: 'response';
  command: string;
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface SessionState {
  model: ModelInfo | null;
  thinkingLevel: ThinkingLevel;
  isStreaming: boolean;
  isCompacting: boolean;
  steeringMode: string;
  followUpMode: string;
  sessionFile?: string;
  sessionId?: string;
  sessionName?: string;
  autoCompactionEnabled: boolean;
  messageCount: number;
  pendingMessageCount: number;
}

/** Tool execution lifecycle events (keyed by toolCallId). */
export interface ToolExecutionStart {
  type: 'tool_execution_start';
  toolCallId: string;
  toolName: string;
  args?: unknown;
}
export interface ToolExecutionUpdate {
  type: 'tool_execution_update';
  toolCallId: string;
  toolName: string;
  args?: unknown;
  partialResult?: { content: ContentBlock[] };
}
export interface ToolExecutionEnd {
  type: 'tool_execution_end';
  toolCallId: string;
  toolName: string;
  result?: { content: ContentBlock[] };
  isError?: boolean;
}

export interface MessageStartEvent {
  type: 'message_start';
  message: AppMessage;
}
export interface MessageUpdateEvent {
  type: 'message_update';
  assistantMessageEvent?: unknown;
  message: AppMessage;
}
export interface MessageEndEvent {
  type: 'message_end';
  message: AppMessage;
}

/**
 * The union of streamed session events. This is deliberately open: the runtime
 * emits more event types than we render, and we forward everything to the webview.
 */
export type RpcEvent =
  | { type: 'agent_start' }
  | { type: 'agent_end'; messages?: AppMessage[] }
  | { type: 'turn_start' }
  | { type: 'turn_end'; message?: AppMessage; toolResults?: unknown[] }
  | MessageStartEvent
  | MessageUpdateEvent
  | MessageEndEvent
  | { type: 'text'; text: string }
  | ToolExecutionStart
  | ToolExecutionUpdate
  | ToolExecutionEnd
  | { type: 'compaction_start' }
  | { type: 'compaction_end'; [k: string]: unknown }
  | { type: 'auto_retry_start'; [k: string]: unknown }
  | { type: 'auto_retry_end'; [k: string]: unknown }
  | { type: 'model_select'; [k: string]: unknown }
  | { type: 'thinking_level_changed'; [k: string]: unknown }
  | { type: 'session_info_changed'; [k: string]: unknown }
  | { type: 'session_shutdown'; [k: string]: unknown }
  | { type: 'extension_error'; [k: string]: unknown }
  | { type: string; [k: string]: unknown };

/** Extension-UI request emitted by pi extensions (dialogs, notifications, etc). */
export interface ExtensionUiRequest {
  type: 'extension_ui_request';
  id: string;
  method:
    | 'select'
    | 'confirm'
    | 'input'
    | 'editor'
    | 'notify'
    | 'setStatus'
    | 'setWidget'
    | 'setTitle'
    | 'set_editor_text';
  [k: string]: unknown;
}

export interface ExtensionUiResponse {
  type: 'extension_ui_response';
  id: string;
  cancelled?: boolean;
  value?: unknown;
  confirmed?: boolean;
}

// ============================================================================
// Session browsing / stats / commands / forking
// ============================================================================

export interface SessionInfo {
  path: string;
  id: string;
  name?: string;
  firstMessage: string;
  messageCount: number;
  created: number;
  modified: number;
  current?: boolean;
}

export interface SessionStats {
  userMessages: number;
  assistantMessages: number;
  toolCalls: number;
  toolResults: number;
  totalMessages: number;
  tokens: {
    input: number;
    output: number;
    cacheRead: number;
    cacheWrite: number;
    total: number;
  };
  cost: number;
  contextUsage: { tokens: number; contextWindow: number; percent: number };
}

export interface CommandInfo {
  name: string;
  description?: string;
  source: string;
}

export interface ForkMessage {
  entryId: string;
  text: string;
}

// ============================================================================
// Provider login (auth.json)
// ============================================================================

/** The top-level method chosen in the Provider Login dialog. */
export type ProviderLoginMethod = 'subscription' | 'apiKey';

/** OAuth transport for subscription logins. */
export type ProviderLoginTransport = 'browser' | 'device';

/**
 * A credential-write request emitted by the Provider Login dialog.
 *
 *  - `apiKey`: the host writes `{ type: 'api_key', key }` under `providerId`
 *    into auth.json directly (covers the "Log in to a provider" and
 *    "Use an API key" methods).
 *  - `oauth`: a subscription login. OAuth tokens cannot be minted from the
 *    webview, so the host hands off to the `pi` CLI's real login flow, which
 *    performs the handshake and writes the `oauth` entry to the same auth.json.
 */
export type ProviderLoginRequest =
  | {
      kind: 'apiKey';
      /** auth.json key, e.g. "anthropic", "deepseek". */
      providerId: string;
      /** Human label, used in notifications. */
      providerLabel: string;
      apiKey: string;
    }
  | {
      kind: 'oauth';
      providerId: string;
      providerLabel: string;
      transport?: ProviderLoginTransport;
      /** GitHub Enterprise host, when logging in to Copilot against a GHE instance. */
      gheHost?: string;
    };

/** Snapshot of which providers already have an entry in auth.json. */
export interface AuthStatus {
  /** Provider keys present in auth.json. */
  providers: string[];
  /** Absolute path to the resolved auth.json (present or not). */
  path: string;
}

/**
 * Outcome of an API-key provider login, sent after the host has written
 * auth.json and auto-restarted the runtime so the model list refreshes.
 */
export interface ProviderLoginResult {
  providerId: string;
  providerLabel: string;
  ok: boolean;
  /** Present when `ok` is false. */
  error?: string;
}

// ============================================================================
// Host <-> Webview protocol
// ============================================================================

export type RuntimePhase = 'starting' | 'ready' | 'error' | 'stopped';

export interface RuntimeStatus {
  phase: RuntimePhase;
  message?: string;
  binaryPath?: string;
  cwd?: string;
  /** Version reported by the resolved pi binary (`pi --version`); travels with
   * the runtime so it stays in sync when the binary path changes. */
  agentVersion?: string;
}

/** Messages sent from the webview to the extension host. */
export type WebviewMessage =
  | { type: 'ready' }
  | { type: 'sendMessage'; text: string; attachments?: Attachment[] }
  | { type: 'steer'; text: string }
  | { type: 'abort' }
  | { type: 'newChat' }
  | { type: 'setModel'; provider: string; modelId: string }
  | { type: 'cycleModel' }
  | { type: 'setThinkingLevel'; level: ThinkingLevel }
  | { type: 'compact' }
  | { type: 'requestModels' }
  | { type: 'requestState' }
  | { type: 'restart' }
  | { type: 'showLog' }
  | { type: 'requestSessions' }
  | { type: 'switchSession'; path: string }
  | { type: 'deleteSession'; path: string }
  | { type: 'deleteAllSessions' }
  | { type: 'renameSession'; path: string; name: string }
  | { type: 'openSessionInEditor'; path: string }
  | { type: 'requestStats' }
  | { type: 'requestCommands' }
  | { type: 'openForkPicker' }
  | { type: 'editAndFork'; entryId: string; text: string }
  | { type: 'exportChat' }
  | { type: 'openInEditor' }
  | { type: 'setAutoCompaction'; enabled: boolean }
  | { type: 'openPiFolder' }
  | { type: 'showSessionInfo' }
  | { type: 'openSettings' }
  | { type: 'pickFiles' }
  | { type: 'openExternal'; url: string }
  | { type: 'copyText'; text: string }
  | { type: 'requestAuthStatus' }
  | { type: 'openAuthFile' }
  | { type: 'providerLogin'; request: ProviderLoginRequest }
  | { type: 'log'; level: 'info' | 'warn' | 'error'; text: string }
  | { type: 'extensionUiResponse'; response: ExtensionUiResponse };

/** Messages sent from the extension host to the webview. */
export type HostMessage =
  | { type: 'runtimeStatus'; status: RuntimeStatus }
  | { type: 'rpcEvent'; event: RpcEvent }
  | { type: 'state'; state: SessionState }
  | { type: 'models'; models: ModelInfo[] }
  | { type: 'history'; messages: AppMessage[] }
  | { type: 'config'; config: WebviewConfig }
  | { type: 'focusInput' }
  | { type: 'insertText'; text: string }
  | { type: 'pickedFiles'; files: Attachment[] }
  | { type: 'sessions'; sessions: SessionInfo[] }
  | { type: 'stats'; stats: SessionStats }
  | { type: 'commands'; commands: CommandInfo[] }
  | { type: 'enterForkMode'; entryId: string; text: string }
  | { type: 'authStatus'; status: AuthStatus }
  | { type: 'providerLoginResult'; result: ProviderLoginResult }
  | { type: 'extensionUiRequest'; request: ExtensionUiRequest };

export interface WebviewConfig {
  thinkingLevel: ThinkingLevel;
  autoExpandEditLineThreshold?: number;
}
