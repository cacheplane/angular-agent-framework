'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { SOLUTIONS } from '../../../lib/solutions-data';

export function SolutionsGrid() {
  return (
    <section className="solutions-grid" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solutions-grid { padding: 60px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            color: tokens.colors.accent,
            marginBottom: 14,
          }}
        >
          By Use Case
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            marginBottom: 10,
          }}
        >
          Enterprise solutions
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: tokens.colors.textSecondary,
            maxWidth: 520,
            margin: '0 auto',
          }}
        >
          See how Angular Agent Framework solves real enterprise problems — from compliance to customer support.
        </p>
      </motion.div>

      <div
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 24,
        }}
      >
        {SOLUTIONS.map((sol, i) => (
          <motion.div
            key={sol.slug}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              background: `rgba(${sol.rgb}, 0.03)`,
              border: `1px solid rgba(${sol.rgb}, 0.15)`,
              borderRadius: 14,
              padding: '28px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.58rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                padding: '2px 9px',
                borderRadius: 5,
                color: '#fff',
                background: sol.color,
              }}
            >
              {sol.eyebrow}
            </span>

            <h3
              style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                lineHeight: 1.25,
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {sol.title}
            </h3>

            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.88rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {sol.subtitle}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
              {sol.proofPoints.map(pp => (
                <span
                  key={pp.metric}
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '0.58rem',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `rgba(${sol.rgb}, 0.07)`,
                    color: sol.color,
                    border: `1px solid rgba(${sol.rgb}, 0.15)`,
                  }}
                >
                  {pp.metric} {pp.label.split(' — ')[0]}
                </span>
              ))}
            </div>

            <Link
              href={`/solutions/${sol.slug}`}
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: sol.color,
                textDecoration: 'none',
                marginTop: 'auto',
                paddingTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Learn more →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
