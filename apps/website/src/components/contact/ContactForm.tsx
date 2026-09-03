// SPDX-License-Identifier: MIT
'use client';

import React, { useRef, useState } from 'react';
import { Button } from '../ui/Button';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  FORM_POLICY_REFRESH_MESSAGE,
  growthFormRequestSnapshot,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';

type Status = 'idle' | 'sending' | 'sent' | 'error' | 'stale';

export function ContactForm({
  formPolicy,
}: {
  formPolicy: PublicFormPolicy;
}) {
  const [status, setStatus] = useState<Status>('idle');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');
  const submissionSnapshot = useRef<GrowthFormRequestSnapshot | null>(null);
  const disclosureId = 'contact-form-growth-disclosure';

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    track(analyticsEvents.marketingLeadFormSubmit, {
      surface: 'contact',
      source_section: 'contact-form',
    });
    try {
      const snapshot = growthFormRequestSnapshot(submissionSnapshot.current, {
        form_kind: 'contact',
        email,
        ...(name ? { name } : {}),
        ...(company ? { company } : {}),
        ...(message ? { message } : {}),
      });
      submissionSnapshot.current = snapshot;
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...snapshot.facts,
          acquisition_session_id: snapshot.acquisition_session_id,
          submission_id: snapshot.submission_id,
          policy_version: formPolicy.version,
        }),
      });
      if (res.status === 409) {
        submissionSnapshot.current = null;
        setStatus('stale');
        return;
      }
      if (res.status >= 400 && res.status < 500) {
        submissionSnapshot.current = null;
      }
      if (res.ok) {
        submissionSnapshot.current = null;
        track(analyticsEvents.marketingLeadFormSuccess, {
          surface: 'contact',
          source_section: 'contact-form',
        });
        setStatus('sent');
      } else {
        track(analyticsEvents.marketingLeadFormFail, {
          surface: 'contact',
          source_section: 'contact-form',
          error_reason: 'api_error',
        });
        setStatus('error');
      }
    } catch {
      track(analyticsEvents.marketingLeadFormFail, {
        surface: 'contact',
        source_section: 'contact-form',
        error_reason: 'network_error',
      });
      setStatus('error');
    }
  }

  if (status === 'stale') {
    return (
      <div role="alert" className="contact-form">
        <p className="contact-form-disclosure">{FORM_POLICY_REFRESH_MESSAGE}</p>
        <Button
          type="button"
          variant="primary"
          size="lg"
          onClick={() => window.location.reload()}
        >
          Refresh page
        </Button>
      </div>
    );
  }

  if (status === 'sent') {
    return (
      <div role="status" className="contact-form-sent">
        Thanks. We&apos;ll be in touch within one business day.
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="contact-form">
      <label className="contact-form-label">
        Email
        <input
          type="email"
          autoComplete="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="contact-form-input"
        />
      </label>
      <label className="contact-form-label">
        Name <span className="contact-form-optional">(optional)</span>
        <input
          type="text"
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="contact-form-input"
        />
      </label>
      <label className="contact-form-label">
        Company <span className="contact-form-optional">(optional)</span>
        <input
          type="text"
          autoComplete="organization"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          className="contact-form-input"
        />
      </label>
      <label className="contact-form-label">
        Message <span className="contact-form-optional">(optional)</span>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What are you shipping?"
          className="contact-form-input contact-form-textarea"
        />
      </label>
      <p id={disclosureId} className="contact-form-disclosure">
        {formPolicy.disclosures.contact}
      </p>
      <Button
        variant="primary"
        size="lg"
        type="submit"
        disabled={status === 'sending'}
        aria-describedby={disclosureId}
      >
        {status === 'sending' ? 'Sending…' : 'Send'}
      </Button>
      {status === 'error' && (
        <div role="alert" className="contact-form-error">
          Something went wrong. Please try again or email us directly.
        </div>
      )}
    </form>
  );
}
