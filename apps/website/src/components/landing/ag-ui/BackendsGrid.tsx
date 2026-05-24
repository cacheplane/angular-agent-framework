import { tokens } from '@ngaf/design-tokens';

interface Backend {
  readonly name: string;
  readonly note: string;
}

const BACKENDS: readonly Backend[] = [
  { name: 'LangGraph', note: 'Python / TS' },
  { name: 'CrewAI', note: 'Python' },
  { name: 'Mastra', note: 'TypeScript' },
  { name: 'MS Agent Framework', note: '.NET / Python' },
  { name: 'AG2', note: 'Python' },
  { name: 'Pydantic AI', note: 'Python' },
  { name: 'AWS Strands', note: 'Python' },
  { name: 'CopilotKit runtime', note: 'TypeScript' },
];

export function BackendsGrid() {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
        gap: 10,
        padding: 16,
        background: tokens.surfaces.surfaceTinted,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.lg,
      }}
    >
      {BACKENDS.map((b) => (
        <div
          key={b.name}
          style={{
            padding: '14px 14px',
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            borderRadius: tokens.radius.md,
            display: 'flex',
            flexDirection: 'column',
            gap: 4,
          }}
        >
          <div
            style={{
              fontFamily: tokens.typography.fontSans,
              fontSize: 14,
              fontWeight: 600,
              color: tokens.colors.textPrimary,
            }}
          >
            {b.name}
          </div>
          <div
            style={{
              fontFamily: tokens.typography.fontMono,
              fontSize: 11,
              color: tokens.colors.textMuted,
            }}
          >
            {b.note}
          </div>
        </div>
      ))}
    </div>
  );
}
