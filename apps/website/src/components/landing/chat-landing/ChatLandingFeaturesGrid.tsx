// apps/website/src/components/landing/chat-landing/ChatLandingFeaturesGrid.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const FEATURES = [
  { title: 'Messages', desc: 'Streaming message display with token-by-token rendering. Markdown support, auto-scroll, and accessible message list.', iframePath: 'chat/messages' },
  { title: 'Input', desc: 'Chat input with send and interrupt controls. Keyboard shortcuts, disabled state during streaming, accessible labels.', iframePath: 'chat/input' },
  { title: 'Generative UI', desc: 'Inline spec rendering in conversation. json-render and Google A2UI specs render as native Angular components within the chat.', iframePath: 'chat/generative-ui' },
  { title: 'Theming', desc: 'CSS custom property theming that integrates with your design system. Swap colors, fonts, spacing without touching component code.', iframePath: 'chat/theming' },
  { title: 'Debug', desc: 'Agent state inspector for development. View messages, tool calls, interrupts, and streaming state in real time.', iframePath: 'chat/debug' },
];

export function ChatLandingFeaturesGrid() {
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
          fontWeight: 700, color: '#5a00c8', marginBottom: 14,
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
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24,
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
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
