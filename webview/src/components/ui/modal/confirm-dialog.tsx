import { createPortal } from 'react-dom';
import { useEscapeKey } from '../../../hooks/use-escape-key';
import { useConfirmStore } from '../../../stores/confirm-store';
import { Button } from '../button';
import './modal-dialog.scss';

export function Modal() {
  const options = useConfirmStore((s) => s.options);
  const respond = useConfirmStore((s) => s.respond);

  useEscapeKey(() => respond(false), options !== null);

  if (!options) return null;

  return createPortal(
    <div className="modal-overlay" onClick={() => respond(false)}>
      <div
        className="modal-dialog"
        role="alertdialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}>
        <div className="modal-title">{options.title}</div>
        {options.message != null && (
          <div className="modal-message">{options.message}</div>
        )}
        <div className="modal-actions">
          <Button variant="ghost" onClick={() => respond(false)}>
            {options.cancelLabel ?? 'Cancel'}
          </Button>
          <Button
            variant={options.confirmVariant ?? 'primary'}
            autoFocus
            onClick={() => respond(true)}>
            {options.confirmLabel ?? 'Confirm'}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
