import { useEffect, useRef } from 'react';
import { useChatState } from '../../contexts/chat-context';
import { AgentTimeline, EntryView } from '../entry-view';
import { LogoText } from '../logo-text';
import { ProgressBar } from '../progress-bar';
import type { UiMessage } from '../../store';
import './message-list.scss';

/** Extension version injected into the page shell as `data-ext-version`. */
const APP_VERSION = document.body.dataset.extVersion ?? '';

/**
 * Group the flat message stream into turns: each user message starts a turn that
 * owns the assistant/tool/system messages that follow it. Wrapping each turn
 * makes it the containing block for that user bubble's sticky pin — so when the
 * next turn scrolls up it pushes the previous pinned bubble out of view and
 * takes its place (native sticky handoff), instead of the bubbles stacking at
 * the top. Messages before the first user turn form a leading, header-less group.
 */
function groupIntoTurns(
  messages: UiMessage[],
): { key: string; items: UiMessage[] }[] {
  const turns: { key: string; items: UiMessage[] }[] = [];
  for (const m of messages) {
    if (m.role === 'user' || turns.length === 0) {
      turns.push({ key: m.uid, items: [m] });
    } else {
      turns[turns.length - 1].items.push(m);
    }
  }
  return turns;
}

export function EntryList({
  onScrollAtBottomChange,
}: {
  onScrollAtBottomChange?: (atBottom: boolean) => void;
}) {
  const { messages, tools, status, streaming, compacting } = useChatState();
  const ready = status.phase === 'ready';

  const listRef = useRef<HTMLDivElement | null>(null);
  const stickToBottom = useRef(true);

  useEffect(() => {
    const el = listRef.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages, tools, streaming, compacting]);

  const onScroll = () => {
    const el = listRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 48;
    if (atBottom !== stickToBottom.current) {
      stickToBottom.current = atBottom;
      onScrollAtBottomChange?.(atBottom);
    }
  };

  return (
    <div id="chat-log" ref={listRef} onScroll={onScroll}>
      {messages.length === 0 && ready && (
        <div className="welcome">
          <div className="welcome-logo">
            <LogoText />
            {APP_VERSION && (
              <span className="welcome-version">v{APP_VERSION}</span>
            )}
          </div>
          <p className="welcome-sub">
            Ask Pi to build a feature, fix a bug, or explain the code in this
            workspace.
          </p>
        </div>
      )}
      {groupIntoTurns(messages).map((turn) => {
        // A turn is [user?, ...agent/system]; the user message stays a bubble
        // while the reply that follows renders as one continuous timeline.
        const hasUser = turn.items[0]?.role === 'user';
        const userMsg = hasUser ? turn.items[0] : null;
        const agentMsgs = hasUser ? turn.items.slice(1) : turn.items;
        return (
          <div className="turn" key={turn.key}>
            {userMsg && (
              <EntryView key={userMsg.uid} message={userMsg} tools={tools} />
            )}
            {agentMsgs.length > 0 && (
              <AgentTimeline messages={agentMsgs} tools={tools} />
            )}
          </div>
        );
      })}
      {streaming && !compacting && <ProgressBar />}
      {compacting && (
        <div className="notice-msg compact-msg">Compacting context…</div>
      )}
    </div>
  );
}
