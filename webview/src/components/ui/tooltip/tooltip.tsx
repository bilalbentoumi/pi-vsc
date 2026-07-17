import {
  cloneElement,
  isValidElement,
  type ReactElement,
  type ReactNode,
} from 'react';
import {
  Flyout,
  type PopoverAlign,
  type PopoverContentApi,
  type PopoverSide,
} from '../flyout';
import './tooltip.scss';

type AnyRef = React.Ref<unknown> | undefined;

function mergeRefs(...refs: AnyRef[]) {
  return (node: unknown) => {
    for (const ref of refs) {
      if (!ref) continue;
      if (typeof ref === 'function') ref(node);
      else (ref as React.MutableRefObject<unknown>).current = node;
    }
  };
}

export interface TooltipProps {
  /**
   * Tooltip body — plain text, arbitrary content, or a render function that
   * receives `{ close }` for interactive content that needs to dismiss itself.
   */
  content: ReactNode | ((api: PopoverContentApi) => ReactNode);
  /** Single element the tooltip is anchored to; hover it to reveal `content`. */
  children: ReactElement;
  /** When true (or `content` is empty), the tooltip never opens. */
  disabled?: boolean;
  side?: PopoverSide;
  align?: PopoverAlign;
  gap?: number;
  minWidth?: number;
  hoverCloseDelay?: number;
  /** Extra class applied to the tooltip surface. */
  className?: string;
}

/**
 * Hover-triggered popover. Clones its single child to attach hover handlers and
 * a ref (merged with any the child already has) without stealing its `onClick`,
 * so it composes with click-driven surfaces like a {@link Popover} trigger.
 */
export function Tooltip({
  content,
  children,
  disabled = false,
  side = 'top',
  align = 'center',
  gap = 6,
  minWidth,
  hoverCloseDelay,
  className,
}: TooltipProps) {
  if (!isValidElement(children)) return children;

  const empty = content == null || content === '';
  const popoverClassName = ['tooltip', className].filter(Boolean).join(' ');

  return (
    <Flyout
      popoverClassName={popoverClassName}
      side={side}
      align={align}
      gap={gap}
      minWidth={minWidth}
      openOnHover
      hoverCloseDelay={hoverCloseDelay}
      disabled={disabled || empty}
      trigger={({ ref, triggerProps }) => {
        const child = children as ReactElement<
          React.HTMLAttributes<HTMLElement>
        >;
        const childRef =
          (child as { ref?: AnyRef }).ref ??
          (child.props as { ref?: AnyRef }).ref;
        return cloneElement(child, {
          ref: mergeRefs(childRef, ref),
          onMouseEnter: (e: React.MouseEvent<HTMLElement>) => {
            child.props.onMouseEnter?.(e);
            triggerProps.onMouseEnter();
          },
          onMouseLeave: (e: React.MouseEvent<HTMLElement>) => {
            child.props.onMouseLeave?.(e);
            triggerProps.onMouseLeave();
          },
        } as React.HTMLAttributes<HTMLElement> & { ref: AnyRef });
      }}>
      {typeof content === 'function' ? (
        content
      ) : typeof content === 'string' ? (
        <div className="tooltip-text">{content}</div>
      ) : (
        content
      )}
    </Flyout>
  );
}
