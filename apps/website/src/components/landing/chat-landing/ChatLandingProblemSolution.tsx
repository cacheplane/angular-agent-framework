// apps/website/src/components/landing/chat-landing/ChatLandingProblemSolution.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@ngaf/design-tokens';

const PAIN_POINTS = [
  'Message rendering from scratch',
  'Streaming indicators from scratch',
  'Input handling from scratch',
  'Accessibility added as afterthought',
  'Generative UI bolted on later',
  'Debug tooling usually skipped',
];

const SOLUTIONS = [
  'Pre-built accessible components',
  'Vercel json-render spec via @ngaf/render',
  'Google A2UI spec — 18 built-in components, v0.9 CheckRule validation',
  'Consumer-extensible action handlers for both specs',
  'Debug tooling + CSS custom property theming included',
  'Every feature ships together — not incrementally',
];

export function ChatLandingProblemSolution() {
  return (
    <section className="chat-problem" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .chat-problem { padding: 60px 20px !important; } }`}</style>
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
            Without @ngaf/chat
          </span>
          <h3 style={{
            fontFamily: "'EB Garamond', serif", fontSize: '1.3rem', fontWeight: 700,
            color: tokens.colors.textPrimary, lineHeight: 1.25, marginBottom: 16,
          }}>
            Every team rebuilds the same chat UI. It takes 4-6 weeks and delays the real agent work.
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
            padding: '2px 9px', borderRadius: 5, color: '#fff', background: '#1a7a40', marginBottom: 16,
          }}>
            With @ngaf/chat
          </span>
          <h3 style={{
            fontFamily: "'EB Garamond', serif", fontSize: '1.3rem', fontWeight: 700,
            color: tokens.colors.textPrimary, lineHeight: 1.25, marginBottom: 16,
          }}>
            Fully featured from day one. No feature backlog.
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SOLUTIONS.map(s => (
              <li key={s} style={{ display: 'flex', gap: 8, fontSize: '0.85rem', color: '#333', lineHeight: 1.5 }}>
                <span style={{ color: '#1a7a40', flexShrink: 0 }}>✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
