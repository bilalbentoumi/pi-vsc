import { memo, useState } from 'react';
import { LuCheck, LuCopy, LuGitBranch } from 'react-icons/lu';
import type { Attachment, ContentBlock } from '../../../../shared/protocol';
import {
  asText,
  asThinking,
  asToolCall,
  textOfContent,
} from '../../../../shared/blocks';
import { actions } from '../../apis/actions';
import { useChatState } from '../../contexts/chat-context';
import type { ToolExec, UiMessage } from '../../store';
import { formatByteSize } from '../../utils/format';
import { clockTime } from '../../utils/time';
import { IconButton } from '../ui/button';
import { MdRender } from '../md-render';
import { ReasoningBlock } from '../reasoning-block';
import { ExecBlock } from '../exec-view';
import './message-view.scss';

interface MessageViewProps {
  message: UiMessage;
  tools: Record<string, ToolExec>;
}

function UserMessageActions({ message }: { message: UiMessage }) {
  const [copied, setCopied] = useState(false);

  const onCopy = () => {
    actions.copyText(textOfContent(message.content).trim());
    setCopied(true);
    setTimeout(() => setCopied(false), 1400);
  };

  return (
    <div className="entry-actions">
      {message.timestamp != null && (
        <span className="entry-time">{clockTime(message.timestamp)}</span>
      )}
      <IconButton
        variant="ghost"
        size="sm"
        icon={copied ? LuCheck : LuCopy}
        label={copied ? 'Copied' : 'Copy message'}
        className={`entry-action${copied ? ' is-copied' : ''}`}
        onClick={onCopy}
      />
      <IconButton
        variant="ghost"
        size="sm"
        icon={LuGitBranch}
        label="Branch from here"
        tooltip="Branch conversation from an earlier message"
        className="entry-action"
        onClick={() => actions.openForkPicker()}
      />
    </div>
  );
}

function AttachmentGallery({ attachments }: { attachments: Attachment[] }) {
  return (
    <div className="entry-attachments">
      {attachments.map((att) => (
        <div key={att.id} className="entry-attachment">
          {att.dataUrl ? (
            <img
              src={att.dataUrl}
              alt={att.name}
              className="entry-attachment-image"
            />
          ) : (
            <div className="entry-attachment-file">
              <span className="entry-attachment-ext">
                {att.name.split('.').pop()?.toUpperCase() ?? '?'}
              </span>
              <div className="entry-attachment-info">
                <span className="entry-attachment-name" title={att.name}>
                  {att.name}
                </span>
                <span className="entry-attachment-size">
                  {formatByteSize(att.size)}
                </span>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export const EntryView = memo(function EntryView({
  message,
  tools,
}: MessageViewProps) {
  const { role, content, streaming } = message;
  const { userAttachments } = useChatState();
  const isAssistant = role === 'assistant';
  const isUser = role === 'user';

  // Get attachments from local store (not stored by pi)
  const attachments = isUser ? userAttachments.get(message.uid) : undefined;

  return (
    <div
      className={`entry${isAssistant ? ' agent-entry' : ''}${
        isUser ? ' user-entry' : ''
      }`}>
      <div className="entry-body">
        {!isUser && (
          <div className="entry-role">{role === 'assistant' ? 'Pi' : role}</div>
        )}
        <div className="entry-content">
          {isUser ? (
            <div className="entry-bubble">
              {attachments && attachments.length > 0 && (
                <AttachmentGallery attachments={attachments} />
              )}
              {content.map((block, i) => renderBlock(block, i, tools))}
              <UserMessageActions message={message} />
            </div>
          ) : (
            <>
              {content.map((block, i) =>
                renderBlock(
                  block,
                  i,
                  tools,
                  streaming && i === content.length - 1,
                ),
              )}
              {streaming && content.length === 0 && (
                <span className="caret-blink" />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
});

function renderBlock(
  block: ContentBlock,
  index: number,
  tools: Record<string, ToolExec>,
  active = false,
) {
  const text = asText(block);
  if (text) return <MdRender key={index}>{text.text}</MdRender>;

  const thinking = asThinking(block);
  if (thinking)
    return (
      <ReasoningBlock key={index} text={thinking.thinking} active={active} />
    );

  const call = asToolCall(block);
  if (call)
    return (
      <ExecBlock
        key={call.id ?? index}
        tool={tools[call.id]}
        name={call.name}
        args={call.arguments}
      />
    );

  return null;
}
