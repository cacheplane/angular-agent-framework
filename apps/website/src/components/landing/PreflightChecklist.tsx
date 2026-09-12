'use client';

import { useEffect, useRef, useState } from 'react';
import { AIRWORTHINESS, type ChecklistRow } from '../../lib/preflight-checklist';

/** Milliseconds between ticks. Fast enough not to read as a loading bar. */
const TICK_MS = 180;

function Box() {
  return (
    <span className="preflight-box" aria-hidden="true">
      <svg viewBox="0 0 10 10" focusable="false">
        <path d="M1 5.2 3.8 8 9 2.2" fill="none" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Row({ row, done }: { row: ChecklistRow; done: boolean }) {
  const external = row.href.startsWith('http');
  return (
    <li>
      <a
        className={`preflight-row${done ? ' is-done' : ''}`}
        href={row.href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        <Box />
        <span className="preflight-challenge">{row.challenge}</span>
        <span className="preflight-dots" aria-hidden="true" />
        {row.badgeSrc ? (
          <img
            className="preflight-badge"
            src={row.badgeSrc}
            alt="HVTrust supply-chain grade for Threadplane (live badge)"
            width={91}
            height={20}
            loading="lazy"
            referrerPolicy="no-referrer"
          />
        ) : (
          <span className="preflight-response">
            {row.response}
            {row.unit ? <span className="preflight-unit"> {row.unit}</span> : null}
          </span>
        )}
      </a>
    </li>
  );
}

/**
 * The trust band's list: five third-party figures, each linking to the body
 * that published it. The boxes tick in sequence on scroll-into-view.
 *
 * The tick sequence is decorative: `is-done` also changes the response colour,
 * so a reader who never sees the animation still sees the state. Under
 * reduced motion every row is done from the first paint.
 *
 * This is a client component only because of the IntersectionObserver;
 * Reliability.tsx, which frames it, stays a server component.
 */
export function PreflightChecklist() {
  const ref = useRef<HTMLDivElement>(null);
  const [ticked, setTicked] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const total = AIRWORTHINESS.length;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setTicked(total);
      return;
    }
    const timers: ReturnType<typeof setTimeout>[] = [];
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        io.disconnect();
        for (let i = 1; i <= total; i += 1) {
          timers.push(setTimeout(() => setTicked(i), TICK_MS * i));
        }
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      timers.forEach(clearTimeout);
    };
  }, []);

  return (
    <div className="preflight" ref={ref}>
      <p className="preflight-col-head is-ours" id="preflight-air-label">Airworthiness</p>
      <ul className="preflight-rows preflight-air" aria-labelledby="preflight-air-label">
        {AIRWORTHINESS.map((row, i) => (
          <Row key={row.challenge} row={row} done={i < ticked} />
        ))}
      </ul>
    </div>
  );
}
