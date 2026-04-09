// apps/website/src/components/landing/angular/AngularComparison.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const ROWS = [
  { capability: 'SSE streaming', theirs: 'Manual wiring', ours: 'Signal-native via agent()' },
  { capability: 'State management', theirs: 'Custom signals', ours: 'Built-in reactive state' },
  { capability: 'Thread persistence', theirs: 'DIY localStorage', ours: 'Built-in threadId signal + restore' },
  { capability: 'Interrupt handling', theirs: 'Manual Command.RESUME', ours: 'interrupt() signal + approve/edit/cancel' },
  { capability: 'Tool call rendering', theirs: 'Raw events', ours: 'Structured tool call state' },
  { capability: 'Time travel', theirs: 'Not included', ours: 'Built-in state history' },
  { capability: 'Testing', theirs: 'Against live API', ours: 'MockStreamTransport, offline, <100ms' },
  { capability: 'OnPush compatibility', theirs: 'Requires workarounds', ours: 'Native signal support' },
  { capability: 'DeepAgent support', theirs: 'Not included', ours: 'Full multi-agent orchestration' },
];

export function AngularComparison() {
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
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          Head to Head
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          LangGraph Angular SDK vs @cacheplane/angular
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
          border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glass.shadow, overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(255,255,255,.3)', borderBottom: `1px solid ${tokens.glass.border}`, padding: '14px 24px',
        }}>
          {['Capability', 'LangGraph Angular SDK', '@cacheplane/angular'].map((h, i) => (
            <div key={h} style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: i === 2 ? tokens.colors.accent : tokens.colors.textMuted,
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
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '14px 24px',
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
            <div style={{ fontSize: '0.8rem', color: tokens.colors.accent, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#1a7a40', marginTop: 2, flexShrink: 0 }}>✓</span>
              <span>{row.ours}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
