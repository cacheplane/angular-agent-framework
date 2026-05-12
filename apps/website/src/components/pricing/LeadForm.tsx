'use client';
import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    track(analyticsEvents.marketingLeadFormSubmit, {
      surface: 'pricing',
      source_section: 'lead-form',
    });
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        track(analyticsEvents.marketingLeadFormSuccess, {
          surface: 'pricing',
          source_section: 'lead-form',
        });
        setStatus('sent');
      } else {
        track(analyticsEvents.marketingLeadFormFail, {
          surface: 'pricing',
          source_section: 'lead-form',
          error_reason: 'api_error',
        });
        setStatus('error');
      }
    } catch {
      track(analyticsEvents.marketingLeadFormFail, {
        surface: 'pricing',
        source_section: 'lead-form',
        error_reason: 'network_error',
      });
      setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: tokens.surfaces.surface,
    border: `1px solid ${tokens.surfaces.border}`,
    color: tokens.colors.textPrimary,
    borderRadius: tokens.radius.md,
    padding: '10px 14px',
    width: '100%',
    fontFamily: tokens.typography.body.family,
    fontSize: 14,
    outline: 'none',
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = tokens.colors.accent;
    e.target.style.boxShadow = tokens.shadows.focus;
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    e.target.style.borderColor = tokens.surfaces.border;
    e.target.style.boxShadow = 'none';
  };

  return (
    <Section id="lead-form" surface="canvas" ariaLabelledBy="lead-form-heading">
      <Container>
        <div style={{ maxWidth: 560, margin: '0 auto' }}>
          <Eyebrow tone="accent" style={{ textAlign: 'center', marginBottom: 12 }}>Enterprise</Eyebrow>
          <h2
            id="lead-form-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontWeight: 700,
              fontSize: 'clamp(24px, 3vw, 36px)',
              color: tokens.colors.textPrimary,
              textAlign: 'center',
              marginTop: 0,
              marginBottom: 32,
              letterSpacing: '-0.015em',
            }}
          >
            Need volume seats or a custom contract?
          </h2>
          {status === 'sent' ? (
            <p style={{ textAlign: 'center', color: tokens.colors.textSecondary }}>
              Thanks &mdash; we&apos;ll be in touch within one business day.
            </p>
          ) : (
            <Card padding="lg">
              <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <label htmlFor="lf-name" className="sr-only">Name</label>
                <input
                  id="lf-name"
                  name="name"
                  aria-label="Name"
                  placeholder="Name"
                  required
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
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
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <label htmlFor="lf-company" className="sr-only">Company</label>
                <input
                  id="lf-company"
                  name="company"
                  aria-label="Company"
                  placeholder="Company"
                  style={inputStyle}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <label htmlFor="lf-message" className="sr-only">Tell us about your use case</label>
                <textarea
                  id="lf-message"
                  name="message"
                  aria-label="Tell us about your use case"
                  placeholder="Tell us about your use case"
                  rows={4}
                  style={{ ...inputStyle, resize: 'vertical' }}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <Button
                  type="submit"
                  variant="primary"
                  size="md"
                  disabled={status === 'sending'}
                  style={{ width: '100%', justifyContent: 'center' }}
                >
                  {status === 'sending' ? 'Sending…' : 'Get in touch'}
                </Button>
                {status === 'error' && (
                  <p style={{ fontSize: 14, textAlign: 'center', color: tokens.colors.angularRed }}>
                    Something went wrong &mdash; try again or email us directly.
                  </p>
                )}
              </form>
            </Card>
          )}
        </div>
      </Container>
    </Section>
  );
}
