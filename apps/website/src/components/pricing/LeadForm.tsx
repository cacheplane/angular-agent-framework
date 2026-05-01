'use client';
import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.6)',
    border: `1px solid ${tokens.glass.border}`,
    color: tokens.colors.textPrimary,
    borderRadius: '6px',
    padding: '10px 14px',
    width: '100%',
    fontFamily: 'var(--font-inter)',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <section id="lead-form" className="px-8 py-16 max-w-xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest mb-8 text-center" style={{ color: tokens.colors.accent }}>Enterprise</p>
      <h2
        style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 700,
          fontSize: 'clamp(24px, 3vw, 36px)',
          color: tokens.colors.textPrimary,
          textAlign: 'center',
          marginBottom: 32,
        }}>
        Need volume seats or a custom contract?
      </h2>
      {status === 'sent' ? (
        <p className="text-center" style={{ color: tokens.colors.textSecondary }}>Thanks &mdash; we&apos;ll be in touch within one business day.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4"
          style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
            borderRadius: 12,
            padding: 24,
          }}>
          <label htmlFor="lf-name" className="sr-only">Name</label>
          <input
            id="lf-name"
            name="name"
            aria-label="Name"
            placeholder="Name"
            required
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <label htmlFor="lf-email" className="sr-only">Work email</label>
          <input
            id="lf-email"
            name="email"
            type="email"
            aria-label="Work email"
            placeholder="Work email"
            required
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <label htmlFor="lf-company" className="sr-only">Company</label>
          <input
            id="lf-company"
            name="company"
            aria-label="Company"
            placeholder="Company"
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <label htmlFor="lf-message" className="sr-only">Tell us about your use case</label>
          <textarea
            id="lf-message"
            name="message"
            aria-label="Tell us about your use case"
            placeholder="Tell us about your use case"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{
              background: tokens.colors.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              cursor: status === 'sending' ? 'not-allowed' : 'pointer',
              opacity: status === 'sending' ? 0.6 : 1,
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { if (status !== 'sending') e.currentTarget.style.boxShadow = tokens.glow.button; }}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
            {status === 'sending' ? 'Sending\u2026' : 'Get in touch'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-center" style={{ color: '#FF6B6B' }}>
              Something went wrong &mdash; try again or email us directly.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
