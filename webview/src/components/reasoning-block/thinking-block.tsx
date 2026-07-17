import { useState } from 'react';
import { LuChevronRight } from 'react-icons/lu';
import './reasoning-block.scss';

interface ThinkingBlockProps {
  text: string;
  /** True while the model is still streaming this reasoning block. */
  active?: boolean;
}

export function ReasoningBlock({ text, active = false }: ThinkingBlockProps) {
  const [expanded, setExpanded] = useState(false);
  const hasText = text.trim().length > 0;

  // Nothing to show once thinking is done and produced no content.
  if (!hasText && !active) return null;

  return (
    <div
      className={`reasoning-block${expanded ? ' is-expanded' : ''}${
        active ? ' is-active' : ''
      }`}>
      <button
        type="button"
        className="reasoning-summary"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        disabled={!hasText}>
        <LuChevronRight className="reasoning-chevron" aria-hidden="true" />
        <span className="reasoning-label">
          {active ? 'Thinking' : 'Thought'}
        </span>
        {active && (
          <span className="reasoning-dots" aria-hidden="true">
            <span />
            <span />
            <span />
          </span>
        )}
      </button>
      {hasText && <div className="reasoning-body">{text}</div>}
    </div>
  );
}
