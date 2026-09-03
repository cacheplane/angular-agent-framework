'use client';
import { useRef, useState } from 'react';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  FORM_POLICY_REFRESH_MESSAGE,
  growthFormRequestSnapshot,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';

const ROWS = [
  { claim: 'Six production-readiness dimensions', tail: '18 pages' },
  { claim: 'Error boundaries, fallbacks, observability, deploy', tail: 'concrete patterns' },
  { claim: 'No vendor pitch — what we learned shipping it', tail: 'free' },
];

type WhitepaperId = 'overview' | 'angular' | 'render' | 'chat';

interface WhitePaperBlockProps {
  /** Whitepaper variant. Determines PDF path + analytics tag. */
  paper?: WhitepaperId;
  formPolicy: PublicFormPolicy;
}

const PDF_PATHS: Record<WhitepaperId, { href: string; download: string }> = {
  overview: { href: '/whitepaper.pdf', download: 'angular-agent-readiness-guide.pdf' },
  angular: { href: '/whitepapers/angular.pdf', download: 'angular-streaming-guide.pdf' },
  render: { href: '/whitepapers/render.pdf', download: 'angular-genui-guide.pdf' },
  chat: { href: '/whitepapers/chat.pdf', download: 'angular-chat-guide.pdf' },
};

export function WhitePaperBlock({
  formPolicy,
  paper = 'overview',
}: WhitePaperBlockProps) {
  const pdf = PDF_PATHS[paper];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<
    'idle' | 'submitting' | 'done' | 'error' | 'stale'
  >('idle');
  const submissionSnapshot = useRef<GrowthFormRequestSnapshot<{
    email: string;
    paper: WhitepaperId;
  }> | null>(null);
  const disclosureId = `wp-${paper}-growth-disclosure`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('submitting');
    track(analyticsEvents.marketingWhitepaperSignupSubmit, {
      surface: 'home_whitepaper',
      source_section: 'whitepaper-block',
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
        surface: 'home_whitepaper',
        source_section: 'whitepaper-block',
        paper,
      });
      setState('done');
    } catch {
      track(analyticsEvents.marketingWhitepaperSignupFail, {
        surface: 'home_whitepaper',
        source_section: 'whitepaper-block',
        paper,
        error_reason: 'api_error',
      });
      setState('error');
    }
  };

  return (
    <Section surface="white" id="whitepaper-block" ariaLabelledBy="wp-heading">
      <Container>
        <div className="wp-grid">
          <div>
            <div className="wp-rail">
              <Eyebrow tone="accent" className="wp-eyebrow">Field report</Eyebrow>
              <span className="wp-rail-line" aria-hidden="true" />
            </div>
            <h2 id="wp-heading" className="wp-heading">
              The last-mile gap in Angular AI.
            </h2>
            <div className="wp-rows">
              {ROWS.map((r) => (
                <div key={r.claim} className="wp-row">
                  <p className="wp-row-claim">{r.claim}</p>
                  <p className="wp-row-tail">{r.tail}</p>
                </div>
              ))}
            </div>

            {state === 'done' ? (
              <div className="wp-success">
                ✓ Check your inbox — the guide is on its way.{' '}
                <a
                  href={pdf.href}
                  download={pdf.download}
                  onClick={() =>
                    trackWhitepaperDownloadClick(paper, {
                      surface: 'home_whitepaper',
                      source_section: 'whitepaper-block',
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
                <label htmlFor="wp-email" className="sr-only">Email address</label>
                <input
                  id="wp-email"
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
                      surface: 'home_whitepaper',
                      source_section: 'whitepaper-block',
                      cta_id: 'home_whitepaper_direct_inline',
                    })
                  }
                  className="wp-already-link"
                >
                  Download the PDF directly.
                </a>
              </p>
            )}
          </div>

          {/* Tilted whitepaper cover */}
          <div className="wp-cover-wrap" aria-hidden="true">
            <div className="wp-paper">
              <div>
                <div className="wp-cover-badge">Field report · 18 pages</div>
                <div className="wp-cover-title">From Prototype to Production</div>
                <div className="wp-cover-desc">Six production-readiness dimensions for Angular AI teams.</div>
              </div>
              <div className="wp-cover-footer">Threadplane</div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
