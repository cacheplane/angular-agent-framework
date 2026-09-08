# Preflight Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the homepage proof band's figure cards, receipts and pitch ladder with a two-column preflight checklist (Threadplane / Yours) plus an Airworthiness block, where every ticked row links to the page that proves it.

**Architecture:** The 27 rows live in a data module so the component stays a renderer and the guards can assert the data directly. The checklist is a **client** component because the tick sequence runs off an IntersectionObserver; `Reliability` stays a server component and composes it. The boxes are drawn spans, not form controls — nothing here is interactive.

**Tech Stack:** Next.js 15 App Router, React, plain CSS in `apps/website/src/styles/landing.css`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-preflight-checklist-design.md`

---

## Background an engineer needs before starting

**Run the commands CI runs**: `npx nx test website`, `npx nx lint website`, `npx nx build website` — NOT `npx vitest run --root apps/website`. They are not equivalent; the nx executor swallows output on a hard failure, and `nx test` does not type-check while `nx build` does.

**Two things the spec did not know, found while reading the code. Both are binding:**

1. **The HVTrust grade must stay a live badge image.** `Reliability.tsx`'s comment is emphatic: *"The HVTrust grade is deliberately a LIVE badge: it sits at 84.3 against an A-band floor of 80 and has flipped grade several times in a month; a hardcoded letter would be wrong on some days."* The spec's Airworthiness table shows `84.8 HVTRUST` as text. **Do not hardcode it** — that row renders the badge `<img>` as its response.

2. **`RELIABILITY_RECEIPTS` is guarded outside this component.** `apps/website/src/lib/positioning.spec.ts:162-168` asserts its exact claim strings. Two of the three receipts are being dropped, so that spec must be updated in the same change or it fails.

**`#proof`, `#proof-heading` and `data-surface="dark"` do not change.** `apps/website/e2e/website.spec.ts` pins all three, and it must stay green untouched. If it goes red, something drifted that was not meant to.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/website/src/lib/preflight-checklist.ts` | The 27 rows and their proof links | **Create** |
| `apps/website/src/lib/preflight-checklist.spec.ts` | Data guards — counts, links, no raw APIs | **Create** |
| `apps/website/src/components/landing/PreflightChecklist.tsx` | Renders the rows, runs the tick sequence | **Create** (client) |
| `apps/website/src/components/landing/PreflightChecklist.spec.tsx` | Render guards — boxes, links, a11y | **Create** |
| `apps/website/src/components/landing/Reliability.tsx` | The band | Loses cells, receipts, ladder; composes the checklist |
| `apps/website/src/components/landing/Reliability.spec.tsx` | Band guards | Cell/receipt/ladder tests move or go |
| `apps/website/src/lib/positioning.ts` | Copy | `RELIABILITY_RECEIPTS` trimmed to the one surviving receipt |
| `apps/website/src/lib/positioning.spec.ts` | Copy guard | Follows that trim |
| `apps/website/src/styles/landing.css` | Styles | Checklist styles in; cells/receipts/ladder styles out |

---

## Task 1: The data module

**Files:**
- Create: `apps/website/src/lib/preflight-checklist.ts`
- Create: `apps/website/src/lib/preflight-checklist.spec.ts`

- [ ] **Step 1: Write the failing spec**

Create `apps/website/src/lib/preflight-checklist.spec.ts`:

