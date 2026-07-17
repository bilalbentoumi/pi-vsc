import { ComponentType } from 'react';
import { IconBaseProps } from 'react-icons';
import { LuCheck, LuChevronDown } from 'react-icons/lu';
import { Button } from '../button';
import {
  Flyout,
  PopoverAlign,
  PopoverSide,
  PopoverTriggerApi,
} from '../flyout';
import './dropdown.scss';

export interface DropdownItem {
  label: string;
  icon: ComponentType<IconBaseProps>;
  onSelect: () => void;
  kind?: 'toggle';
  checked?: boolean;
  disabled?: boolean;
}

export interface DropdownProps {
  items: DropdownItem[];
  triggerIcon?: ComponentType<IconBaseProps>;
  label?: string;
  side?: PopoverSide;
  align?: PopoverAlign;
  minWidth?: number;
  trigger?: (api: PopoverTriggerApi) => React.ReactNode;
}

export function MenuItem({
  items,
  triggerIcon = LuChevronDown,
  label,
  side = 'bottom-right',
  align = 'center',
  minWidth = 198,
  trigger,
}: DropdownProps) {
  return (
    <Flyout
      side={side}
      align={align}
      minWidth={minWidth}
      popoverProps={{ role: 'menu' }}
      trigger={
        trigger ??
        (({ ref, triggerProps }) => (
          <Button
            ref={ref}
            variant="ghost"
            icon={triggerIcon}
            aria-label={label}
            aria-haspopup="menu"
            title={label}
            {...triggerProps}>
            {label}
          </Button>
        ))
      }>
      {({ close }) => (
        <div style={{ padding: '.25rem' }}>
          {items.map((item) => (
            <Button
              key={item.label}
              type="button"
              role="menuitem"
              className={`menu-item${item.kind === 'toggle' ? ' menu-toggle' : ''}${item.disabled ? ' disabled' : ''}`}
              disabled={item.disabled}
              onClick={() => {
                if (item.disabled) return;
                item.onSelect();
                close();
              }}>
              <span className="menu-icon">
                <item.icon size={14} />
              </span>
              <span className="menu-label">{item.label}</span>
              {item.kind === 'toggle' && item.checked && <LuCheck size={14} />}
            </Button>
          ))}
        </div>
      )}
    </Flyout>
  );
}
