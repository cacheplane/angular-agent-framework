'use client';
import { useState } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';

const BULLETS = [
  'Six production-readiness dimensions for Angular AI',
  'Concrete patterns — error boundaries, fallbacks, observability, deploy',
  'No vendor pitch. Just what we learned shipping it.',
];

type WhitepaperId = 'overview' | 'angular' | 'render' | 'chat';

interface WhitePaperBlockProps {
  /** Whitepaper variant. Determines PDF path + analytics tag. */
  paper?: WhitepaperId;
}

const PDF_PATHS: Record<WhitepaperId, { href: string; download: string }> = {
  overview: { href: '/whitepaper.pdf', download: 'angular-agent-readiness-guide.pdf' },
  angular: { href: '/whitepapers/angular.pdf', download: 'angular-streaming-guide.pdf' },
  render: { href: '/whitepapers/render.pdf', download: 'angular-genui-guide.pdf' },
  chat: { href: '/whitepapers/chat.pdf', download: 'angular-chat-guide.pdf' },
};

export function WhitePaperBlock({ paper = 'overview' }: WhitePaperBlockProps = {}) {
  const pdf = PDF_PATHS[paper];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

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
      const res = await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, paper }),
      });
      if (!res.ok) throw new Error('whitepaper_signup_failed');
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
            <Eyebrow tone="accent" className="wp-eyebrow">Field report</Eyebrow>
            <h2 id="wp-heading" className="wp-heading">
              The last-mile gap in Angular AI.
            </h2>
            <ul className="wp-bullets">
              {BULLETS.map((b) => (
                <li key={b} className="wp-bullet">
                  <span aria-hidden="true" className="wp-bullet-dot" />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

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
                <Button
                  type="submit"
                  variant="primary"
                  size="lg"
                  disabled={state === 'submitting' || !email}
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
          <div className="wp-cover-wrap">
            <BrowserFrame
              url="angular-agent-readiness-guide.pdf"
              rotate={-2}
              elevation="lg"
              maxWidth={420}
            >
              <div className="wp-cover">
                <div>
                  <div className="wp-cover-badge">
                    Field report · 18 pages
                  </div>
                  <div className="wp-cover-title">
                    From Prototype to Production
                  </div>
                  <div className="wp-cover-desc">
                    Six production-readiness dimensions for Angular AI teams.
                  </div>
                </div>
                <div className="wp-cover-footer">
                  Threadplane
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>
      </Container>
    </Section>
  );
}
