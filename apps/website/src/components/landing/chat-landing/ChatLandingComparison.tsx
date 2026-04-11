// apps/website/src/components/landing/chat-landing/ChatLandingComparison.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const ROWS = [
  { capability: 'Message rendering', theirs: 'Sprint 1', ours: 'Included' },
  { capability: 'Streaming indicators', theirs: 'Sprint 1', ours: 'Included' },
  { capability: 'Input handling', theirs: 'Sprint 2', ours: 'Included' },
  { capability: 'Accessibility (WCAG)', theirs: 'Sprint 2-3', ours: 'Included' },
  { capability: 'Theming / design system', theirs: 'Sprint 3', ours: 'Included (CSS custom properties)' },
  { capability: 'Generative UI (json-render)', theirs: 'Sprint 4+', ours: 'Included — Vercel json-render spec' },
  { capability: 'Google A2UI spec', theirs: 'Sprint 5+', ours: '18 components, v0.9 validation, extensible handlers' },
  { capability: 'Debug tooling', theirs: 'Often never', ours: 'Included' },
  { capability: 'Time to production', theirs: '4-6 weeks', ours: 'Days' },
];

export function ChatLandingComparison() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.chatPurple, marginBottom: 14,
        }}>
          Head to Head
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Incrementally building chat vs @cacheplane/chat
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          maxWidth: 860, margin: '0 auto', borderRadius: 20,
          background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glass.shadow, overflow: 'auto',
        }}
      >
        <div style={{
          display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr)',
          background: 'rgba(255,255,255,.3)', borderBottom: `1px solid ${tokens.glass.border}`, padding: '14px 24px',
        }}>
          {['Capability', 'Build Incrementally', '@cacheplane/chat'].map((h, i) => (
            <div key={h} style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: i === 2 ? tokens.colors.chatPurple : tokens.colors.textMuted,
            }}>
              {h}
            </div>
          ))}
        </div>
        {ROWS.map((row, i) => (
          <motion.div
            key={row.capability}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={{
              display: 'grid', gridTemplateColumns: 'minmax(100px, 1fr) minmax(120px, 1fr) minmax(120px, 1fr)', padding: '14px 24px',
              borderBottom: i < ROWS.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none', alignItems: 'center',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.72rem', fontWeight: 700, color: tokens.colors.textPrimary,
            }}>
              {row.capability}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.textMuted, paddingRight: 16, lineHeight: 1.5 }}>
              {row.theirs}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.chatPurple, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#1a7a40', marginTop: 2, flexShrink: 0 }}>✓</span>
              <span>{row.ours}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
