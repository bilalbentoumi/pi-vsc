import { forwardRef, useCallback, useEffect, useRef, useState } from 'react';
import { LuArrowUp, LuPaperclip, LuSquare, LuX } from 'react-icons/lu';
import type { Attachment } from '../../../../../shared/protocol';
import { MAX_ATTACHMENT_BYTES } from '../../../../../shared/constants';
import { actions } from '../../../apis/actions';
import { useChatDispatch, useChatState } from '../../../contexts/chat-context';
import { useSlashCommands } from '../../../hooks/use-slash-commands';
import type { SlashCommand } from '../cmd-menu';
import { CommandMenu } from '../cmd-menu';
import { openProviderLogin } from '../../../stores/provider-login-store';
import { IconButton } from '../../ui/button';
import { ContextMeter } from '../ctx-meter';
import { ModelPicker } from '../model-picker';
import { ReasoningSelect } from '../reasoning-select';
import { formatByteSize } from '../../../utils/format';
import './input-bar.scss';

/** Read a clipboard image blob into an Attachment (base64 data + data URL). */
function imageToAttachment(file: File): Promise<Attachment> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.onload = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.slice(dataUrl.indexOf(',') + 1);
      const ext = file.type.split('/')[1] || 'png';
      resolve({
        id: `att_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`,
        name: file.name || `pasted-${Date.now().toString(36)}.${ext}`,
        mimeType: file.type || 'image/png',
        data: base64,
        dataUrl,
        size: file.size,
      });
    };
    reader.readAsDataURL(file);
  });
}

export const InputBar = forwardRef<HTMLTextAreaElement, {}>(
  function InputBar(_props, ref) {
    const { streaming, status, commands, pendingAttachments } = useChatState();
    const dispatch = useChatDispatch();
    const ready = status.phase === 'ready';

    const [input, setInput] = useState('');
    const localRef = useRef<HTMLTextAreaElement | null>(null);

    const setRefs = (el: HTMLTextAreaElement | null) => {
      localRef.current = el;
      if (typeof ref === 'function') ref(el);
      else if (ref)
        (ref as React.MutableRefObject<HTMLTextAreaElement | null>).current =
          el;
    };

    const submit = (text?: string) => {
      const message = (text ?? input).trim();
      if (!message && pendingAttachments.length === 0) return;
      if (streaming) {
        actions.steer(message);
      } else {
        // Leave the attachments in `pendingAttachments`: the store links them to
        // the user message's uid when its `message_start` event arrives, which is
        // what lets the bubble render them.
        actions.sendMessage(
          message,
          pendingAttachments.length > 0 ? pendingAttachments : undefined,
        );
      }
      setInput('');
    };

    const handleSlashSelect = useCallback(
      (command: SlashCommand) => {
        // Handle built-in commands that trigger actions
        switch (command.clean) {
          case 'clear':
            actions.newChat();
            setInput('');
            break;
          case 'compact':
            actions.compact();
            setInput('');
            break;
          case 'login':
            openProviderLogin();
            setInput('');
            break;
          default:
            // For runtime commands, send as text
            submit(`/${command.clean}`);
        }
      },
      [streaming, input],
    );

    const slash = useSlashCommands({
      commands,
      value: input,
      onSelect: handleSlashSelect,
    });

    // Request commands from the host on mount
    useEffect(() => {
      actions.requestCommands?.();
    }, []);

    const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      // First, let the slash command handler try to consume the event
      if (slash.onKeyDown(e)) return;

      // @ key triggers file picker when at the start of input or after a space.
      if (e.key === '@') {
        const textarea = localRef.current;
        if (textarea) {
          const pos = textarea.selectionStart;
          const before = input.slice(0, pos);
          if (before.length === 0 || before.endsWith(' ')) {
            e.preventDefault();
            actions.pickFiles();
            return;
          }
        }
      }

      if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
        e.preventDefault();
        submit();
      }
    };

    const onPaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const items = e.clipboardData?.items;
      if (!items) return;
      const images: File[] = [];
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        if (item.kind === 'file' && item.type.startsWith('image/')) {
          const file = item.getAsFile();
          if (file) images.push(file);
        }
      }
      // No image in the clipboard — let the textarea paste text as usual.
      if (images.length === 0) return;

      e.preventDefault();
      const accepted = images.filter((f) => f.size <= MAX_ATTACHMENT_BYTES);
      if (accepted.length === 0) return;
      void Promise.all(accepted.map(imageToAttachment))
        .then((attachments) =>
          dispatch({ type: 'addPendingAttachments', attachments }),
        )
        .catch(() => {
          /* unreadable clipboard blob — nothing to attach */
        });
    };

    const removeAttachment = useCallback(
      (id: string) => {
        dispatch({
          type: 'setPendingAttachments',
          attachments: pendingAttachments.filter((a) => a.id !== id),
        });
      },
      [pendingAttachments, dispatch],
    );

    return (
      <div className="input-bar">
        {pendingAttachments.length > 0 && (
          <div className="input-attachments">
            {pendingAttachments.map((att) => (
              <div key={att.id} className="attach-chip">
                {att.dataUrl ? (
                  <img
                    src={att.dataUrl}
                    alt={att.name}
                    className="attach-thumb"
                  />
                ) : (
                  <span className="attach-icon">
                    {att.name.split('.').pop()?.toUpperCase() ?? '?'}
                  </span>
                )}
                <span className="attach-info">
                  <span className="attach-name" title={att.name}>
                    {att.name}
                  </span>
                  <span className="attach-size">
                    {formatByteSize(att.size)}
                  </span>
                </span>
                <button
                  className="attach-remove"
                  onClick={() => removeAttachment(att.id)}
                  title="Remove">
                  <LuX size={12} />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="input-wrap">
          <textarea
            ref={setRefs}
            className="input-field"
            placeholder={
              !ready
                ? 'Waiting for runtime…'
                : streaming
                  ? 'Steer the agent (Esc to stop)…'
                  : 'Ask anything, @ to add files, / for commands'
            }
            rows={2}
            disabled={!ready}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            onPaste={onPaste}
          />
          {slash.visible && (
            <CommandMenu
              items={slash.items}
              query={slash.query}
              focused={slash.focused}
              onHover={slash.onHover}
              onSelect={handleSlashSelect}
              textareaRef={localRef}
            />
          )}
        </div>
        <hr className="input-divider" />
        <div className="input-toolbar">
          <div className="input-toolbar-group">
            <IconButton
              variant="ghost"
              icon={LuPaperclip}
              label="Attach files"
              tooltip="Attach files (@)"
              onClick={() => actions.pickFiles()}
            />
            <span className="toolbar-hide-narrow">
              <ModelPicker />
            </span>
            <span className="toolbar-hide-narrow">
              <ReasoningSelect />
            </span>
          </div>
          <div className="input-toolbar-group">
            <ContextMeter />
            {streaming ? (
              <IconButton
                variant="error"
                icon={LuSquare}
                label="Stop"
                tooltip="Stop (Esc)"
                onClick={() => actions.abort()}
              />
            ) : (
              <IconButton
                variant="contained"
                icon={LuArrowUp}
                label="Send (Enter)"
                disabled={
                  !ready || (!input.trim() && pendingAttachments.length === 0)
                }
                onClick={() => submit()}
              />
            )}
          </div>
        </div>
      </div>
    );
  },
);
