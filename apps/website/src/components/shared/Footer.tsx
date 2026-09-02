'use client';
import { useRef, useState } from 'react';
import Link from 'next/link';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import {
  FORM_POLICY_REFRESH_MESSAGE,
  growthFormRequestSnapshot,
  type GrowthFormRequestSnapshot,
} from '../../lib/growth/form-client';
import { analyticsEvents, type CtaId } from '../../lib/analytics/events';
import { track, trackCtaClick, trackExternalLinkClick } from '../../lib/analytics/client';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';
import { LogoMark } from '../ui/LogoMark';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';

function GitHubIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
    </svg>
  );
}

function NpmIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path d="M0 0v16h16V0H0zm13 13H8V5h2.5v5.5H13V5h-1V3H3v10h10V0H0v16h16V0H0z" opacity="0" />
      <path d="M0 0v16h16V0H0zm13 13h-2.5V5.5H8V13H3V3h10v10z" />
    </svg>
  );
}

function NewsletterForm({ formPolicy }: { formPolicy: PublicFormPolicy }) {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<
    'idle' | 'submitting' | 'done' | 'error' | 'stale'
  >('idle');
  const submissionSnapshot = useRef<GrowthFormRequestSnapshot<{
    email: string;
  }> | null>(null);
  const disclosureId = 'footer-newsletter-growth-disclosure';

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('submitting');
    track(analyticsEvents.marketingNewsletterSignupSubmit, {
      surface: 'footer',
      source_section: 'newsletter-form',
    });
    try {
      const snapshot = growthFormRequestSnapshot(submissionSnapshot.current, {
        email,
      });
      submissionSnapshot.current = snapshot;
      const res = await fetch('/api/newsletter', {
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
      if (!res.ok) throw new Error();
      submissionSnapshot.current = null;
      track(analyticsEvents.marketingNewsletterSignupSuccess, {
        surface: 'footer',
        source_section: 'newsletter-form',
      });
      setState('done');
    } catch {
      track(analyticsEvents.marketingNewsletterSignupFail, {
        surface: 'footer',
        source_section: 'newsletter-form',
        error_reason: 'api_error',
      });
      setState('error');
    }
  };

  if (state === 'done') {
    return <p className="text-sm mb-4 footer-newsletter-success">✓ You&apos;re subscribed!</p>;
  }

  if (state === 'stale') {
    return (
      <div role="alert" className="mb-4 max-w-xs">
        <p className="text-xs footer-newsletter-disclosure">
          {FORM_POLICY_REFRESH_MESSAGE}
        </p>
        <Button type="button" onClick={() => window.location.reload()}>
          Refresh page
        </Button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2 mb-4 max-w-xs">
      <label htmlFor="footer-email" className="sr-only">Email address</label>
      <input
        id="footer-email"
        type="email"
        autoComplete="email"
        placeholder="Email address"
        value={email}
        onChange={e => setEmail(e.target.value)}
        required
        disabled={state === 'submitting'}
        className="text-sm rounded-lg px-3 py-2 flex-1 min-w-0 footer-newsletter-input"
      />
      <p id={disclosureId} className="text-xs footer-newsletter-disclosure">
        {formPolicy.disclosures.newsletter}
      </p>
      <Button
        type="submit"
        variant="primary"
        size="md"
        disabled={state === 'submitting' || !email}
        aria-describedby={disclosureId}
      >
        {state === 'submitting' ? '...' : 'Subscribe'}
      </Button>
    </form>
  );
}

export function Footer({ formPolicy }: { formPolicy: PublicFormPolicy }) {
  /**
   * `ctaId` defaults to a slug of the label. Pass it explicitly when the visible
   * text changes but the analytics series should stay continuous — renaming
   * "Render" to "json-render" would otherwise silently split footer_render into
   * a new footer_json_render series.
   */
  const trackFooterCta = (label: string, href: string, ctaId?: CtaId) => {
    trackCtaClick({
      surface: 'footer',
      destination_url: href,
      cta_id:
        ctaId ?? `footer_${label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')}`,
      cta_text: label,
    });
  };

  return (
    <footer className="px-6 md:px-8 py-16 mt-24 footer-root">
      <div className="max-w-6xl mx-auto">

        {/* Top section: brand + columns */}
        <div className="grid grid-cols-1 md:grid-cols-6 gap-10 md:gap-8">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="mb-2">
              <LogoMark size="md" />
            </div>
            <p className="text-sm mb-4 footer-tagline">
              The Angular UI layer for production agents.
            </p>
            <NewsletterForm formPolicy={formPolicy} />
            {/* Social links */}
            <div className="flex items-center gap-4">
              <a href="https://github.com/cacheplane/angular-agent-framework"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackExternalLinkClick('https://github.com/cacheplane/angular-agent-framework', {
                  surface: 'footer',
                  cta_id: 'footer_github_icon',
                  cta_text: 'GitHub',
                })}
                className="transition-colors footer-social-link"
                aria-label="GitHub">
                <GitHubIcon />
              </a>
              <a href="https://www.npmjs.com/package/@threadplane/langgraph"
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackExternalLinkClick('https://www.npmjs.com/package/@threadplane/langgraph', {
                  surface: 'footer',
                  cta_id: 'footer_npm_icon',
                  cta_text: 'npm',
                })}
                className="transition-colors footer-social-link"
                aria-label="npm">
                <NpmIcon />
              </a>
            </div>
          </div>

          {/* Product column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <Eyebrow tone="accent" className="footer-column-eyebrow">Product</Eyebrow>
            <Link href="/docs" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Documentation', '/docs')}>
              Documentation
            </Link>
            <Link href="/docs/langgraph/api/inject-agent" className="transition-colors footer-link"
              onClick={() => trackFooterCta('API Reference', '/docs/langgraph/api/inject-agent')}>
              API Reference
            </Link>
            {DEMOS.map((demo) => (
              <a key={demo.key} href={demo.href} className="transition-colors footer-link"
                onClick={() => trackExternalLinkClick(demo.href, {
                  surface: 'footer',
                  cta_id: `footer_demo_${demoCtaSuffix(demo.key)}`,
                  cta_text: demo.label,
                })}>
                {demo.label}
              </a>
            ))}
            <a href="https://cockpit.threadplane.ai" className="transition-colors footer-link"
              onClick={() => trackExternalLinkClick('https://cockpit.threadplane.ai', {
                surface: 'footer',
                cta_id: 'footer_examples',
                cta_text: 'Examples',
              })}>
              Examples
            </a>
            <Link href="/pricing" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Pricing', '/pricing')}>
              Pricing
            </Link>
            <a href="https://github.com/cacheplane/angular-agent-framework"
              target="_blank" rel="noopener noreferrer"
              className="transition-colors footer-link"
              onClick={() => trackExternalLinkClick('https://github.com/cacheplane/angular-agent-framework', {
                surface: 'footer',
                cta_id: 'footer_github',
                cta_text: 'GitHub',
              })}>
              GitHub
            </a>
          </div>

          {/* Libraries column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <Eyebrow tone="accent" className="footer-column-eyebrow">Libraries</Eyebrow>
            <Link href="/langgraph" className="transition-colors footer-link"
              onClick={() => trackFooterCta('LangGraph', '/langgraph')}>
              LangGraph
            </Link>
            <Link href="/ag-ui" className="transition-colors footer-link"
              onClick={() => trackFooterCta('AG-UI', '/ag-ui')}>
              AG-UI
            </Link>
            <Link href="/render" className="transition-colors footer-link"
              onClick={() => trackFooterCta('json-render', '/render', 'footer_render')}>
              json-render
            </Link>
            <Link href="/chat" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Chat', '/chat')}>
              Chat
            </Link>
          </div>

          {/* Solutions column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <Eyebrow tone="accent" className="footer-column-eyebrow">Solutions</Eyebrow>
            <Link href="/solutions/compliance" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Compliance', '/solutions/compliance')}>
              Compliance
            </Link>
            <Link href="/solutions/analytics" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Analytics', '/solutions/analytics')}>
              Analytics
            </Link>
            <Link href="/solutions/customer-support" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Customer Support', '/solutions/customer-support')}>
              Customer Support
            </Link>
            <Link href="/solutions" className="transition-colors footer-link"
              onClick={() => trackFooterCta('All Solutions', '/solutions')}>
              All solutions
            </Link>
          </div>

          {/* Resources column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <Eyebrow tone="accent" className="footer-column-eyebrow">Resources</Eyebrow>
            <Link href="/pilot-to-prod" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Pilot to Prod', '/pilot-to-prod')}>
              Pilot to Prod
            </Link>
            <Link href="/blog" className="transition-colors footer-link"
              onClick={() => trackFooterCta('Blog', '/blog')}>
              Blog
            </Link>
            <a href="https://www.npmjs.com/package/@threadplane/langgraph"
              target="_blank" rel="noopener noreferrer"
              className="transition-colors footer-link"
              onClick={() => trackExternalLinkClick('https://www.npmjs.com/package/@threadplane/langgraph', {
                surface: 'footer',
                cta_id: 'footer_npm_package',
                cta_text: 'npm Package',
              })}>
              npm Package
            </a>
            <Link href="/about" className="transition-colors footer-link"
              onClick={() => trackFooterCta('About', '/about')}>
              About
            </Link>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs footer-bottom-bar">
          <span>&copy; {new Date().getFullYear()} Threadplane. All rights reserved.</span>
          <span>
            <Link
              href="/pricing"
              className="transition-colors footer-legal-link"
              onClick={() => trackFooterCta('Pricing Bottom', '/pricing')}
            >
              Pricing
            </Link>
          </span>
        </div>
      </div>
    </footer>
  );
}
