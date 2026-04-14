'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import type { SolutionConfig } from '../../../lib/solutions-data';

interface SolutionHeroProps {
  solution: SolutionConfig;
}

export function SolutionHero({ solution }: SolutionHeroProps) {
  return (
    <section
      aria-labelledby="solution-hero-heading"
      style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}
    >
      <div
        style={{
          maxWidth: '56rem',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
        className="py-24 md:py-32"
      >
        <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: solution.color,
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '1.5rem',
            }}
          >
            {solution.eyebrow}
          </span>
        </motion.div>

        <motion.h1
          id="solution-hero-heading"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            margin: 0,
            marginBottom: '1.25rem',
            whiteSpace: 'pre-line',
          }}
        >
          {solution.title}
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            color: tokens.colors.textSecondary,
            maxWidth: '52ch',
            margin: '0 auto',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          {solution.subtitle}
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: solution.color,
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              padding: '0.875rem 1.75rem',
              borderRadius: 8,
              textDecoration: 'none',
              minHeight: 44,
            }}
          >
            Start a Pilot
          </Link>
          <a
            href="/whitepaper.pdf"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: solution.color,
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              padding: '0.875rem 1.75rem',
              borderRadius: 8,
              textDecoration: 'none',
              border: `1px solid rgba(${solution.rgb}, 0.25)`,
              minHeight: 44,
            }}
          >
            Download the Guide
          </a>
        </motion.div>
      </div>
    </section>
  );
}
