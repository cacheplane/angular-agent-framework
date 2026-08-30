'use client';
import { useEffect, useRef, useState } from 'react';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';
import { SITE_ORIGIN } from '../../lib/site-origin';

const GITHUB_EDIT_BASE =
  'https://github.com/cacheplane/angular-agent-framework/edit/main/apps/website/content/docs';

interface Props {
  library: string;
  section: string;
  slug: string;
}

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

function ChevronIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6.5l4 4 4-4" />
    </svg>
  );
}

/**
 * "Copy page" split button (docs premium-polish pass). The primary segment
 * copies the page's raw Markdown — the single most useful docs action in the
 * LLM era, previously buried behind an unlabeled "⋯" menu. The chevron opens
 * the secondary actions. Menu a11y (first-item focus, arrow roving, Escape,
 * focus restore) carried over from the a11y pass (#865).
 */
export function PageActions({ library, section, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return undefined;
    const items = menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]');
    items?.[0]?.focus();
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
      triggerRef.current?.focus();
    };
  }, [open]);

  const onMenuKeyDown = (e: React.KeyboardEvent) => {
    const items = [...(menuRef.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])];
    if (items.length === 0) return;
    const i = items.indexOf(document.activeElement as HTMLElement);
    const move = (n: number) => {
      e.preventDefault();
      items[(n + items.length) % items.length].focus();
    };
    if (e.key === 'ArrowDown') move(i + 1);
    if (e.key === 'ArrowUp') move(i - 1);
    if (e.key === 'Home') move(0);
    if (e.key === 'End') move(items.length - 1);
  };

  const path = `${library}/${section}/${slug}`;
  const pageUrl = `${SITE_ORIGIN}/docs/${path}`;
  const markdownUrl = `/api/markdown/${path}`;
  const chatgptUrl = `https://chatgpt.com/?hints=search&q=${encodeURIComponent(
    `Read this Threadplane docs page and help me apply it to my project: ${pageUrl}`,
  )}`;
  const githubUrl = `${GITHUB_EDIT_BASE}/${path}.mdx`;

  const copyMarkdown = async () => {
    try {
      const res = await fetch(markdownUrl);
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      track(analyticsEvents.docsCopyCodeClick, { surface: 'docs', cta_id: 'copy_page_markdown' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // network/clipboard failure — silently ignore
    }
  };

  return (
    <div ref={ref} className="docs-page-actions">
      <div className="docs-copy-split">
        <button
          type="button"
          aria-label="Copy page as Markdown"
          onClick={copyMarkdown}
          className="docs-copy-primary"
          data-copied={copied || undefined}
        >
          {copied ? <CheckIcon /> : <CopyIcon />}
          <span>{copied ? 'Copied' : 'Copy page'}</span>
        </button>
        <button
          type="button"
          ref={triggerRef}
          aria-label="Page actions"
          aria-haspopup="menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className="docs-copy-more"
        >
          <ChevronIcon />
        </button>
      </div>
      {open ? (
        <div
          role="menu"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          className="docs-page-actions-menu"
        >
          <a
            role="menuitem"
            href={chatgptUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="docs-page-actions-item"
          >
            Open in ChatGPT
          </a>
          <a
            role="menuitem"
            href={markdownUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="docs-page-actions-item"
          >
            View as Markdown
          </a>
          <a
            role="menuitem"
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            className="docs-page-actions-item"
          >
            Edit on GitHub
          </a>
        </div>
      ) : null}
    </div>
  );
}
