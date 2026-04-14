// apps/website/src/components/landing/render/RenderProblemSolution.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const PAIN_POINTS = [
  'Hardcoded component logic per agent',
  'Tight coupling blocks iteration',
  "Can't swap UI without rewriting agent",
  'No streaming for progressive updates',
  'Every new agent capability requires frontend work',
];

const SOLUTIONS = [
  'Declarative UI specs — Vercel json-render + Google A2UI',
  'Hot-swappable component registry with extensible handlers',
  'No frontend deploy for new capabilities',
  'Progressive JSON patch streaming',
  '18 built-in A2UI components with v0.9 CheckRule validation',
  'Two open standards, one rendering engine',
];

export function RenderProblemSolution() {
  return (
    <section className="render-problem" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .render-problem { padding: 60px 20px !important; } }`}</style>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: 900, margin: '0 auto',
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(360px, 100%), 1fr))', gap: 32,
        }}
      >
        <div style={{
          padding: 28, borderRadius: 14,
          background: 'rgba(183,28,28,0.03)', border: '1px solid rgba(183,28,28,0.15)',
        }}>
          <span style={{
            display: 'inline-block', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            padding: '2px 9px', borderRadius: 5, color: '#fff', background: '#b71c1c', marginBottom: 16,
          }}>
            Without @cacheplane/render
          </span>
          <h3 style={{
            fontFamily: "'EB Garamond', serif", fontSize: '1.3rem', fontWeight: 700,
            color: tokens.colors.textPrimary, lineHeight: 1.25, marginBottom: 16,
          }}>
            Every new agent output means a new frontend deploy.
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PAIN_POINTS.map(p => (
              <li key={p} style={{ display: 'flex', gap: 8, fontSize: '0.85rem', color: '#555', lineHeight: 1.5 }}>
                <span style={{ color: '#b71c1c', flexShrink: 0 }}>✗</span> {p}
              </li>
            ))}
          </ul>
        </div>

        <div style={{
          padding: 28, borderRadius: 14,
          background: 'rgba(26,122,64,0.03)', border: '1px solid rgba(26,122,64,0.15)',
        }}>
          <span style={{
            display: 'inline-block', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            padding: '2px 9px', borderRadius: 5, color: '#fff', background: tokens.colors.renderGreen, marginBottom: 16,
          }}>
            With @cacheplane/render
          </span>
          <h3 style={{
            fontFamily: "'EB Garamond', serif", fontSize: '1.3rem', fontWeight: 700,
            color: tokens.colors.textPrimary, lineHeight: 1.25, marginBottom: 16,
          }}>
            The agent emits a spec. Your registry renders it.
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SOLUTIONS.map(s => (
              <li key={s} style={{ display: 'flex', gap: 8, fontSize: '0.85rem', color: '#333', lineHeight: 1.5 }}>
                <span style={{ color: tokens.colors.renderGreen, flexShrink: 0 }}>✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
