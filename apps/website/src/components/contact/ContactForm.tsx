// SPDX-License-Identifier: MIT
'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '../ui/Button';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';

type Status = 'idle' | 'sending' | 'sent' | 'error';

function sanitizeReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined;
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return undefined;
  }
}

export function ContactForm() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('idle');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');

  const sourcePage = params.get('source') ?? 'contact_direct';
  const trackParam = (params.get('track') ?? 'enterprise') as string;
  const ctaId = params.get('cta_id') ?? undefined;
  const paper = params.get('paper') ?? undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    track(analyticsEvents.marketingLeadFormSubmit, {
      surface: 'contact',
      source_section: 'contact-form',
    });
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          company: company || undefined,
          message: message || undefined,
          source_page: sourcePage,
          track: trackParam,
          cta_id: ctaId,
          paper,
          referrer_host: sanitizeReferrerHost(),
        }),
      });
      if (res.ok) {
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
      <Button variant="primary" size="lg" type="submit" disabled={status === 'sending'}>
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
