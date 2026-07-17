import { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCornerDownLeft, LuSlash } from 'react-icons/lu';
import type { CommandInfo } from '../../../../../shared/protocol';
import { fuzzyHighlight } from '../../../utils/fuzzy-highlight';
import './slash-command-menu.scss';

export interface SlashCommand extends CommandInfo {
  /** `name` with any leading slashes stripped, ready to display/insert. */
  clean: string;
}

interface SlashCommandMenuProps {
  items: SlashCommand[];
  query: string;
  focused: number;
  onHover: (index: number) => void;
  onSelect: (command: SlashCommand) => void;
  /** Ref to the textarea element for positioning. */
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

/**
 * The floating command palette shown above the composer while a `/token` is
 * being typed. Purely presentational — navigation lives in `useSlashCommands`.
 * Renders nothing when there are no matches so the composer can ignore it.
 *
 * Uses a portal + fixed positioning to escape overflow:hidden containers.
 * Positions itself above the composer using `bottom` to avoid overlaps.
 */
export function CommandMenu({
  items,
  query,
  focused,
  onHover,
  onSelect,
  textareaRef,
}: SlashCommandMenuProps) {
  const [composerRect, setComposerRect] = useState<DOMRect | null>(null);

  // Calculate position based on the composer's bounding rect
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    // Find the .input-bar parent element
    const composer = textarea.closest('.input-bar');
    if (!composer) return;

    const updatePosition = () => {
      setComposerRect(composer.getBoundingClientRect());
    };

    updatePosition();

    // Update on scroll/resize
    window.addEventListener('scroll', updatePosition, true);
    window.addEventListener('resize', updatePosition);
    return () => {
      window.removeEventListener('scroll', updatePosition, true);
      window.removeEventListener('resize', updatePosition);
    };
  }, [textareaRef]);

  const handleMouseDown = useCallback(
    (cmd: SlashCommand) => (e: React.MouseEvent) => {
      e.preventDefault();
      onSelect(cmd);
    },
    [onSelect],
  );

  if (items.length === 0 || !composerRect) return null;

  // Position menu above the composer with 8px gap
  const GAP = 8;

  const menu = (
    <div
      className="cmd-menu"
      role="listbox"
      aria-label="Slash commands"
      style={
        {
          position: 'fixed',
          left: composerRect.left,
          width: composerRect.width,
          bottom: window.innerHeight - composerRect.top + GAP,
          '--pintra-popover-enter-y': '7px',
        } as React.CSSProperties
      }>
      <div className="cmd-menu-list">
        {items.map((cmd, idx) => (
          <div
            key={`${cmd.source}::${cmd.clean}`}
            data-idx={idx}
            role="option"
            aria-selected={idx === focused}
            tabIndex={-1}
            style={{ '--i': idx } as React.CSSProperties}
            className={`cmd-item${idx === focused ? ' focused' : ''}`}
            onMouseDown={handleMouseDown(cmd)}
            onMouseEnter={() => onHover(idx)}>
            <span className="cmd-item-glyph">
              <LuSlash size={13} />
            </span>
            <span className="cmd-item-body">
              <span className="cmd-item-name">
                <span className="cmd-item-slash">/</span>
                {fuzzyHighlight(cmd.clean, query).nodes}
              </span>
              {cmd.description && (
                <span className="cmd-item-desc">{cmd.description}</span>
              )}
            </span>
            {cmd.source && (
              <span className="cmd-item-source">{cmd.source}</span>
            )}
          </div>
        ))}
      </div>
      <div className="cmd-menu-footer">
        <span className="cmd-hint">
          <kbd className="cmd-kbd">↑</kbd>
          <kbd className="cmd-kbd">↓</kbd>
          Navigate
        </span>
        <span className="cmd-hint">
          <kbd className="cmd-kbd">
            <LuCornerDownLeft size={11} />
          </kbd>
          Select
        </span>
        <span className="cmd-hint cmd-hint-end">
          <kbd className="cmd-kbd">Esc</kbd>
          Dismiss
        </span>
      </div>
    </div>
  );

  return createPortal(menu, document.body);
}
