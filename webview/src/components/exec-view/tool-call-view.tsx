import type { ComponentType } from 'react';
import { useState } from 'react';
import type { IconBaseProps } from 'react-icons';
import {
  LuChevronRight,
  LuEye,
  LuFilePen,
  LuFolderOpen,
  LuPencil,
  LuSearch,
  LuTerminal,
  LuWrench,
} from 'react-icons/lu';
import type { ToolExec } from '../../store';
import { PatchView } from '../patch-view';
import { CodeBlock } from '../code-block';
import './exec-block-view.scss';

interface ToolCallViewProps {
  tool: ToolExec | undefined;
  name: string;
  args?: unknown;
}

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' ? (v as Record<string, unknown>) : {};
}

function summarize(name: string, args: Record<string, unknown>): string {
  const first = (...keys: string[]) => {
    for (const k of keys) {
      const v = args[k];
      if (typeof v === 'string' && v.length > 0) return v;
    }
    return '';
  };
  switch (name) {
    case 'bash':
      return first('command', 'cmd');
    case 'read':
    case 'write':
    case 'edit':
      return first('path', 'file', 'filePath', 'file_path');
    case 'grep':
    case 'find':
      return first('pattern', 'query', 'path');
    case 'ls':
      return first('path', 'dir') || '.';
    default:
      return first('path', 'file', 'command', 'pattern', 'query', 'url');
  }
}

function extractEdits(
  args: Record<string, unknown>,
): { oldText: string; newText: string }[] {
  if (Array.isArray(args.edits)) {
    return (args.edits as any[])
      .filter((e) => e && typeof e === 'object')
      .map((e) => ({
        oldText: String(e.oldText ?? ''),
        newText: String(e.newText ?? ''),
      }));
  }
  if (typeof args.oldText === 'string' && typeof args.newText === 'string') {
    return [{ oldText: args.oldText, newText: args.newText }];
  }
  return [];
}

const TOOL_ICONS: Record<string, ComponentType<IconBaseProps>> = {
  bash: LuTerminal,
  read: LuEye,
  write: LuFilePen,
  edit: LuPencil,
  grep: LuSearch,
  find: LuFolderOpen,
  ls: LuFolderOpen,
};

const TOOL_LABELS: Record<string, string> = {
  bash: 'Terminal',
  read: 'Read',
  write: 'Write',
  edit: 'Edit',
  grep: 'Search',
  find: 'Find',
  ls: 'List',
};

const FILE_TOOLS = new Set(['read', 'write', 'edit']);

function basename(p: string): string {
  const clean = p.replace(/[/\\]+$/, '');
  const idx = Math.max(clean.lastIndexOf('/'), clean.lastIndexOf('\\'));
  return idx >= 0 ? clean.slice(idx + 1) : clean;
}

function statusClass(status: string): string {
  switch (status) {
    case 'running':
      return 'pending';
    case 'done':
      return 'success';
    case 'error':
      return 'error';
    default:
      return 'pending';
  }
}

export function ExecBlock({ tool, name, args }: ToolCallViewProps) {
  const effectiveArgs = asRecord(tool?.args ?? args);
  const status = tool?.status ?? 'running';
  const summary = summarize(name, effectiveArgs);
  const result = tool?.resultText ?? '';
  const isError = tool?.isError ?? false;

  const [expandedOverride, setExpandedOverride] = useState<boolean | null>(
    null,
  );
  const defaultExpanded = status !== 'done' || isError;
  const expanded = expandedOverride ?? defaultExpanded;

  const Icon = TOOL_ICONS[name] ?? LuWrench;
  const label = TOOL_LABELS[name] ?? name;
  const displaySummary =
    FILE_TOOLS.has(name) && summary ? basename(summary) : summary;

  return (
    <div
      className={`exec-block ${statusClass(status)}${isError ? ' error' : ''}`}
      {...(expanded ? ({ open: true } as Record<string, unknown>) : {})}>
      <button
        className="exec-header"
        onClick={() => setExpandedOverride(!expanded)}
        title={summary || undefined}
        type="button">
        <Icon className="exec-type-icon" aria-hidden />
        <span className="exec-name">{label}</span>
        {displaySummary && (
          <span className="exec-summary-text">{displaySummary}</span>
        )}
        <span className="exec-chevron" aria-hidden>
          <LuChevronRight />
        </span>
      </button>
      {/* Always mounted so collapsing can animate; the grid wrapper drives
          the height transition, the scroll layer keeps output scrollable. */}
      <div className="exec-content-wrap" aria-hidden={!expanded}>
        <div className="exec-content">
          <div className="exec-scroll">
            {renderBody(name, effectiveArgs, result, status, isError)}
          </div>
        </div>
      </div>
    </div>
  );
}

function renderBody(
  name: string,
  args: Record<string, unknown>,
  result: string,
  status: string,
  isError: boolean,
) {
  if (name === 'bash') {
    return (
      <>
        {typeof args.command === 'string' && (
          <pre className="exec-bash">$ {String(args.command)}</pre>
        )}
        {result && (
          <pre
            className={`exec-output exec-bash-out${isError ? ' exec-output-error' : ''}`}>
            {result}
          </pre>
        )}
        {!result && status === 'running' && (
          <div className="exec-running">Running…</div>
        )}
      </>
    );
  }
  if (name === 'edit') {
    const edits = extractEdits(args);
    return (
      <>
        <div className="exec-edit">
          <PatchView edits={edits} />
        </div>
        {isError && result && (
          <pre className="exec-output exec-output-error">{result}</pre>
        )}
      </>
    );
  }
  if (name === 'read') {
    if (result && !isError) {
      return (
        <CodeBlock
          code={result}
          path={summarize('read', args)}
          className="exec-output exec-output-code"
        />
      );
    }
    if (result) {
      return <pre className="exec-output exec-output-error">{result}</pre>;
    }
    return status === 'running' ? (
      <div className="exec-running">Reading…</div>
    ) : null;
  }
  if (name === 'write' && typeof args.content === 'string') {
    return (
      <>
        <div className="exec-write">
          <PatchView edits={[{ oldText: '', newText: args.content }]} />
        </div>
        {isError && result && (
          <pre className="exec-output exec-output-error">{result}</pre>
        )}
      </>
    );
  }
  return (
    <>
      {Object.keys(args).length > 1 && (
        <pre className="exec-args">{JSON.stringify(args, null, 2)}</pre>
      )}
      {result ? (
        <pre className={`exec-output${isError ? ' exec-output-error' : ''}`}>
          {result}
        </pre>
      ) : status === 'running' ? (
        <div className="exec-running">Running…</div>
      ) : null}
    </>
  );
}
