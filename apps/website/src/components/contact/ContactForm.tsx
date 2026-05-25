// SPDX-License-Identifier: MIT
'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { tokens } from '@threadplane/design-tokens';
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
      <div role="status" style={{ color: tokens.colors.textPrimary, padding: 24 }}>
        Thanks. We&apos;ll be in touch within one business day.
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    fontSize: tokens.typography.body.size,
    fontFamily: tokens.typography.body.family,
    color: tokens.colors.textPrimary,
    background: tokens.surfaces.surface,
    border: `1px solid ${tokens.surfaces.border}`,
    borderRadius: 6,
    marginTop: 4,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Name <span style={{ color: tokens.colors.textMuted }}>(optional)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Company <span style={{ color: tokens.colors.textMuted }}>(optional)</span>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Message <span style={{ color: tokens.colors.textMuted }}>(optional)</span>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What are you shipping?"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>
      <Button variant="primary" size="lg" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send'}
      </Button>
      {status === 'error' && (
        <div role="alert" style={{ color: '#c00' }}>
          Something went wrong. Please try again or email us directly.
        </div>
      )}
    </form>
  );
}
