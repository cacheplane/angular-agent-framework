import { tokens } from '@threadplane/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

const PROMISES = [
  {
    title: 'No runtime lock-in',
    body: 'MIT adapters and render primitives stay open. @threadplane/chat is free for noncommercial use and commercially licensed for production.',
  },
  {
    title: 'No abandoned majors',
    body: 'We support Angular’s current and previous LTS versions.',
  },
  {
    title: 'No required cloud',
    body: 'Self-host LangGraph + your Angular app. Run it all in your VPC.',
  },
  {
    title: 'No app telemetry',
    body: 'We don’t collect prompts, completions, tool data, or app runtime content by default. Package installs send a minimal opt-out ping.',
  },
  {
    title: 'No model lock-in',
    body: 'Adapters work with any LLM your runtime supports. Swap providers without changing Angular code.',
  },
];

export function Promises() {
  return (
    <Section surface="canvas" ariaLabelledBy="promises-heading">
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
            Built on principles
          </Eyebrow>
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
