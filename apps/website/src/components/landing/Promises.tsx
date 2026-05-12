import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

const PROMISES = [
  { title: 'No vendor lock-in', body: 'MIT today, MIT tomorrow. Use without us.' },
  { title: 'No paid Angular tier', body: 'The libraries stay open. Pilot-to-Prod is the only paid offering.' },
  { title: 'No abandoned majors', body: 'We follow Angular’s LTS. When Angular ships, we ship.' },
  { title: 'No closed primitives', body: 'Headless primitives stay in the open repo.' },
  { title: 'No required cloud', body: 'Self-host LangGraph + your Angular app. No phone-home.' },
];

export function Promises() {
  return (
    <Section surface="canvas" ariaLabelledBy="promises-heading">
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Built on principles</Eyebrow>
          <h2
            id="promises-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 12,
              letterSpacing: '-0.015em',
            }}
          >
            What we won&apos;t do.
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
            }}
          >
            Honest commitments, not aspirations.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {PROMISES.map((p) => (
            <Card key={p.title} padding="lg">
              <h3
                style={{
                  fontFamily: tokens.typography.h3.family,
                  fontSize: 17,
                  lineHeight: 1.3,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                {p.title}
              </h3>
              <p
                style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: 14,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textSecondary,
                  margin: 0,
                }}
              >
                {p.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
