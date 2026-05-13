import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

interface Signal {
  label: string;
  value: string;
  href: string | null;
}

const SIGNALS: Signal[] = [
  {
    label: 'MIT licensed',
    value: 'Open source',
    href: 'https://github.com/cacheplane/angular-agent-framework/blob/main/LICENSE',
  },
  { label: 'Built for', value: 'Angular 20+', href: null },
  {
    label: 'Adapter contract',
    value: 'LangGraph + AG-UI + your own',
    href: null,
  },
  {
    label: 'Reference app',
    value: 'cockpit.cacheplane.ai',
    href: 'https://cockpit.cacheplane.ai',
  },
  {
    label: 'On npm',
    value: '@ngaf/* — 7 packages',
    href: 'https://www.npmjs.com/search?q=%40ngaf',
  },
];

function SignalCard({ s }: { s: Signal }) {
  return (
    <Card padding="md" style={{ textAlign: 'center', height: '100%' }}>
      <div
        style={{
          fontFamily: tokens.typography.fontMono,
          fontSize: 11,
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          color: tokens.colors.textMuted,
          marginBottom: 6,
        }}
      >
        {s.label}
      </div>
      <div
        style={{
          fontFamily: tokens.typography.fontSans,
          fontSize: 15,
          fontWeight: 600,
          color: tokens.colors.textPrimary,
        }}
      >
        {s.value}
      </div>
    </Card>
  );
}

export function ProofStrip() {
  return (
    <Section surface="canvas" tight>
      <Container>
        <Eyebrow style={{ textAlign: 'center', marginBottom: 12 }}>
          Built in the open
        </Eyebrow>
        <p
          style={{
            fontFamily: tokens.typography.bodyLg.family,
            fontSize: tokens.typography.bodyLg.size,
            lineHeight: tokens.typography.bodyLg.line,
            fontWeight: 600,
            color: tokens.colors.textPrimary,
            textAlign: 'center',
            margin: 0,
            marginBottom: 20,
          }}
        >
          Open code, open packages, a live reference app.
        </p>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            maxWidth: 1000,
            margin: '0 auto',
          }}
        >
          {SIGNALS.map((s) =>
            s.href ? (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                style={{ textDecoration: 'none' }}
              >
                <SignalCard s={s} />
              </a>
            ) : (
              <div key={s.label}>
                <SignalCard s={s} />
              </div>
            )
          )}
        </div>
      </Container>
    </Section>
  );
}
