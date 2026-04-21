'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const LIBRARIES = [
  {
    id: 'angular',
    tag: 'Agent',
    pkg: '@cacheplane/langgraph',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    oneLiner: 'Signal-native streaming for LangGraph agents',
    chips: ['agent()', 'provideAgent()', 'interrupt()', 'MockStreamTransport'],
    href: '/angular',
    ctaLabel: 'Explore Angular',
  },
  {
    id: 'render',
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: tokens.colors.renderGreen,
    rgb: '26,122,64',
    oneLiner: 'Agents that render UI — without coupling to your frontend',
    chips: ['<render-spec>', 'defineAngularRegistry()', 'signalStateStore()', 'JSON patch'],
    href: '/render',
    ctaLabel: 'Explore Render',
  },
  {
    id: 'chat',
    tag: 'Chat',
    pkg: '@cacheplane/chat',
    color: tokens.colors.chatPurple,
    rgb: '90,0,200',
    oneLiner: 'Batteries-included agent chat — fully featured from day one',
    chips: ['<chat-messages>', '<chat>', '<chat-debug>', '<chat-generative-ui>'],
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
];

export function LibrariesSection() {
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
          The Cacheplane Stack
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary, marginBottom: 10,
        }}>
          Three libraries. One architecture.
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary,
          maxWidth: 520, margin: '0 auto',
        }}>
          Everything your Angular team needs to ship AI agents to production.
        </p>
      </motion.div>

      <div style={{
        maxWidth: 1000, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
        gap: 24,
      }}>
        {LIBRARIES.map((lib, i) => (
          <motion.div
            key={lib.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              background: `rgba(${lib.rgb}, 0.03)`,
              border: `1px solid rgba(${lib.rgb}, 0.15)`,
              borderRadius: 14,
              padding: '24px 24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              padding: '2px 9px', borderRadius: 5, color: '#fff', background: lib.color,
            }}>
              {lib.tag}
            </span>

            <p style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.76rem', fontWeight: 700, color: lib.color, margin: 0,
            }}>
              {lib.pkg}
            </p>

            <p style={{
              fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
              fontSize: '1.1rem', fontWeight: 700, color: tokens.colors.textPrimary,
              lineHeight: 1.25, margin: 0,
            }}>
              {lib.oneLiner}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {lib.chips.map(chip => (
                <span key={chip} style={{
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.58rem', padding: '2px 8px', borderRadius: 4,
                  background: `rgba(${lib.rgb},.07)`, color: lib.color,
                  border: `1px solid rgba(${lib.rgb},.15)`,
                }}>
                  {chip}
                </span>
              ))}
            </div>

            <Link
              href={lib.href}
              style={{
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: '0.72rem', fontWeight: 700, color: lib.color,
                textDecoration: 'none', marginTop: 'auto', paddingTop: 8,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {lib.ctaLabel} →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
