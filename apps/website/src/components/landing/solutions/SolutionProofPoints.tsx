'use client';
import { motion } from 'framer-motion';
import { tokens } from '@ngaf/design-tokens';
import type { ProofPoint } from '../../../lib/solutions-data';

interface SolutionProofPointsProps {
  color: string;
  proofPoints: ProofPoint[];
}

export function SolutionProofPoints({ color, proofPoints }: SolutionProofPointsProps) {
  return (
    <section className="solution-proof" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solution-proof { padding: 60px 20px !important; }
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
          The Results
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
          }}
        >
          What you can expect
        </h2>
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          maxWidth: 840,
          margin: '0 auto',
        }}
      >
        {proofPoints.map((point, i) => (
          <motion.div
            key={point.metric}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '3rem',
                fontWeight: 800,
                lineHeight: 1,
                color,
                marginBottom: 10,
              }}
            >
              {point.metric}
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {point.label}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
