'use client';
import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import {
  trackCtaClick,
  trackExternalLinkClick,
} from '../../lib/analytics/client';
import { Button } from '../ui/Button';
import { GitHubIcon } from '../ui/GitHubIcon';
import { GITHUB_REPO_URL } from '../../lib/positioning';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';

export const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Pricing', href: '/pricing', external: false },
];

function DemoDropdown() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);
  return (
    <div ref={ref} className="nav-demo-dropdown">
      <button
        onClick={() => setOpen((o) => !o)}
        className="text-sm font-mono transition-colors nav-demo-trigger"
        aria-haspopup="true"
        aria-expanded={open}
      >
        Demo{' '}
        <span className="nav-demo-caret" data-open={open || undefined}>
          &#9662;
        </span>
      </button>
      {open && (
        <div className="nav-demo-menu">
          {DEMOS.map((demo) => (
            <a
              key={demo.key}
              href={demo.href}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => {
                setOpen(false);
                trackExternalLinkClick(demo.href, {
                  surface: 'nav',
                  cta_id: `nav_demo_${demoCtaSuffix(demo.key)}`,
                  cta_text: demo.label,
                });
              }}
              className="text-sm font-mono nav-demo-item"
            >
              {demo.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}

export function trackNavLink(
  label: string,
  href: string,
  external: boolean,
  surface: 'nav' | 'mobile_nav'
) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const ctaId: `nav_${string}` | `mobile_nav_${string}` =
    surface === 'nav' ? `nav_${slug}` : `mobile_nav_${slug}`;
  if (external) {
    trackExternalLinkClick(href, { surface, cta_id: ctaId, cta_text: label });
    return;
  }
  trackCtaClick({
    surface,
    destination_url: href,
    cta_id: ctaId,
    cta_text: label,
  });
}

export function NavDesktop() {
  return (
    <div className="hidden lg:flex items-center gap-8">
      {links.map((l) =>
        l.external ? (
          <a
            key={l.href}
            href={l.href}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackNavLink(l.label, l.href, true, 'nav')}
            className="text-sm font-mono transition-colors nav-link"
          >
            {l.label}
          </a>
        ) : (
          <Link
            key={l.href}
            href={l.href}
            onClick={() => trackNavLink(l.label, l.href, false, 'nav')}
            className="text-sm font-mono transition-colors nav-link"
          >
            {l.label}
          </Link>
        )
      )}
      <DemoDropdown />
      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackExternalLinkClick(
            GITHUB_REPO_URL,
            {
              surface: 'nav',
              cta_id: 'nav_github',
              cta_text: 'GitHub',
            }
          )
        }
        className="transition-colors nav-link"
        aria-label="GitHub repository"
      >
        <GitHubIcon />
      </a>
      <Button
        variant="primary"
        size="md"
        href="/contact"
        onClick={() =>
          trackCtaClick({
            surface: 'nav',
            destination_url: '/contact',
            cta_id: 'nav_talk_to_us',
            cta_text: 'Talk to Us',
          })
        }
      >
        Talk to Us
      </Button>
    </div>
  );
}
