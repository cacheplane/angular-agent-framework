'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const cards = [
  {
    icon: '📦',
    title: 'angular',
    description:
      "The Angular streaming library. Token-by-token streaming, thread persistence, interrupt handling, and MockAgentTransport for deterministic testing. Purpose-built for LangGraph and Angular Signals.",
    bullets: [
      'Signals-native API',
      'OnPush compatible',
      'Deterministic test transport',
    ],
    highlighted: false,
    label: null,
  },
  {
    icon: '🚀',
    title: '3-Month Pilot',
    description:
      'Structured engagement with your team. We define the scope, build the first agent together, and leave you with a production-ready pattern you can replicate.',
    bullets: [
      'Week 1: Integration & first stream',
      'Month 1: First agent in staging',
      'Month 3: Production deployment',
    ],
    highlighted: true,
    label: '★ Included',
  },
  {
    icon: '📄',
    title: 'App Deployment License',
    description:
      'One license covers one Angular application in production. angular is included for that app. The 3-month engagement is how we get you there together.',
    bullets: [
      'One app in production',
      'angular license included',
      'Patterns your team can replicate',
    ],
    highlighted: false,
    label: null,
  },
] as const;

export function WhatIsIncluded() {
  return (
    <section style={{ padding: '5rem 2rem' }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        {/* Section header */}
        <div style={{ textAlign: 'center', marginBottom: '3rem' }}>
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
            What&apos;s Included
          </span>
          <h2
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: 'clamp(28px, 4vw, 36px)',
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            Everything you need to ship
          </h2>
        </div>

        {/* 3-column grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.5rem',
            alignItems: 'stretch',
          }}
        >
          {cards.map((card, i) => (
            <motion.div
              key={card.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                background: tokens.glass.bg,
                border: card.highlighted
                  ? `1px solid ${tokens.colors.accentBorder}`
                  : `1px solid ${tokens.glass.border}`,
                backdropFilter: `blur(${tokens.glass.blur})`,
                WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                borderRadius: 12,
                padding: '2rem',
                boxShadow: card.highlighted
                  ? tokens.glow.card
                  : tokens.glass.shadow,
                display: 'flex',
                flexDirection: 'column',
                gap: '1rem',
              }}
            >
              {/* Label (Pilot card only) */}
              {card.label && (
                <span
                  style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10,
                    letterSpacing: '0.06em',
                    color: tokens.colors.angularRed,
                    textTransform: 'uppercase',
                    display: 'inline-block',
                  }}
                >
                  {card.label}
                </span>
              )}

              {/* Icon */}
              <span style={{ fontSize: 32, lineHeight: 1 }}>{card.icon}</span>

              {/* Title */}
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 20,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                }}
              >
                {card.title}
              </h3>

              {/* Description */}
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.6,
                  margin: 0,
                }}
              >
                {card.description}
              </p>

              {/* Bullet points */}
              <ul
                style={{
                  margin: 0,
                  padding: 0,
                  listStyle: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '0.5rem',
                  marginTop: 'auto',
                }}
              >
                {card.bullets.map((bullet) => (
                  <li
                    key={bullet}
                    style={{
                      display: 'flex',
                      alignItems: 'flex-start',
                      gap: '0.5rem',
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 14,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    <span
                      style={{
                        color: tokens.colors.accent,
                        fontWeight: 700,
                        flexShrink: 0,
                        lineHeight: '1.4',
                      }}
                    >
                      ✓
                    </span>
                    {bullet}
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
