import { tokens } from '@ngaf/design-tokens';

interface BoxProps {
  eyebrow: string;
  title: string;
  meta: string;
  tone?: 'neutral' | 'accent';
}

function Box({ eyebrow, title, meta, tone = 'neutral' }: BoxProps) {
  const isAccent = tone === 'accent';
  return (
    <div
      style={{
        background: isAccent ? tokens.colors.accentSurface : tokens.surfaces.surface,
        border: `1px solid ${isAccent ? tokens.colors.accent + '33' : tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
        padding: '20px 22px',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        minHeight: 116,
      }}
    >
      <span
        style={{
          fontFamily: tokens.typography.eyebrow.family,
          fontSize: '0.7rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: isAccent ? tokens.colors.accent : tokens.colors.textMuted,
        }}
      >
        {eyebrow}
      </span>
      <span
        style={{
          fontFamily: tokens.typography.fontMono,
          fontSize: '0.95rem',
          fontWeight: 600,
          color: tokens.colors.textPrimary,
        }}
      >
        {title}
      </span>
      <span
        style={{
          fontSize: '0.85rem',
          lineHeight: 1.5,
          color: tokens.colors.textSecondary,
        }}
      >
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
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 4,
        color: tokens.colors.textMuted,
        padding: '0 4px',
      }}
    >
      <span
        style={{
          fontFamily: tokens.typography.eyebrow.family,
          fontSize: '0.65rem',
          fontWeight: 600,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: tokens.colors.accent,
          whiteSpace: 'nowrap',
        }}
      >
        {label}
      </span>
      <svg width="44" height="14" viewBox="0 0 44 14" fill="none" style={{ display: 'block' }}>
        <path
          d="M2 7 H36 M30 2 L36 7 L30 12"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span style={{ fontSize: '0.72rem', color: tokens.colors.textMuted, whiteSpace: 'nowrap' }}>
        {sub}
      </span>
    </div>
  );
}

export function AgUiArchDiagram() {
  return (
    <figure
      style={{
        margin: '2rem 0',
        padding: '28px 24px',
        background: tokens.surfaces.canvas,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
      }}
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
          title="@ngaf/ag-ui"
          meta="Signal-driven reducer over AG-UI events."
          tone="accent"
        />
        <ArrowLabel label="Agent contract" sub="signals" />
        <Box
          eyebrow="Chat UI"
          title="@ngaf/chat"
          meta="<chat [agent]='…' /> + slots + themes."
        />
      </div>
      <figcaption
        style={{
          marginTop: 16,
          fontSize: '0.8rem',
          color: tokens.colors.textMuted,
          textAlign: 'center',
          fontStyle: 'italic',
        }}
      >
        Backend speaks AG-UI over SSE → adapter exposes a signal-shaped Agent contract → chat UI renders.
      </figcaption>
    </figure>
  );
}
