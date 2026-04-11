// apps/website/src/components/landing/render/RenderWhitePaperGate.tsx
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

type FormState = 'idle' | 'submitting' | 'done' | 'error';

export function RenderWhitePaperGate() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setFormState('submitting');
    try {
      const res = await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, paper: 'render' }),
      });
      if (!res.ok) throw new Error('Server error');
      setFormState('done');
    } catch {
      setFormState('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${tokens.glass.border}`, borderRadius: 10,
    padding: '10px 14px', fontSize: '0.88rem', color: tokens.colors.textPrimary,
    fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: 10,
    backdropFilter: `blur(${tokens.glass.blur})`,
  };

  return (
    <section id="render-whitepaper-gate" style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: 860, margin: '0 auto', borderRadius: 20,
          background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glass.shadow,
          padding: '32px 24px', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(320px, 100%), 1fr))', gap: 56, alignItems: 'center',
        }}
      >
        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em',
            fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
          }}>
            Free Download
          </p>
          <h2 style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontSize: 'clamp(22px,2.5vw,36px)', fontWeight: 800, lineHeight: 1.15,
            color: tokens.colors.textPrimary, marginBottom: 14,
          }}>
            The Enterprise Guide to Generative UI in Angular
          </h2>
          <p style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontStyle: 'italic', fontSize: '1rem', color: tokens.colors.textSecondary,
            lineHeight: 1.55, marginBottom: 28,
          }}>
            Five chapters covering the coupling problem, declarative UI specs with Vercel's json-render standard, the component registry, streaming JSON patches, and state management.
          </p>
          <a href="/whitepapers/render.pdf" download="cacheplane-render-enterprise-guide.pdf"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: tokens.colors.renderGreen, color: '#fff',
              padding: '12px 28px', borderRadius: 10,
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(26,122,64,.28)',
            }}>
            ↓ Download PDF
          </a>
        </div>

        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            fontWeight: 700, color: tokens.colors.textMuted, marginBottom: 16,
          }}>
            Optional — Get notified of updates
          </p>
          {formState === 'done' ? (
            <div style={{
              padding: '20px 24px', borderRadius: 12,
              background: 'rgba(26,122,64,.07)', border: '1px solid rgba(26,122,64,.2)',
              fontSize: '0.88rem', color: tokens.colors.renderGreen, lineHeight: 1.55,
            }}>
              ✓ Thanks! We'll reach out when the guide is updated.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="render-wp-name" className="sr-only">Name (optional)</label>
              <input id="render-wp-name" style={inputStyle} type="text" placeholder="Name (optional)"
                value={name} onChange={e => setName(e.target.value)} disabled={formState === 'submitting'} />
              <label htmlFor="render-wp-email" className="sr-only">Email address</label>
              <input id="render-wp-email" style={{ ...inputStyle, marginBottom: 16 }} type="email"
                placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                required disabled={formState === 'submitting'} />
              {formState === 'error' && (
                <p style={{ fontSize: '0.8rem', color: tokens.colors.angularRed, marginBottom: 10 }}>
                  Something went wrong — please try again.
                </p>
              )}
              <button type="submit" disabled={formState === 'submitting' || !email}
                style={{
                  padding: '10px 24px', borderRadius: 9,
                  background: email ? 'rgba(26,122,64,.08)' : 'rgba(0,0,0,.04)',
                  border: `1px solid ${email ? 'rgba(26,122,64,.22)' : 'rgba(0,0,0,.08)'}`,
                  color: email ? tokens.colors.renderGreen : tokens.colors.textMuted,
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  cursor: email ? 'pointer' : 'not-allowed',
                }}>
                {formState === 'submitting' ? 'Sending…' : 'Notify me'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
