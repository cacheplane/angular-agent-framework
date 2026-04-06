'use client';

import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';
import { CitationBadge } from './CitationBadge';

const gartnerCitation = {
  source: 'Gartner — GenAI Project Failure (2026)',
  url: 'https://www.gartner.com/en/articles/genai-project-failure',
  stat: '50% of GenAI projects abandoned after proof of concept by end of 2025',
  note: 'Poor data quality, inadequate risk controls, escalating costs, and unclear business value are the primary causes.',
};

export function PilotFooterCTA() {
  return (
    <section
      aria-labelledby="pilot-footer-cta-heading"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)',
        padding: '0 2rem',
      }}
    >
      <style>{`.pilot-footer-secondary-btn:hover { border-color: rgba(255,255,255,0.6) !important; }`}</style>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: '48rem',
          margin: '0 auto',
          paddingTop: '6rem',
          paddingBottom: '6rem',
          textAlign: 'center',
        }}
      >
        {/* Eyebrow */}
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.5)',
            marginBottom: '1rem',
          }}
        >
          Ready when you are
        </p>

        {/* Heading */}
        <h2
          id="pilot-footer-cta-heading"
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: '42px',
            fontWeight: 400,
            lineHeight: 1.15,
            color: '#ffffff',
            marginBottom: '1.25rem',
          }}
        >
          Ready to stop stalling?
        </h2>

        {/* Subtext */}
        <p
          style={{
            fontFamily: 'var(--font-inter, Inter, sans-serif)',
            fontSize: '17px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2.5rem',
          }}
        >
          Half of GenAI projects die after proof of concept.<CitationBadge citation={gartnerCitation} /> Angular Stream Resource closes the gap. Start with a conversation.
        </p>

        {/* CTA buttons */}
        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          {/* Primary CTA */}
          <motion.a
            href="#whitepaper-gate"
            whileHover={{ boxShadow: '0 0 20px rgba(255, 255, 255, 0.3)' }}
            style={{
              display: 'inline-block',
              padding: '0.875rem 2rem',
              background: '#ffffff',
              color: tokens.colors.accent,
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
              transition: 'box-shadow 0.2s ease',
            }}
          >
            Start Your Pilot →
          </motion.a>

          {/* Secondary CTA */}
          <a
            href="/whitepaper.pdf"
            download
            className="pilot-footer-secondary-btn"
            style={{
              display: 'inline-block',
              padding: '0.875rem 2rem',
              background: 'transparent',
              color: '#ffffff',
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              transition: 'border-color 0.2s ease',
            }}
          >
            Download the Guide
          </a>
        </div>

        {/* Fine print */}
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: 'rgba(255, 255, 255, 0.4)',
          }}
        >
          App deployment license · $20,000 · 3-month co-pilot engagement
        </p>
      </motion.div>
    </section>
  );
}
