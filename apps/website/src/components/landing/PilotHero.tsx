'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';
import { CitationBadge } from './CitationBadge';

const citation77 = {
  source: 'McKinsey — State of AI 2024',
  url: 'https://www.mckinsey.com/capabilities/quantumblack/our-insights/the-state-of-ai',
  stat: 'Most companies remain in experimentation or pilot phases',
  note: 'Workflow redesign and human validation are what drive real production value.',
};

export function PilotHero() {
  return (
    <section
      aria-labelledby="pilot-hero-heading"
      style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}
    >
      {/* Ambient gradient blobs */}
      <div
        aria-hidden="true"
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
        aria-hidden="true"
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
          position: 'relative',
          zIndex: 1,
        }}
        className="py-24 md:py-32"
      >
        {/* Eyebrow label */}
        <motion.div
          initial={{ y: 16 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.5 }}
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: 11,
              letterSpacing: '0.08em',
              color: tokens.colors.accent,
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '1.5rem',
            }}
          >
            Angular Stream Resource Pilot Program
          </span>
        </motion.div>

        {/* H1 headline */}
        <motion.h1
          id="pilot-hero-heading"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
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
          initial={{ y: 14 }}
          animate={{ y: 0 }}
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
          Most Angular teams are 77%<CitationBadge citation={citation77} /> of the way there. Angular Stream Resource closes the
          gap — app deployment license, fixed price, your team owns the result.
        </motion.p>

        {/* CTAs */}
        <motion.div
          initial={{ y: 14 }}
          animate={{ y: 0 }}
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
              padding: '0.875rem 1.75rem',
              borderRadius: 8,
              textDecoration: 'none',
              boxShadow: tokens.glow.button,
              transition: 'opacity 0.15s ease',
              minHeight: 44,
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
              padding: '0.875rem 1.75rem',
              borderRadius: 8,
              textDecoration: 'none',
              border: `1px solid ${tokens.colors.accentBorder}`,
              transition: 'background 0.15s ease, border-color 0.15s ease',
              minHeight: 44,
            }}
          >
            Download the Guide
          </a>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.25 }}
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 11,
            color: tokens.colors.textMuted,
            margin: 0,
            letterSpacing: '0.02em',
          }}
        >
          App deployment license · $20,000 · 3-month co-pilot engagement
        </motion.p>
      </div>
    </section>
  );
}
