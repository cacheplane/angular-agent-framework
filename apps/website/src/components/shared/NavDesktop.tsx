'use client';

import Link from 'next/link';
import { Fragment, useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  trackCtaClick,
  trackExternalLinkClick,
} from '../../lib/analytics/client';
import { Button } from '../ui/Button';
import { GitHubIcon } from '../ui/GitHubIcon';
import { GITHUB_REPO_URL } from '../../lib/positioning';
import { LibraryMark } from '../docs/LibraryMark';
import { NAV_TRIGGERS, type NavItem, type NavPanel } from './nav-config';

/** Long enough to cross the gap between trigger and panel diagonally. */
const OPEN_DELAY_MS = 100;
const CLOSE_DELAY_MS = 150;

export const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Pricing', href: '/pricing', external: false },
];

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

export function trackNavItem(item: NavItem, surface: 'nav' | 'mobile_nav') {
  const ctaId: `nav_${string}` | `mobile_nav_${string}` =
    surface === 'nav' ? `nav_${item.ctaId}` : `mobile_nav_${item.ctaId}`;
  if (item.external) {
    trackExternalLinkClick(item.href, {
      surface,
      cta_id: ctaId,
      cta_text: item.label,
    });
    return;
  }
  trackCtaClick({
    surface,
    destination_url: item.href,
    cta_id: ctaId,
    cta_text: item.label,
  });
}

export function NavPanelItem({
  item,
  surface,
  onNavigate,
}: {
  item: NavItem;
  surface: 'nav' | 'mobile_nav';
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="nav-panel-item-chip" aria-hidden="true">
        {item.library ? (
          <LibraryMark library={item.library} size={20} />
        ) : Icon ? (
          <Icon size={16} aria-hidden={true} />
        ) : null}
      </span>
      <span className="nav-panel-item-text">
        <span className="nav-panel-item-label">{item.label}</span>
        <span className="nav-panel-item-desc">{item.description}</span>
      </span>
    </>
  );
  const onClick = () => {
    trackNavItem(item, surface);
    onNavigate?.();
  };

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="nav-panel-item"
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} onClick={onClick} className="nav-panel-item">
      {body}
    </Link>
  );
}

function Panel({ panel, id }: { panel: NavPanel; id: string }) {
  return (
    <div id={id} className="nav-panel" data-columns={panel.columns.length}>
      <div className="nav-panel-cols">
        {panel.columns.map((column, index) => (
          <div key={column.heading ?? index} className="nav-panel-col">
            {column.heading ? (
              <span className="nav-panel-col-head">{column.heading}</span>
            ) : null}
            {column.items.map((item) => (
              <NavPanelItem key={item.ctaId} item={item} surface="nav" />
            ))}
          </div>
        ))}
      </div>
      {panel.footer ? (
        <div className="nav-panel-footer">
          <span className="nav-panel-footer-lead">{panel.footer.lead}</span>
          <NavPanelItem item={panel.footer} surface="nav" />
        </div>
      ) : null}
    </div>
  );
}

export function NavDesktop() {
  const [openId, setOpenId] = useState<string | null>(null);
  const panelPrefix = useId();
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!openId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      clearTimers();
      triggerRefs.current.get(openId)?.focus();
      setOpenId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearTimers, openId]);

  const scheduleOpen = (id: string) => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpenId(id), OPEN_DELAY_MS);
  };
  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(
      () => setOpenId(null),
      CLOSE_DELAY_MS
    );
  };

  const panelId = (id: string) => `${panelPrefix}-${id}`;

  return (
    <div
      className="hidden lg:flex items-center gap-8 nav-desktop"
      onMouseLeave={scheduleClose}
    >
      {NAV_TRIGGERS.map((trigger) =>
        trigger.kind === 'link' ? (
          <Link
            key={trigger.id}
            href={trigger.href}
            onMouseEnter={() => {
              clearTimers();
              setOpenId(null);
            }}
            onClick={() =>
              trackCtaClick({
                surface: 'nav',
                destination_url: trigger.href,
                cta_id: `nav_${trigger.ctaId}`,
                cta_text: trigger.label,
              })
            }
            className="text-sm font-mono transition-colors nav-link"
          >
            {trigger.label}
          </Link>
        ) : (
          <Fragment key={trigger.id}>
            <button
              type="button"
              ref={(node) => {
                if (node) triggerRefs.current.set(trigger.id, node);
                else triggerRefs.current.delete(trigger.id);
              }}
              onMouseEnter={() => scheduleOpen(trigger.id)}
              onClick={() => {
                clearTimers();
                setOpenId((current) =>
                  current === trigger.id ? null : trigger.id
                );
              }}
              aria-expanded={openId === trigger.id}
              aria-controls={
                openId === trigger.id ? panelId(trigger.id) : undefined
              }
              className="text-sm font-mono transition-colors nav-link nav-trigger"
            >
              {trigger.label}
              <ChevronDown
                size={14}
                strokeWidth={2}
                aria-hidden="true"
                data-open={openId === trigger.id || undefined}
                className="nav-trigger-caret"
              />
            </button>
            {openId === trigger.id ? (
              <div
                className="nav-panel-shell"
                onMouseEnter={clearTimers}
                onMouseLeave={scheduleClose}
              >
                <Panel panel={trigger.panel} id={panelId(trigger.id)} />
              </div>
            ) : null}
          </Fragment>
        )
      )}

      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackExternalLinkClick(GITHUB_REPO_URL, {
            surface: 'nav',
            cta_id: 'nav_github',
            cta_text: 'GitHub',
          })
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
