import { useState } from 'react';
import { LuCheck, LuExternalLink, LuPen, LuTrash2, LuX } from 'react-icons/lu';
import type { SessionInfo } from '../../../../shared/protocol';
import { actions } from '../../apis/actions';
import { relativeTime } from '../../utils/time';
import './recent-sessions.scss';

export function SessionGrid({ sessions }: { sessions: SessionInfo[] }) {
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [draft, setDraft] = useState('');

  if (sessions.length === 0) return null;

  const startRename = (s: SessionInfo) => {
    setRenamingPath(s.path);
    setDraft(s.name ?? '');
  };
  const cancelRename = () => {
    setRenamingPath(null);
    setDraft('');
  };
  const commitRename = (path: string) => {
    const name = draft.trim();
    if (name) actions.renameSession(path, name);
    cancelRename();
  };

  return (
    <div className="session-grid-recent">
      <div className="session-grid-label">
        <span className="session-grid-label-text">Recent sessions</span>
        <button
          type="button"
          className="session-grid-delete-all"
          onClick={() => actions.deleteAllSessions()}>
          Delete all sessions
        </button>
      </div>

      <div
        className="session-grid-list"
        role="listbox"
        aria-label="Recent sessions">
        {sessions.map((s) => {
          const isRenaming = renamingPath === s.path;
          const title = s.name || s.firstMessage;
          return (
            <div
              key={s.path}
              role="option"
              aria-selected={!!s.current}
              tabIndex={isRenaming ? -1 : 0}
              className={`session-grid-row${s.current ? ' is-active' : ''}`}
              title={s.firstMessage}
              onClick={() => {
                if (!isRenaming) actions.switchSession(s.path);
              }}
              onKeyDown={(e) => {
                if (isRenaming) return;
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  actions.switchSession(s.path);
                }
              }}>
              <div className="session-grid-row-main">
                {isRenaming ? (
                  <div className="session-grid-row-top session-grid-row-top-rename">
                    <div
                      className="session-grid-rename"
                      onClick={(e) => e.stopPropagation()}>
                      <input
                        className="session-grid-rename-input"
                        value={draft}
                        placeholder="Session name"
                        autoFocus
                        onChange={(e) => setDraft(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitRename(s.path);
                          } else if (e.key === 'Escape') {
                            e.preventDefault();
                            cancelRename();
                          }
                        }}
                      />
                      <button
                        type="button"
                        className="session-grid-rename-save"
                        aria-label="Save name"
                        title="Save name"
                        onClick={() => commitRename(s.path)}>
                        <LuCheck size={13} />
                      </button>
                      <button
                        type="button"
                        className="session-grid-rename-cancel"
                        aria-label="Cancel rename"
                        title="Cancel rename"
                        onClick={cancelRename}>
                        <LuX size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="session-grid-row-top">
                    <span className="session-grid-row-title">{title}</span>
                    <div className="session-grid-actions">
                      <span className="session-grid-meta-time">
                        {relativeTime(s.modified)}
                      </span>
                      <button
                        type="button"
                        className="session-editor-btn"
                        aria-label="Open in editor"
                        title="Open in editor"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.openSessionInEditor(s.path);
                        }}>
                        <LuExternalLink size={13} />
                      </button>
                      <button
                        type="button"
                        className="session-rename-btn"
                        aria-label="Rename session"
                        title="Rename session"
                        onClick={(e) => {
                          e.stopPropagation();
                          startRename(s);
                        }}>
                        <LuPen size={13} />
                      </button>
                      <button
                        type="button"
                        className="session-del-btn"
                        aria-label="Delete session"
                        title="Delete session"
                        onClick={(e) => {
                          e.stopPropagation();
                          actions.deleteSession(s.path);
                        }}>
                        <LuTrash2 size={13} />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
