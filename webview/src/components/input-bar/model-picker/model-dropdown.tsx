import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {
  LuBrain,
  LuChevronDown,
  LuChevronUp,
  LuClipboardList,
  LuCopy,
  LuCornerDownLeft,
  LuFileText,
  LuKeyRound,
  LuRefreshCw,
  LuSearch,
} from 'react-icons/lu';
import type { ModelInfo } from '../../../../../shared/protocol';
import { actions } from '../../../apis/actions';
import { useChatState } from '../../../contexts/chat-context';
import { openProviderLogin } from '../../../stores/provider-login-store';
import { fuzzyHighlight } from '../../../utils/fuzzy-highlight';
import { ProviderIcon } from '../../../utils/provider-icon';
import { Button } from '../../ui/button';
import { ContextMenuItem, useCtxMenu } from '../../ui/ctx-menu';
import { Flyout } from '../../ui/flyout';
import { Tooltip } from '../../ui/tooltip';
import './picker-dropdown.scss';

function formatCtx(cw: unknown): string | null {
  const n = Number(cw);
  if (!Number.isFinite(n) || n <= 0) return null;
  if (n >= 1_000_000) {
    const m = n / 1_000_000;
    return `${Number.isInteger(m) ? m : m.toFixed(1)}M`;
  }
  return `${Math.round(n / 1000)}K`;
}

function formatModelDetails(m: ModelInfo): string {
  const lines = [
    `Name: ${m.name || m.id}`,
    `ID: ${m.id}`,
    `Provider: ${m.provider}`,
  ];
  if (m.api) lines.push(`API: ${m.api}`);
  const cw = Number(m.contextWindow);
  if (Number.isFinite(cw) && cw > 0) {
    lines.push(`Context window: ${cw.toLocaleString()}`);
  }
  if (m.baseUrl) lines.push(`Base URL: ${m.baseUrl}`);
  return lines.join('\n');
}

function ModelHoverCard({ model }: { model: ModelInfo }) {
  const title = model.name || model.id;
  const context = formatCtx(model.contextWindow);
  return (
    <div className="picker-hover-card">
      <div className="picker-hover-head">
        <span className="picker-hover-glyph">
          <ProviderIcon provider={model.provider} model={title} />
        </span>
        <div className="picker-hover-heading">
          <div className="picker-hover-title">{title}</div>
          <div className="picker-hover-sub">{model.provider}</div>
        </div>
      </div>
      <dl className="picker-hover-rows">
        {context && (
          <div className="picker-hover-row">
            <dt>Context</dt>
            <dd>{context} tokens</dd>
          </div>
        )}
        <div className="picker-hover-row">
          <dt>Reasoning</dt>
          <dd className={`picker-hover-flag ${model.reasoning ? 'on' : 'off'}`}>
            <span className="picker-hover-dot" />
            {model.reasoning ? 'Enabled' : 'Disabled'}
          </dd>
        </div>
        {model.api && (
          <div className="picker-hover-row">
            <dt>API</dt>
            <dd>{model.api}</dd>
          </div>
        )}
      </dl>
      <div className="picker-hover-foot">Right-click for options</div>
    </div>
  );
}

