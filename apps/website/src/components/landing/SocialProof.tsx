'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const LOGOS = [
  { name: 'Klarna', src: '/logos/klarna.svg', width: 80 },
  { name: 'Elastic', src: '/logos/elastic.svg', width: 90 },
  { name: 'Rakuten', src: '/logos/rakuten.svg', width: 85 },
  { name: 'GitLab', src: '/logos/gitlab.svg', width: 32 },
  { name: 'Cloudflare', src: '/logos/cloudflare.svg', width: 34 },
  { name: 'Coinbase', src: '/logos/coinbase.svg', width: 32 },
  { name: 'Stripe', src: '/logos/stripe.svg', width: 70 },
  { name: 'Lyft', src: '/logos/lyft.svg', width: 50 },
  { name: 'Cisco', src: '/logos/cisco.svg', width: 70 },
  { name: 'Shopify', src: '/logos/shopify.svg', width: 32 },
  { name: 'Databricks', src: '/logos/databricks.svg', width: 32 },
  { name: 'Snowflake', src: '/logos/snowflake.svg', width: 32 },
];

/** Duplicate for seamless infinite scroll */
const SCROLL_ITEMS = [...LOGOS, ...LOGOS];

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
          padding: '28px 0',
        }}>
          {/* Fade edges */}
          <div style={{
            position: 'absolute', left: 0, top: 0, bottom: 0, width: 100, zIndex: 1,
            background: 'linear-gradient(to right, rgba(248,249,252,0.95), transparent)',
            pointerEvents: 'none',
          }} />
          <div style={{
            position: 'absolute', right: 0, top: 0, bottom: 0, width: 100, zIndex: 1,
            background: 'linear-gradient(to left, rgba(248,249,252,0.95), transparent)',
            pointerEvents: 'none',
          }} />

          {/* Scrolling track */}
          <div
            className="logo-scroll-track"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 56,
              width: 'max-content',
              paddingLeft: 48,
              paddingRight: 48,
            }}
          >
            {SCROLL_ITEMS.map((logo, i) => (
              <div
                key={`${logo.name}-${i}`}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  height: 36,
                  flexShrink: 0,
                  opacity: 0.4,
                  padding: '0 8px',
                }}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={logo.src}
                  alt={logo.name}
                  width={logo.width}
                  height={36}
                  style={{
                    objectFit: 'contain',
                    filter: 'grayscale(100%) brightness(0.2)',
                    userSelect: 'none',
                    pointerEvents: 'none',
                  }}
                  loading="lazy"
                  draggable={false}
                />
              </div>
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
