import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { useClickOutside } from '../../../hooks/use-click-outside';
import { useEscapeKey } from '../../../hooks/use-escape-key';
import './popover.scss';

// Positioning is computed in JS against the viewport, so these px/ms values
// are deliberately plain numbers rather than --pintra-* CSS tokens (which the
// layout math can't read without a getComputedStyle round-trip).
/** Min gap kept between the popover and the viewport edge, in px. */
const VIEWPORT_MARGIN = 8;
/** Default gap between the trigger and the popover, in px. */
const DEFAULT_GAP = 6;
/** Default grace period before a hover-opened popover closes, in ms. */
const DEFAULT_HOVER_CLOSE_DELAY = 120;

export type PopoverSide =
  | 'auto'
  | 'top'
  | 'top-left'
  | 'top-right'
  | 'bottom'
  | 'bottom-left'
  | 'bottom-right';
export type PopoverAlign = 'start' | 'center' | 'end';

export interface PopoverTriggerApi {
  ref: (el: HTMLElement | null) => void;
  open: boolean;
  toggle: () => void;
  triggerProps: {
    onClick: () => void;
    onMouseEnter: () => void;
    onMouseLeave: () => void;
    'aria-expanded': boolean;
  };
}

export interface PopoverContentApi {
  close: () => void;
}

interface Placement {
  side: 'top' | 'bottom';
  style: React.CSSProperties;
}

function getContainingBlock(element: HTMLElement): HTMLElement | null {
  let node = element.parentElement;
  while (node) {
    const s = getComputedStyle(node) as CSSStyleDeclaration & {
      webkitBackdropFilter?: string;
      containerType?: string;
    };
    const backdrop = s.backdropFilter || s.webkitBackdropFilter;
    if (
      s.transform !== 'none' ||
      s.filter !== 'none' ||
      s.perspective !== 'none' ||
      /\b(transform|filter|perspective)\b/.test(s.willChange) ||
      /\b(paint|layout|strict|content)\b/.test(s.contain) ||
      (s.containerType && s.containerType !== 'normal') ||
      (backdrop && backdrop !== 'none')
    )
      return node;
    node = node.parentElement;
  }
  return null;
}

export interface PopoverProps {
  trigger: (api: PopoverTriggerApi) => React.ReactNode;
  children: React.ReactNode | ((api: PopoverContentApi) => React.ReactNode);
  popoverClassName?: string;
  popoverProps?: React.HTMLAttributes<HTMLDivElement>;
  side?: PopoverSide;
  align?: PopoverAlign;
  minWidth?: number;
  gap?: number;
  openOnHover?: boolean;
  hoverCloseDelay?: number;
  /** When true, the popover cannot be opened and force-closes if already open. */
  disabled?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function Flyout({
  trigger,
  children,
  popoverClassName,
  popoverProps,
  side = 'bottom',
  align = 'start',
  minWidth = 0,
  gap = DEFAULT_GAP,
  openOnHover = false,
  hoverCloseDelay = DEFAULT_HOVER_CLOSE_DELAY,
  disabled = false,
  onOpenChange,
}: PopoverProps) {
  const triggerRef = useRef<HTMLElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);
  const containingBlockRef = useRef<HTMLElement | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [pos, setPos] = useState<Placement | null>(null);
  const [open, setOpenState] = useState(false);
  const openRef = useRef(open);

  const setOpen = useCallback(
    (next: boolean | ((prev: boolean) => boolean)) => {
      const resolved =
        typeof next === 'function' ? next(openRef.current) : next;
      if (resolved === openRef.current) return;
      openRef.current = resolved;
      setOpenState(resolved);
      onOpenChange?.(resolved);
    },
    [onOpenChange],
  );

  const setTriggerRef = useCallback((el: HTMLElement | null) => {
    triggerRef.current = el;
  }, []);
  const setPopoverRef = useCallback((el: HTMLDivElement | null) => {
    popoverRef.current = el;
  }, []);

  const clearCloseTimer = useCallback(() => {
    if (closeTimer.current !== null) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  }, []);

  const close = useCallback(() => {
    clearCloseTimer();
    setOpen(false);
  }, [clearCloseTimer, setOpen]);
  const toggle = useCallback(() => {
    if (disabled) return;
    clearCloseTimer();
    setOpen((v) => !v);
  }, [disabled, clearCloseTimer, setOpen]);

  const scheduleClose = useCallback(() => {
    if (!openOnHover) return;
    clearCloseTimer();
    closeTimer.current = setTimeout(() => {
      closeTimer.current = null;
      setOpen(false);
    }, hoverCloseDelay);
  }, [openOnHover, hoverCloseDelay, clearCloseTimer, setOpen]);
  const handleTriggerEnter = useCallback(() => {
    if (!openOnHover || disabled) return;
    clearCloseTimer();
    setOpen(true);
  }, [openOnHover, disabled, clearCloseTimer, setOpen]);

