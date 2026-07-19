import { useEffect, useState } from 'react';
import {
  LuDownload,
  LuEye,
  LuFileText,
  LuFolderOpen,
  LuInfo,
  LuKeyRound,
  LuMessageSquareWarning,
  LuMinimize2,
  LuRefreshCw,
  LuSettings,
  LuSettings2,
} from 'react-icons/lu';
import { actions } from '../../../apis/actions';
import { useChatState } from '../../../contexts/chat-context';
import { openProviderLogin } from '../../../stores/provider-login-store';
import { Menu, MenuItem } from '../../ui/menu-item';

const REPO_URL = 'https://github.com/bilalbentoumi/pi-vsc';

export function SettingsMenu() {
  const { session } = useChatState();
  const [showThinking, setShowThinking] = useState(false);

  useEffect(() => {
    document.body.classList.toggle('show-reasoning', showThinking);
  }, [showThinking]);

  const autoCompactionEnabled = session?.autoCompactionEnabled ?? true;

  const items: MenuItem[] = [
    {
      label: 'Submit Feedback',
      icon: LuMessageSquareWarning,
      onSelect: () => actions.openExternal(`${REPO_URL}/issues/new`),
    },
    {
      label: 'Log in to provider',
      icon: LuKeyRound,
      onSelect: () => openProviderLogin(),
    },
    {
      label: 'Open Pi folder',
      icon: LuFolderOpen,
      onSelect: () => actions.openPiFolder(),
    },
    {
      label: 'Reload Pi config',
      icon: LuRefreshCw,
      onSelect: () => actions.restart(),
    },
    {
      label: 'Show session info',
      icon: LuInfo,
      onSelect: () => actions.showSessionInfo(),
    },
    {
      label: 'Show thinking',
      icon: LuEye,
      onSelect: () => setShowThinking((v) => !v),
      kind: 'toggle',
      checked: showThinking,
    },
    {
      label: 'Auto compact',
      icon: LuMinimize2,
      onSelect: () => actions.setAutoCompaction(!autoCompactionEnabled),
      kind: 'toggle',
      checked: autoCompactionEnabled,
    },
    {
      label: 'Export chat',
      icon: LuDownload,
      onSelect: () => actions.exportChat(),
    },
    {
      label: 'Changelog',
      icon: LuFileText,
      onSelect: () => actions.openExternal(`${REPO_URL}/releases`),
    },
    {
      label: 'Settings',
      icon: LuSettings,
      onSelect: () => actions.openSettings(),
    },
  ];

  return <Menu items={items} triggerIcon={LuSettings2} />;
}
