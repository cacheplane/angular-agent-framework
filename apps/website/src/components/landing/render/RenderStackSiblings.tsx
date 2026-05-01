'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';

const SIBLINGS = [
  {
    tag: 'Agent',
    pkg: '@ngaf/langgraph',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'The reactive bridge to LangGraph',
    href: '/angular',
    ctaLabel: 'Explore Agent',
  },
  {
    tag: 'Chat',
    pkg: '@ngaf/chat',
    color: tokens.colors.chatPurple,
    rgb: '90,0,200',
    headline: 'Production chat UI in days, not sprints',
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
  {
    tag: 'AG-UI',
    pkg: '@ngaf/ag-ui',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'Run any AG-UI compatible backend',
    href: 'https://github.com/cacheplane/angular-agent-framework/tree/main/libs/ag-ui',
    ctaLabel: 'Explore AG-UI',
  },
];

export function RenderStackSiblings() {
  return (
    <section className="render-stack-siblings" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .render-stack-siblings { padding: 60px 20px !important; }
          .render-stack-siblings-grid { grid-template-columns: 1fr !important; }
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
        className="render-stack-siblings-grid"
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
