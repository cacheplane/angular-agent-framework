'use client';

import { tokens } from '@threadplane/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { trackCtaClick } from '../../lib/analytics/client';

interface ProductionRow {
  need: string;
  description: string;
  primitive: string;
}

const PRODUCTION_ROWS: ProductionRow[] = [
  {
    need: 'Durable threads',
    description: 'Persist across reloads, resume, branch, replay.',
    primitive: 'threadId signal + durable transports',
  },
  {
    need: 'Resumable interrupts',
    description: 'Human-in-the-loop pause, resume token, retry, cancel.',
    primitive: 'interrupt(), resume()',
  },
  {
    need: 'Tool calls as events',
    description: 'Stream progress, structured args, surfaced errors.',
    primitive: 'tool events on injectAgent()',
  },
  {
    need: 'Streaming state as signals',
    description: 'messages(), status(), error() — not promises.',
    primitive: 'signal-native injectAgent()',
  },
  {
    need: 'Generative UI on your design system',
    description: 'Vercel json-render + Google A2UI rendered into your Angular components.',
    primitive: '@threadplane/render',
  },
  {
    need: 'Recoverable errors',
    description: 'Retry, reload, error boundaries, fallback content.',
    primitive: 'error(), reload()',
  },
  {
    need: 'Backend portability',
    description: 'LangGraph today; AG-UI / Mastra / CrewAI / your own tomorrow — same UI.',
    primitive: 'runtime adapters behind one contract',
  },
  {
    need: 'Angular-native',
    description: 'DI, signals, RxJS interop — no React rewrite.',
    primitive: 'built on Angular primitives, not ported',
  },
  {
    need: 'Observability hooks',
    description: 'Tracing seams; app telemetry off by default.',
    primitive: 'event hooks, opt-in only',
  },
  {
    need: 'MIT + self-hosted',
    description: 'Own the primitives long-term, no vendor lock-in.',
    primitive: 'MIT-licensed, no runtime SaaS dependency',
  },
];

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke={tokens.colors.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 4 }}
    >
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

export function Differentiator() {
  return (
    <Section
      surface="canvas"
      ariaLabelledBy="differentiator-heading"
      style={{ paddingTop: 72 }}
    >
      <Container>
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
            Everything an Angular agent needs once the demo works.
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
            A streaming chat tutorial takes an hour. Shipping a real agent — durable, interruptible, observable, on your design system — takes most teams six months. Threadplane gives the Angular surface that the rest of the stack assumes you&apos;ve already built.
          </p>
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 auto',
            maxWidth: 980,
            borderTop: `1px solid ${tokens.surfaces.border}`,
          }}
        >
          {PRODUCTION_ROWS.map((row) => (
            <li
              key={row.need}
              className="why-row"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '18px 8px',
                borderBottom: `1px solid ${tokens.surfaces.border}`,
              }}
            >
              <CheckIcon />
              <div
                className="why-row__body"
                style={{
                  flex: 1,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                      marginRight: 8,
                    }}
                  >
                    {row.need}
                  </span>
                  <span
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    {row.description}
                  </span>
                </div>
                <code
                  style={{
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 13,
                    color: tokens.colors.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {row.primitive}
                </code>
              </div>
            </li>
          ))}
        </ul>

        <p
          style={{
            margin: '24px auto 0',
            maxWidth: 980,
            textAlign: 'center',
            fontFamily: tokens.typography.body.family,
            fontSize: tokens.typography.body.size,
            lineHeight: tokens.typography.body.line,
            color: tokens.colors.textMuted,
          }}
        >
          Want help walking these on your codebase?{' '}
          <a
            href="/pilot-to-prod"
            onClick={() =>
              trackCtaClick({
                surface: 'home',
                destination_url: '/pilot-to-prod',
                cta_id: 'home_why_pilot_to_prod',
                cta_text: 'Pilot to Prod',
              })
            }
            style={{ color: tokens.colors.accent, textDecoration: 'none', fontWeight: 600 }}
          >
            Pilot to Prod →
          </a>
        </p>

        <style>{`
          @media (max-width: 640px) {
            .why-row__body {
              flex-direction: column !important;
              gap: 6px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
