'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

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
  'Monday',
];

/** Duplicate for seamless infinite scroll */
const SCROLL_ITEMS = [...COMPANIES, ...COMPANIES];

export function SocialProof() {
  return (
    <section style={{ padding: '36px 0', overflow: 'hidden' }}>
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
          fontSize: '0.62rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.textMuted,
          marginBottom: 22,
        }}>
          Built for teams shipping with LangChain
        </p>

        {/* Scrolling logo strip */}
        <div style={{
          position: 'relative',
          maxWidth: 1060,
          margin: '0 auto',
          borderRadius: 20,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          overflow: 'hidden',
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
            pointerEvents: 'none',
          }} />

          {/* Scrolling track */}
          <div
            className="logo-scroll-track"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 72,
              width: 'max-content',
              paddingLeft: 48,
              paddingRight: 48,
            }}
          >
            {SCROLL_ITEMS.map((company, i) => (
              <span
                key={`${company}-${i}`}
                style={{
                  fontFamily: 'var(--font-inter, Inter, system-ui, sans-serif)',
                  fontSize: 22,
                  fontWeight: 800,
                  color: tokens.colors.textPrimary,
                  opacity: 0.35,
                  whiteSpace: 'nowrap',
                  letterSpacing: '-0.02em',
                  userSelect: 'none',
                  lineHeight: 1,
                  padding: '4px 0',
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
          animation: logo-scroll 35s linear infinite;
        }
        .logo-scroll-track:hover {
          animation-play-state: paused;
        }
      `}</style>
    </section>
  );
}
