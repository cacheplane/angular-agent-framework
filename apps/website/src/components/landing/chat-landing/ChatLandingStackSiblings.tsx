'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const SIBLINGS = [
  {
    tag: 'Agent',
    pkg: '@cacheplane/langgraph',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'The reactive bridge to LangGraph',
    href: '/angular',
    ctaLabel: 'Explore Agent',
  },
  {
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: tokens.colors.renderGreen,
    rgb: '26,122,64',
    headline: 'Agents that render UI — on open standards',
    href: '/render',
    ctaLabel: 'Explore Render',
  },
];

export function ChatLandingStackSiblings() {
  return (
    <section className="chat-stack-siblings" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .chat-stack-siblings { padding: 60px 20px !important; }
          .chat-stack-siblings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 36 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic', fontSize: '1.05rem',
          color: tokens.colors.textSecondary, maxWidth: 520, margin: '0 auto',
        }}>
          This library is part of a cohesive three-layer architecture.
        </p>
      </motion.div>

      <div
        className="chat-stack-siblings-grid"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16, maxWidth: 860, margin: '0 auto',
        }}
      >
        {SIBLINGS.map((lib, i) => (
          <motion.div
            key={lib.pkg}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              padding: '24px 20px',
              borderRadius: 14,
              background: `rgba(${lib.rgb}, 0.03)`,
              border: `1px solid rgba(${lib.rgb}, 0.15)`,
              borderLeft: `3px solid ${lib.color}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', padding: '2px 9px', borderRadius: 5,
              color: '#fff', background: lib.color,
            }}>
              {lib.tag}
            </span>

            <p style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.76rem', fontWeight: 700, color: lib.color, margin: 0,
            }}>
              {lib.pkg}
            </p>

            <h3 style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: '1.15rem', fontWeight: 700,
              color: tokens.colors.textPrimary, lineHeight: 1.25, margin: 0,
            }}>
              {lib.headline}
            </h3>

            <Link
              href={lib.href}
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.72rem', fontWeight: 700, color: lib.color,
                textDecoration: 'none', marginTop: 4,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {lib.ctaLabel} →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
