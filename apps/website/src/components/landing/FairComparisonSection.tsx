'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

const ROWS = [
  {
    capability: 'Token streaming',
    without: 'Custom SSE wiring + zone management',
    with: 'agent() signal, zero boilerplate',
  },
  {
    capability: 'Thread persistence',
    without: 'Manual localStorage + API calls',
    with: 'threadId signal + onThreadId callback',
  },
  {
    capability: 'Interrupt flows',
    without: 'Custom polling or WebSocket',
    with: 'interrupt() signal + resume built in',
  },
  {
    capability: 'Tool-call rendering',
    without: 'Custom event parsing',
    with: '<chat-tool-call-card> or headless <chat-tool-calls>',
  },
  {
    capability: 'Generative UI',
    without: 'No established pattern',
    with: '<chat-generative-ui> + <render-spec> + registry',
  },
  {
    capability: 'Deterministic testing',
    without: 'Mock HTTP + tick management',
    with: 'MockAgentTransport + writable signals',
  },
  {
    capability: 'Human approval UI',
    without: 'Build from scratch',
    with: '<chat-interrupt-panel>',
  },
  {
    capability: 'Full chat layout',
    without: 'Build from scratch',
    with: '<chat> drop-in',
  },
];

export function FairComparisonSection() {
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
          A fair comparison
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary, marginBottom: 12,
        }}>
          What Angular Agent Framework adds
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary,
          maxWidth: 560, margin: '0 auto',
        }}>
          LangGraph and @langchain/langgraph-sdk are excellent. This is what the Angular production layer provides on top.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          maxWidth: 860, margin: '0 auto',
          borderRadius: 20,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
          overflow: 'hidden',
        }}
      >
        {/* Table header — hidden on mobile, grid on md+ */}
        <div className="hidden md:grid" style={{
          gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(255,255,255,.3)',
          borderBottom: `1px solid ${tokens.glass.border}`,
          padding: '14px 24px',
        }}>
          {['Capability', '@langchain/langgraph-sdk', 'With Angular Agent Framework'].map((h, i) => (
            <div key={h} style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: i === 2 ? tokens.colors.accent : tokens.colors.textMuted,
            }}>
              {h}
            </div>
          ))}
        </div>
        {/* Rows */}
        {ROWS.map((row, i) => (
          <motion.div
            key={row.capability}
            className="fair-compare-row"
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={{
              padding: '14px 24px',
              borderBottom: i < ROWS.length - 1 ? `1px solid rgba(0,0,0,.05)` : 'none',
              alignItems: 'center',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.72rem', fontWeight: 700, color: tokens.colors.textPrimary,
            }}>
              {row.capability}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.textMuted, paddingRight: 16, lineHeight: 1.5 }}>
              <span className="md:hidden" style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', opacity: 0.5, display: 'block', marginBottom: 2 }}>Without</span>
              {row.without}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.accent, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6, flexWrap: 'wrap' }}>
              <span className="md:hidden" style={{ fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)', fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', width: '100%', marginBottom: 2 }}>With Angular Agent Framework</span>
              <span style={{ color: '#1a7a40', marginTop: 2, flexShrink: 0 }}>✓</span>
              <span style={{ fontFamily: row.with.startsWith('<') ? 'var(--font-mono,"JetBrains Mono",monospace)' : 'inherit', fontSize: row.with.startsWith('<') ? '0.72rem' : '0.8rem' }}>
                {row.with}
              </span>
            </div>
          </motion.div>
        ))}
      </motion.div>
      <style>{`
        .fair-compare-row {
          display: grid;
          grid-template-columns: 1fr 1fr 1fr;
        }
        @media (max-width: 767px) {
          .fair-compare-row {
            display: flex !important;
            flex-direction: column !important;
            gap: 8px !important;
          }
        }
      `}</style>
    </section>
  );
}
