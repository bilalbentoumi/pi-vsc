import { useChatState } from '../../../contexts/chat-context';
import type { UiMessage } from '../../../store';
import { LogoIcon } from '../../logo-icon';
import './topbar-left.scss';

/**
 * The pi backend only sets `sessionName` once a name has been explicitly
 * assigned (rename / set_session_name); it never auto-titles a session. So we
 * fall back to the first user message — mirroring the session list's
 * `name || firstMessage` — otherwise the header would read "New chat" forever.
 */
function deriveSessionTitle(
  sessionName: string | undefined,
  messages: UiMessage[],
): string {
  const explicit = sessionName?.trim();
  if (explicit) return explicit;

  const firstUser = messages.find((m) => m.role === 'user');
  const text = firstUser?.content
    .filter((b) => b.type === 'text')
    .map((b) => (b as { text?: string }).text ?? '')
    .join(' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text || 'New chat';
}

export function TopbarLeft() {
  const { session, messages } = useChatState();

  const sessionName = deriveSessionTitle(session?.sessionName, messages);

  return (
    <div className="topbar-left">
      <div className="topbar-logo">
        <LogoIcon size={16} />
      </div>
      <span id="title-text" title={sessionName}>
        {sessionName}
      </span>
    </div>
  );
}
