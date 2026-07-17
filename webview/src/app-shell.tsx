import { useEffect, useRef, useState } from 'react';
import type { HostMessage } from '../../shared/protocol';
import { actions } from './apis/actions';
import { onHostMessage } from './apis/vscode';
import { useChatDispatch, useChatState } from './contexts/chat-context';
import { useEscapeKey } from './hooks/use-escape-key';
import { ChatScreen } from './screens/session-screen';
import { SplashScreen } from './screens/splash-screen';

interface ForkMode {
  entryId: string;
  text: string;
}

/** Handlers for host messages that drive local view state rather than the store. */
type ViewMessageHandlers = {
  [K in HostMessage['type']]?: (
    message: Extract<HostMessage, { type: K }>,
  ) => void;
};

export function Shell() {
  const state = useChatState();
  const dispatch = useChatDispatch();
  const [, setInput] = useState('');
  const [forkMode, setForkMode] = useState<ForkMode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    // A few host messages steer view-local UI (focus, drafts, fork mode,
    // attachments); route those here and let everything else fall through to
    // the store so there's a single reducer path for chat state.
    const handlers: ViewMessageHandlers = {
      focusInput: () => textareaRef.current?.focus(),
      insertText: (message) => {
        setInput((v) => (v && !v.endsWith(' ') ? v + ' ' : v) + message.text);
        textareaRef.current?.focus();
      },
      enterForkMode: (message) => {
        setForkMode({ entryId: message.entryId, text: message.text });
        setInput(message.text);
        textareaRef.current?.focus();
      },
      pickedFiles: (message) =>
        dispatch({ type: 'addPendingAttachments', attachments: message.files }),
    };

    const off = onHostMessage((message: HostMessage) => {
      const handler = handlers[message.type] as
        ((m: HostMessage) => void) | undefined;
      if (handler) handler(message);
      else dispatch({ type: 'host', message });
    });
    actions.ready();
    return off;
  }, []);

  useEscapeKey(() => actions.abort(), state.streaming);

  // Stay on the splash until the runtime is actually up. The runtime reports
  // `stopped` before `start()` runs (its initial status), so treating anything
  // other than `starting` as "ready" would flash the empty chat screen during
  // `stopped` before the splash. `starting` and `stopped` are both "coming up"
  // states; only `error` falls through so its (actionable) chat UI stays reachable.
  const phase = state.status.phase;
  if (phase === 'starting' || phase === 'stopped') {
    return <SplashScreen />;
  }

  return (
    <div className="shell">
      <ChatScreen />

      {forkMode && (
        <div className="gh-fork">
          <span>
            ⑂ Editing a previous message — sending will fork the conversation.
          </span>
          <button
            className="ext-link"
            onClick={() => {
              setForkMode(null);
              setInput('');
            }}>
            Cancel
          </button>
        </div>
      )}
    </div>
  );
}