export function ModelPicker() {
  const { models, session } = useChatState();
  const current = session?.model ?? null;

  const searchRef = useRef<HTMLInputElement>(null);
  const resultsRef = useRef<HTMLDivElement>(null);

  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(0);
  const [shadow, setShadow] = useState({ top: false, bottom: false });

  const menuItems = useMemo<ContextMenuItem[]>(() => {
    const name = current?.name || current?.id || '';
    const id = current?.id ?? '';
    const provider = current?.provider ?? '';
    return [
      {
        label: 'Log in to provider',
        icon: LuKeyRound,
        onSelect: () => openProviderLogin(),
      },
      {
        label: 'Refresh model list',
        icon: LuRefreshCw,
        onSelect: () => actions.requestModels(),
      },
      {
        label: 'Copy model name',
        hint: name ? `(${name})` : undefined,
        icon: LuCopy,
        disabled: !name,
        separatorBefore: true,
        onSelect: () => actions.copyText(name),
      },
      {
        label: 'Copy model ID',
        hint: id ? `(${id})` : undefined,
        icon: LuCopy,
        disabled: !id,
        onSelect: () => actions.copyText(id),
      },
      {
        label: 'Copy provider',
        hint: provider ? `(${provider})` : undefined,
        icon: LuCopy,
        disabled: !provider,
        onSelect: () => actions.copyText(provider),
      },
      {
        label: 'Copy model details',
        icon: LuClipboardList,
        disabled: !current,
        onSelect: () =>
          current && actions.copyText(formatModelDetails(current)),
      },
      {
        label: 'Open Pi auth.json',
        icon: LuFileText,
        separatorBefore: true,
        onSelect: () => actions.openAuthFile(),
      },
    ];
  }, [current]);

  const contextMenu = useCtxMenu(menuItems);

  const groups = useMemo(() => {
    const filtered = query
      ? models.filter((m) => {
          const label = m.name || m.id;
          return (
            fuzzyHighlight(label, query).matched ||
            fuzzyHighlight(m.id, query).matched
          );
        })
      : models;
    const order: string[] = [];
    const byProvider = new Map<string, ModelInfo[]>();
    for (const m of filtered) {
      if (!byProvider.has(m.provider)) {
        byProvider.set(m.provider, []);
        order.push(m.provider);
      }
      byProvider.get(m.provider)!.push(m);
    }
    return order.map((provider) => ({
      provider,
      items: byProvider.get(provider)!,
    }));
  }, [models, query]);

  const flat = useMemo(() => groups.flatMap((g) => g.items), [groups]);

  const isActive = useCallback(
    (m: ModelInfo) =>
      !!current && m.provider === current.provider && m.id === current.id,
    [current],
  );

  const select = useCallback((m: ModelInfo) => {
    actions.setModel(m.provider, m.id);
    setOpen(false);
  }, []);

  const updateShadows = useCallback(() => {
    const el = resultsRef.current;
    if (!el) return;
    const top = el.scrollTop > 1;
    const bottom = el.scrollTop + el.clientHeight < el.scrollHeight - 1;
    setShadow((s) =>
      s.top === top && s.bottom === bottom ? s : { top, bottom },
    );
  }, []);

  const scrollFocusedIntoView = useCallback(() => {
    const list = resultsRef.current;
    if (!list) return;
    const el = list.querySelector<HTMLElement>(`[data-idx="${focused}"]`);
    if (!el) return;
    const stickyH =
      list.querySelector<HTMLElement>('.picker-group-hdr')?.offsetHeight ?? 0;
    const listRect = list.getBoundingClientRect();
    const elRect = el.getBoundingClientRect();
    const pad = 4;
    const topLimit = listRect.top + stickyH + pad;
    const bottomLimit = listRect.bottom - pad;
    if (elRect.top < topLimit) {
      list.scrollTop -= topLimit - elRect.top;
    } else if (elRect.bottom > bottomLimit) {
      list.scrollTop += elRect.bottom - bottomLimit;
    }
  }, [focused]);

  useLayoutEffect(() => {
    if (!open) return;
    setQuery('');
    const activeIdx = flat.findIndex(isActive);
    setFocused(activeIdx >= 0 ? activeIdx : 0);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const raf = requestAnimationFrame(() => {
      searchRef.current?.focus();
      updateShadows();
    });
    return () => cancelAnimationFrame(raf);
  }, [open, updateShadows]);

  useEffect(() => {
    if (focused >= flat.length) setFocused(flat.length ? flat.length - 1 : 0);
  }, [flat.length, focused]);

  useEffect(() => {
    if (!open) return;
    scrollFocusedIntoView();
    updateShadows();
  }, [focused, open, scrollFocusedIntoView, updateShadows]);

  const currentLabel = current?.name || current?.id || 'Select model';

  if (models.length === 0) {
    return (
      <>
        <Tooltip
          className="picker-login-hover"
          side="top"
          align="start"
          gap={8}
          content={
            <div className="picker-login-card">
              <div className="picker-login-title">Log in to a provider</div>
              <div className="picker-login-sub">
                Use OAuth or an API key. Pintra saves credentials in auth.json.
              </div>
            </div>
          }>
          <Button
            variant="trigger"
            startIcon={LuKeyRound}
            onClick={() => openProviderLogin()}
            onContextMenu={contextMenu.open}>
            Log in
          </Button>
        </Tooltip>
        {contextMenu.menu}
      </>
    );
  }

  return (
    <>
      <Flyout
        popoverClassName="picker-dropdown"
        side="top-left"
        align="start"
        minWidth={376}
        onOpenChange={setOpen}
        trigger={({ ref: pickerRef, triggerProps: pickerProps, open }) => (
          <Tooltip
            side="top"
            align="center"
            gap={8}
            disabled={!current || open || contextMenu.isOpen}
            content={current ? <ModelHoverCard model={current} /> : null}>
            <Button
              ref={pickerRef}
              variant="trigger"
              aria-haspopup="listbox"
              aria-expanded={pickerProps['aria-expanded']}
              onClick={pickerProps.onClick}
              onContextMenu={contextMenu.open}
              startIcon={
                current
                  ? () => (
                      <ProviderIcon
                        provider={current.provider}
                        model={current.name || current.id}
                      />
                    )
                  : undefined
              }
              endIcon={!open ? LuChevronUp : LuChevronDown}>
              {currentLabel}
            </Button>
          </Tooltip>
        )}>
        {({ close }) => {
          return (
            <div role="group" aria-label="Model picker">
              {/* Search Input */}
              <div className="picker-search-wrap">
                <LuSearch size={13} className="picker-search-icon" />
                <input
                  ref={searchRef}
                  autoFocus
                  type="text"
                  className="picker-search-input"
                  placeholder="Search models…"
                  value={query}
                  onChange={(e) => {
                    setQuery(e.target.value);
                    setFocused(0);
                  }}
                  onKeyDown={(e: React.KeyboardEvent) => {
                    if (e.key === 'ArrowDown') {
                      e.preventDefault();
                      setFocused((i) =>
                        flat.length ? (i + 1) % flat.length : 0,
                      );
                    } else if (e.key === 'ArrowUp') {
                      e.preventDefault();
                      setFocused((i) =>
                        flat.length ? (i - 1 + flat.length) % flat.length : 0,
                      );
                    } else if (e.key === 'Enter') {
                      e.preventDefault();
                      const m = flat[focused];
                      if (m) {
                        select(m);
                        close();
                      }
                    }
                  }}
                />
                <span
                  className="picker-count"
                  title={
                    query
                      ? `${flat.length} of ${models.length} models`
                      : `${models.length} models`
                  }>
                  {query ? `${flat.length}/${models.length}` : models.length}
                </span>
              </div>

              {/* Model List */}
              <div
                ref={resultsRef}
                className={`picker-list picker-scroll-host${
                  shadow.top ? ' picker-scroll-top' : ''
                }${shadow.bottom ? ' picker-scroll-bot' : ''}`}
                onScroll={updateShadows}>
                {flat.length === 0 ? (
                  <div className="picker-empty">
                    <LuSearch size={16} className="picker-empty-icon" />
                    <div className="picker-empty-title">No models found</div>
                    {query && (
                      <div className="picker-empty-sub">
                        Nothing matches “{query}”
                      </div>
                    )}
                  </div>
                ) : (
                  groups.map((g) => (
                    <Fragment key={g.provider}>
                      <div className="picker-group-hdr">
                        <span className="picker-group-tick" />
                        <span className="picker-group-name">{g.provider}</span>
                        <span className="picker-group-count">
                          {g.items.length}
                        </span>
                      </div>
                      {g.items.map((m) => {
                        const idx = flat.indexOf(m);
                        const active = isActive(m);
                        const label = m.name || m.id;
                        const ctx = formatCtx(m.contextWindow);
                        return (
                          <div
                            key={`${m.provider}::${m.id}`}
                            data-idx={idx}
                            role="button"
                            tabIndex={-1}
                            style={{ '--i': idx } as React.CSSProperties}
                            className={`picker-item ${active ? 'active' : ''} ${idx === focused ? 'focused' : ''}`}
                            onClick={() => {
                              select(m);
                              close();
                            }}
                            onMouseEnter={() => setFocused(idx)}>
                            <span className="picker-item-glyph">
                              <ProviderIcon
                                provider={m.provider}
                                model={m.name || m.id}
                              />
                            </span>
                            <span className="picker-item-name">
                              {fuzzyHighlight(label, query).nodes}
                            </span>
                            <span className="picker-item-meta">
                              {m.reasoning && (
                                <span
                                  className="picker-chip picker-chip-reason"
                                  title="Supports reasoning">
                                  <LuBrain size={11} />
                                </span>
                              )}
                              {ctx && (
                                <span
                                  className="picker-chip picker-chip-ctx"
                                  title="Context window">
                                  {ctx}
                                </span>
                              )}
                            </span>
                          </div>
                        );
                      })}
                    </Fragment>
                  ))
                )}
              </div>

              {/* Keyboard hint footer */}
              {flat.length > 0 && (
                <div className="picker-foot">
                  <span className="picker-hint">
                    <kbd className="picker-kbd">↑</kbd>
                    <kbd className="picker-kbd">↓</kbd>
                    Navigate
                  </span>
                  <span className="picker-hint">
                    <kbd className="picker-kbd">
                      <LuCornerDownLeft size={11} />
                    </kbd>
                    Select
                  </span>
                  <span className="picker-hint picker-hint-end">
                    <kbd className="picker-kbd">Esc</kbd>
                    Close
                  </span>
                </div>
              )}
            </div>
          );
        }}
      </Flyout>
      {contextMenu.menu}
    </>
  );
}
