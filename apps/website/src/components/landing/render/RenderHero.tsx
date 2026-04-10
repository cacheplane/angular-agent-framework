// apps/website/src/components/landing/render/RenderHero.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const BADGES = ['Angular 20+', 'Vercel json-render', 'Google A2UI', 'JSON Patch streaming'];

export function RenderHero() {
  return (
    <section aria-labelledby="render-hero-heading" style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="py-24 md:py-32">
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
            color: tokens.colors.accent, textTransform: 'uppercase', display: 'inline-block', marginBottom: '1.5rem',
          }}>
            @cacheplane/render
          </span>
        </motion.div>

        <motion.h1 id="render-hero-heading" initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: "'EB Garamond', serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700,
            lineHeight: 1.1, color: tokens.colors.textPrimary, margin: 0, marginBottom: '1.25rem',
          }}>
          Agents that render UI — without coupling to your frontend
        </motion.h1>

        <motion.p initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 18, color: tokens.colors.textSecondary,
            maxWidth: '52ch', margin: '0 auto', lineHeight: 1.6, marginBottom: '2rem',
          }}>
          Built on Vercel's json-render spec and Google's A2UI protocol — open standards you already trust. @cacheplane/render brings both to Angular with streaming JSON patches, component registries, and signal-native state.
        </motion.p>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="/whitepapers/render.pdf" download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: '#1a7a40', color: '#fff', fontFamily: 'Inter, sans-serif',
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
              color: tokens.colors.accent, fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', border: `1px solid ${tokens.colors.accentBorder}`, minHeight: 44,
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
              background: 'rgba(26,122,64,0.04)', border: '1px solid rgba(26,122,64,0.1)',
            }}>
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
