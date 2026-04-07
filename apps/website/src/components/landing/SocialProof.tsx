'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

<<<<<<< HEAD
=======
/**
 * Companies displayed as social proof — sourced from the LangChain ecosystem.
 * These represent the types of companies building with LangChain/LangGraph,
 * the same ecosystem Angular Agent Framework serves.
 */
>>>>>>> origin/main
const COMPANIES = [
  'Klarna',
  'Elastic',
  'Rakuten',
  'GitLab',
  'Cloudflare',
  'Coinbase',
  'LinkedIn',
  'Lyft',
  'Cisco',
  'Workday',
  'ServiceNow',
<<<<<<< HEAD
  'Monday',
=======
  'Monday.com',
>>>>>>> origin/main
];

/** Duplicate for seamless infinite scroll */
const SCROLL_ITEMS = [...COMPANIES, ...COMPANIES];

export function SocialProof() {
  return (
<<<<<<< HEAD
    <section style={{ padding: '36px 0', overflow: 'hidden' }}>
=======
    <section style={{ padding: '24px 0', overflow: 'hidden' }}>
>>>>>>> origin/main
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
      >
        {/* Eyebrow */}
        <p style={{
          textAlign: 'center',
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
<<<<<<< HEAD
          fontSize: '0.62rem',
=======
          fontSize: '0.6rem',
>>>>>>> origin/main
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.textMuted,
<<<<<<< HEAD
          marginBottom: 22,
=======
          marginBottom: 16,
>>>>>>> origin/main
        }}>
          Built for teams shipping with LangChain
        </p>

        {/* Scrolling logo strip */}
        <div style={{
          position: 'relative',
<<<<<<< HEAD
          maxWidth: 1060,
          margin: '0 auto',
          borderRadius: 20,
=======
          maxWidth: 900,
          margin: '0 auto',
          borderRadius: 16,
>>>>>>> origin/main
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          overflow: 'hidden',
<<<<<<< HEAD
          padding: '32px 0',
        }}>
          {/* Fade edges */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, zIndex: 1,
            background: 'linear-gradient(to right, rgba(248,249,252,0.9), transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, zIndex: 1,
            background: 'linear-gradient(to left, rgba(248,249,252,0.9), transparent)',
=======
          padding: '16px 0',
        }}>
          {/* Fade edges */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 60, zIndex: 1,
            background: 'linear-gradient(to right, rgba(244,240,255,0.95), transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 60, zIndex: 1,
            background: 'linear-gradient(to left, rgba(244,240,255,0.95), transparent)',
>>>>>>> origin/main
            pointerEvents: 'none',
          }} />

          {/* Scrolling track */}
          <div
            className="logo-scroll-track"
            style={{
              display: 'flex',
              alignItems: 'center',
<<<<<<< HEAD
              gap: 72,
              width: 'max-content',
              paddingLeft: 48,
              paddingRight: 48,
=======
              gap: 48,
              width: 'max-content',
>>>>>>> origin/main
            }}
          >
            {SCROLL_ITEMS.map((company, i) => (
              <span
                key={`${company}-${i}`}
                style={{
<<<<<<< HEAD
                  fontFamily: 'var(--font-inter, Inter, system-ui, sans-serif)',
                  fontSize: 'clamp(20px, 1.6vw, 26px)',
                  fontWeight: 800,
                  color: tokens.colors.textPrimary,
                  opacity: 0.18,
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.02em',
                  userSelect: 'none',
                  lineHeight: 1,
                  padding: '4px 0',
=======
                  fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
                  fontSize: 'clamp(14px, 1.1vw, 17px)',
                  fontWeight: 700,
                  color: tokens.colors.textMuted,
                  whiteSpace: 'nowrap',
                  opacity: 0.6,
                  letterSpacing: '0.02em',
                  userSelect: 'none',
>>>>>>> origin/main
                }}
              >
                {company}
              </span>
            ))}
          </div>
        </div>
      </motion.div>

      <style>{`
        @keyframes logo-scroll {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .logo-scroll-track {
<<<<<<< HEAD
          animation: logo-scroll 35s linear infinite;
=======
          animation: logo-scroll 30s linear infinite;
>>>>>>> origin/main
        }
        .logo-scroll-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
