'use client';
import { useState, useEffect } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';
import { Button } from '../ui/Button';

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
  const [mounted, setMounted] = useState(false);
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

  useEffect(() => {
    if (visible) {
      // Next frame: flip mounted so the CSS transition runs from initial to final state.
      const id = requestAnimationFrame(() => setMounted(true));
      return () => cancelAnimationFrame(id);
    }
    setMounted(false);
    return undefined;
  }, [visible]);

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
    track(analyticsEvents.marketingWhitepaperSignupSubmit, {
      surface: 'toast',
      source_section: 'announcement-toast',
      paper: 'overview',
    });
    try {
      await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      track(analyticsEvents.marketingWhitepaperSignupSuccess, {
        surface: 'toast',
        source_section: 'announcement-toast',
        paper: 'overview',
      });
    } catch {
      track(analyticsEvents.marketingWhitepaperSignupFail, {
        surface: 'toast',
        source_section: 'announcement-toast',
        paper: 'overview',
        error_reason: 'api_error',
      });
    }
    setStep('sent');
    setSubmitting(false);
    // Auto-dismiss after showing success
    setTimeout(dismiss, 4000);
  };

  const inputStyle: React.CSSProperties = {
    width: '100%',
    background: tokens.surfaces.surface,
    border: `1px solid ${tokens.surfaces.border}`,
    borderRadius: tokens.radius.md,
    padding: '8px 12px',
    fontSize: '0.82rem',
    color: tokens.colors.textPrimary,
    fontFamily: 'Inter, sans-serif',
    outline: 'none',
  };

  if (!visible) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 100,
        maxWidth: 360,
        width: 'calc(100vw - 48px)',
        background: tokens.surfaces.surface,
        border: `1px solid ${tokens.surfaces.border}`,
        boxShadow: tokens.shadows.lg,
        borderRadius: tokens.radius.lg,
        padding: '20px 24px',
        opacity: mounted ? 1 : 0,
        transform: mounted ? 'translateY(0)' : 'translateY(12px)',
        transition: 'opacity 200ms ease, transform 240ms ease',
      }}
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
            <Button
              variant="primary"
              size="md"
              onClick={() => {
                track(analyticsEvents.marketingCtaClick, {
                  surface: 'toast',
                  source_section: 'announcement-toast',
                  cta_id: 'toast_get_guide',
                });
                setStep('form');
              }}
            >
              ↓ Get the Guide
            </Button>
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
            onBlur={e => (e.currentTarget.style.borderColor = tokens.surfaces.border)}
          />
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <Button
              type="submit"
              variant="primary"
              size="md"
              disabled={submitting || !email}
            >
              {submitting ? 'Sending...' : '↓ Send me the guide'}
            </Button>
          </div>
          <a
            href="/whitepaper.pdf"
            download="angular-agent-readiness-guide.pdf"
            onClick={() => {
              trackWhitepaperDownloadClick('overview', {
                surface: 'toast',
                source_section: 'announcement-toast',
                cta_id: 'toast_direct_download',
              });
              dismiss();
            }}
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
    </div>
  );
}