```ts
import { describe, it, expect } from 'vitest';
import {
  PREFLIGHT_OURS,
  PREFLIGHT_YOURS,
  AIRWORTHINESS,
} from './preflight-checklist';

describe('preflight checklist data', () => {
  it('has the shape the section argues for', () => {
    // The unticked half is the argument, not an oversight — if Yours ever
    // empties out, the section stops making its point.
    expect(PREFLIGHT_OURS).toHaveLength(11);
    expect(PREFLIGHT_YOURS).toHaveLength(8);
    expect(AIRWORTHINESS).toHaveLength(8);
  });

  it('proves every claim it ticks', () => {
    // "Not self-reported" is the section's own aside. A ticked row with no
    // link is a claim with no source.
    for (const row of [...PREFLIGHT_OURS, ...AIRWORTHINESS]) {
      expect(row.href, row.challenge).toBeTruthy();
    }
  });

  it('claims nothing in the Yours column', () => {
    // Nothing proves that YOU set a cost ceiling, so these carry no link.
    for (const row of PREFLIGHT_YOURS) {
      expect(row.href, row.challenge).toBeNull();
    }
  });

  it('links pages a human can read, never a raw API', () => {
    for (const row of [...PREFLIGHT_OURS, ...AIRWORTHINESS]) {
      const { hostname, pathname } = new URL(row.href!, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), row.href!).toBe(false);
      expect(pathname.startsWith('/api/'), row.href!).toBe(false);
    }
  });

  it('keeps the HVTrust grade live rather than hardcoding it', () => {
    // It has flipped grade several times in a month against an A-band floor
    // of 80; a hardcoded number would be wrong on some days.
    const grade = AIRWORTHINESS.find((r) => r.challenge === 'Supply-chain grade');
    expect(grade?.badgeSrc).toBe('https://hvtracker.net/badge/threadplane.svg');
    expect(grade?.response).toBe('');
  });

  it('gives every response an outcome, not a feature name', () => {
    // Responses are states you could verify. Lowercase would mean someone
    // wrote a sentence instead of a checklist response.
    for (const row of [...PREFLIGHT_OURS, ...PREFLIGHT_YOURS]) {
      expect(row.response, row.challenge).toBe(row.response.toUpperCase());
    }
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `./preflight-checklist` does not exist.

- [ ] **Step 3: Create the data module**

Create `apps/website/src/lib/preflight-checklist.ts`:

```ts
/**
 * The homepage preflight checklist.
 *
 * Every row in OURS and AIRWORTHINESS was verified against the docs rather
 * than written from memory, and that caught three errors worth remembering:
 *
 *  - "Destructive actions — HELD FOR APPROVAL" was FALSE. `<chat>` does not
 *    render the interrupt panel; the docs say "Interrupt UI is not part of it
 *    — compose <chat-interrupt-panel> yourself." It is two YOURS rows now.
 *  - "Errors & retry" had been held back as unverified and is in fact the
 *    strongest line: zero-config retry across five classified error kinds.
 *  - Keyboard and screen reader stay OFF. Four components document a11y,
 *    there is no overview page and no audit, and reduced motion exists only
 *    in code with nothing to link. A tick would overclaim.
 *
 * Before adding a row: find the page that proves it. If there is no page, it
 * is not a tick.
 */
export interface ChecklistRow {
  /** Left side of the line. 1–3 words. */
  readonly challenge: string;
  /** Right side. An outcome you could verify, never a feature name. */
  readonly response: string;
  /** The page that proves it. `null` only in YOURS. */
  readonly href: string | null;
  /** Small trailing unit, AIRWORTHINESS only. */
  readonly unit?: string;
  /** Live badge rendered instead of `response` text. */
  readonly badgeSrc?: string;
}

export const PREFLIGHT_OURS: readonly ChecklistRow[] = [
  { challenge: 'A run fails', response: 'RETRY, BUILT IN', href: '/docs/chat/guides/error-handling' },
  { challenge: 'Tool calls', response: 'LIVE STATUS CARDS', href: '/docs/chat/components/chat-tool-call-card' },
  { challenge: 'Durable threads', response: 'SURVIVE RESTARTS', href: '/docs/langgraph/guides/persistence' },
  { challenge: 'Reader scrolls up', response: 'STREAM STAYS PUT', href: '/docs/chat/components/chat' },
  { challenge: 'Model output', response: 'SANITIZED, 26 NODES', href: '/docs/chat/guides/markdown' },
  { challenge: 'Shared link', response: 'URL IS THE TRUTH', href: '/docs/chat/guides/thread-routing' },
  { challenge: 'Your design system', response: 'CSS VARS, NO !IMPORTANT', href: '/docs/chat/guides/theming' },
  { challenge: 'Your tests', response: 'RUN WITHOUT A MODEL', href: '/docs/chat/getting-started/try-without-a-backend' },
  { challenge: 'Swapping backend', response: 'ONE IMPORT CHANGES', href: '/docs/choosing-an-adapter' },
  {
    challenge: 'Model drift',
    response: 'CHECKED WEEKLY, LIVE',
    // No doc page for this one. The workflow IS the source: it runs the
    // @drift e2e subset against the live provider every Monday and diffs
    // fresh recordings against the committed fixtures.
    href: 'https://github.com/cacheplane/angular-agent-framework/blob/main/.github/workflows/aimock-drift.yml',
  },
  { challenge: 'Debug panel', response: 'TREE-SHAKEN OUT', href: '/docs/chat/components/chat-debug' },
];

