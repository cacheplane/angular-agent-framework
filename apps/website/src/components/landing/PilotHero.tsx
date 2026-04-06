'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

export function PilotHero() {
  return (
    <section
      aria-labelledby="pilot-hero-heading"
      style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}
    >
      {/* Ambient gradient blobs */}
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: tokens.gradient.warm,
          top: -150,
          left: -100,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 450,
          height: 450,
          borderRadius: '50%',
          background: tokens.gradient.cool,
          top: -100,
          right: -100,
          filter: 'blur(60px)',
          pointerEvents: 'none',
        }}
      />

      {/* Content */}
      <div
        style={{
          maxWidth: '56rem',
          margin: '0 auto',
          textAlign: 'center',
          paddingTop: '6rem',
          paddingBottom: '6rem',
          position: 'relative',
          zIndex: 1,
        }}
        className="py-24 md:py-32"
      >
        {/* Eyebrow label */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              fontVariant: 'small-caps',
              letterSpacing: '0.08em',
              color: tokens.colors.accent,
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '1.5rem',
            }}
          >
            StreamResource Pilot Program
          </span>
        </motion.div>

        {/* H1 headline */}
        <motion.h1
          id="pilot-hero-heading"
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: "'EB Garamond', serif",
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            margin: 0,
            marginBottom: '1.25rem',
            whiteSpace: 'pre-line',
          }}
        >
          {'Your agentic Angular app.\nIn production.'}
        </motion.h1>

        {/* Subheadline */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            color: tokens.colors.textSecondary,
            maxWidth: '52ch',
            margin: '0 auto',
            lineHeight: 1.6,
            marginBottom: '2.5rem',
          }}
        >
          Most Angular teams are 77% of the way there. StreamResource closes the
          gap — structured pilot, fixed price, guaranteed outcome.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '1.25rem',
          }}
        >
          {/* Primary CTA */}
          <a
            href="#whitepaper-gate"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: tokens.colors.accent,
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              textDecoration: 'none',
              boxShadow: tokens.glow.button,
              transition: 'opacity 0.15s ease',
            }}
          >
            Start Your Pilot →
          </a>

          {/* Secondary CTA */}
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
              color: tokens.colors.accent,
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              padding: '0.75rem 1.5rem',
              borderRadius: 8,
              textDecoration: 'none',
              border: `1px solid ${tokens.colors.accentBorder}`,
              transition: 'background 0.15s ease, border-color 0.15s ease',
            }}
          >
            Download the Guide
          </a>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: tokens.colors.textMuted,
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          3-month structured engagement · Fixed $20,000 · 100% money-back if you don&apos;t ship
        </motion.p>
      </div>
    </section>
  );
}
