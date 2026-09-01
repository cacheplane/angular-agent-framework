'use client';
import { useState } from 'react';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

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

  return (
    <Section id="lead-form" surface="canvas" ariaLabelledBy="lead-form-heading">
      <Container>
        <div className="lead-form-wrap">
          <div className="lead-form-header">
            <div className="lead-form-rail">
              <Eyebrow tone="accent" className="lead-form-eyebrow">Enterprise</Eyebrow>
              <span className="lead-form-rail-line" aria-hidden="true" />
            </div>
            <h2 id="lead-form-heading" className="lead-form-heading">
              Choose the support.<br />Add delivery if you need it.
            </h2>
            <p className="lead-form-subhead">
              Production Assurance and Pilot-to-Prod are separate choices. Request ongoing support or ask us to scope a hands-on delivery engagement.
            </p>
            <a href="/pilot-to-prod" className="lead-form-p2p-link">
              See how Pilot-to-Prod works →
            </a>
          </div>

          <div className="lead-form-grid">
            {status === 'sent' ? (
              <Card padding="lg">
                <p className="lead-form-sent-message">
                  Thanks &mdash; we&apos;ll be in touch within one business day.
                </p>
              </Card>
            ) : (
              <Card padding="lg">
                <form onSubmit={handleSubmit} className="lead-form-form">
                  <label htmlFor="lf-name" className="sr-only">Name</label>
                  <input
                    id="lf-name"
                    name="name"
                    autoComplete="name"
                    aria-label="Name"
                    placeholder="Name"
                    required
                    className="lead-form-input"
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
                    className="lead-form-input"
                  />
                  <label htmlFor="lf-company" className="sr-only">Company</label>
                  <input
                    id="lf-company"
                    name="company"
                    autoComplete="organization"
                    aria-label="Company"
                    placeholder="Company"
                    required
                    className="lead-form-input"
                  />

                  <div className="lead-form-field-row">
                    <div>
                      <label htmlFor="lf-team-size" className="lead-form-field-label">
                        Team size
                      </label>
                      <select
                        id="lf-team-size"
                        name="team_size"
                        className="lead-form-input lead-form-select"
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
                      <label htmlFor="lf-timeline" className="lead-form-field-label">
                        Timeline
                      </label>
                      <select
                        id="lf-timeline"
                        name="timeline"
                        className="lead-form-input lead-form-select"
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

                  <fieldset className="lead-form-fieldset">
                    <legend className="lead-form-legend">
                      Pilot-to-Prod
                    </legend>
                    <div className="lead-form-radio-row">
                      {(['yes', 'maybe', 'no'] as const).map((value) => (
                        <label key={value} className="lead-form-radio-label">
                          <input
                            type="radio"
                            name="pilot_interest"
                            value={value}
                            checked={pilotInterest === value}
                            onChange={() => setPilotInterest(value)}
                          />
                          {value === 'yes' && 'Yes, include it'}
                          {value === 'maybe' && 'Tell me more'}
                          {value === 'no' && 'Assurance only'}
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
                    className="lead-form-input lead-form-textarea"
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    disabled={status === 'sending'}
                    className="lead-form-submit"
                  >
                    {status === 'sending' ? 'Sending…' : 'Request enterprise quote'}
                  </Button>
                  {status === 'error' && (
                    <p className="lead-form-error">
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
