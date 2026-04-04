'use client';
import { useState, useEffect } from 'react';
import { tokens } from '../../../lib/design-tokens';
import type { DocHeading } from '../../lib/extract-headings';

export function DocsTOC({ headings }: { headings: DocHeading[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-52 shrink-0 py-8 pl-8"
      style={{ position: 'sticky', top: '5rem', maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}>
      <p className="font-mono text-xs uppercase tracking-wider mb-3"
        style={{ color: tokens.colors.textMuted, fontWeight: 600 }}>On this page</p>
      <nav className="flex flex-col gap-1.5">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className="text-sm transition-colors block"
            style={{
              color: activeId === h.id ? tokens.colors.accent : tokens.colors.textMuted,
              paddingLeft: h.level === 3 ? 12 : 0,
              fontSize: h.level === 3 ? '0.8rem' : '0.825rem',
              lineHeight: 1.5,
              textDecoration: 'none',
            }}>
            {h.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
