// apps/website/src/components/landing/chat-landing/ChatLandingFeaturesGrid.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';
import { EmbedFrame } from '../EmbedFrame';

const FEATURES = [
  { title: 'Messages', desc: 'Streaming message display with token-by-token rendering. Markdown support, auto-scroll, and accessible message list.', iframePath: 'chat/core-capabilities/messages/overview/python' },
  { title: 'Input', desc: 'Chat input with send and interrupt controls. Keyboard shortcuts, disabled state during streaming, accessible labels.', iframePath: 'chat/core-capabilities/input/overview/python' },
  { title: 'Generative UI', desc: 'Inline spec rendering in conversation. Vercel json-render specs and Google A2UI surfaces render as native Angular components — 18 built-in A2UI components, v0.9 CheckRule validation, and consumer-extensible action handlers.', iframePath: 'chat/core-capabilities/generative-ui/overview/python' },
  { title: 'Theming', desc: 'CSS custom property theming that integrates with your design system. Swap colors, fonts, spacing without touching component code.', iframePath: 'chat/core-capabilities/theming/overview/python' },
  { title: 'Debug', desc: 'Agent state inspector for development. View messages, tool calls, interrupts, and streaming state in real time.', iframePath: 'chat/core-capabilities/debug/overview/python' },
];

export function ChatLandingFeaturesGrid() {
  return (
    <section className="chat-features" style={{ padding: '80px 32px' }}>
      <style>{`@media (max-width: 767px) { .chat-features { padding: 60px 20px !important; } }`}</style>
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
          Features
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Every chat capability, production-ready
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
