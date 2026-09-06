'use client';
import { useRef, useState } from 'react';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  FORM_POLICY_REFRESH_MESSAGE,
  growthFormRequestSnapshot,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';
import { Button } from '../ui/Button';
import {
  analyticsEvents,
  type AnalyticsSurface,
  type WhitepaperId,
} from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';

export type { WhitepaperId };

export const PDF_PATHS: Record<WhitepaperId, { href: string; download: string }> = {
  overview: { href: '/whitepaper.pdf', download: 'angular-agent-readiness-guide.pdf' },
  angular: { href: '/whitepapers/angular.pdf', download: 'angular-streaming-guide.pdf' },
  render: { href: '/whitepapers/render.pdf', download: 'angular-genui-guide.pdf' },
  chat: { href: '/whitepapers/chat.pdf', download: 'angular-chat-guide.pdf' },
};

interface WhitePaperFormProps {
  paper: WhitepaperId;
  formPolicy: PublicFormPolicy;
  /** Analytics surface + section, so the teams block and the library pages report separately. */
  surface: AnalyticsSurface;
  sourceSection: string;
  /** Ids must be unique per page; two forms on one page would collide. */
  idPrefix: string;
}

export function WhitePaperForm({
  paper,
  formPolicy,
  surface,
  sourceSection,
  idPrefix,
}: WhitePaperFormProps) {
  const pdf = PDF_PATHS[paper];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<
    'idle' | 'submitting' | 'done' | 'error' | 'stale'
  >('idle');
  const submissionSnapshot = useRef<GrowthFormRequestSnapshot<{
    email: string;
    paper: WhitepaperId;
  }> | null>(null);
  const inputId = `${idPrefix}-email`;
  const disclosureId = `${idPrefix}-growth-disclosure`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('submitting');
    track(analyticsEvents.marketingWhitepaperSignupSubmit, {
      surface,
      source_section: sourceSection,
      paper,
    });
    try {
      const snapshot = growthFormRequestSnapshot(submissionSnapshot.current, {
        email,
        paper,
      });
      submissionSnapshot.current = snapshot;
      const res = await fetch('/api/whitepaper-signup', {
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
        setState('stale');
        return;
      }
      if (res.status >= 400 && res.status < 500) {
        submissionSnapshot.current = null;
      }
      if (!res.ok) throw new Error('whitepaper_signup_failed');
      submissionSnapshot.current = null;
      track(analyticsEvents.marketingWhitepaperSignupSuccess, {
        surface,
        source_section: sourceSection,
        paper,
      });
      setState('done');
    } catch {
      track(analyticsEvents.marketingWhitepaperSignupFail, {
        surface,
        source_section: sourceSection,
        paper,
        error_reason: 'api_error',
      });
      setState('error');
    }
  };

  return (
    <>
      {state === 'done' ? (
        <div className="wp-success">
          ✓ Check your inbox — the guide is on its way.{' '}
          <a
            href={pdf.href}
            download={pdf.download}
            onClick={() =>
              trackWhitepaperDownloadClick(paper, {
                surface,
                source_section: sourceSection,
                cta_id: 'home_whitepaper_direct',
              })
            }
            className="wp-success-link"
          >
            Or download directly.
          </a>
        </div>
      ) : state === 'stale' ? (
        <div role="alert" className="wp-form">
          <p className="wp-disclosure">{FORM_POLICY_REFRESH_MESSAGE}</p>
          <Button
            type="button"
            variant="primary"
            size="lg"
            onClick={() => window.location.reload()}
          >
            Refresh page
          </Button>
        </div>
      ) : (
        <form onSubmit={submit} className="wp-form">
          <label htmlFor={inputId} className="sr-only">Email address</label>
          <input
            id={inputId}
            type="email"
            autoComplete="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            disabled={state === 'submitting'}
            className="wp-email-input"
          />
          <p id={disclosureId} className="wp-disclosure">
            {formPolicy.disclosures.whitepaper}
          </p>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            disabled={state === 'submitting' || !email}
            aria-describedby={disclosureId}
          >
            {state === 'submitting' ? 'Sending…' : 'Download (free)'}
          </Button>
        </form>
      )}
      {state === 'error' && (
        <p className="wp-error">
          Something went wrong — please try again or{' '}
          <a href={pdf.href} download={pdf.download} className="wp-error-link">
            download directly
          </a>
          .
        </p>
      )}
      {state !== 'done' && (
        <p className="wp-already">
          Already on the list?{' '}
          <a
            href={pdf.href}
            download={pdf.download}
            onClick={() =>
              trackWhitepaperDownloadClick(paper, {
                surface,
                source_section: sourceSection,
                cta_id: 'home_whitepaper_direct_inline',
              })
            }
            className="wp-already-link"
          >
            Download the PDF directly.
          </a>
        </p>
      )}
    </>
  );
}
