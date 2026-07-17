import { LuExternalLink, LuSquarePen } from 'react-icons/lu';
import { actions } from '../../../apis/actions';
import { SessionDropdown } from '../../session-dd';
import { Button } from '../../ui/button';
import { SettingsMenu } from '../settings-menu';
import './header-right.scss';

export function TopbarRight() {
  return (
    <div className="topbar-right">
      <SettingsMenu />
      <Button
        variant="ghost"
        icon={LuExternalLink}
        aria-label="Open chat in editor"
        title="Open chat in editor"
        onClick={() => actions.openInEditor()}
      />
      <SessionDropdown />
      <Button
        variant="ghost"
        icon={LuSquarePen}
        aria-label="New chat"
        title="New chat"
        onClick={() => actions.newChat()}
      />
    </div>
  );
}
