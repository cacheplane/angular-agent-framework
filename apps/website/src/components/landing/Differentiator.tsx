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
    need: 'Open adapters + self-hosted',
    description: 'Own the primitives long-term, no vendor lock-in.',
    primitive: 'MIT adapters, no runtime SaaS dependency',
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
      className="differentiator-check-icon"
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
      className="differentiator-section"
    >
      <Container>
        <div className="differentiator-intro">
          <Eyebrow tone="accent" className="differentiator-eyebrow">Why this exists</Eyebrow>
          <h2 id="differentiator-heading" className="differentiator-heading">
            Everything an Angular agent needs once the demo works.
          </h2>
          <p className="differentiator-subhead">
            A streaming chat tutorial takes an hour. Shipping a real agent — durable, interruptible, observable, on your design system — takes most teams six months. Threadplane gives the Angular surface that the rest of the stack assumes you&apos;ve already built.
          </p>
        </div>

        <ul className="differentiator-list">
          {PRODUCTION_ROWS.map((row) => (
            <li key={row.need} className="why-row">
              <CheckIcon />
              <div className="why-row__body">
                <div className="why-row__text">
                  <span className="why-row__need">
                    {row.need}
                  </span>
                  <span className="why-row__description">
                    {row.description}
                  </span>
                </div>
                <code className="why-row__primitive">
                  {row.primitive}
                </code>
              </div>
            </li>
          ))}
        </ul>

        <p className="differentiator-footer">
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
            className="differentiator-footer-link"
          >
            Pilot to Prod →
          </a>
        </p>
      </Container>
    </Section>
  );
}
