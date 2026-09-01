interface Backend {
  readonly name: string;
  readonly note: string;
}

// Three copy sites on /ag-ui say "seven" — the page spec ties this list's
// length to that word. Adding a runtime here fails that test until the copy
// updates. Honest counts only.
export const BACKENDS: readonly Backend[] = [
  { name: 'LangGraph', note: 'Python / TS' },
  { name: 'CrewAI', note: 'Python' },
  { name: 'Mastra', note: 'TypeScript' },
  { name: 'MS Agent Framework', note: '.NET / Python' },
  { name: 'AG2', note: 'Python' },
  { name: 'Pydantic AI', note: 'Python' },
  { name: 'AWS Strands', note: 'Python' },
];

export function BackendsGrid() {
  return (
    <div className="backends-grid">
      {BACKENDS.map((b) => (
        <div key={b.name} className="backends-grid-item">
          <div className="backends-grid-name">
            {b.name}
          </div>
          <div className="backends-grid-note">
            {b.note}
          </div>
        </div>
      ))}
    </div>
  );
}
