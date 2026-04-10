// apps/website/src/components/landing/angular/AngularFeaturesGrid.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const FEATURES = [
  { title: 'agent() API', desc: 'Signal-native streaming with automatic state management. One function to connect your Angular app to LangGraph.', iframePath: 'langgraph/core-capabilities/streaming/overview/python' },
  { title: 'Thread Persistence', desc: 'Conversations survive page refreshes. Built-in threadId signal with localStorage restore and thread list UI.', iframePath: 'langgraph/core-capabilities/persistence/overview/python' },
  { title: 'Interrupt Handling', desc: 'Human-in-the-loop approval flows. interrupt() signal maps directly to approve, edit, or cancel actions.', iframePath: 'langgraph/core-capabilities/interrupts/overview/python' },
  { title: 'Tool Call Support', desc: 'Structured tool execution state. Progressive disclosure — live steps, completion, collapsible history.', iframePath: 'langgraph/core-capabilities/subgraphs/overview/python' },
  { title: 'Time Travel', desc: 'Navigate agent state history. Replay, inspect, and debug any point in a conversation timeline.', iframePath: 'langgraph/core-capabilities/time-travel/overview/python' },
  { title: 'DeepAgent Support', desc: 'Multi-agent orchestration with full streaming support. Subgraphs, delegation, parallel execution.', iframePath: 'deep-agents/core-capabilities/subagents/overview/python' },
];

export function AngularFeaturesGrid() {
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
          Features
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Every LangGraph capability, production-ready
        </h2>
      </motion.div>

      <div style={{
        maxWidth: 1000, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(440px, 100%), 1fr))', gap: 24,
      }}>
        {FEATURES.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            style={{
              background: tokens.glass.bg, border: `1px solid ${tokens.glass.border}`,
              backdropFilter: `blur(${tokens.glass.blur})`, WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              borderRadius: 14, overflow: 'hidden', boxShadow: tokens.glass.shadow,
            }}
          >
            <div style={{ padding: '20px 24px 16px' }}>
              <h3 style={{
                fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600,
                color: tokens.colors.textPrimary, margin: 0, marginBottom: 6,
              }}>
                {feat.title}
              </h3>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: 14, color: tokens.colors.textSecondary,
                lineHeight: 1.6, margin: 0,
              }}>
                {feat.desc}
              </p>
            </div>
            <div style={{ borderTop: `1px solid ${tokens.glass.border}`, background: 'rgba(0,0,0,0.02)' }}>
              <iframe
                src={`https://cockpit.cacheplane.ai/${feat.iframePath}`}
                title={feat.title}
                style={{ width: '100%', height: 320, border: 'none', display: 'block' }}
                loading="lazy"
                sandbox="allow-scripts allow-same-origin"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
