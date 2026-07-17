import { forwardRef, type ComponentType, type ReactNode } from 'react';
import type { IconBaseProps } from 'react-icons';
import type { PopoverAlign, PopoverSide } from '../flyout';
import { Tooltip } from '../tooltip';
import { Button, type ButtonProps } from './button';

export interface IconButtonProps extends Omit<
  ButtonProps,
  'children' | 'startIcon' | 'endIcon' | 'iconPosition'
> {
  icon: ComponentType<IconBaseProps>;
  /** Accessible name; also the default tooltip text. Required for icon-only buttons. */
  label: string;
  /** Tooltip body; defaults to `label`. Pass nodes for a richer tip. */
  tooltip?: ReactNode;
  tooltipSide?: PopoverSide;
  tooltipAlign?: PopoverAlign;
}

/**
 * An icon-only {@link Button} that always carries an accessible label and a
 * hover {@link Tooltip}, so icon buttons don't each re-wire `aria-label` + a native
 * `title` by hand (and get a consistent, styled tooltip instead of the OS one).
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon,
      label,
      tooltip,
      tooltipSide = 'top',
      tooltipAlign = 'center',
      ...rest
    },
    ref,
  ) {
    return (
      <Tooltip content={tooltip ?? label} side={tooltipSide} align={tooltipAlign}>
        <Button ref={ref} icon={icon} aria-label={label} {...rest} />
      </Tooltip>
    );
  },
);
