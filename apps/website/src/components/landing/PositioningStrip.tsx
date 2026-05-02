'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';

interface Card {
  eyebrow: string;
  headline: string;
  body: ReactNode;
}

const CARDS: Card[] = [
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
        <code style={{ fontFamily: 'var(--font-mono)' }}>agent()</code> ships LangGraph streaming for interrupts, branch and history, tool progress, and tool results — plus{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>error()</code>,{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>status()</code>, and{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>reload()</code>.
      </>
    ),
  },
  {
    eyebrow: 'Generative UI',
    headline: 'Generative UI, built in.',
    body: (
      <>
        Render Vercel <code style={{ fontFamily: 'var(--font-mono)' }}>json-render</code> and Google A2UI specs into Angular components. No second framework to bolt on.
      </>
    ),
  },
  {
    eyebrow: 'License',
    headline: 'MIT. Headless primitives, drop-in compositions.',
    body: 'No tier gates on Angular. Use the unstyled primitives, or the opinionated chat shell — your call.',
  },
];

export function PositioningStrip() {
  return (
    <section
      className="positioning-strip"
      aria-labelledby="positioning-heading"
      style={{ maxWidth: 1040, margin: '0 auto', padding: '64px 32px' }}
    >
      <style>{`
        .positioning-strip .positioning-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 16px;
        }
        @media (min-width: 640px) {
          .positioning-strip .positioning-grid { grid-template-columns: repeat(2, 1fr); }
        }
        @media (min-width: 1024px) {
          .positioning-strip .positioning-grid { grid-template-columns: repeat(4, 1fr); }
        }
      `}</style>
      <h2
        id="positioning-heading"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        What makes the Angular Agent Framework different
      </h2>

      <div className="positioning-grid">
        {CARDS.map((card, i) => (
          <motion.article
            key={card.eyebrow}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            style={{
              padding: '24px 22px',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: tokens.colors.accent,
                margin: 0,
              }}
            >
              {card.eyebrow}
            </p>
            <h3
              style={{
                fontFamily: 'var(--font-garamond)',
                fontSize: 'clamp(18px, 1.6vw, 22px)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: tokens.colors.textPrimary,
                margin: 0,
              }}
            >
              {card.headline}
            </h3>
            <p
              style={{
                fontSize: '0.9rem',
                lineHeight: 1.55,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}
            >
              {card.body}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
