import { useCallback, useState } from 'react';

export interface UseListNavigationOptions {
  /** Number of items in the list. */
  count: number;
  /** Invoked with the focused index when Enter is pressed. */
  onSelect: (index: number) => void;
  /** Wrap around past the ends (default true). */
  cycle?: boolean;
}

export interface UseListNavigationReturn {
  /** Index of the focused item. */
  focused: number;
  /** Move focus imperatively (e.g. on hover or when the list resets). */
  setFocused: (index: number) => void;
  /** Handle Arrow/Enter keys; returns true when the event was consumed. */
  onKeyDown: (e: React.KeyboardEvent) => boolean;
}

/**
 * Keyboard focus-ring for a flat list: ArrowUp/ArrowDown move focus (cycling by
 * default), Enter selects the focused index. Shared by the command menu, model
 * picker, and other dropdowns instead of each re-implementing the modulo math.
 */
export function useListNavigation({
  count,
  onSelect,
  cycle = true,
}: UseListNavigationOptions): UseListNavigationReturn {
  const [focused, setFocused] = useState(0);

  const move = useCallback(
    (delta: number) =>
      setFocused((prev) => {
        if (count <= 0) return 0;
        const next = prev + delta;
        return cycle
          ? (next + count) % count
          : Math.max(0, Math.min(count - 1, next));
      }),
    [count, cycle],
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent): boolean => {
      if (count <= 0) return false;
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          move(1);
          return true;
        case 'ArrowUp':
          e.preventDefault();
          move(-1);
          return true;
        case 'Enter':
          if (focused >= 0 && focused < count) {
            e.preventDefault();
            onSelect(focused);
            return true;
          }
          return false;
        default:
          return false;
      }
    },
    [count, focused, move, onSelect],
  );

  return { focused, setFocused, onKeyDown };
}