/**
 * The product's own words, not ours. Every response here is a paraphrase of a
 * sentence in the docs — "Never generate a thread ID client-side", "never
 * expose a LangSmith API key in client-side code", "you must configure CORS".
 *
 * These boxes never fill. That is the argument.
 */
export const PREFLIGHT_YOURS: readonly ChecklistRow[] = [
  { challenge: 'Agent endpoint', response: 'BEHIND YOUR PROXY', href: null },
  { challenge: 'API keys', response: 'NEVER IN THE BUNDLE', href: null },
  { challenge: 'Thread IDs', response: 'SERVER-GENERATED', href: null },
  { challenge: 'CORS', response: 'YOURS TO CONFIGURE', href: null },
  { challenge: 'Interrupt panel', response: 'YOU COMPOSE IT', href: null },
  { challenge: 'Resume payload', response: 'YOURS TO CHOOSE', href: null },
  { challenge: 'Runs', response: 'TRACED', href: null },
  { challenge: 'Regressions', response: 'EVALUATED', href: null },
];

/**
 * Verified 2026-09-04 against live sources. The rank and score drift — re-verify
 * on touch, and never "round up".
 */
export const AIRWORTHINESS: readonly ChecklistRow[] = [
  { challenge: 'Framework rank', response: '#8', unit: 'OF 119', href: 'https://hvtracker.net/categories/agent-frameworks/' },
  { challenge: 'OpenSSF Scorecard', response: '8.2', unit: '/ 10', href: 'https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework' },
  {
    challenge: 'Supply-chain grade',
    // Deliberately empty: the badge is the response. It sits near an A-band
    // floor of 80 and has flipped grade several times in a month, so a
    // hardcoded number would be wrong on some days.
    response: '',
    badgeSrc: 'https://hvtracker.net/badge/threadplane.svg',
    href: 'https://hvtracker.net/agents/threadplane/',
  },
  { challenge: 'Angular support', response: '20–22', unit: 'CI-TESTED', href: 'https://www.npmjs.com/package/@threadplane/langgraph' },
  { challenge: 'Release provenance', response: 'SIGNED', unit: 'OIDC · SLSA', href: 'https://www.npmjs.com/package/@threadplane/chat' },
  { challenge: 'Cloud', response: 'NONE', unit: 'SELF-HOSTED', href: '/privacy' },
  { challenge: 'Signup', response: 'NONE', unit: 'npm i', href: '/docs/chat/getting-started/installation' },
  { challenge: 'VC board', response: 'NONE', href: '/about' },
];
```

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: PASS.

Note the `Angular support` response is hardcoded `20–22` here while `Reliability.tsx` derived it from `WEBSITE_SUPPORTED_ANGULAR_MAJORS`. That regression is fixed in Task 5 Step 2 — leave it for now so this task stays one concern.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/preflight-checklist.ts apps/website/src/lib/preflight-checklist.spec.ts
git commit -m "feat(website): the preflight checklist rows, with a proof link each"
```

---

## Task 2: The component

**Files:**
- Create: `apps/website/src/components/landing/PreflightChecklist.tsx`
- Create: `apps/website/src/components/landing/PreflightChecklist.spec.tsx`

- [ ] **Step 1: Write the failing spec**

Create `apps/website/src/components/landing/PreflightChecklist.spec.tsx`:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PreflightChecklist } from './PreflightChecklist';
import { PREFLIGHT_OURS, PREFLIGHT_YOURS, AIRWORTHINESS } from '../../lib/preflight-checklist';