  useEffect(() => () => clearCloseTimer(), [clearCloseTimer]);

  // Force-close when disabled while open (e.g. another surface took over).
  useEffect(() => {
    if (disabled) close();
  }, [disabled, close]);

  // Trigger + popover count as "inside"; a click anywhere else dismisses.
  const outsideRefs = useMemo(() => [triggerRef, popoverRef], []);
  useClickOutside(outsideRefs, close, open);

  const closeAndRefocus = useCallback(() => {
    close();
    triggerRef.current?.focus();
  }, [close]);
  useEscapeKey(closeAndRefocus, open);

  const sideVertical: 'top' | 'bottom' | 'auto' = side.startsWith('top')
    ? 'top'
    : side.startsWith('bottom')
      ? 'bottom'
      : 'auto';
  const sideHoriz: 'left' | 'center' | 'right' = side.endsWith('-left')
    ? 'left'
    : side.endsWith('-right')
      ? 'right'
      : 'center';

  const computeFloating = useCallback((): Placement | null => {
    const trigger = triggerRef.current;
    if (!trigger) return null;
    const r = trigger.getBoundingClientRect();
    const margin = VIEWPORT_MARGIN;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const spaceAbove = r.top;
    const spaceBelow = vh - r.bottom;

    const resolvedSide: 'top' | 'bottom' =
      sideVertical === 'auto'
        ? spaceBelow > spaceAbove && spaceAbove < 240
          ? 'bottom'
          : 'top'
        : sideVertical;
    const minW = Math.min(
      Math.max(r.width, minWidth),
      Math.max(0, vw - 2 * margin),
    );
    const width = popoverRef.current?.offsetWidth ?? minW;
    let left =
      align === 'end'
        ? r.right - width
        : align === 'center'
          ? r.left + r.width / 2 - width / 2
          : r.left;
    if (left + width > vw - margin)
      left = Math.max(margin, vw - margin - width);
    left = Math.max(margin, left);

    const cb = containingBlockRef.current;
    const cbRect = cb?.getBoundingClientRect();
    const originX = cbRect ? cbRect.left + cb!.clientLeft : 0;
    const originY = cbRect ? cbRect.top + cb!.clientTop : 0;
    const cbBottom = cbRect ? originY + cb!.clientHeight : vh;

    const style: React.CSSProperties = { left: left - originX, minWidth: minW };
    if (resolvedSide === 'bottom') {
      style.top = Math.round(r.bottom + gap - originY);
    } else {
      style.bottom = Math.round(cbBottom - r.top + gap);
    }
    return { side: resolvedSide, style };
  }, [sideVertical, align, minWidth, gap]);

  const reposition = useCallback(() => {
    setPos(computeFloating());
  }, [computeFloating]);

  useLayoutEffect(() => {
    if (!open) {
      setPos(null);
      containingBlockRef.current = null;
      return;
    }
    containingBlockRef.current = popoverRef.current
      ? getContainingBlock(popoverRef.current)
      : null;
    reposition();
  }, [open, reposition]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(reposition);
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [open, reposition]);

  const resolvedSide: 'top' | 'bottom' =
    pos?.side ?? (sideVertical === 'auto' ? 'bottom' : sideVertical);
  const originClass =
    resolvedSide === 'bottom'
      ? sideHoriz === 'left'
        ? 'flyout-origin-top-left'
        : sideHoriz === 'right'
          ? 'flyout-origin-top-right'
          : 'flyout-origin-top'
      : sideHoriz === 'left'
        ? 'flyout-origin-bottom-left'
        : sideHoriz === 'right'
          ? 'flyout-origin-bottom-right'
          : 'flyout-origin-bottom';
  const enterY =
    resolvedSide === 'bottom'
      ? ({ '--pintra-popover-enter-y': '-7px' } as React.CSSProperties)
      : ({ '--pintra-popover-enter-y': '7px' } as React.CSSProperties);
  const animate =
    typeof document === 'undefined' ||
    !document.body.classList.contains('no-anim');

  const className = [
    'flyout',
    originClass,
    animate && 'flyout--animate',
    popoverClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const popover = (
    <div
      ref={setPopoverRef}
      className={className}
      style={{ ...pos?.style, ...enterY }}
      {...popoverProps}
      onMouseEnter={(e) => {
        popoverProps?.onMouseEnter?.(e);
        if (openOnHover) clearCloseTimer();
      }}
      onMouseLeave={(e) => {
        popoverProps?.onMouseLeave?.(e);
        scheduleClose();
      }}>
      {typeof children === 'function' ? children({ close }) : children}
    </div>
  );

  return (
    <>
      {trigger({
        ref: setTriggerRef,
        open,
        toggle,
        triggerProps: {
          onClick: toggle,
          onMouseEnter: handleTriggerEnter,
          onMouseLeave: scheduleClose,
          'aria-expanded': open,
        },
      })}
      {open && popover}
    </>
  );
}
