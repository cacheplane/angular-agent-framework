'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

type FormState = 'idle' | 'submitting' | 'done' | 'error';

export function WhitePaperSection() {
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
        body: JSON.stringify({ name, email }),
      });
      if (!res.ok) throw new Error('Server error');
      setFormState('done');
    } catch {
      setFormState('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${tokens.glass.border}`,
    borderRadius: 10,
    padding: '10px 14px',
    fontSize: '0.88rem',
    color: tokens.colors.textPrimary,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
    marginBottom: 10,
    backdropFilter: `blur(${tokens.glass.blur})`,
  };

  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: 860,
          margin: '0 auto',
          borderRadius: 20,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          boxShadow: tokens.glass.shadow,
          padding: '48px 56px',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gap: 56,
          alignItems: 'center',
        }}
      >
        {/* Left — form / soft gate */}
        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em',
            fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
          }}>
            Get the Guide
          </p>

          {formState === 'done' ? (
            <>
              <div style={{
                padding: '20px 24px', borderRadius: 12,
                background: 'rgba(26,122,64,.07)', border: '1px solid rgba(26,122,64,.2)',
                fontSize: '0.88rem', color: '#1a7a40', lineHeight: 1.55,
              }}>
                ✓ Check your inbox — the guide is on its way!
              </div>
              <a
                href="/whitepaper.pdf"
                download="streamresource-angular-agent-readiness-guide.pdf"
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  fontSize: '0.75rem',
                  color: tokens.colors.textMuted,
                  textDecoration: 'underline',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                or download directly
              </a>
            </>
          ) : (
            <>
              <form onSubmit={handleSubmit}>
                <label htmlFor="wp-name" className="sr-only">Name (optional)</label>
                <input
                  id="wp-name"
                  aria-label="Name (optional)"
                  style={inputStyle}
                  type="text"
                  placeholder="Name (optional)"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  disabled={formState === 'submitting'}
                />
                <label htmlFor="wp-email" className="sr-only">Email address</label>
                <input
                  id="wp-email"
                  aria-label="Email address"
                  style={{ ...inputStyle, marginBottom: 16 }}
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  disabled={formState === 'submitting'}
                />
                {formState === 'error' && (
                  <p style={{ fontSize: '0.8rem', color: tokens.colors.angularRed, marginBottom: 10 }}>
                    Something went wrong — please try again.
                  </p>
                )}
                <button
                  type="submit"
                  disabled={formState === 'submitting' || !email}
                  style={{
                    padding: '10px 24px', borderRadius: 9,
                    background: email ? `rgba(0,64,144,.08)` : 'rgba(0,0,0,.04)',
                    border: `1px solid ${email ? `rgba(0,64,144,.22)` : 'rgba(0,0,0,.08)'}`,
                    color: email ? tokens.colors.accent : tokens.colors.textMuted,
                    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                    fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                    cursor: email ? 'pointer' : 'not-allowed',
                    transition: 'background .2s, border-color .2s',
                  }}
                >
                  {formState === 'submitting' ? 'Sending…' : 'Send me the guide'}
                </button>
              </form>
              <a
                href="/whitepaper.pdf"
                download="streamresource-angular-agent-readiness-guide.pdf"
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  fontSize: '0.75rem',
                  color: tokens.colors.textMuted,
                  textDecoration: 'underline',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                or download directly
              </a>
            </>
          )}
        </div>

        {/* Right — value prop */}
        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            fontWeight: 700, color: tokens.colors.textMuted, marginBottom: 16,
          }}>
            What&apos;s Inside
          </p>
          <h2 style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontSize: 'clamp(22px,2.5vw,36px)', fontWeight: 800, lineHeight: 1.15,
            color: tokens.colors.textPrimary, marginBottom: 14,
          }}>
            From Prototype<br />to Production
          </h2>
          <p style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontStyle: 'italic', fontSize: '1rem', color: tokens.colors.textSecondary,
            lineHeight: 1.55, marginBottom: 28,
          }}>
            The Angular Agent Readiness Guide. Six chapters. Six production-readiness dimensions.
            What separates demos from shipped products.
          </p>
        </div>
      </motion.div>
    </section>
  );
}
