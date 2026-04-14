'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';
import type { SolutionPainPoint } from '../../../lib/solutions-data';

interface SolutionProblemProps {
  color: string;
  painPoints: SolutionPainPoint[];
}

export function SolutionProblem({ color, painPoints }: SolutionProblemProps) {
  return (
    <section className="solution-problem" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solution-problem { padding: 60px 20px !important; }
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
            color,
            marginBottom: 14,
          }}
        >
          The Problem
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
          Why teams stall
        </h2>
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          gap: 20,
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {painPoints.map((point, i) => (
          <motion.div
            key={point.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '28px 24px',
              borderRadius: 16,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                marginBottom: 10,
                lineHeight: 1.25,
              }}
            >
              {point.title}
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
              {point.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
