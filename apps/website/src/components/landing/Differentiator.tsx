import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

interface PositionCard {
  eyebrow: string;
  headline: string;
  body: ReactNode;
}

const CARDS: PositionCard[] = [
  {
    eyebrow: 'Runtime',
    headline: 'One Angular UI. Any agent runtime.',
    body: 'Same primitives drive LangGraph, AG-UI, CrewAI, Mastra, Pydantic AI, AWS Strands, and your own backend.',
  },
  {
    eyebrow: 'Streaming',
    headline: 'LangGraph streaming for Angular.',
    body: (
      <>
        <code style={{ fontFamily: tokens.typography.fontMono }}>agent()</code> ships LangGraph streaming for interrupts, branch and history, tool progress, and tool results — plus{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>error()</code>,{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>status()</code>, and{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>reload()</code>.
      </>
    ),
  },
  {
    eyebrow: 'Generative UI',
    headline: 'Generative UI, built in.',
    body: (
      <>
        Render Vercel <code style={{ fontFamily: tokens.typography.fontMono }}>json-render</code> and Google A2UI specs into Angular components. No second framework to bolt on.
      </>
    ),
  },
  {
    eyebrow: 'License',
    headline: 'MIT. Headless primitives, drop-in compositions.',
    body: 'No tier gates on Angular. Use the unstyled primitives, or the opinionated chat shell — your call.',
  },
];

export function Differentiator() {
  return (
    <Section surface="canvas" ariaLabelledBy="differentiator-heading">
      <Container>
        {/* Editorial top */}
        <div style={{ maxWidth: 720, margin: '0 auto 56px', textAlign: 'center' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Why this exists</Eyebrow>
          <h2
            id="differentiator-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 24,
              letterSpacing: '-0.015em',
            }}
          >
            The fullstack agentic library for Angular.
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              marginBottom: 16,
            }}
          >
            NGAF brings runtime adapters, signal-native streaming, tool events, generative UI, and production patterns into one Angular-first SDK.
          </p>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
            }}
          >
            Built by people who have shipped agent UI systems and wanted something deeper than a framework adapter.
          </p>
        </div>

        {/* 4-card sub-grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {CARDS.map((c) => (
            <Card key={c.eyebrow} padding="lg" hoverable>
              <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{c.eyebrow}</Eyebrow>
              <h3
                style={{
                  fontFamily: tokens.typography.h3.family,
                  fontSize: 20,
                  lineHeight: 1.3,
                  fontWeight: tokens.typography.h3.weight,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                  marginBottom: 8,
                }}
              >
                {c.headline}
              </h3>
              <p
                style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: tokens.typography.body.size,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textSecondary,
                  margin: 0,
                }}
              >
                {c.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
