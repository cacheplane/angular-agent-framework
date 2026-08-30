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

export function PageActions({ library, section, slug }: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    // Menu pattern: focus the first item on open, restore the trigger on close.
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

  // Roving arrow-key navigation over the menu items.
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
  const chatgptUrl = `https://chatgpt.com/?hints=search&q=${encodeURIComponent(
    `Read this Threadplane docs page and help me apply it to my project: ${pageUrl}`,
  )}`;
  const githubUrl = `${GITHUB_EDIT_BASE}/${path}.mdx`;

  const copyMarkdown = async () => {
    try {
      const res = await fetch(`/api/markdown/${path}`);
      if (!res.ok) throw new Error(String(res.status));
      const text = await res.text();
      await navigator.clipboard.writeText(text);
      track(analyticsEvents.docsCopyCodeClick, { surface: 'docs', cta_id: 'copy_page_markdown' });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // network/clipboard failure — silently ignore
    }
    setOpen(false);
  };

  return (
    <div ref={ref} className="docs-page-actions">
      <button
        type="button"
        ref={triggerRef}
        aria-label="Page actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="docs-page-actions-trigger"
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div
          role="menu"
          ref={menuRef}
          onKeyDown={onMenuKeyDown}
          className="docs-page-actions-menu"
        >
          <button type="button" role="menuitem" onClick={copyMarkdown} className="docs-page-actions-item">
            {copied ? 'Copied' : 'Copy page as Markdown'}
          </button>
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
