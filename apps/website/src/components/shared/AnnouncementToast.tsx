'use client';
import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

/**
 * Bump this date to re-show the toast for all users.
 * Format: YYYY-MM-DD
 */
const ANNOUNCEMENT_DATE = '2026-04-07';
const STORAGE_KEY = `dismissed-announcement-${ANNOUNCEMENT_DATE}`;
const DELAY_MS = 30_000;

export function AnnouncementToast() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Check if already dismissed for this announcement date
    try {
      if (localStorage.getItem(STORAGE_KEY) === 'true') return;
    } catch {
      // localStorage unavailable (SSR, private browsing)
      return;
    }

    const timer = setTimeout(() => setVisible(true), DELAY_MS);
    return () => clearTimeout(timer);
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(STORAGE_KEY, 'true');
    } catch {
      // ignore
    }
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

          {/* Content */}
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
          <p style={{
            fontSize: '0.82rem',
            color: tokens.colors.textSecondary,
            lineHeight: 1.5,
            marginBottom: 16,
          }}>
            Six production-readiness dimensions for Angular agents. Get the guide.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <a
              href="/whitepaper.pdf"
              download="angular-agent-readiness-guide.pdf"
              onClick={dismiss}
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
                textDecoration: 'none',
                transition: 'box-shadow .2s',
              }}
              onMouseEnter={e => (e.currentTarget.style.boxShadow = '0 4px 16px rgba(0,64,144,.3)')}
              onMouseLeave={e => (e.currentTarget.style.boxShadow = 'none')}
            >
              ↓ Download
            </a>
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}
