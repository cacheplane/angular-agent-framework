'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

/**
 * Companies displayed as social proof — sourced from the LangChain ecosystem.
 * These represent the types of companies building with LangChain/LangGraph,
 * the same ecosystem Angular Agent Framework serves.
 */
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
  'Monday.com',
];

/** Duplicate for seamless infinite scroll */
const SCROLL_ITEMS = [...COMPANIES, ...COMPANIES];

export function SocialProof() {
  return (
    <section style={{ padding: '24px 0', overflow: 'hidden' }}>
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
          fontSize: '0.6rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.textMuted,
          marginBottom: 16,
        }}>
          Built for teams shipping with LangChain
        </p>

        {/* Scrolling logo strip */}
        <div style={{
          position: 'relative',
          maxWidth: 900,
          margin: '0 auto',
          borderRadius: 16,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          overflow: 'hidden',
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
            pointerEvents: 'none',
          }} />

          {/* Scrolling track */}
          <div
            className="logo-scroll-track"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 48,
              width: 'max-content',
            }}
          >
            {SCROLL_ITEMS.map((company, i) => (
              <span
                key={`${company}-${i}`}
                style={{
                  fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
                  fontSize: 'clamp(14px, 1.1vw, 17px)',
                  fontWeight: 700,
                  color: tokens.colors.textMuted,
                  whiteSpace: 'nowrap',
                  opacity: 0.6,
                  letterSpacing: '0.02em',
                  userSelect: 'none',
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
          animation: logo-scroll 30s linear infinite;
        }
        .logo-scroll-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
