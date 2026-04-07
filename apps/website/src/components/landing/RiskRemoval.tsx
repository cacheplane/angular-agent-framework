'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const commitments = [
  {
    icon: '📄',
    title: 'One license, one app.',
    desc: '$20,000 covers one application deployed to production. angular is licensed for that app. Buy more licenses as you scale to more apps.',
  },
  {
    icon: '👥',
    title: 'We work alongside your team.',
    desc: 'This is not a handoff. We pair with your engineers throughout the 3 months — code reviews, architecture calls, unblocking sessions. Your team drives; we co-pilot.',
  },
  {
    icon: '⚡',
    title: 'Fixed price. No scope creep.',
    desc: '$20,000 flat. No hourly overruns, no change-order invoices. The engagement is scoped to ship your first agent — not open-ended consulting.',
  },
  {
    icon: '🔒',
    title: 'Your code. Your repo.',
    desc: 'Everything we build lives in your codebase under your ownership. We leave you with patterns you can replicate across every future agent, not dependencies on us.',
  },
];

export function RiskRemoval() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <div style={{ maxWidth: '72rem', margin: '0 auto' }}>
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          style={{ textAlign: 'center', marginBottom: '3rem' }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.08em',
              color: tokens.colors.accent,
              textTransform: 'uppercase' as const,
              display: 'inline-block',
              marginBottom: '0.75rem',
            }}
          >
            How It Works
          </span>
          <h2
            style={{
              fontFamily: "'EB Garamond', serif",
              fontSize: 'clamp(28px, 4vw, 38px)',
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              lineHeight: 1.2,
            }}
          >
            What&apos;s included in the license
          </h2>
        </motion.div>

        {/* Commitments grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '1.25rem',
          }}
        >
          {commitments.map((g, i) => (
            <motion.div
              key={g.title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.45, delay: i * 0.08 }}
              style={{
                background: tokens.glass.bg,
                border: `1px solid ${tokens.glass.border}`,
                backdropFilter: `blur(${tokens.glass.blur})`,
                WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                borderRadius: 12,
                padding: '1.75rem',
                boxShadow: tokens.glass.shadow,
                display: 'flex',
                flexDirection: 'column' as const,
                gap: '0.75rem',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 20,
                  color: tokens.colors.accent,
                  lineHeight: 1,
                }}
              >
                {g.icon}
              </span>
              <h3
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 16,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                  margin: 0,
                }}
              >
                {g.title}
              </h3>
              <p
                style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 14,
                  color: tokens.colors.textSecondary,
                  lineHeight: 1.65,
                  margin: 0,
                }}
              >
                {g.desc}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Fine print */}
        <p
          style={{
            textAlign: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: tokens.colors.textMuted,
            marginTop: '2rem',
            letterSpacing: '0.04em',
          }}
        >
          App deployment license · $20,000 · 3-month co-pilot engagement
        </p>
      </div>
    </section>
  );
}
