'use client';
import { useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const VALUE_PROPS = [
  {
    title: 'Threadplane Commercial license',
    body: 'Multi-app coverage, unlimited developers, custom contract — built for procurement.',
  },
  {
    title: 'SLA + security review',
    body: 'Response SLAs, security questionnaires, and a private support channel.',
  },
  {
    title: 'Pilot-to-Prod engagement',
    body: '8-week concierge delivery. We ship your first Angular agent on your real data, in your real app — and your engineers own it at the end.',
    highlight: true,
    link: { href: '/pilot-to-prod', label: 'See how Pilot-to-Prod works →' },
  },
  {
    title: 'Procurement support',
    body: 'Master services agreement, security review, custom indemnification — handled by humans, not portals.',
  },
];

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [pilotInterest, setPilotInterest] = useState<'yes' | 'maybe' | 'no'>('maybe');

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
        body: JSON.stringify({ ...data, pilot_interest: pilotInterest }),
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

  const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = tokens.colors.accent;
    e.target.style.boxShadow = tokens.shadows.focus;
  };
  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    e.target.style.borderColor = tokens.surfaces.border;
    e.target.style.boxShadow = 'none';
  };

  return (
    <Section id="lead-form" surface="canvas" ariaLabelledBy="lead-form-heading">
      <Container>
        <div style={{ maxWidth: 1080, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 720, marginLeft: 'auto', marginRight: 'auto' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 12 }}>Enterprise</Eyebrow>
            <h2
              id="lead-form-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontWeight: 700,
                fontSize: 'clamp(28px, 3.5vw, 42px)',
                color: tokens.colors.textPrimary,
                marginTop: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
                lineHeight: 1.1,
              }}
            >
              Built for procurement.<br />Backed by delivery.
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}
            >
              Volume licensing, custom contract, and optional concierge delivery — so your first Angular agent ships, not just compiles.
            </p>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
              gap: 24,
              alignItems: 'start',
            }}
          >
            {/* Value props column */}
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 16 }}>
              {VALUE_PROPS.map((vp) => (
                <li
                  key={vp.title}
                  style={{
                    padding: '16px 18px',
                    background: vp.highlight ? tokens.surfaces.surfaceTinted : 'transparent',
                    border: vp.highlight ? `1px solid ${tokens.colors.accent}` : `1px solid transparent`,
                    borderRadius: tokens.radius.md,
                    display: 'flex',
                    gap: 12,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      color: tokens.colors.accent,
                      fontSize: 18,
                      fontWeight: 700,
                      lineHeight: 1.4,
                      flexShrink: 0,
                    }}
                  >
                    ✓
                  </span>
                  <div>
                    <div
                      style={{
                        fontFamily: tokens.typography.fontSans,
                        fontSize: 15,
                        fontWeight: 600,
                        color: tokens.colors.textPrimary,
                        marginBottom: 4,
                      }}
                    >
                      {vp.title}
                    </div>
                    <p
                      style={{
                        fontFamily: tokens.typography.fontSans,
                        fontSize: 14,
                        lineHeight: 1.5,
                        color: tokens.colors.textSecondary,
                        margin: 0,
                      }}
                    >
                      {vp.body}
                    </p>
                    {vp.link && (
                      <a
                        href={vp.link.href}
                        style={{
                          display: 'inline-block',
                          marginTop: 6,
                          fontFamily: tokens.typography.fontSans,
                          fontSize: 13,
                          color: tokens.colors.accent,
                          textDecoration: 'none',
                          fontWeight: 600,
                        }}
                      >
                        {vp.link.label}
                      </a>
                    )}
                  </div>
                </li>
              ))}
            </ul>

            {/* Form column */}
            {status === 'sent' ? (
              <Card padding="lg">
                <p style={{ textAlign: 'center', color: tokens.colors.textSecondary, margin: 0 }}>
                  Thanks &mdash; we&apos;ll be in touch within one business day.
                </p>
              </Card>
            ) : (
              <Card padding="lg">
                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <label htmlFor="lf-name" className="sr-only">Name</label>
                  <input
                    id="lf-name"
                    name="name"
                    autoComplete="name"
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
                    autoComplete="email"
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
                    autoComplete="organization"
                    aria-label="Company"
                    placeholder="Company"
                    required
                    style={inputStyle}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                    <div>
                      <label
                        htmlFor="lf-team-size"
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          color: tokens.colors.textMuted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 4,
                        }}
                      >
                        Team size
                      </label>
                      <select
                        id="lf-team-size"
                        name="team_size"
                        style={{ ...inputStyle, padding: '9px 14px' }}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        defaultValue=""
                      >
                        <option value="" disabled>Select…</option>
                        <option value="1-5">1–5 developers</option>
                        <option value="6-25">6–25 developers</option>
                        <option value="26-100">26–100 developers</option>
                        <option value="100+">100+ developers</option>
                      </select>
                    </div>
                    <div>
                      <label
                        htmlFor="lf-timeline"
                        style={{
                          display: 'block',
                          fontSize: 11,
                          fontWeight: 600,
                          color: tokens.colors.textMuted,
                          textTransform: 'uppercase',
                          letterSpacing: '0.06em',
                          marginBottom: 4,
                        }}
                      >
                        Timeline
                      </label>
                      <select
                        id="lf-timeline"
                        name="timeline"
                        style={{ ...inputStyle, padding: '9px 14px' }}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        defaultValue=""
                      >
                        <option value="" disabled>Select…</option>
                        <option value="this_quarter">This quarter</option>
                        <option value="next_quarter">Next quarter</option>
                        <option value="6_plus_months">6+ months</option>
                        <option value="exploring">Just exploring</option>
                      </select>
                    </div>
                  </div>

                  <fieldset
                    style={{
                      border: `1px solid ${tokens.surfaces.border}`,
                      borderRadius: tokens.radius.md,
                      padding: '10px 14px',
                      margin: 0,
                    }}
                  >
                    <legend
                      style={{
                        fontSize: 11,
                        fontWeight: 600,
                        color: tokens.colors.textMuted,
                        textTransform: 'uppercase',
                        letterSpacing: '0.06em',
                        padding: '0 6px',
                      }}
                    >
                      Pilot-to-Prod
                    </legend>
                    <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 6 }}>
                      {(['yes', 'maybe', 'no'] as const).map((value) => (
                        <label
                          key={value}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 6,
                            fontSize: 13,
                            fontFamily: tokens.typography.fontSans,
                            color: tokens.colors.textSecondary,
                            cursor: 'pointer',
                          }}
                        >
                          <input
                            type="radio"
                            name="pilot_interest"
                            value={value}
                            checked={pilotInterest === value}
                            onChange={() => setPilotInterest(value)}
                          />
                          {value === 'yes' && 'Yes, include it'}
                          {value === 'maybe' && 'Tell me more'}
                          {value === 'no' && 'License only'}
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <label htmlFor="lf-message" className="sr-only">Tell us about your use case</label>
                  <textarea
                    id="lf-message"
                    name="message"
                    aria-label="Tell us about your use case"
                    placeholder="Tell us about your use case (optional)"
                    rows={3}
                    style={{ ...inputStyle, resize: 'vertical' }}
                    onFocus={handleFocus}
                    onBlur={handleBlur}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={status === 'sending'}
                    style={{ width: '100%', justifyContent: 'center', marginTop: 4 }}
                  >
                    {status === 'sending' ? 'Sending…' : 'Request enterprise quote'}
                  </Button>
                  {status === 'error' && (
                    <p style={{ fontSize: 13, textAlign: 'center', color: tokens.colors.angularRed, margin: 0 }}>
                      Something went wrong &mdash; try again or email us directly.
                    </p>
                  )}
                </form>
              </Card>
            )}
          </div>
        </div>
      </Container>
    </Section>
  );
}
