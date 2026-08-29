'use client';
import { useState, useEffect } from 'react';
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
    <aside className="hidden xl:block w-56 shrink-0 py-8 pl-8 pr-6 docs-toc">
      <p className="font-mono text-xs uppercase tracking-wider mb-3 docs-toc-label">On this page</p>
      <nav className="flex flex-col gap-1.5">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className="text-sm transition-colors block docs-toc-link"
            data-level={h.level === 3 ? '3' : undefined}
            data-active={activeId === h.id || undefined}>
            {h.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}
