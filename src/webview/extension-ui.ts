import * as vscode from 'vscode';
import type {
  ExtensionUiRequest,
  ExtensionUiResponse,
} from '../../shared/protocol';
import type { Logger } from '../runtime/pi-runtime';

/**
 * Map a pi `extension_ui_request` (dialogs/notifications emitted by pi extensions,
 * e.g. tool-approval prompts) to native VS Code UI, and produce the response the
 * runtime expects. Fire-and-forget methods return `null` (no response needed).
 */
export async function handleExtensionUiRequest(
  req: ExtensionUiRequest,
  _log: Logger,
): Promise<ExtensionUiResponse | null> {
  const respond = (
    extra: Partial<ExtensionUiResponse>,
  ): ExtensionUiResponse => ({
    type: 'extension_ui_response',
    id: req.id,
    ...extra,
  });

  switch (req.method) {
    case 'confirm': {
      const title = String(req.title ?? 'Confirm');
      const message = req.message ? String(req.message) : undefined;
      const pick = await vscode.window.showInformationMessage(
        title,
        { modal: true, detail: message },
        'Yes',
        'No',
      );
      if (pick === undefined) return respond({ cancelled: true });
      return respond({ confirmed: pick === 'Yes' });
    }
    case 'select': {
      const title = String(req.title ?? 'Select');
      const rawOptions = Array.isArray(req.options)
        ? (req.options as unknown[])
        : [];
      const items = rawOptions.map((opt) => normalizeOption(opt));
      const picked = await vscode.window.showQuickPick(
        items.map((i) => i.label),
        { title, placeHolder: title },
      );
      if (picked === undefined) return respond({ cancelled: true });
      const match = items.find((i) => i.label === picked);
      return respond({ value: match ? match.value : picked });
    }
    case 'input': {
      const title = String(req.title ?? 'Input');
      const value = await vscode.window.showInputBox({
        title,
        placeHolder: req.placeholder ? String(req.placeholder) : undefined,
      });
      if (value === undefined) return respond({ cancelled: true });
      return respond({ value });
    }
    case 'editor': {
      const title = String(req.title ?? 'Edit');
      const value = await vscode.window.showInputBox({
        title,
        value: req.prefill ? String(req.prefill) : undefined,
        prompt: title,
      });
      if (value === undefined) return respond({ cancelled: true });
      return respond({ value });
    }
    case 'notify': {
      const message = String(req.message ?? '');
      const kind = String(req.notifyType ?? 'info');
      if (kind === 'error') void vscode.window.showErrorMessage(message);
      else if (kind === 'warn' || kind === 'warning')
        void vscode.window.showWarningMessage(message);
      else void vscode.window.showInformationMessage(message);
      return null;
    }
    default:
      // setStatus / setTitle / setWidget / set_editor_text: no native mapping yet.
      // pi extensions emit these in a tight loop (status updates, widget
      // ticks); logging each one floods the output channel and stalls the
      // webview. Silently ignore — there is nothing actionable here.
      return null;
  }
}

function normalizeOption(opt: unknown): { label: string; value: unknown } {
  if (typeof opt === 'string') return { label: opt, value: opt };
  if (opt && typeof opt === 'object') {
    const o = opt as Record<string, unknown>;
    const label = String(o.label ?? o.title ?? o.name ?? o.value ?? '');
    return { label, value: 'value' in o ? o.value : label };
  }
  return { label: String(opt), value: opt };
}
