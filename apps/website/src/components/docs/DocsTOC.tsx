'use client';
import { useState, useEffect } from 'react';
import type { DocHeading } from '../../lib/extract-headings';

export function DocsTOC({ headings }: { headings: DocHeading[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    // "Current section" = the last heading above the reading line. Unlike an
    // IntersectionObserver band, this always yields an active item after a
    // jump-scroll or hash navigation, not only when a heading crosses the band.
    const els = headings
      .map((h) => document.getElementById(h.id))
      .filter((el): el is HTMLElement => el !== null);
    if (els.length === 0) return undefined;

    let frame = 0;
    const update = () => {
      frame = 0;
      const line = window.scrollY + window.innerHeight * 0.25;
      let current = '';
      for (const el of els) {
        if (el.offsetTop <= line) current = el.id;
        else break;
      }
      setActiveId(current);
    };
    const onScroll = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
    };
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-56 shrink-0 py-8 pl-8 pr-6 docs-toc">
      <p className="font-mono text-xs uppercase tracking-wider mb-3 docs-toc-label">On this page</p>
      <nav className="flex flex-col gap-0.5 docs-toc-nav">
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
