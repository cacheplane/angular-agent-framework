'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from '@ngaf/design-tokens';

/**
 * Bump this date to re-show the toast for all users.
 * Format: YYYY-MM-DD
 */
const ANNOUNCEMENT_DATE = '2026-04-07';
const STORAGE_KEY = `dismissed-announcement-${ANNOUNCEMENT_DATE}`;
const DELAY_MS = 30_000;

type Step = 'cta' | 'form' | 'sent';

export function AnnouncementToast() {
  const [visible, setVisible] = useState(false);
  const [step, setStep] = useState<Step>('cta');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    } catch {
      return;
    }
    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch { /* ignore */ }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitting(true);
    try {
      await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
    } catch { /* best-effort */ }
    setStep('sent');
    setSubmitting(false);
    // Auto-dismiss after showing success
    setTimeout(dismiss, 4000);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${tokens.glass.border}`,
    borderRadius: 8,
    padding: '8px 12px',
    fontSize: '0.82rem',
    color: tokens.colors.textPrimary,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  };

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 60, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 40, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 300 }}
          style={{
            position: 'fixed',
            bottom: 24,
            right: 24,
            zIndex: 100,
            maxWidth: 360,
            width: 'calc(100vw - 48px)',
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
            boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
            borderRadius: 16,
            padding: '20px 24px',
          }}
          role="alert"
          aria-live="polite"
        >
          {/* Dismiss button */}
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            style={{
              position: 'absolute',
              top: 10,
              right: 12,
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: tokens.colors.textMuted,
              fontSize: 18,
              lineHeight: 1,
              padding: 4,
            }}
          >
            ×
          </button>

          {/* Eyebrow */}
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.62rem',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            fontWeight: 700,
            color: tokens.colors.accent,
            marginBottom: 8,
          }}>
            Free Guide
          </p>

          {/* Title */}
          <p style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontSize: '1.05rem',
            fontWeight: 700,
            color: tokens.colors.textPrimary,
            lineHeight: 1.3,
            marginBottom: 6,
          }}>
            From Prototype to Production
          </p>

          {step === 'cta' && (
            <>
              <p style={{
                fontSize: '0.82rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.5,
                marginBottom: 16,
              }}>
                Six production-readiness dimensions for Angular agents. Get the guide.
              </p>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  onClick={() => setStep('form')}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: tokens.colors.accent,
                    color: '#fff',
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'box-shadow .2s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,64,144,.3)')}
                  onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
                >
                  ↓ Get the Guide
                </button>
                <button
                  onClick={dismiss}
                  style={{
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                    fontSize: '0.68rem',
                    color: tokens.colors.textMuted,
                    textDecoration: 'underline',
                    padding: '8px 4px',
                  }}
                >
                  Not now
                </button>
              </div>
            </>
          )}

          {step === 'form' && (
            <form onSubmit={handleSubmit} style={{ marginTop: 8 }}>
              <label htmlFor="toast-email" className="sr-only">Email address</label>
              <input
                id="toast-email"
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                disabled={submitting}
                autoFocus
                style={{ ...inputStyle, marginBottom: 10 }}
                onFocus={e => (e.currentTarget.style.borderColor = tokens.colors.accent)}
                onBlur={e => (e.currentTarget.style.borderColor = tokens.glass.border)}
              />
              <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                <button
                  type="submit"
                  disabled={submitting || !email}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 6,
                    background: email ? tokens.colors.accent : 'rgba(0,0,0,.08)',
                    color: email ? '#fff' : tokens.colors.textMuted,
                    padding: '8px 18px',
                    borderRadius: 8,
                    fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                    border: 'none',
                    cursor: email ? 'pointer' : 'not-allowed',
                    transition: 'box-shadow .2s, background .2s',
                  }}
                >
                  {submitting ? 'Sending...' : '↓ Send me the guide'}
                </button>
              </div>
              <a
                href="/whitepaper.pdf"
                download="angular-agent-readiness-guide.pdf"
                onClick={dismiss}
                style={{
                  display: 'inline-block',
                  marginTop: 10,
                  fontSize: '0.7rem',
                  color: tokens.colors.textMuted,
                  textDecoration: 'underline',
                  fontFamily: 'Inter, sans-serif',
                }}
              >
                or download directly
              </a>
            </form>
          )}

          {step === 'sent' && (
            <div style={{ marginTop: 8 }}>
              <p style={{
                fontSize: '0.85rem',
                color: '#1a7a40',
                lineHeight: 1.5,
              }}>
                ✓ Check your inbox — the guide is on its way!
              </p>
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
