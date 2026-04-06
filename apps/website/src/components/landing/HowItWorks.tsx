'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

interface Phase {
  phaseLabel: string;
  number: number;
  title: string;
  description: string;
  deliverable: string;
}

const phases: Phase[] = [
  {
    phaseLabel: 'Week 1',
    number: 1,
    title: 'Integration Sprint',
    description:
      'We install stream-resource into your Angular workspace, wire it to your LangGraph backend, and ship your first streamed response. Your team sees tokens flowing within days.',
    deliverable: '✓ First stream live',
  },
  {
    phaseLabel: 'Month 1',
    number: 2,
    title: 'First Agent in Staging',
    description:
      'Build and deploy the first complete agent — tool calls, human approval flows, generative UI. Your team owns the code. We pair with your engineers throughout.',
    deliverable: '✓ Agent in staging',
  },
  {
    phaseLabel: 'Month 3',
    number: 3,
    title: 'Production Deployment',
    description:
      'Harden for scale, deploy to production, hand off the pattern. Your team can now build the next agent without us — the license and the knowledge stay with you.',
    deliverable: '✓ Production deployment',
  },
];

export function HowItWorks() {
  return (
    <section
      aria-labelledby="how-it-works-heading"
      style={{ padding: '5rem 2rem' }}
    >
      <div style={{ maxWidth: '64rem', margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '3.5rem' }}>
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.08em',
              color: tokens.colors.accent,
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '0.75rem',
            }}
          >
            The Engagement
          </span>
          <h2
            id="how-it-works-heading"
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: 'clamp(28px, 4vw, 36px)',
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            From first stream to production
          </h2>
        </div>

        {/* Timeline wrapper — relative for connector line positioning */}
        <div style={{ position: 'relative' }}>
          {/* Connector line (desktop only, decorative) */}
          <div
            aria-hidden="true"
            className="hidden md:block"
            style={{
              position: 'absolute',
              top: 50,
              left: 'calc(16.67% + 18px)',
              right: 'calc(16.67% + 18px)',
              borderTop: '2px dashed rgba(0,64,144,0.2)',
              zIndex: 0,
            }}
          />

          {/* Phase grid */}
          <ol
            style={{
              listStyle: 'none',
              margin: 0,
              padding: 0,
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
              gap: '1.5rem',
              position: 'relative',
              zIndex: 1,
            }}
          >
            {phases.map((phase, i) => (
              <motion.li
                key={phase.number}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.15 }}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '1rem',
                }}
              >
                {/* Phase label */}
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 11,
                    letterSpacing: '0.06em',
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    display: 'inline-block',
                  }}
                >
                  {phase.phaseLabel}
                </span>

                {/* Numbered circle */}
                <div
                  aria-hidden="true"
                  style={{
                    width: 36,
                    height: 36,
                    borderRadius: '50%',
                    background: tokens.colors.accent,
                    color: '#fff',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontWeight: 700,
                    fontSize: 14,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  {phase.number}
                </div>

                {/* Card */}
                <div
                  style={{
                    background: tokens.glass.bg,
                    border: `1px solid ${tokens.glass.border}`,
                    backdropFilter: `blur(${tokens.glass.blur})`,
                    WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                    borderRadius: 12,
                    padding: '28px',
                    boxShadow: tokens.glass.shadow,
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.75rem',
                    flex: 1,
                  }}
                >
                  {/* Title */}
                  <h3
                    style={{
                      fontFamily: "'EB Garamond', serif",
                      fontSize: 20,
                      fontWeight: 700,
                      color: tokens.colors.textPrimary,
                      margin: 0,
                      lineHeight: 1.25,
                    }}
                  >
                    {phase.title}
                  </h3>

                  {/* Description */}
                  <p
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 14,
                      color: tokens.colors.textSecondary,
                      lineHeight: 1.65,
                      margin: 0,
                      flex: 1,
                    }}
                  >
                    {phase.description}
                  </p>

                  {/* Deliverable chip */}
                  <div>
                    <span
                      style={{
                        background: tokens.colors.accent,
                        color: '#fff',
                        borderRadius: 100,
                        padding: '4px 12px',
                        fontSize: 10,
                        fontFamily: 'monospace',
                        letterSpacing: '0.04em',
                        display: 'inline-block',
                      }}
                    >
                      {phase.deliverable}
                    </span>
                  </div>
                </div>
              </motion.li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
