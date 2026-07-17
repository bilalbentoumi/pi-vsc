import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { LuCheck, LuKeyRound, LuLock, LuX } from 'react-icons/lu';
import type {
  ProviderLoginMethod,
  ProviderLoginTransport,
} from '../../../../../shared/protocol';
import { actions } from '../../../apis/actions';
import { onHostMessage } from '../../../apis/vscode';
import { useEscapeKey } from '../../../hooks/use-escape-key';
import { useProviderLoginStore } from '../../../stores/provider-login-store';
import { Button } from '../button';
import {
  API_KEY_PROVIDERS,
  isConfigured,
  ProviderDef,
  SUBSCRIPTION_PROVIDERS,
} from './providers';
import './provider-login-dialog.scss';

type Step =
  | 'method'
  | 'provider-list'
  | 'api-key-entry'
  | 'subscription-list'
  | 'subscription-transport'
  | 'subscription-ghe'
  | 'restarting'
  | 'done'
  | 'error';

interface Head {
  title: string;
  subtitle: string;
}

export function AuthDialog() {
  const open = useProviderLoginStore((s) => s.open);
  const close = useProviderLoginStore((s) => s.close);
  const configured = useProviderLoginStore((s) => s.configured);
  const setConfigured = useProviderLoginStore((s) => s.setConfigured);

  const [step, setStep] = useState<Step>('method');
  const [provider, setProvider] = useState<ProviderDef | null>(null);
  const [apiKey, setApiKey] = useState('');
  const [gheHost, setGheHost] = useState('');
  const [error, setError] = useState('');
  /** True while an API-key login is awaiting the host's result. */
  const pendingRef = useRef(false);

  // Escape closes only when not mid-restart (avoids abandoning an in-flight login).
  useEscapeKey(close, open && step !== 'restarting');

  // On open: reset navigation, fetch auth.json status, and react to login results.
  useEffect(() => {
    if (!open) return;
    setStep('method');
    setProvider(null);
    setApiKey('');
    setGheHost('');
    setError('');
    pendingRef.current = false;
    actions.requestAuthStatus();
    return onHostMessage((m) => {
      if (m.type === 'authStatus') {
        setConfigured(m.status.providers);
      } else if (m.type === 'providerLoginResult') {
        // Ignore results for a login we're no longer waiting on (e.g. the
        // dialog was dismissed mid-restart and reopened).
        if (!pendingRef.current) return;
        pendingRef.current = false;
        if (m.result.ok) {
          setStep('done');
        } else {
          setError(m.result.error ?? 'Provider login failed.');
          setStep('error');
        }
      }
    });
  }, [open, setConfigured]);

  if (!open) return null;

  const chooseMethod = (m: ProviderLoginMethod) => {
    setStep(m === 'subscription' ? 'subscription-list' : 'provider-list');
  };

  const chooseListProvider = (p: ProviderDef) => {
    setProvider(p);
    setApiKey('');
    setStep('api-key-entry');
  };

  const chooseSubscription = (p: ProviderDef) => {
    setProvider(p);
    if (p.id === 'github-copilot') {
      setGheHost('');
      setStep('subscription-ghe');
    } else {
      setStep('subscription-transport');
    }
  };

  const submitApiKey = () => {
    const key = apiKey.trim();
    if (!provider || !key) return;
    actions.providerLogin({
      kind: 'apiKey',
      providerId: provider.id,
      providerLabel: provider.label,
      apiKey: key,
    });
    // The host writes auth.json then auto-restarts Pi; show progress until it
    // reports back with a `providerLoginResult`.
    setError('');
    pendingRef.current = true;
    setStep('restarting');
  };

  const submitTransport = (transport: ProviderLoginTransport) => {
    if (!provider) return;
    actions.providerLogin({
      kind: 'oauth',
      providerId: provider.id,
      providerLabel: provider.label,
      transport,
    });
    close();
  };

  const submitGhe = () => {
    if (!provider) return;
    actions.providerLogin({
      kind: 'oauth',
      providerId: provider.id,
      providerLabel: provider.label,
      gheHost: gheHost.trim() || undefined,
    });
    close();
  };

  const head: Head | null = (() => {
    switch (step) {
      case 'provider-list':
        return {
          title: 'Choose an API key provider',
          subtitle: 'Pick the provider you want Pi to authenticate.',
        };
      case 'subscription-list':
        return {
          title: 'Choose a subscription provider',
          subtitle: 'Pick the provider you want Pi to authenticate.',
        };
      case 'api-key-entry':
        return {
          title: `Enter API key for ${provider?.label ?? ''}`,
          subtitle: 'The key will be saved to auth.json.',
        };
      case 'subscription-transport':
        return {
          title: `Logging in to ${provider?.label ?? ''}`,
          subtitle: 'Follow the provider prompts to complete authentication.',
        };
      case 'subscription-ghe':
        return {
          title: 'Logging in to GitHub Copilot',
          subtitle: 'Follow the provider prompts to complete authentication.',
        };
      case 'restarting':
        return {
          title: `Saved ${provider?.label ?? 'provider'} credentials`,
          subtitle: 'Restarting Pi so the model list can refresh…',
        };
      case 'done':
        return {
          title: `${provider?.label ?? 'Provider'} is ready`,
          subtitle: 'Pi has reloaded the available models.',
        };
      case 'error':
        return {
          title: `Could not log in to ${provider?.label ?? 'provider'}`,
          subtitle: error || 'Provider login failed.',
        };
      default:
        return null;
    }
  })();

  const renderRow = (p: ProviderDef, onSelect: (p: ProviderDef) => void) => (
    <button
      key={p.id}
      type="button"
      className="auth-row"
      onClick={() => onSelect(p)}>
      <span className="auth-row-label">{p.label}</span>
      {isConfigured(p, configured) && (
        <span className="auth-row-badge">Configured in auth.json</span>
      )}
    </button>
  );

  return createPortal(
    <div className="auth-overlay" onClick={close}>
      <div
        className="auth-dialog"
        role="dialog"
        aria-modal="true"
        aria-label="Provider Login"
        onClick={(e) => e.stopPropagation()}>
        <div className="auth-titlebar">
          <span className="auth-titlebar-title">Provider Login</span>
          <button
            type="button"
            className="auth-close"
            aria-label="Close"
            onClick={close}>
            <LuX size={16} />
          </button>
        </div>

        <div className="auth-body">
          {head && (
            <div className="auth-head">
              <span className="auth-head-icon">
                <LuKeyRound size={16} />
              </span>
              <div className="auth-head-text">
                <div className="auth-head-title">{head.title}</div>
                <div className="auth-head-subtitle">{head.subtitle}</div>
              </div>
            </div>
          )}

          {step === 'method' && (
            <div className="auth-options">
              <button
                type="button"
                className="auth-option"
                onClick={() => chooseMethod('subscription')}>
                <span className="auth-option-icon">
                  <LuLock size={16} />
                </span>
                <span className="auth-option-text">
                  <span className="auth-option-title">Use a subscription</span>
                  <span className="auth-option-desc">
                    Sign in with a provider account.
                  </span>
                </span>
              </button>
              <button
                type="button"
                className="auth-option"
                onClick={() => chooseMethod('apiKey')}>
                <span className="auth-option-icon">
                  <LuKeyRound size={16} />
                </span>
                <span className="auth-option-text">
                  <span className="auth-option-title">Use an API key</span>
                  <span className="auth-option-desc">
                    Save a provider key to auth.json.
                  </span>
                </span>
              </button>
            </div>
          )}

          {step === 'provider-list' && (
            <>
              <div className="auth-list">
                {API_KEY_PROVIDERS.map((p) => renderRow(p, chooseListProvider))}
              </div>
              <div className="auth-footer">
                <Button variant="secondary" onClick={() => setStep('method')}>
                  Switch method
                </Button>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === 'subscription-list' && (
            <>
              <div className="auth-list">
                {SUBSCRIPTION_PROVIDERS.map((p) =>
                  renderRow(p, chooseSubscription),
                )}
              </div>
              <div className="auth-footer">
                <Button variant="secondary" onClick={() => setStep('method')}>
                  Switch method
                </Button>
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === 'api-key-entry' && (
            <>
              <input
                className="auth-input"
                type="password"
                autoFocus
                autoComplete="off"
                spellCheck={false}
                placeholder="API key"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') submitApiKey();
                }}
              />
              <div className="auth-actions">
                <Button
                  variant="primary"
                  disabled={!apiKey.trim()}
                  onClick={submitApiKey}>
                  Save key
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => setStep('provider-list')}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === 'subscription-transport' && (
            <>
              <div className="auth-list">
                <button
                  type="button"
                  className="auth-row"
                  onClick={() => submitTransport('browser')}>
                  <span className="auth-row-label">
                    Browser login (default)
                  </span>
                </button>
                <button
                  type="button"
                  className="auth-row"
                  onClick={() => submitTransport('device')}>
                  <span className="auth-row-label">
                    Device code login (headless)
                  </span>
                </button>
              </div>
              <div className="auth-footer">
                <Button
                  variant="ghost"
                  onClick={() => setStep('subscription-list')}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === 'subscription-ghe' && (
            <>
              <div className="auth-inline-form">
                <input
                  className="auth-input"
                  type="text"
                  autoFocus
                  autoComplete="off"
                  spellCheck={false}
                  placeholder="company.ghe.com"
                  value={gheHost}
                  onChange={(e) => setGheHost(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') submitGhe();
                  }}
                />
                <div className="auth-actions">
                  <Button variant="primary" onClick={submitGhe}>
                    Continue
                  </Button>
                  <Button
                    variant="ghost"
                    onClick={() => setStep('subscription-list')}>
                    Cancel
                  </Button>
                </div>
              </div>
              <div className="auth-footer">
                <Button variant="ghost" onClick={close}>
                  Cancel
                </Button>
              </div>
            </>
          )}

          {step === 'restarting' && (
            <div className="auth-status-row">
              <span className="auth-spinner" aria-hidden="true" />
              <span className="auth-status-label">Restarting Pi…</span>
            </div>
          )}

          {step === 'done' && (
            <>
              <div className="auth-status-row auth-status-done">
                <span className="auth-status-check">
                  <LuCheck size={14} />
                </span>
                <span className="auth-status-label">
                  Provider login complete.
                </span>
              </div>
              <div className="auth-footer">
                <Button variant="primary" autoFocus onClick={close}>
                  Done
                </Button>
              </div>
            </>
          )}

          {step === 'error' && (
            <div className="auth-footer">
              <Button
                variant="secondary"
                onClick={() => setStep('api-key-entry')}>
                Try again
              </Button>
              <Button variant="ghost" onClick={close}>
                Close
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}
