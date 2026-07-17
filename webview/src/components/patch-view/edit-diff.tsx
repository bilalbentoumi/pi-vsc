import './edit-diff.scss';

interface Edit {
  oldText: string;
  newText: string;
}

function diffLines(
  oldText: string,
  newText: string,
): { context: string[]; removed: string[]; added: string[] } {
  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  let start = 0;
  while (
    start < oldLines.length &&
    start < newLines.length &&
    oldLines[start] === newLines[start]
  )
    start++;
  let endO = oldLines.length;
  let endN = newLines.length;
  while (
    endO > start &&
    endN > start &&
    oldLines[endO - 1] === newLines[endN - 1]
  ) {
    endO--;
    endN--;
  }
  return {
    context: oldLines.slice(Math.max(0, start - 2), start),
    removed: oldLines.slice(start, endO),
    added: newLines.slice(start, endN),
  };
}

function DiffBlock({ oldText, newText }: Edit) {
  const { context, removed, added } = diffLines(oldText, newText);
  return (
    <pre className="patch-container">
      {context.map((l, i) => (
        <div key={`c${i}`} className="patch-line patch-line-context">
          {' '}
          {l}
        </div>
      ))}
      {removed.map((l, i) => (
        <div key={`d${i}`} className="patch-line patch-line-del">
          - {l}
        </div>
      ))}
      {added.map((l, i) => (
        <div key={`a${i}`} className="patch-line patch-line-add">
          + {l}
        </div>
      ))}
    </pre>
  );
}

export function PatchView({ edits }: { edits: Edit[] }) {
  if (edits.length === 0) return null;
  return (
    <div className="patch-stats">
      {edits.map((e, i) => (
        <DiffBlock
          key={i}
          oldText={e.oldText ?? ''}
          newText={e.newText ?? ''}
        />
      ))}
    </div>
  );
}
