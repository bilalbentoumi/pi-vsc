import { memo } from 'react';
import type { ReactNode } from 'react';
import { asText, asThinking, asToolCall } from '../../../../shared/blocks';
import type { ToolExec, ToolStatus, UiMessage } from '../../store';
import { MdRender } from '../md-render';
import { ReasoningBlock } from '../reasoning-block';
import { ExecBlock } from '../exec-view';
import './agent-timeline.scss';

interface AgentTimelineProps {
  /** The assistant/system messages of a single turn, in order. */
  messages: UiMessage[];
  tools: Record<string, ToolExec>;
}

type TimelineKind = 'text' | 'thinking' | 'tool' | 'system' | 'caret';

interface TimelineItem {
  key: string;
  kind: TimelineKind;
  /** Tool execution status, only set when `kind === 'tool'`. */
  status?: ToolStatus;
  node: ReactNode;
}

/**
 * Flatten a turn's agent content into a flat list of timeline nodes. Each text
 * paragraph, reasoning block, and tool call becomes its own node so the rail can
 * mark every step of the agent's work — matching the transcript timeline UI.
 */
function buildItems(
  messages: UiMessage[],
  tools: Record<string, ToolExec>,
): TimelineItem[] {
  const items: TimelineItem[] = [];

  for (const m of messages) {
    const isSystem = m.role === 'system';
    const lastIdx = m.content.length - 1;

    m.content.forEach((block, i) => {
      const active = m.streaming && i === lastIdx;

      const text = asText(block);
      if (text) {
        if (text.text.trim().length === 0) return;
        items.push({
          key: `${m.uid}:${i}`,
          kind: isSystem ? 'system' : 'text',
          node: <MdRender>{text.text}</MdRender>,
        });
        return;
      }

      const thinking = asThinking(block);
      if (thinking) {
        // Skip empty reasoning that produced nothing (ReasoningBlock renders
        // null there) so the rail doesn't carry a dangling dot.
        if (thinking.thinking.trim().length === 0 && !active) return;
        items.push({
          key: `${m.uid}:${i}`,
          kind: 'thinking',
          node: <ReasoningBlock text={thinking.thinking} active={active} />,
        });
        return;
      }

      const call = asToolCall(block);
      if (call) {
        const tool = tools[call.id];
        items.push({
          key: call.id ?? `${m.uid}:${i}`,
          kind: 'tool',
          status: tool?.status ?? 'running',
          node: (
            <ExecBlock tool={tool} name={call.name} args={call.arguments} />
          ),
        });
        return;
      }
    });

    // Streaming reply that hasn't emitted any content yet — a blinking caret
    // keeps the rail alive until the first block arrives.
    if (m.streaming && m.content.length === 0) {
      items.push({
        key: `${m.uid}:caret`,
        kind: 'caret',
        node: <span className="caret-blink" />,
      });
    }
  }

  return items;
}

function propsEqual(a: AgentTimelineProps, b: AgentTimelineProps): boolean {
  if (a.tools !== b.tools) return false;
  if (a.messages.length !== b.messages.length) return false;
  // The reducer keeps unchanged messages referentially stable, so a shallow
  // element compare lets completed turns skip re-rendering while another turn
  // streams.
  for (let i = 0; i < a.messages.length; i++) {
    if (a.messages[i] !== b.messages[i]) return false;
  }
  return true;
}

export const AgentTimeline = memo(function AgentTimeline({
  messages,
  tools,
}: AgentTimelineProps) {
  const items = buildItems(messages, tools);
  if (items.length === 0) return null;

  return (
    <div className="agent-timeline">
      <div className="tl-items">
        {items.map((item) => (
          <div
            key={item.key}
            className={`tl-item tl-${item.kind}${
              item.status ? ` tl-${item.status}` : ''
            }`}>
            <span className="tl-rail" aria-hidden>
              <span className="tl-dot" />
            </span>
            <div className="tl-body">{item.node}</div>
          </div>
        ))}
      </div>
    </div>
  );
}, propsEqual);
