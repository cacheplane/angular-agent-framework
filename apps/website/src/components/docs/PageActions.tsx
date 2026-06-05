'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
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

  useEffect(() => {
    if (!open) return;
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
    };
  }, [open]);

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

  const itemStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    textAlign: 'left',
    padding: '8px 12px',
    fontFamily: tokens.typography.fontSans,
    fontSize: 13,
    color: tokens.colors.textPrimary,
    background: 'transparent',
    border: 'none',
    textDecoration: 'none',
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label="Page actions"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 32,
          height: 32,
          padding: 0,
          border: `1px solid ${tokens.surfaces.border}`,
          borderRadius: tokens.radius.md,
          background: tokens.surfaces.surface,
          color: tokens.colors.textSecondary,
          cursor: 'pointer',
          fontSize: 18,
          lineHeight: 1,
        }}
      >
        <span aria-hidden="true">⋯</span>
      </button>
      {open ? (
        <div
          role="menu"
          style={{
            position: 'absolute',
            top: 'calc(100% + 6px)',
            right: 0,
            minWidth: 200,
            background: tokens.surfaces.surface,
            border: `1px solid ${tokens.surfaces.border}`,
            borderRadius: tokens.radius.md,
            boxShadow: tokens.shadows.md,
            padding: 4,
            zIndex: 20,
          }}
        >
          <button type="button" role="menuitem" onClick={copyMarkdown} style={itemStyle}>
            {copied ? 'Copied' : 'Copy page as Markdown'}
          </button>
          <a
            role="menuitem"
            href={chatgptUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={itemStyle}
          >
            Open in ChatGPT
          </a>
          <a
            role="menuitem"
            href={githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => setOpen(false)}
            style={itemStyle}
          >
            Edit on GitHub
          </a>
        </div>
      ) : null}
    </div>
  );
}
