// apps/website/src/components/landing/chat-landing/ChatLandingHero.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const BADGES = ['Angular 20+', 'Vercel json-render', 'Google A2UI', 'WCAG accessible'];

export function ChatLandingHero() {
  return (
    <section aria-labelledby="chat-hero-heading" style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="py-24 md:py-32">
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
            color: tokens.colors.chatPurple, textTransform: 'uppercase', display: 'inline-block', marginBottom: '1.5rem',
          }}>
            @cacheplane/chat
          </span>
        </motion.div>

        <motion.h1 id="chat-hero-heading" initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: "'EB Garamond', serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700,
            lineHeight: 1.1, color: tokens.colors.textPrimary, margin: 0, marginBottom: '1.25rem',
          }}>
          Production agent chat UI in days, not sprints
        </motion.h1>

        <motion.p initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 18, color: tokens.colors.textSecondary,
            maxWidth: '52ch', margin: '0 auto', lineHeight: 1.6, marginBottom: '2rem',
          }}>
          The batteries-included Angular chat library. Built on the agent framework, Vercel's json-render spec, and Google's A2UI spec. Every feature included — debug, theming, generative UI, streaming — from day one.
        </motion.p>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="/whitepapers/chat.pdf" download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.colors.chatPurple, color: '#fff', fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', boxShadow: tokens.glow.button, minHeight: 44,
            }}>
            Download the Guide
          </a>
          <a href="/docs"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: tokens.colors.chatPurple, fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', border: '1px solid rgba(90,0,200,0.2)', minHeight: 44,
            }}>
            View Docs
          </a>
        </motion.div>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {BADGES.map(badge => (
            <span key={badge} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.06em',
              color: tokens.colors.textMuted, textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 4,
              background: 'rgba(90,0,200,0.04)', border: '1px solid rgba(90,0,200,0.1)',
            }}>
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
