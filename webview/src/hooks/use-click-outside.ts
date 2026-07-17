import { type RefObject, useEffect } from 'react';

type ElementRef = RefObject<HTMLElement | null>;

/**
 * Fire `callback` on a `mousedown` outside every element in `refs`. Pass an
 * array of refs to treat several elements as "inside" (e.g. a trigger and the
 * popover it opens). Pass an array literal built from stable `useRef` objects
 * or memoize it so the listener isn't re-subscribed each render.
 */
export function useClickOutside(
  refs: ElementRef | ElementRef[],
  callback: () => void,
  enabled = true,
) {
  useEffect(() => {
    if (!enabled) return;
    const list = Array.isArray(refs) ? refs : [refs];
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node;
      const inside = list.some((r) => r.current?.contains(target));
      if (!inside) callback();
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, [refs, callback, enabled]);
}
