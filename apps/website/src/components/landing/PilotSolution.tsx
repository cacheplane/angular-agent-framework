'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const STEPS = [
  {
    num: 1,
    title: 'Pilot',
    description: 'We assess your LangGraph agent and Angular codebase. You get a concrete production plan.',
  },
  {
    num: 2,
    title: 'Build',
    description: 'We work alongside your team to integrate the framework. Streaming, generative UI, testing — done right.',
  },
  {
    num: 3,
    title: 'Ship',
    description: 'Your agent goes to production with your team owning every line. No vendor lock-in, no black boxes.',
  },
];

export function PilotSolution() {
  return (
    <section className="pilot-solution" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .pilot-solution { padding: 60px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.accent,
          marginBottom: 14,
        }}>
          The Solution
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontSize: 'clamp(26px, 3.5vw, 46px)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: tokens.colors.textPrimary,
          marginBottom: 10,
        }}>
          From proof of concept to production in 90 days
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          color: tokens.colors.textSecondary,
          maxWidth: 560,
          margin: '0 auto',
        }}>
          The structured pilot engagement that closes the last-mile gap.
        </p>
      </motion.div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        maxWidth: 840,
        margin: '0 auto 36px',
      }}>
        {STEPS.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: tokens.colors.accent,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.75rem',
              fontWeight: 700,
              margin: '0 auto 14px',
            }}>
              {step.num}
            </div>
            <h3 style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '1rem',
              fontWeight: 600,
              color: tokens.colors.textPrimary,
              marginBottom: 8,
            }}>
              {step.title}
            </h3>
            <p style={{
              fontSize: '0.82rem',
              color: tokens.colors.textSecondary,
              lineHeight: 1.5,
            }}>
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link
          href="/pilot-to-prod"
          style={{
            display: 'inline-block',
            padding: '0.875rem 2rem',
            background: tokens.colors.accent,
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            borderRadius: 6,
          }}
        >
          Explore the Pilot Program →
        </Link>
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.62rem',
          color: tokens.colors.textMuted,
          marginTop: 12,
          letterSpacing: '0.06em',
        }}>
          Included with every app deployment license
        </p>
      </div>
    </section>
  );
}