describe('PreflightChecklist', () => {
  it('renders one row per data row', () => {
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('.preflight-row')).toHaveLength(
      PREFLIGHT_OURS.length + PREFLIGHT_YOURS.length + AIRWORTHINESS.length,
    );
  });

  it('links every ticked row and none of the Yours rows', () => {
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('a.preflight-row')).toHaveLength(
      PREFLIGHT_OURS.length + AIRWORTHINESS.length,
    );
    for (const a of Array.from(container.querySelectorAll('a.preflight-row'))) {
      expect(a.getAttribute('href')).toBeTruthy();
    }
  });

  it('draws the boxes rather than using form controls', () => {
    // Nothing here is interactive. An <input type="checkbox"> would tell a
    // screen reader it can be toggled, which is a lie.
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('.preflight-box')).toHaveLength(
      PREFLIGHT_OURS.length + PREFLIGHT_YOURS.length + AIRWORTHINESS.length,
    );
  });

  it('names each column list so two adjacent lists are distinguishable', () => {
    const { container } = render(<PreflightChecklist />);
    const lists = Array.from(container.querySelectorAll('ul[aria-labelledby]'));
    expect(lists).toHaveLength(3);
    for (const ul of lists) {
      const label = container.querySelector(`#${ul.getAttribute('aria-labelledby')}`);
      expect(label?.textContent).toBeTruthy();
    }
  });

  it('keeps the HVTrust grade a live badge with real alt text', () => {
    const { container } = render(<PreflightChecklist />);
    const badge = container.querySelector('img.preflight-badge');
    expect(badge?.getAttribute('src')).toBe('https://hvtracker.net/badge/threadplane.svg');
    // Not decorative: it carries the grade, so it needs a real description.
    expect(badge?.getAttribute('alt')).toBeTruthy();
    expect(badge?.getAttribute('alt')).not.toBe('');
  });

  it('opens off-site sources safely in a new tab', () => {
    const { container } = render(<PreflightChecklist />);
    for (const a of Array.from(container.querySelectorAll('a.preflight-row'))) {
      const href = a.getAttribute('href')!;
      if (!href.startsWith('http')) continue;
      expect(a.getAttribute('target')).toBe('_blank');
      expect(a.getAttribute('rel')).toBe('noopener noreferrer');
    }
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `./PreflightChecklist` does not exist.

- [ ] **Step 3: Create the component**

Create `apps/website/src/components/landing/PreflightChecklist.tsx`:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import {
  AIRWORTHINESS,
  PREFLIGHT_OURS,
  PREFLIGHT_YOURS,
  type ChecklistRow,
} from '../../lib/preflight-checklist';

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
  const body = (
    <>
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
    </>
  );

  const className = `preflight-row${done ? ' is-done' : ''}`;
  if (!row.href) return <li className={className}>{body}</li>;

  const external = row.href.startsWith('http');
  return (
    <li>
      <a
        className={className}
        href={row.href}
        {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
      >
        {body}
      </a>
    </li>
  );
}

/**
 * The band's argument in checklist form. The Yours boxes never fill — that is
 * deliberate, and it is the half that makes the section honest.
 *
 * The tick sequence is decorative: `is-done` also changes the response colour,
 * so a reader who never sees the animation still sees the state. Under
 * reduced motion every row is done from the first paint.
 */
export function PreflightChecklist() {
  const ref = useRef<HTMLDivElement>(null);
  const [ticked, setTicked] = useState(0);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const total = PREFLIGHT_OURS.length + AIRWORTHINESS.length;
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

  // One counter across both ticked groups, so Airworthiness continues the
  // sequence rather than restarting it.
  const doneAt = (index: number) => index < ticked;

  return (
    <div className="preflight" ref={ref}>
      <div className="preflight-cols">
        <div>
          <p className="preflight-col-head is-ours" id="preflight-ours-label">Threadplane</p>
          <ul className="preflight-rows" aria-labelledby="preflight-ours-label">
            {PREFLIGHT_OURS.map((row, i) => (
              <Row key={row.challenge} row={row} done={doneAt(i)} />
            ))}
          </ul>
        </div>
        <div className="preflight-yours">
          <p className="preflight-col-head is-yours" id="preflight-yours-label">Yours</p>
          <ul className="preflight-rows" aria-labelledby="preflight-yours-label">
            {PREFLIGHT_YOURS.map((row) => (
              <Row key={row.challenge} row={row} done={false} />
            ))}
          </ul>
        </div>
      </div>

      <p className="preflight-col-head is-ours" id="preflight-air-label">Airworthiness</p>
      <ul className="preflight-rows preflight-air" aria-labelledby="preflight-air-label">
        {AIRWORTHINESS.map((row, i) => (
          <Row key={row.challenge} row={row} done={doneAt(PREFLIGHT_OURS.length + i)} />
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/PreflightChecklist.tsx apps/website/src/components/landing/PreflightChecklist.spec.tsx
git commit -m "feat(website): the preflight checklist component"
```

---

## Task 3: The styles

**Files:**
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Add the checklist styles**

Append to `landing.css`:

```css
/* Preflight checklist.
 *
 * Plain flex rows: every row starts at its column's left edge and its first
 * child is a fixed 16px box, so the boxes share one edge by construction. Do
 * NOT reach for `display: contents` here — it breaks the moment one row is an
 * <li> rather than an <a>, and it weakens the link's semantics. */
.preflight {
  margin-top: 26px;
}
.preflight-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 48px;
}
.preflight-col-head {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  margin: 0;
  padding-bottom: 12px;
}
.preflight-col-head.is-ours {
  color: var(--color-signal);
}
.preflight-col-head.is-yours {
  color: var(--color-text-muted);
}
.preflight-rows {
  list-style: none;
  margin: 0;
  padding: 0;
}
.preflight-air {
  margin-top: 22px;
}
.preflight-row {
  display: flex;
  align-items: center;
  gap: 11px;
  height: 33px;
  text-decoration: none;
}
.preflight-box {
  flex: 0 0 16px;
  height: 16px;
  box-sizing: border-box;
  /* Deliberately NOT var(--color-border-strong): that resolves to
   * rgba(255,255,255,.2) in the dark scope, and the empty Yours boxes are the
   * section's whole argument — they cannot be the faintest thing on the band.
   * .35 is the value the approved prototype was reviewed at. */
  border: 1.5px solid rgba(255, 255, 255, 0.35);
  border-radius: 3px;
  display: grid;
  place-items: center;
  transition: border-color 180ms ease, background-color 180ms ease;
}
.preflight-box svg {
  width: 10px;
  height: 10px;
  display: block;
  opacity: 0;
  transform: scale(0.5);
  stroke: var(--color-ink);
  transition: opacity 150ms ease, transform 200ms cubic-bezier(0.2, 1.5, 0.4, 1);
}
.preflight-row.is-done .preflight-box {
  border-color: var(--color-signal);
  background-color: var(--color-signal);
}
.preflight-row.is-done .preflight-box svg {
  opacity: 1;
  transform: scale(1);
}
.preflight-challenge {
  flex: 0 0 auto;
  font-family: var(--font-sans);
  font-size: 13px;
  color: var(--color-text-primary);
  white-space: nowrap;
}
.preflight-dots {
  flex: 1 1 auto;
  min-width: 12px;
  border-bottom: 1px dotted var(--color-border);
  margin-bottom: 4px;
}
.preflight-response {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  white-space: nowrap;
  color: var(--color-text-muted);
  transition: color 180ms ease;
}
.preflight-row.is-done .preflight-response {
  color: var(--color-signal);
}
.preflight-yours .preflight-response {
  font-weight: 400;
}
/* Airworthiness responses are figures, so they take the display face and a
 * larger size; the unit stays mono beside them. */
.preflight-air .preflight-response {
  font-family: var(--font-display);
  font-size: 15px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--color-text-muted);
}
.preflight-air .preflight-row.is-done .preflight-response {
  color: var(--color-text-primary);
}
.preflight-unit {
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.04em;
  color: var(--color-text-muted);
}
.preflight-badge {
  flex: 0 0 auto;
  display: block;
}
a.preflight-row:hover .preflight-challenge {
  color: #ffffff;
}
@media (prefers-reduced-motion: reduce) {
  .preflight-box,
  .preflight-box svg,
  .preflight-response {
    transition: none;
  }
}
@media (max-width: 820px) {
  .preflight-cols {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
```

- [ ] **Step 2: Remove the styles the checklist replaces**

Delete these rules from `landing.css` entirely:

- `.proof-strip-cells`, `.proof-strip-cell`, `.proof-strip-value`, `.proof-strip-suffix`, `.proof-strip-caption`, `.proof-strip-badge`
- `.proof-strip-source` and its `[data-surface="dark"]` variants
- `.reliability-receipts`, `.reliability-receipt`, `.reliability-receipt-claim`, `.reliability-receipt-detail`
- `.proof-ladder`, `.proof-ladder-rungs line`, `.proof-ladder-wing line`, `.proof-ladder-dot`
- Any `@media` block that only adjusts `.proof-strip-cells` columns

Keep `.proof-strip`, `.proof-strip-grid` and `.proof-strip-watermark` — the band's frame and its guarded watermark.

Then confirm nothing dangles:

```bash
grep -n "proof-strip-cell\|proof-strip-value\|proof-strip-caption\|proof-strip-source\|proof-strip-badge\|reliability-receipt\|proof-ladder" apps/website/src/styles/landing.css || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/styles/landing.css
git commit -m "feat(website): checklist styles in, figure-card and ladder styles out"
```

---

## Task 4: Wire it into the band

**Files:**
- Modify: `apps/website/src/components/landing/Reliability.tsx`
- Modify: `apps/website/src/components/landing/Reliability.spec.tsx`

- [ ] **Step 1: Update the band's spec first**

In `Reliability.spec.tsx`:

Note the Yours rows are `<li>` here, not the `<div>` the spec's §6 names — `<div>` children of a `<ul>` are invalid, and the point that spec section was making (no `<a>`, because no page proves you set a cost ceiling) is preserved.

- **Delete** `it('renders four cells, each with a source link', …)`, `it('renders the HVTrust grade as a live badge image, not text', …)`, `it('renders three receipts under the cells, each with a source link', …)`, `it('orders the ladder, cells, then receipts', …)` and `it('frames the section as a climb and hides the instrument from assistive tech', …)`. Their coverage now lives in `PreflightChecklist.spec.tsx` and `preflight-checklist.spec.ts`.
- **Delete** `it('links every number and receipt to a human-readable page, never a raw API', …)` — the same assertion is in `preflight-checklist.spec.ts`, against the data rather than the render.
- **Remove** the now-unused `PROOF_CELLS` and `RELIABILITY_RECEIPTS` imports.
- **Keep** the masthead test and the dark-band/watermark/framing test exactly as they are.

Then add:

```tsx
  it('carries the checklist and keeps the framing above it', () => {
    const { container } = render(<Reliability />);
    // The eyebrow and aside still frame the band; the checklist is what
    // replaced the figure cards beneath them.
    expect(screen.getByText('Climb performance')).toBeTruthy();
    expect(container.querySelector('.preflight')).toBeTruthy();
    expect(container.querySelector('.proof-ladder')).toBeNull();
    expect(container.querySelector('.proof-strip-cells')).toBeNull();
  });
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `.preflight` is not rendered and `.proof-ladder` still is.

- [ ] **Step 3: Rewrite the band's body**

In `Reliability.tsx`:

- Delete the `ProofCell` interface, the `PROOF_CELLS` export and its docblock.
- Delete the entire `<svg className="proof-ladder">` block.
- Delete the entire `<ul className="proof-strip-cells">` block.
- Delete the entire `<ul className="reliability-receipts">` block.
- Remove the now-unused imports: `RELIABILITY_RECEIPTS`, `WEBSITE_SUPPORTED_ANGULAR_MAJORS`.
- Add `import { PreflightChecklist } from './PreflightChecklist';`
- Render `<PreflightChecklist />` as the last child of `.proof-strip-grid`, directly after `<SectionHeader />`.

The `<Section>`, the masthead `<p className="proof-masthead">`, the `.proof-strip` wrapper, the watermark `<div>`, `.proof-strip-grid` and the whole `<SectionHeader>` (eyebrow, heading, headingId, aside) are **unchanged**.

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/Reliability.tsx apps/website/src/components/landing/Reliability.spec.tsx
git commit -m "feat(website): the proof band is a preflight checklist"
```

---

## Task 5: The two data regressions the rewrite creates

Both are consequences of Task 1 that would otherwise ship silently.

**Files:**
- Modify: `apps/website/src/lib/positioning.ts`
- Modify: `apps/website/src/lib/positioning.spec.ts`
- Modify: `apps/website/src/lib/preflight-checklist.ts`

- [ ] **Step 1: Trim the receipts to the one that survived**

Two of the three receipts are gone from the page — "Three runtimes exercised end to end" and "No content telemetry, no cloud" — and provenance is now an Airworthiness row rather than a receipt. So `RELIABILITY_RECEIPTS` has no consumer.

Delete the `ReliabilityReceipt` interface and the `RELIABILITY_RECEIPTS` export from `positioning.ts`, then delete the test at `positioning.spec.ts` that asserts their claim strings (it imports `RELIABILITY_RECEIPTS` and checks `.map((r) => r.claim)`).

Confirm:

```bash
grep -rn "RELIABILITY_RECEIPTS\|ReliabilityReceipt" apps/website/src || echo "clean"
```

Expected: `clean`

- [ ] **Step 2: Restore the derived Angular range**

`Reliability.tsx` derived the Angular row from `WEBSITE_SUPPORTED_ANGULAR_MAJORS`, so bumping a major updated the homepage. Task 1 hardcoded `20–22`, which will silently go stale.

In `preflight-checklist.ts`, add at the top:

```ts
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../components/pricing/angular-support.mjs';
```

and change that row's response to:

```ts
  {
    challenge: 'Angular support',
    // Derived, not typed: bumping a supported major must update the homepage
    // without anyone remembering to edit this file.
    response: `${WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]}–${WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)}`,
    unit: 'CI-TESTED',
    href: 'https://www.npmjs.com/package/@threadplane/langgraph',
  },
```

- [ ] **Step 3: Guard the derivation so it cannot be re-hardcoded**

Add to `preflight-checklist.spec.ts`:

```ts
  it('derives the Angular range rather than hardcoding it', async () => {
    const { WEBSITE_SUPPORTED_ANGULAR_MAJORS } = await import(
      '../components/pricing/angular-support.mjs'
    );
    const row = AIRWORTHINESS.find((r) => r.challenge === 'Angular support');
    expect(row?.response).toContain(String(WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]));
    expect(row?.response).toContain(String(WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)));
  });
```

- [ ] **Step 4: Test, lint, build**

```bash
npx nx test website && npx nx lint website && npx nx build website
```

Expected: all pass, lint 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib
git commit -m "fix(website): retire the orphaned receipts and re-derive the Angular range"
```

---

## Task 6: Verification

- [ ] **Step 1: The CI commands**

```bash
npx nx test website
npx nx lint website
npx nx build website
```

All pass; lint 0 errors (65 pre-existing warnings expected).

- [ ] **Step 2: The guard that must not move**

```bash
npx nx e2e website
```

Free port 3000 first if a dev server holds it. `e2e/website.spec.ts` pins `#proof-heading` and `#proof[data-surface="dark"]`, and the spine order test now includes `compatibility-heading`. All must pass **unchanged** — if any fails, something drifted that was not meant to.

- [ ] **Step 3: Every proof link must resolve**

A checklist whose proof 404s is worse than no checklist. With the dev server running:

```bash
for p in /docs/chat/guides/error-handling /docs/chat/components/chat-tool-call-card \
  /docs/langgraph/guides/persistence /docs/chat/components/chat /docs/chat/guides/markdown \
  /docs/chat/guides/thread-routing /docs/chat/guides/theming \
  /docs/chat/getting-started/try-without-a-backend /docs/choosing-an-adapter \
  /docs/chat/components/chat-debug /docs/chat/getting-started/installation /privacy /about; do
  printf "%-52s %s\n" "$p" "$(curl -sS -o /dev/null -w '%{http_code}' "http://localhost:3000$p")"
done
```

Expected: `200` for every one.

- [ ] **Step 4: Look at it, and measure the alignment**

Start the dev server through the Browser pane preview tools (`website-dev` in `.claude/launch.json`), then in the console:

```javascript
const boxes = [...document.querySelectorAll('#proof .preflight-box')].map(b => b.getBoundingClientRect());
({ count: boxes.length,
   lefts: [...new Set(boxes.map(b => Math.round(b.left)))].sort((a,b) => a-b),
   sizes: [...new Set(boxes.map(b => `${Math.round(b.width)}x${Math.round(b.height)}`))] })
```

Expected: 27 boxes, **exactly two distinct left edges** above 820px (one per column) and all `16x16`. More than two means a row escaped its column — that happened once already with `display: contents`.

Then confirm by eye: the Yours boxes stay empty after the sequence finishes, the ticks read as a sequence rather than a flicker, and at 390px the columns stack with each row still on one line.

- [ ] **Step 5: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): preflight checklist verification pass"
```

---

## Out of scope

- The **masthead** keeps `MIT · ANGULAR 20–22 · NO ACCOUNT · NO CLOUD` even though Cloud and Signup now appear as rows ~200px below. The duplication is recorded in spec §5 as accepted; do not fix it here.
- The **"no content telemetry" claim** leaves the homepage with the dropped receipt. That is the decision, not an oversight.
- The **nine unused STRONG items** (multiple threads, subagents, generative UI, four layouts, conformance suite, dark mode, lifecycle timestamps, scriptable fake-agent events, MIT with no runtime key) stay on the bench.
