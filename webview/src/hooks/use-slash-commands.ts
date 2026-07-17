import { useCallback, useMemo, useRef } from 'react';
import type { CommandInfo } from '../../../shared/protocol';
import type { SlashCommand } from '../components/input-bar/cmd-menu/slash-command-menu';
import { useListNavigation } from './use-list-navigation';

/** Built-in commands available even if the runtime doesn't provide any. */
const BUILTIN_COMMANDS: CommandInfo[] = [
  {
    name: 'compact',
    description: 'Compact conversation context',
    source: 'built-in',
  },
  {
    name: 'clear',
    description: 'Start a new chat session',
    source: 'built-in',
  },
  {
    name: 'model',
    description: 'Switch the current model',
    source: 'built-in',
  },
  { name: 'think', description: 'Set thinking level', source: 'built-in' },
];

interface UseSlashCommandsOptions {
  commands: CommandInfo[];
  /** Current textarea value. */
  value: string;
  /** Called when a slash command is selected (after the menu handles it). */
  onSelect: (command: SlashCommand, fullCommand: string) => void;
}

interface UseSlashCommandsReturn {
  /** Whether the slash command menu is currently visible. */
  visible: boolean;
  /** Filtered + enriched command items to render. */
  items: SlashCommand[];
  /** Index of the currently focused item (-1 = none). */
  focused: number;
  /** Called on textarea keydown to handle menu navigation. Returns true if the event was consumed. */
  onKeyDown: (e: React.KeyboardEvent<HTMLTextAreaElement>) => boolean;
  /** Update the focused index on hover. */
  onHover: (index: number) => void;
  /** The query string (text after `/`). */
  query: string;
}

/**
 * Parses the textarea value to detect a `/command` token, filters available
 * commands, and provides keyboard-navigation handlers.
 *
 * A slash command is triggered when the cursor is at the end of the input
 * and the last "word" starts with `/`. This keeps the UX simple and avoids
 * mid-sentence command detection.
 */
export function useSlashCommands({
  commands,
  value,
  onSelect,
}: UseSlashCommandsOptions): UseSlashCommandsReturn {
  // Detect slash command: the value ends with `/something`
  const match = useMemo(() => {
    // Match a slash token at the end of the input
    const re = /(?:^|\s)\/([^\s/]*)$/;
    const m = value.match(re);
    if (!m) return null;
    return { fullMatch: m[0].trimStart(), query: m[1] };
  }, [value]);

  const query = match?.query ?? '';
  // Use runtime commands, or fall back to built-in commands
  const availableCommands = commands.length > 0 ? commands : BUILTIN_COMMANDS;
  const visible = match !== null;

  // Filter and enrich commands
  const items = useMemo<SlashCommand[]>(() => {
    if (!visible) return [];
    const q = query.toLowerCase();
    return availableCommands
      .filter((cmd) => {
        const name = cmd.name.replace(/^\/+/, '');
        return name.toLowerCase().includes(q);
      })
      .map((cmd) => ({
        ...cmd,
        clean: cmd.name.replace(/^\/+/, ''),
      }))
      .sort((a, b) => {
        // Exact prefix match first, then alphabetical
        const aStartsWith = a.clean.toLowerCase().startsWith(q);
        const bStartsWith = b.clean.toLowerCase().startsWith(q);
        if (aStartsWith && !bStartsWith) return -1;
        if (!aStartsWith && bStartsWith) return 1;
        return a.clean.localeCompare(b.clean);
      });
  }, [availableCommands, query, visible]);

  const selectItem = useCallback(
    (item: SlashCommand) => {
      if (!match) return;
      // Build the full command text to insert (e.g. "/compact")
      const fullCommand = `/${item.clean}`;
      onSelect(item, fullCommand);
    },
    [match, onSelect],
  );

  // ArrowUp/ArrowDown/Enter navigation is shared; Tab/Escape are composer-specific.
  const nav = useListNavigation({
    count: items.length,
    cycle: true,
    onSelect: (i) => selectItem(items[i]),
  });
  const { focused, setFocused } = nav;

  // Reset focus when the query changes.
  const prevQuery = useRef(query);
  if (query !== prevQuery.current) {
    prevQuery.current = query;
    if (focused !== 0) setFocused(0);
  }

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>): boolean => {
      if (!visible || items.length === 0) return false;
      if (e.key === 'Tab') {
        e.preventDefault();
        if (focused >= 0 && focused < items.length) selectItem(items[focused]);
        return true;
      }
      // Escape falls through so the composer can dismiss the menu.
      if (e.key === 'Escape') return false;
      return nav.onKeyDown(e);
    },
    [visible, items, focused, selectItem, nav],
  );

  return {
    visible,
    items,
    focused,
    onKeyDown,
    onHover: setFocused,
    query,
  };
}
