interface BoxProps {
  eyebrow: string;
  title: string;
  meta: string;
  tone?: 'neutral' | 'accent';
}

function Box({ eyebrow, title, meta, tone = 'neutral' }: BoxProps) {
  return (
    <div className="ag-ui-arch-box" data-tone={tone}>
      <span className="ag-ui-arch-box-eyebrow">
        {eyebrow}
      </span>
      <span className="ag-ui-arch-box-title">
        {title}
      </span>
      <span className="ag-ui-arch-box-meta">
        {meta}
      </span>
    </div>
  );
}

function ArrowLabel({ label, sub }: { label: string; sub: string }) {
  return (
    <div
      aria-hidden
      className="ag-ui-arch-arrow"
    >
      <span className="ag-ui-arch-arrow-label">
        {label}
      </span>
      <svg width="44" height="14" viewBox="0 0 44 14" fill="none" className="ag-ui-arch-arrow-svg">
        <path
          d="M2 7 H36 M30 2 L36 7 L30 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span className="ag-ui-arch-arrow-sub">
        {sub}
      </span>
    </div>
  );
}

export function AgUiArchDiagram() {
  return (
    <figure
      className="ag-ui-arch-figure"
    >
      <div className="ag-ui-arch-grid">
        <Box
          eyebrow="Backend"
          title="Agent runtime"
          meta="LangGraph, CrewAI, Mastra, MS Agent Fwk, Pydantic AI, …"
        />
        <ArrowLabel label="AG-UI" sub="SSE" />
        <Box
          eyebrow="Adapter"
          title="@threadplane/ag-ui"
          meta="Signal-driven reducer over AG-UI events."
          tone="accent"
        />
        <ArrowLabel label="Agent contract" sub="signals" />
        <Box
          eyebrow="Chat UI"
          title="@threadplane/chat"
          meta="<chat [agent]='…' /> + slots + themes."
        />
      </div>
      <figcaption
        className="ag-ui-arch-caption"
      >
        Backend speaks AG-UI over SSE → adapter exposes a signal-shaped Agent contract → chat UI renders.
      </figcaption>
    </figure>
  );
}
