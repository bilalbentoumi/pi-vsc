import { LuBrain, LuChevronDown, LuChevronUp, LuPower } from 'react-icons/lu';
import { actions } from '../../../apis/actions';
import {
  LEVEL_LABELS,
  THINKING_LEVELS,
} from '../../../constants/thinking-level';
import { useChatState } from '../../../contexts/chat-context';
import { Button } from '../../ui/button';
import { MenuItem, DropdownItem } from '../../ui/menu-item';

export function ReasoningSelect() {
  const value = useChatState().thinkingLevel;

  const items: DropdownItem[] = THINKING_LEVELS.map((level) => ({
    label: LEVEL_LABELS[level] ?? level,
    icon:
      level === 'off'
        ? LuPower
        : () => <span>{level.charAt(0).toUpperCase()}</span>,
    onSelect: () => {
      if (level !== value) actions.setThinkingLevel(level);
    },
    kind: 'toggle',
    checked: level === value,
  }));

  const currentLabel = LEVEL_LABELS[value] ?? value;

  return (
    <MenuItem
      items={items.reverse()}
      triggerIcon={value === 'off' ? LuPower : LuBrain}
      label={`Thinking: ${currentLabel}`}
      side="top-left"
      align="start"
      trigger={({ ref, triggerProps, open }) => (
        <Button
          ref={ref}
          variant="trigger"
          aria-label={currentLabel}
          aria-haspopup="menu"
          startIcon={() =>
            value === 'off' ? (
              <LuPower />
            ) : (
              <span>{value.charAt(0).toUpperCase()}</span>
            )
          }
          endIcon={!open ? LuChevronUp : LuChevronDown}
          title={currentLabel}
          {...triggerProps}>
          {currentLabel}
        </Button>
      )}
    />
  );
}
