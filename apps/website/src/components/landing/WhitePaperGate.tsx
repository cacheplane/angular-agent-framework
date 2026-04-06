'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '../../../lib/design-tokens';

type FormState = 'idle' | 'submitting' | 'done' | 'error';

const labelStyle: React.CSSProperties = {
  fontSize: 13,
  fontFamily: 'monospace',
  color: tokens.colors.textSecondary,
  marginBottom: 6,
  display: 'block',
};

const baseInputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 14px',
  border: `1px solid ${tokens.colors.accentBorder}`,
  borderRadius: 8,
  background: tokens.colors.accentSurface,
  color: tokens.colors.textPrimary,
  fontFamily: 'Inter, sans-serif',
  fontSize: 14,
  outline: 'none',
  boxSizing: 'border-box',
};

function FormField({
  id,
  label,
  children,
}: {
  id: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 16 }}>
      <label htmlFor={id} style={labelStyle}>
        {label}
      </label>
      {children}
    </div>
  );
}

export function WhitePaperGate() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [company, setCompany] = useState('');
  const [role, setRole] = useState('');
  const [message, setMessage] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');
  const [focusedField, setFocusedField] = useState<string | null>(null);

  const getFocusStyle = (fieldId: string): React.CSSProperties =>
    focusedField === fieldId
      ? {
          border: `1px solid ${tokens.colors.accentBorderHover}`,
          boxShadow: '0 0 0 3px rgba(0,64,144,0.1)',
        }
      : {};

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormState('submitting');

    const messageValue = role
      ? `Role: ${role}${message ? '\n\n' + message : ''}`
      : message;

    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company,
          message: messageValue,
        }),
      });

      const data = (await res.json()) as { ok: boolean; error?: string };

      if (!res.ok || !data.ok) {
        throw new Error(data.error ?? 'Server error');
      }

      setFormState('done');
    } catch {
      setFormState('error');
    }
  };

  return (
    <section id="whitepaper-gate" style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.55 }}
        style={{ maxWidth: '72rem', margin: '0 auto' }}
      >
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
            gap: '3rem',
            alignItems: 'start',
          }}
        >
          {/* Left column — value proposition */}
          <div>
            <p
              style={{
                fontFamily: 'monospace',
                fontSize: 11,
                textTransform: 'uppercase' as const,
                letterSpacing: '0.1em',
                color: tokens.colors.accent,
                margin: 0,
                marginBottom: 16,
              } as React.CSSProperties}
            >
              Start Your Pilot
            </p>

            <h2
              style={{
                fontFamily: "'EB Garamond', Georgia, serif",
                fontSize: 32,
                fontWeight: 700,
                lineHeight: 1.2,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
              }}
            >
              Let&apos;s talk about your agent
            </h2>

            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: 15,
                color: tokens.colors.textSecondary,
                lineHeight: 1.7,
                margin: 0,
                marginBottom: 32,
              }}
            >
              Fill in the form and we&apos;ll reach out within one business day to
              discuss your use case, timeline, and fit. No sales pressure — if
              the pilot isn&apos;t right for you, we&apos;ll tell you.
            </p>

            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 12 }}>
              {[
                'Response within 1 business day',
                'No commitment to proceed',
                "We'll tell you if it's not a fit",
              ].map((bullet) => (
                <li
                  key={bullet}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 10,
                    fontFamily: 'monospace',
                    fontSize: 12,
                    color: tokens.colors.textSecondary,
                  }}
                >
                  <span style={{ color: tokens.colors.accent, fontWeight: 700 }}>✓</span>
                  {bullet}
                </li>
              ))}
            </ul>
          </div>

          {/* Right column — form */}
          <div>
            {formState === 'done' ? (
              <div
                style={{
                  background: tokens.glass.bg,
                  backdropFilter: `blur(${tokens.glass.blur})`,
                  WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
                  border: `1px solid ${tokens.glass.border}`,
                  boxShadow: tokens.glass.shadow,
                  borderRadius: 12,
                  padding: '32px 28px',
                  fontFamily: 'Inter, sans-serif',
                  fontSize: 15,
                  color: tokens.colors.textPrimary,
                  lineHeight: 1.6,
                }}
              >
                ✓ We&apos;ll be in touch within one business day.
              </div>
            ) : (
              <form onSubmit={handleSubmit} noValidate>
                <FormField id="gate-name" label="Full Name *">
                  <input
                    id="gate-name"
                    type="text"
                    placeholder="Jane Smith"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    onFocus={() => setFocusedField('gate-name')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={formState === 'submitting'}
                    style={{ ...baseInputStyle, ...getFocusStyle('gate-name') }}
                  />
                </FormField>

                <FormField id="gate-email" label="Work Email *">
                  <input
                    id="gate-email"
                    type="email"
                    placeholder="jane@company.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    onFocus={() => setFocusedField('gate-email')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={formState === 'submitting'}
                    style={{ ...baseInputStyle, ...getFocusStyle('gate-email') }}
                  />
                </FormField>

                <FormField id="gate-company" label="Company *">
                  <input
                    id="gate-company"
                    type="text"
                    placeholder="Acme Corp"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    onFocus={() => setFocusedField('gate-company')}
                    onBlur={() => setFocusedField(null)}
                    required
                    disabled={formState === 'submitting'}
                    style={{ ...baseInputStyle, ...getFocusStyle('gate-company') }}
                  />
                </FormField>

                <FormField id="gate-role" label="Role">
                  <input
                    id="gate-role"
                    type="text"
                    placeholder="e.g. Engineering Manager"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    onFocus={() => setFocusedField('gate-role')}
                    onBlur={() => setFocusedField(null)}
                    disabled={formState === 'submitting'}
                    style={{ ...baseInputStyle, ...getFocusStyle('gate-role') }}
                  />
                </FormField>

                <FormField id="gate-message" label="Message">
                  <textarea
                    id="gate-message"
                    rows={4}
                    placeholder="What are you building? What's blocking you?"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    onFocus={() => setFocusedField('gate-message')}
                    onBlur={() => setFocusedField(null)}
                    disabled={formState === 'submitting'}
                    style={{
                      ...baseInputStyle,
                      resize: 'vertical',
                      ...getFocusStyle('gate-message'),
                    }}
                  />
                </FormField>

                {formState === 'error' && (
                  <div
                    role="status"
                    aria-live="polite"
                    style={{
                      fontFamily: 'Inter, sans-serif',
                      fontSize: 13,
                      color: tokens.colors.angularRed,
                      marginBottom: 12,
                    }}
                  >
                    Something went wrong. Email us at{' '}
                    <a
                      href="mailto:hello@cacheplane.io"
                      style={{ color: tokens.colors.angularRed }}
                    >
                      hello@cacheplane.io
                    </a>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={formState === 'submitting'}
                  style={{
                    width: '100%',
                    padding: '12px 20px',
                    background: tokens.colors.accent,
                    color: '#fff',
                    fontFamily: 'Inter, sans-serif',
                    fontSize: 15,
                    fontWeight: 600,
                    border: 'none',
                    borderRadius: 8,
                    cursor: formState === 'submitting' ? 'not-allowed' : 'pointer',
                    opacity: formState === 'submitting' ? 0.7 : 1,
                    transition: 'opacity 0.15s ease',
                  }}
                >
                  {formState === 'submitting' ? 'Sending...' : 'Request Pilot Consultation →'}
                </button>
              </form>
            )}
          </div>
        </div>
      </motion.div>
    </section>
  );
}
