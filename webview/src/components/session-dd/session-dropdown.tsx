import { LuHistory } from 'react-icons/lu';
import { actions } from '../../apis/actions';
import { useChatState } from '../../contexts/chat-context';
import { Button } from '../ui/button';
import { Flyout } from '../ui/flyout';
import { SessionList } from './session-list';

/**
 * Self-contained session-history dropdown: the trigger button plus the flyout
 * list. Owns fetching the session list on open, switching sessions, and
 * starting a new chat — callers just drop `<SessionDropdown />` into a toolbar.
 */
export function SessionDropdown() {
  const { sessions } = useChatState();

  const onOpenChange = (next: boolean) => {
    if (next) actions.requestSessions();
  };

  return (
    <Flyout
      side="bottom-right"
      align="end"
      minWidth={320}
      onOpenChange={onOpenChange}
      popoverClassName="session-dd"
      popoverProps={{ role: 'listbox', 'aria-label': 'Session history' }}
      trigger={({ ref, open, triggerProps }) => (
        <Button
          ref={ref}
          variant="ghost"
          icon={LuHistory}
          aria-label="Session history"
          title="Session history"
          aria-haspopup="listbox"
          aria-expanded={open}
          onClick={triggerProps.onClick}
        />
      )}>
      {({ close }) => (
        <SessionList
          sessions={sessions}
          onSelect={(path) => {
            actions.switchSession(path);
            close();
          }}
          onStartPage={close}
        />
      )}
    </Flyout>
  );
}
