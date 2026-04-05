'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const FEATURES = [
  { icon: '\u26A1', title: 'Token-by-token streaming', desc: 'Real-time SSE streaming via FetchStreamTransport. Messages update as each token arrives.' },
  { icon: '\uD83D\uDD17', title: 'Thread persistence', desc: 'MemorySaver-backed threads survive page refreshes via threadId signal and onThreadId callback.' },
  { icon: '\uD83D\uDCD0', title: 'Angular Signals', desc: 'Every state slice is an Angular Signal. Works with OnPush, async pipe, and computed().' },
  { icon: '\uD83E\uDDEA', title: 'MockStreamTransport', desc: 'Deterministic unit testing. Script event sequences and step through them in your specs.' },
  { icon: '\uD83D\uDD27', title: 'Full useStream() parity', desc: 'Interrupts, tool calls, subagents, branch history, joinStream \u2014 everything the React SDK exposes.' },
  { icon: '\uD83C\uDFE2', title: 'Source-available licensing', desc: 'Free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial license at $500/seat/year or $2,000/app deployment.' },
];

export function FeatureStrip() {
  return (
    <section className="px-8 py-16 max-w-6xl mx-auto">
      <h2 className="font-mono text-xs uppercase tracking-widest mb-12 text-center"
        style={{ color: tokens.colors.accent, fontWeight: 'normal' }}>Features</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="p-6 rounded-lg cursor-default"
            style={{
              border: `1px solid ${tokens.glass.border}`,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileHover={{
              borderColor: tokens.colors.accentBorderHover,
              boxShadow: tokens.glow.card,
              background: tokens.glass.bgHover,
            }}>
            <div className="mb-3" style={{ fontSize: '1.5rem', color: tokens.colors.accent }} aria-hidden="true">{f.icon}</div>
            <h3 style={{ fontFamily: 'var(--font-garamond)', fontWeight: 700, fontSize: '1.125rem', color: tokens.colors.textPrimary, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
