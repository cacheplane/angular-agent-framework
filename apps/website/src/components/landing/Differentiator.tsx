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
    eyebrow: 'Runtime layer',
    headline: 'One Angular contract for every agent runtime.',
    body: 'Wire LangGraph, AG-UI, CrewAI, Mastra, Pydantic AI, AWS Strands, or your own backend behind the same Angular primitives.',
  },
  {
    eyebrow: 'Streaming state',
    headline: 'Messages, status, errors, and tools as signals.',
    body: (
      <>
        <code style={{ fontFamily: tokens.typography.fontMono }}>agent()</code> exposes token streams, interrupts, tool progress, branch history,{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>error()</code>,{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>status()</code>, and{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>reload()</code>.
      </>
    ),
  },
  {
    eyebrow: 'Generative UI',
    headline: 'Agent output renders into your component system.',
    body: (
      <>
        Render Vercel <code style={{ fontFamily: tokens.typography.fontMono }}>json-render</code> and Google A2UI specs into Angular components you already own.
      </>
    ),
  },
  {
    eyebrow: 'Production surface',
    headline: 'The pieces that move a demo into production.',
    body: 'Fallbacks, reloads, persistence patterns, observability hooks, and MIT-licensed primitives you can own long term.',
  },
];

export function Differentiator() {
  return (
    <Section
      surface="canvas"
      ariaLabelledBy="differentiator-heading"
      style={{
        paddingTop: 72,
      }}
    >
      <Container>
        {/* Editorial top */}
        <div style={{ maxWidth: 1020, margin: '0 auto 44px', textAlign: 'center' }}>
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
              marginBottom: 20,
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
              margin: '0 auto',
              maxWidth: 760,
            }}
          >
            NGAF brings the pieces of an agentic product into one Angular-first SDK: runtime adapters, signal-native streaming, tool events, generative UI, and production patterns. It is built from real agent UI experience, not a thin integration layer.
          </p>
        </div>

        {/* 4-card sub-grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 14,
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
