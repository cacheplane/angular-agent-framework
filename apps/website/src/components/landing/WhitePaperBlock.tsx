'use client';
import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
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
      await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
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
        <div
          className="wp-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
        >
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Field report</Eyebrow>
            <h2
              id="wp-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.015em',
              }}
            >
              The last-mile gap in Angular AI.
            </h2>
            <ul
              style={{
                listStyle: 'none',
                padding: 0,
                margin: '0 0 24px 0',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              {BULLETS.map((b) => (
                <li
                  key={b}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: 10,
                    fontFamily: tokens.typography.bodyLg.family,
                    fontSize: tokens.typography.bodyLg.size,
                    lineHeight: tokens.typography.bodyLg.line,
                    color: tokens.colors.textSecondary,
                  }}
                >
                  <span
                    aria-hidden="true"
                    style={{
                      flex: '0 0 6px',
                      height: 6,
                      marginTop: 12,
                      borderRadius: tokens.radius.full,
                      background: tokens.colors.accent,
                    }}
                  />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {state === 'done' ? (
              <div
                style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: tokens.typography.body.size,
                  color: '#1a7a40',
                  marginBottom: 16,
                }}
              >
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
                  style={{ color: tokens.colors.accent }}
                >
                  Or download directly.
                </a>
              </div>
            ) : (
              <form
                onSubmit={submit}
                style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 480 }}
              >
                <label htmlFor="wp-email" className="sr-only">Email address</label>
                <input
                  id="wp-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={state === 'submitting'}
                  style={{
                    flex: '1 1 240px',
                    background: tokens.surfaces.surface,
                    border: `1px solid ${tokens.surfaces.border}`,
                    borderRadius: tokens.radius.md,
                    padding: '12px 14px',
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    color: tokens.colors.textPrimary,
                    outline: 'none',
                  }}
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
              <p style={{ marginTop: 12, color: tokens.colors.angularRed, fontSize: 14 }}>
                Something went wrong — please try again or{' '}
                <a href={pdf.href} download={pdf.download} style={{ color: tokens.colors.accent }}>
                  download directly
                </a>
                .
              </p>
            )}
            {state !== 'done' && (
              <p
                style={{
                  marginTop: 12,
                  fontSize: 13,
                  color: tokens.colors.textMuted,
                  fontFamily: tokens.typography.body.family,
                }}
              >
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
                  style={{ color: tokens.colors.accent, textDecoration: 'underline' }}
                >
                  Download the PDF directly.
                </a>
              </p>
            )}
          </div>

          {/* Tilted whitepaper cover */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BrowserFrame
              url="angular-agent-readiness-guide.pdf"
              rotate={-2}
              elevation="lg"
              maxWidth={420}
            >
              <div
                style={{
                  aspectRatio: '8.5 / 11',
                  background: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
                  padding: '48px 36px',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                }}
              >
                <div>
                  <div
                    style={{
                      fontFamily: tokens.typography.fontMono,
                      fontSize: 11,
                      textTransform: 'uppercase',
                      letterSpacing: '0.15em',
                      color: tokens.colors.accent,
                      marginBottom: 14,
                    }}
                  >
                    Field report · 18 pages
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.typography.fontSerif,
                      fontSize: 28,
                      lineHeight: 1.15,
                      fontWeight: 700,
                      color: tokens.colors.textPrimary,
                      marginBottom: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    From Prototype to Production
                  </div>
                  <div
                    style={{
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    Six production-readiness dimensions for Angular AI teams.
                  </div>
                </div>
                <div
                  style={{
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 11,
                    color: tokens.colors.textMuted,
                    textTransform: 'uppercase',
                    letterSpacing: '0.1em',
                  }}
                >
                  Agent UI for Angular
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .wp-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
