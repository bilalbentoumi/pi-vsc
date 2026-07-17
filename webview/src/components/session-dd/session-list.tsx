import { LuHouse, LuTrash2 } from 'react-icons/lu';
import type { SessionInfo } from '../../../../shared/protocol';
import { actions } from '../../apis/actions';
import { relativeTime } from '../../utils/time';
import './session-list.scss';

interface SessionListProps {
  sessions: SessionInfo[];
  onSelect: (path: string) => void;
  onStartPage?: () => void;
}

export function SessionList({
  sessions,
  onSelect,
  onStartPage,
}: SessionListProps) {
  return (
    <>
      <button
        type="button"
        role="option"
        aria-selected={false}
        className="session-dd-start"
        onClick={() => {
          actions.newChat();
          onStartPage?.();
        }}>
        <span className="session-dd-start-icon" aria-hidden>
          <LuHouse size={15} />
        </span>
        <span className="session-dd-start-label">Start page</span>
      </button>

      <div className="session-dd-divider" role="separator" />

      {sessions.length === 0 ? (
        <div className="session-dd-empty">No previous sessions here yet.</div>
      ) : (
        sessions.map((s) => (
          <div
            key={s.path}
            role="option"
            aria-selected={!!s.current}
            tabIndex={0}
            className={`session-dd-row${s.current ? ' is-active' : ''}`}
            onClick={() => onSelect(s.path)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(s.path);
              }
            }}
            title={s.firstMessage}>
            <span className="session-dd-row-title">
              {s.name || s.firstMessage}
            </span>
            <span className="session-dd-row-meta">
              {relativeTime(s.modified)}
            </span>
            <button
              type="button"
              className="session-dd-row-del"
              aria-label="Delete session"
              title="Delete session"
              onClick={(e) => {
                e.stopPropagation();
                actions.deleteSession(s.path);
              }}>
              <LuTrash2 size={14} />
            </button>
          </div>
        ))
      )}
    </>
  );
}
