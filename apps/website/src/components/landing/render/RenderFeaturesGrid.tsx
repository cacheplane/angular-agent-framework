// apps/website/src/components/landing/render/RenderFeaturesGrid.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';
import { EmbedFrame } from '../EmbedFrame';

const FEATURES = [
  { title: 'Spec Rendering', desc: 'Render declarative UI specs from agent output. The agent emits JSON, your Angular components materialize it.', iframePath: 'render/core-capabilities/spec-rendering/overview/python' },
  { title: 'Element Rendering', desc: 'Map spec elements to Angular components. Each element type resolves to a registered component automatically.', iframePath: 'render/core-capabilities/element-rendering/overview/python' },
  { title: 'State Management', desc: 'Signal-native state store for spec data. Reactive updates flow through your component tree via signalStateStore().', iframePath: 'render/core-capabilities/state-management/overview/python' },
  { title: 'Component Registry', desc: 'Register Angular components by type. defineAngularRegistry() maps spec types to your components — swap without touching the agent.', iframePath: 'render/core-capabilities/registry/overview/python' },
  { title: 'Repeat Loops', desc: 'Render lists from spec arrays. Dynamic list rendering with automatic add/remove as streaming data arrives.', iframePath: 'render/core-capabilities/repeat-loops/overview/python' },
  { title: 'Computed Functions', desc: 'Derive values reactively from spec state. Computed properties update automatically as upstream data changes.', iframePath: 'render/core-capabilities/computed-functions/overview/python' },
];

export function RenderFeaturesGrid() {
  return (
    <section className="render-features" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .render-features { padding: 60px 20px !important; } }`}</style>
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
          Every json-render capability, production-ready
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
            <EmbedFrame
              src={`https://cockpit.cacheplane.ai/${feat.iframePath}`}
              title={feat.title}
              height={400}
            />
          </motion.div>
        ))}
      </div>
    </section>
  );
}
