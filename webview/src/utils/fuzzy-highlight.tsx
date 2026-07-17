export function fuzzyHighlight(
  text: string,
  query: string,
): { matched: boolean; nodes: React.ReactNode } {
  if (!query) return { matched: true, nodes: text };
  const q = query.toLowerCase();
  const t = text.toLowerCase();
  const nodes: React.ReactNode[] = [];
  let qi = 0;
  let plain = '';
  let hit = '';
  const flushPlain = () => {
    if (plain) {
      nodes.push(plain);
      plain = '';
    }
  };
  const flushHit = () => {
    if (hit) {
      nodes.push(
        <span key={nodes.length} className="fuzzy-hl">
          {hit}
        </span>,
      );
      hit = '';
    }
  };
  for (let i = 0; i < text.length; i++) {
    if (qi < q.length && t[i] === q[qi]) {
      flushPlain();
      hit += text[i];
      qi++;
    } else {
      flushHit();
      plain += text[i];
    }
  }
  flushPlain();
  flushHit();
  return { matched: qi === q.length, nodes: <>{nodes}</> };
}
