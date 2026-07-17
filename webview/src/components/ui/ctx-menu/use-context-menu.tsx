import { useCallback, useState } from 'react';
import { CtxMenu, ContextMenuItem } from './context-menu';

export interface UseContextMenuOptions {
  minWidth?: number;
}

export interface UseContextMenu {
  /** `onContextMenu` handler — opens the menu at the cursor. */
  open: (e: React.MouseEvent) => void;
  /** Dismiss the menu. */
  close: () => void;
  /** Whether the menu is currently open. */
  isOpen: boolean;
  /** The rendered menu (or `null`). Drop this into your JSX. */
  menu: React.ReactNode;
}

/**
 * Owns the open/close + cursor-anchor state for a {@link ContextMenu}.
 *
 * ```tsx
 * const ctx = useContextMenu(items);
 * return (
 *   <>
 *     <Button onContextMenu={ctx.open}>…</Button>
 *     {ctx.menu}
 *   </>
 * );
 * ```
 */
export function useCtxMenu(
  items: ContextMenuItem[],
  options: UseContextMenuOptions = {},
): UseContextMenu {
  const [anchor, setAnchor] = useState<{ x: number; y: number } | null>(null);

  const open = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setAnchor({ x: e.clientX, y: e.clientY });
  }, []);

  const close = useCallback(() => setAnchor(null), []);

  const menu = anchor ? (
    <CtxMenu
      x={anchor.x}
      y={anchor.y}
      items={items}
      onClose={close}
      minWidth={options.minWidth}
    />
  ) : null;

  return { open, close, isOpen: anchor !== null, menu };
}
