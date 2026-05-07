'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface SolutionFooterCTAProps {
  color: string;
  headline: string;
  subtext: string;
}

export function SolutionFooterCTA({ color, headline, subtext }: SolutionFooterCTAProps) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)',
        padding: '0 2rem',
      }}
    >
      <style>{`
        .solution-footer-secondary:hover { border-color: rgba(255,255,255,0.6) !important; }
        @media (max-width: 767px) {
          .solution-footer-inner { padding-top: 4rem !important; padding-bottom: 4rem !important; }
        }
      `}</style>
      <motion.div
        className="solution-footer-inner"
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

        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 400,
            lineHeight: 1.15,
            color: '#ffffff',
            marginBottom: '1.25rem',
          }}
        >
          {headline}
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-inter, Inter, sans-serif)',
            fontSize: '17px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2.5rem',
          }}
        >
          {subtext}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-block',
              padding: '0.875rem 2rem',
              background: '#ffffff',
              color,
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
            }}
          >
            Start Your Pilot →
          </Link>
          <a
            href="/whitepaper.pdf"
            download
            className="solution-footer-secondary"
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
