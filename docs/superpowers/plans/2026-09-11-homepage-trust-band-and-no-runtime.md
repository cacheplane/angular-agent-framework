# Homepage trust band + No-runtime band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Shrink the homepage's dark proof band to the five third-party Airworthiness rows, and add a bold "No runtime." band (copy left, two vertical flow diagrams right) between the architecture diagram and the Fork-us band, plus one FAQ entry.

**Architecture:** Section 1 is a deletion: the two checklist columns and three self-reported rows leave `lib/preflight-checklist.ts`, `PreflightChecklist.tsx`, and `landing.css`, and the guards shrink with them. Section 2 is a new `NoRuntimeBand.tsx` (`'use client'` only for the tracked link, like `OpenSourceStrip.tsx`) that reads every string from a new `NO_RUNTIME_BAND` object in `lib/positioning.ts`, draws the flows in plain HTML/CSS, and is pinned by a unit spec, the spine e2e, and a new measuring e2e. Section 3 adds one FAQ item.

**Tech Stack:** Next.js app in `apps/website` (React server components, `'use client'` only where hooks are used), Vitest + Testing Library (jsdom), Playwright e2e, plain CSS in `apps/website/src/styles/landing.css`, Nx targets.

**Spec:** `docs/superpowers/specs/2026-09-11-homepage-trust-band-and-no-runtime-design.md`

**Ground rules for every task**
- Never write a competitor's product name anywhere: not in code, comments, tests, commit messages, or this plan. Describe generically ("other agent UI kits").
- Run commands from the worktree root `/Users/blove/repos/angular-agent-framework/.claude/worktrees/homepage-trust-no-runtime`. Dependencies are already installed there (`npm ci` has been run); do not run `npm install`.
- Unit tests: `npx nx test website -- <path-filter>`; the `--` passes the filter to vitest. Lint: `npx nx lint website`. Build (the only typecheck): `npx nx build website`.
- The website's lint reports warnings on many files already; only **errors** fail CI. Strip ANSI before grepping lint output if you pipe it.
- Commit after every task with the trailer `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.

---

## File map

| File | Change | Responsibility |
| --- | --- | --- |
| `apps/website/src/lib/preflight-checklist.ts` | Modify | Only `AIRWORTHINESS` (5 rows) and `ChecklistRow` remain |
| `apps/website/src/lib/preflight-checklist.spec.ts` | Modify | Guards the five rows |
| `apps/website/src/components/landing/PreflightChecklist.tsx` | Modify | Renders one labelled list of five ticking rows |
| `apps/website/src/components/landing/PreflightChecklist.spec.tsx` | Modify | One list, every row linked |
| `apps/website/src/components/landing/Reliability.tsx` | Modify | New aside text, comment updated |
| `apps/website/src/components/landing/Reliability.spec.tsx` | Modify | Pins the new aside |
| `apps/website/src/styles/landing.css` | Modify | Delete column CSS; add `.no-runtime-*` rules |
| `apps/website/src/lib/positioning.ts` | Modify | Add `NO_RUNTIME_BAND` |
| `apps/website/src/lib/positioning.spec.ts` | Modify | Pins `NO_RUNTIME_BAND` |
| `apps/website/src/lib/analytics/events.ts` | Modify | Add `'home_no_runtime_docs'` to `CtaId` |
| `apps/website/src/components/landing/NoRuntimeBand.tsx` | Create | The band |
| `apps/website/src/components/landing/NoRuntimeBand.spec.tsx` | Create | Unit guards |
| `apps/website/src/app/page.tsx` | Modify | Insert the band in the spine |
| `apps/website/e2e/website.spec.ts` | Modify | Spine order gains `no-runtime-heading` |
| `apps/website/e2e/home-no-runtime.spec.ts` | Create | Measures node alignment at 1440 and 390 |
| `apps/website/src/components/landing/HomeFAQ.tsx` | Modify | Fifth question |
| `apps/website/src/components/landing/HomeFAQ.spec.tsx` | Modify | Counts five |
| `docs/superpowers/specs/2026-09-08-preflight-checklist-design.md` | Modify | One-line "superseded" note at the top |

---

## Task 1: Shrink the checklist data to the five Airworthiness rows

**Files:**
- Modify: `apps/website/src/lib/preflight-checklist.ts`
- Test: `apps/website/src/lib/preflight-checklist.spec.ts`

- [ ] **Step 1: Rewrite the spec to describe the five-row list**

Replace the whole file `apps/website/src/lib/preflight-checklist.spec.ts` with:

```ts
import { describe, it, expect, vi } from 'vitest';
import { AIRWORTHINESS } from './preflight-checklist';

describe('airworthiness rows', () => {
  it('lists exactly the five third-party figures', () => {
    // A length pin, on purpose: the list is only as honest as its sources,
    // and a row added without one is the failure mode this guard exists for.
    expect(AIRWORTHINESS.map((r) => r.challenge)).toEqual([
      'Framework rank',
      'OpenSSF Scorecard',
      'Supply-chain grade',
      'Angular support',
      'Release provenance',
    ]);
  });

  it('proves every row it ticks', () => {
    // "Not self-reported" is the section's own aside. A ticked row with no
    // link is a claim with no source.
    for (const row of AIRWORTHINESS) {
      expect(row.href, row.challenge).toBeTruthy();
    }
  });

  it('links pages a human can read, never a raw API', () => {
    for (const row of AIRWORTHINESS) {
      const { hostname, pathname } = new URL(row.href, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), row.href).toBe(false);
      expect(pathname.startsWith('/api/'), row.href).toBe(false);
    }
  });

  it('keeps the HVTrust grade live rather than hardcoding it', () => {
    // It has flipped grade several times in a month against an A-band floor
    // of 80; a hardcoded number would be wrong on some days.
    const grade = AIRWORTHINESS.find((r) => r.challenge === 'Supply-chain grade');
    expect(grade?.badgeSrc).toBe('https://hvtracker.net/badge/threadplane.svg');
    expect(grade?.response).toBe('');
  });

  it('carries no self-reported rows', () => {
    // Cloud, Signup and VC board were ours to say; the masthead and the FAQ
    // say them. Only figures a third party published belong here.
    for (const row of AIRWORTHINESS) {
      expect(row.response, row.challenge).not.toBe('NONE');
    }
  });

  it('derives the Angular range rather than hardcoding it', async () => {
    const { WEBSITE_SUPPORTED_ANGULAR_MAJORS } = await import(
      '../components/pricing/angular-support.mjs'
    );
    const row = AIRWORTHINESS.find((r) => r.challenge === 'Angular support');
    expect(row?.response).toContain(String(WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]));
    expect(row?.response).toContain(String(WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)));

    // The assertions above cannot tell a derived "20-22" from a typed one —
    // they agree until someone bumps a major, and by then the homepage has
    // been wrong for a release. So move the dependency and check the value
    // follows it. A hardcoded string will not.
    vi.resetModules();
    vi.doMock('../components/pricing/angular-support.mjs', () => ({
      WEBSITE_SUPPORTED_ANGULAR_MAJORS: Object.freeze([41, 42, 43]),
    }));
    const { AIRWORTHINESS: moved } = await import('./preflight-checklist');
    vi.doUnmock('../components/pricing/angular-support.mjs');
    vi.resetModules();

    expect(moved.find((r) => r.challenge === 'Angular support')?.response).toBe('41–43');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx nx test website -- src/lib/preflight-checklist.spec.ts`
Expected: FAIL. "lists exactly the five third-party figures" fails because the current array has eight entries, and "carries no self-reported rows" fails on the `NONE` rows.

- [ ] **Step 3: Rewrite the data module**

Replace the whole file `apps/website/src/lib/preflight-checklist.ts` with:

```ts
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../components/pricing/angular-support.mjs';

/**
 * The homepage airworthiness list: the figures a third party published about
 * this project, each linking to the body that published it.
 *
 * This used to be the tail of a 27-row preflight checklist with a Threadplane
 * column and an unticked Yours column (spec 2026-09-08). Both columns came
 * out on 2026-09-11: the section's job is trust, and the only half of it that
 * was not self-reported is this one. The three self-reported rows that lived
 * here (Cloud, Signup, VC board) went with them — the masthead above already
 * says "no account, no cloud" and the FAQ says the rest.
 *
 * Before adding a row: find the page that proves it. If there is no page, it
 * is not a row.
 */
export interface ChecklistRow {
  /** Left side of the line. 1–3 words. */
  readonly challenge: string;
  /** Right side. The figure itself, never a feature name. */
  readonly response: string;
  /** The page that proves it. */
  readonly href: string;
  /** Small trailing unit. */
  readonly unit?: string;
  /** Live badge rendered instead of `response` text. */
  readonly badgeSrc?: string;
}

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
  {
    challenge: 'Angular support',
    // Derived, not typed: bumping a supported major must update the homepage
    // without anyone remembering to edit this file.
    response: `${WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]}–${WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)}`,
    unit: 'CI-TESTED',
    href: 'https://www.npmjs.com/package/@threadplane/langgraph',
  },
  { challenge: 'Release provenance', response: 'SIGNED', unit: 'OIDC · SLSA', href: 'https://www.npmjs.com/package/@threadplane/chat' },
];
```

Note `href` is now `string`, not `string | null`: nothing unlinked is left.

- [ ] **Step 4: Run the data spec and see it pass**

Run: `npx nx test website -- src/lib/preflight-checklist.spec.ts`
Expected: PASS, 6 tests. (Other specs that import `PREFLIGHT_OURS` will fail until Task 2; that is expected and is why this task does not run the full suite.)

- [ ] **Step 5: Re-verify the two drifting figures against the live pages**

Open `https://hvtracker.net/categories/agent-frameworks/` and `https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework` in a browser. If the rank or score differs from `#8 OF 119` / `8.2`, change the row to the live value and note it in the commit message. Never round up.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/preflight-checklist.ts apps/website/src/lib/preflight-checklist.spec.ts
git commit -m "refactor(website): the checklist data keeps only the five airworthiness rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 2: Render one labelled list of five ticking rows

**Files:**
- Modify: `apps/website/src/components/landing/PreflightChecklist.tsx`
- Test: `apps/website/src/components/landing/PreflightChecklist.spec.tsx`

- [ ] **Step 1: Rewrite the component spec**

Replace the whole file `apps/website/src/components/landing/PreflightChecklist.spec.tsx` with:

```tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { PreflightChecklist } from './PreflightChecklist';
import { AIRWORTHINESS } from '../../lib/preflight-checklist';

describe('PreflightChecklist', () => {
  it('renders one row per data row and nothing else', () => {
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('.preflight-row')).toHaveLength(AIRWORTHINESS.length);
    // The two-column checklist is gone; nothing may bring its grid back.
    expect(container.querySelector('.preflight-cols')).toBeNull();
    expect(container.querySelector('.preflight-yours')).toBeNull();
  });

  it('links every row', () => {
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('a.preflight-row')).toHaveLength(AIRWORTHINESS.length);
    for (const a of Array.from(container.querySelectorAll('a.preflight-row'))) {
      expect(a.getAttribute('href')).toBeTruthy();
    }
  });

  it('draws the boxes rather than using form controls', () => {
    // Nothing here is interactive. An <input type="checkbox"> would tell a
    // screen reader it can be toggled, which is a lie.
    const { container } = render(<PreflightChecklist />);
    expect(container.querySelectorAll('input')).toHaveLength(0);
    expect(container.querySelectorAll('.preflight-box')).toHaveLength(AIRWORTHINESS.length);
  });

  it('names the list', () => {
    const { container } = render(<PreflightChecklist />);
    const lists = Array.from(container.querySelectorAll('ul[aria-labelledby]'));
    expect(lists).toHaveLength(1);
    const label = container.querySelector(`#${lists[0].getAttribute('aria-labelledby')}`);
    expect(label?.textContent).toBe('Airworthiness');
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

- [ ] **Step 2: Run it and watch it fail**

Run: `npx nx test website -- src/components/landing/PreflightChecklist.spec.tsx`
Expected: FAIL at import time — the component still imports `PREFLIGHT_OURS` and `PREFLIGHT_YOURS`, which no longer exist.

- [ ] **Step 3: Rewrite the component**

Replace the whole file `apps/website/src/components/landing/PreflightChecklist.tsx` with:

```tsx
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
```

- [ ] **Step 4: Run the component spec and see it pass**

Run: `npx nx test website -- src/components/landing/PreflightChecklist.spec.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Delete the column CSS**

In `apps/website/src/styles/landing.css`, inside the "Preflight checklist" block (it begins with the comment `/* Preflight checklist.`), delete these four rules exactly and nothing else:

```css
.preflight-cols {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 0 48px;
}
```

```css
.preflight-col-head.is-yours {
  color: var(--color-text-muted);
}
```

```css
/* The Airworthiness heading follows the two columns, so it — not its list —
 * is what needs the separation. Putting the margin on the list instead left
 * the heading butted flat against the last Threadplane row (measured: 0px)
 * while pushing it away from the rows it labels. */
.preflight-cols + .preflight-col-head {
  margin-top: 38px;
}
```

```css
.preflight-yours .preflight-response {
  font-weight: 400;
}
```

And replace the `@media (max-width: 820px)` block at the end of the preflight section:

```css
@media (max-width: 820px) {
  .preflight-cols {
    grid-template-columns: 1fr;
    gap: 24px;
  }
}
```

with nothing (delete it; the single column needs no breakpoint).

Also update the block's header comment. Replace:

```css
/* Preflight checklist.
 *
 * Plain flex rows: every row starts at its column's left edge and its first
 * child is a fixed 16px box, so the boxes share one edge by construction. Do
 * NOT reach for `display: contents` here — it breaks the moment one row is an
 * <li> rather than an <a>, and it weakens the link's semantics. */
```

with:

```css
/* Airworthiness list — components/landing/PreflightChecklist.tsx.
 *
 * Plain flex rows: every row starts at the list's left edge and its first
 * child is a fixed 16px box, so the boxes share one edge by construction. Do
 * NOT reach for `display: contents` here — it weakens the link's semantics
 * and, in the two-column version this replaced, broke alignment. */
```

And in the `.preflight-box` rule, replace the comment lines:

```css
  /* Deliberately NOT var(--color-border-strong): that resolves to
   * rgba(255,255,255,.2) in the dark scope, and the empty Yours boxes are the
   * section's whole argument — they cannot be the faintest thing on the band.
   * .35 is the value the approved prototype was reviewed at. */
```

with:

```css
  /* Deliberately NOT var(--color-border-strong): that resolves to
   * rgba(255,255,255,.2) in the dark scope and an unticked box would be the
   * faintest thing on the band before the sequence reaches it. */
```

- [ ] **Step 6: Confirm no other file references the deleted classes or exports**

Run: `grep -rn "preflight-cols\|preflight-yours\|PREFLIGHT_OURS\|PREFLIGHT_YOURS\|is-yours" apps/website/src apps/website/e2e`
Expected: only the `PreflightChecklist.spec.tsx` assertions from Step 1 (which assert absence). If anything else appears, remove that reference.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/landing/PreflightChecklist.tsx apps/website/src/components/landing/PreflightChecklist.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): the trust band renders the five airworthiness rows alone

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 3: Rewrite the trust band's aside and framing comment

**Files:**
- Modify: `apps/website/src/components/landing/Reliability.tsx`
- Test: `apps/website/src/components/landing/Reliability.spec.tsx`

- [ ] **Step 1: Add the aside assertion and drop the checklist-shape assertions**

In `apps/website/src/components/landing/Reliability.spec.tsx`, replace the third test (`'carries the checklist and keeps the framing above it'`) with:

```tsx
  it('frames the list as third-party proof', () => {
    const { container } = render(<Reliability />);
    expect(screen.getByText('Climb performance')).toBeTruthy();
    expect(
      screen.getByText('Not self-reported. Every figure links to the body that published it.'),
    ).toBeTruthy();
    expect(container.querySelector('.preflight')).toBeTruthy();
    // The two-column checklist and its predecessors are gone.
    expect(container.querySelector('.preflight-cols')).toBeNull();
    expect(container.querySelector('.proof-ladder')).toBeNull();
    expect(container.querySelector('.proof-strip-cells')).toBeNull();
  });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx nx test website -- src/components/landing/Reliability.spec.tsx`
Expected: FAIL on `getByText('Not self-reported. …')` — the aside still reads "Vx clears today's obstacle…".

- [ ] **Step 3: Update the component**

In `apps/website/src/components/landing/Reliability.tsx`:

Replace the `aside` prop value:

```tsx
              aside="Vx clears today’s obstacle; Vy gets you to altitude. Not self-reported — every number links to its source."
```

with:

```tsx
              aside="Not self-reported. Every figure links to the body that published it."
```

Replace the file's leading doc comment:

```tsx
/**
 * The reliability section (homepage design spec §3, block 2): the sourced
 * proof band, now argued as a preflight checklist.
 *
 * Replaces ProofStrip and LogoRibbon, both deleted with the homepage
 * restructure. The figure cards, the prose receipts and the pitch ladder came
 * out in favour of the checklist: every row states a challenge, the response
 * it gets, and links the page that proves it — and the unticked Yours column
 * is the half that makes the section honest.
 *
```

with:

```tsx
/**
 * The trust section (homepage design spec §3, block 2): the sourced proof
 * band, reduced on 2026-09-11 to the five third-party figures.
 *
 * Replaces ProofStrip and LogoRibbon, both deleted with the homepage
 * restructure, and the 27-row preflight checklist that followed them. The
 * Threadplane and Yours columns of that checklist were self-reported; the
 * airworthiness rows are not, and they are all that stays. The boundary
 * argument the Yours column used to make now lives in the No-runtime band
 * (NoRuntimeBand.tsx) and in the docs.
 *
```

- [ ] **Step 4: Run the three trust-band specs and see them pass**

Run: `npx nx test website -- src/components/landing/Reliability.spec.tsx src/components/landing/PreflightChecklist.spec.tsx src/lib/preflight-checklist.spec.ts`
Expected: PASS, all green.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/Reliability.tsx apps/website/src/components/landing/Reliability.spec.tsx
git commit -m "feat(website): the trust band's aside frames third-party proof

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 4: Add the No-runtime copy to positioning.ts and the CTA id

**Files:**
- Modify: `apps/website/src/lib/positioning.ts` (after `OPEN_SOURCE_STRIP`)
- Modify: `apps/website/src/lib/analytics/events.ts` (the `CtaId` union, "Homepage sections" group)
- Test: `apps/website/src/lib/positioning.spec.ts`

- [ ] **Step 1: Write the failing copy test**

In `apps/website/src/lib/positioning.spec.ts`, directly after the `describe('homepage restructure copy (live-stage spec §3)', …)` block, add:

```ts
describe('NO_RUNTIME_BAND (spec 2026-09-11)', () => {
  it('argues in two words over an aviation eyebrow, like Fork us', async () => {
    const { NO_RUNTIME_BAND } = await import('./positioning');
    expect(NO_RUNTIME_BAND.eyebrow).toBe('Cleared direct');
    expect(NO_RUNTIME_BAND.headline).toBe('No runtime.');
    // The same budgets as OPEN_SOURCE_STRIP: one line at 116px, one-line eyebrow.
    expect(NO_RUNTIME_BAND.headline.length).toBeLessThanOrEqual(12);
    expect(NO_RUNTIME_BAND.eyebrow.length).toBeLessThanOrEqual(14);
  });

  it('says no cloud, never no proxy', async () => {
    // The docs tell readers to put their agent behind their own proxy, so
    // "no proxy" would be false. "No cloud" is true and matches the masthead.
    const { NO_RUNTIME_BAND } = await import('./positioning');
    expect(NO_RUNTIME_BAND.body).toMatch(/no cloud/i);
    expect(NO_RUNTIME_BAND.body).not.toMatch(/proxy/i);
    expect(NO_RUNTIME_BAND.figureCaption).not.toMatch(/proxy/i);
  });

  it('links the page that already states the adapters call your server directly', async () => {
    const { NO_RUNTIME_BAND } = await import('./positioning');
    expect(NO_RUNTIME_BAND.link.href).toBe('/docs/choosing-an-adapter');
    expect(NO_RUNTIME_BAND.link.label).toBe('How it is wired');
  });

  it('draws the usual path with one more hop than ours, both starting at your users', async () => {
    const { NO_RUNTIME_BAND } = await import('./positioning');
    expect(NO_RUNTIME_BAND.flows.usual.nodes).toEqual(['Your users', 'Their runtime', 'Your agent']);
    expect(NO_RUNTIME_BAND.flows.ours.nodes).toEqual(['Your users', 'Your agent']);
    expect(NO_RUNTIME_BAND.flows.usual.ghost).toBe('Their runtime');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx nx test website -- src/lib/positioning.spec.ts`
Expected: FAIL — `NO_RUNTIME_BAND` is undefined.

- [ ] **Step 3: Add the copy object**

In `apps/website/src/lib/positioning.ts`, directly after the `OPEN_SOURCE_STRIP` object's closing `} as const;`, add:

```ts
// ── The No-runtime band (dark, between the architecture diagram and Fork us;
// spec 2026-09-11). Threadplane's adapters call your LangGraph or AG-UI server
// from the browser: there is no server of ours in the request path, no key,
// no dev-only flag, no production tier. Other agent UI kits ship a "runtime"
// that sits between the two; this band states our shape and names nobody. ──
export const NO_RUNTIME_BAND = {
  /**
   * Controller phraseology for a clearance straight to a fix, skipping the
   * intermediate ones. Texture, like "Squawk 1200": the headline carries the
   * meaning, so a reader who does not fly loses nothing.
   */
  eyebrow: 'Cleared direct',
  /** Two words at up to 116px. */
  headline: 'No runtime.',
  /**
   * "No cloud", not "no proxy": the docs tell you to put your agent behind
   * your own proxy, so "no proxy" would be false.
   */
  body:
    'Your users reach your LangGraph or AG-UI server from your Angular app. Nothing of ours in between: no cloud, no key, no dev-only flag.',
  link: {
    label: 'How it is wired',
    href: '/docs/choosing-an-adapter',
  },
  /**
   * The two vertical flows. `ghost` is the node drawn dashed and struck
   * through: the hop that is not there with Threadplane. "Your users" echoes
   * the first column label of the architecture diagram above the band.
   */
  flows: {
    usual: {
      label: 'The usual',
      nodes: ['Your users', 'Their runtime', 'Your agent'],
      ghost: 'Their runtime',
    },
    ours: {
      label: 'Threadplane',
      nodes: ['Your users', 'Your agent'],
    },
  },
  /** Read to assistive tech in place of the drawn flows. */
  figureCaption:
    'The usual path runs from your users through the vendor’s runtime to your agent. With Threadplane your users reach your agent directly.',
} as const;
```

- [ ] **Step 4: Add the CTA id**

In `apps/website/src/lib/analytics/events.ts`, in the `CtaId` union under the `// Homepage sections` comment, add one member after `| 'home_coding_agent_link'`:

```ts
  | 'home_no_runtime_docs'
```

- [ ] **Step 5: Run the positioning spec and see it pass**

Run: `npx nx test website -- src/lib/positioning.spec.ts`
Expected: PASS, including the four new tests.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/positioning.ts apps/website/src/lib/positioning.spec.ts apps/website/src/lib/analytics/events.ts
git commit -m "feat(website): single-source the No-runtime band copy and register its CTA id

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 5: Build the NoRuntimeBand component

**Files:**
- Create: `apps/website/src/components/landing/NoRuntimeBand.tsx`
- Create: `apps/website/src/components/landing/NoRuntimeBand.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (append after the `.open-source-strip` block's `@media (max-width: 640px)` rule)

- [ ] **Step 1: Write the failing component spec**

Create `apps/website/src/components/landing/NoRuntimeBand.spec.tsx`:

```tsx
// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NoRuntimeBand } from './NoRuntimeBand';
import { NO_RUNTIME_BAND } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: trackCtaClickMock,
  trackExternalLinkClick: vi.fn(),
}));

beforeEach(() => trackCtaClickMock.mockClear());

describe('NoRuntimeBand', () => {
  it('makes the two-word headline the section heading and names the section by it', () => {
    const { container } = render(<NoRuntimeBand />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe(NO_RUNTIME_BAND.headline);
    expect(heading.id).toBe('no-runtime-heading');
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('aria-labelledby')).toBe('no-runtime-heading');
    expect(section?.getAttribute('id')).toBe('no-runtime');
    expect(container.querySelector('.no-runtime-eyebrow')?.textContent).toBe(NO_RUNTIME_BAND.eyebrow);
    expect(screen.getByText(NO_RUNTIME_BAND.body)).toBeTruthy();
  });

  it('sits on the dark surface at the full rhythm, like Fork us', () => {
    const { container } = render(<NoRuntimeBand />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(section?.getAttribute('data-tight')).toBeNull();
    expect(section?.classList.contains('no-runtime')).toBe(true);
  });

  it('offers one text link and no button, and reports it as a homepage CTA', () => {
    const { container } = render(<NoRuntimeBand />);
    const links = container.querySelectorAll('a');
    expect(links).toHaveLength(1);
    const link = screen.getByRole('link', { name: NO_RUNTIME_BAND.link.label });
    expect(link.getAttribute('href')).toBe(NO_RUNTIME_BAND.link.href);
    expect(container.querySelector('[data-ui="button"]')).toBeNull();
    fireEvent.click(link);
    expect(trackCtaClickMock).toHaveBeenCalledWith({
      cta_id: 'home_no_runtime_docs',
      track: 'developer',
      surface: 'home',
      destination_url: NO_RUNTIME_BAND.link.href,
    });
  });

  it('draws both flows from the copy module, with the ghost hop only in the usual one', () => {
    const { container } = render(<NoRuntimeBand />);
    const usual = container.querySelector('[data-flow="usual"]');
    const ours = container.querySelector('[data-flow="ours"]');
    expect(
      Array.from(usual!.querySelectorAll('.no-runtime-node')).map((n) => n.textContent),
    ).toEqual([...NO_RUNTIME_BAND.flows.usual.nodes]);
    expect(
      Array.from(ours!.querySelectorAll('.no-runtime-node')).map((n) => n.textContent),
    ).toEqual([...NO_RUNTIME_BAND.flows.ours.nodes]);
    expect(container.querySelectorAll('.no-runtime-node.is-ghost')).toHaveLength(1);
    expect(usual!.querySelector('.no-runtime-node.is-ghost')?.textContent).toBe(
      NO_RUNTIME_BAND.flows.usual.ghost,
    );
    expect(ours!.querySelector('.is-ghost')).toBeNull();
  });

  it('gives the flows a prose caption and hides the arrows from assistive tech', () => {
    const { container } = render(<NoRuntimeBand />);
    const figure = container.querySelector('figure.no-runtime-figure');
    expect(figure).toBeTruthy();
    expect(figure?.querySelector('figcaption')?.textContent).toBe(NO_RUNTIME_BAND.figureCaption);
    // The drawn flows duplicate the caption, so they are hidden as a unit.
    expect(figure?.querySelector('.no-runtime-flows')?.getAttribute('aria-hidden')).toBe('true');
  });

  it('marks the runway decorative and puts it outside the container', () => {
    const { container } = render(<NoRuntimeBand />);
    const runway = container.querySelector('.no-runtime-runway');
    expect(runway?.getAttribute('aria-hidden')).toBe('true');
    expect(runway?.closest('[data-ui="container"]')).toBeNull();
    expect(runway?.parentElement?.getAttribute('data-ui')).toBe('section');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx nx test website -- src/components/landing/NoRuntimeBand.spec.tsx`
Expected: FAIL — cannot resolve `./NoRuntimeBand`.

- [ ] **Step 3: Write the component**

Create `apps/website/src/components/landing/NoRuntimeBand.tsx`:

```tsx
'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { trackCtaClick } from '../../lib/analytics/client';
import { NO_RUNTIME_BAND } from '../../lib/positioning';

/**
 * The No-runtime band (spec 2026-09-11): a dark band between the architecture
 * diagram and Fork us, in the same loud register. Copy left, two vertical
 * flows right — the usual path with a vendor runtime in the middle, and ours
 * without it.
 *
 * Everything it says comes from NO_RUNTIME_BAND (positioning.ts). It names no
 * other product: the band states Threadplane's shape and leaves the
 * comparison to the reader.
 *
 * `'use client'` only for the analytics click handler; there is no state.
 */
export function NoRuntimeBand() {
  const { eyebrow, headline, body, link, flows, figureCaption } = NO_RUNTIME_BAND;

  return (
    <Section surface="dark" id="no-runtime" ariaLabelledBy="no-runtime-heading" className="no-runtime">
      <Container>
        <div className="no-runtime-grid">
          <div className="no-runtime-copy">
            <p className="no-runtime-eyebrow">{eyebrow}</p>
            <h2 id="no-runtime-heading" className="no-runtime-headline">
              {headline}
            </h2>
            <p className="no-runtime-body">{body}</p>
            <a
              className="no-runtime-link"
              href={link.href}
              onClick={() =>
                trackCtaClick({
                  cta_id: 'home_no_runtime_docs',
                  track: 'developer',
                  surface: 'home',
                  destination_url: link.href,
                })
              }
            >
              {link.label}
              <span aria-hidden="true"> →</span>
            </a>
          </div>

          <figure className="no-runtime-figure">
            {/* The drawn flows and the caption say the same thing; the drawing
                is hidden as a unit so a screen reader hears it once. */}
            <div className="no-runtime-flows" aria-hidden="true">
              <Flow id="usual" label={flows.usual.label} nodes={flows.usual.nodes} ghost={flows.usual.ghost} />
              <Flow id="ours" label={flows.ours.label} nodes={flows.ours.nodes} />
            </div>
            <figcaption className="no-runtime-caption">{figureCaption}</figcaption>
          </figure>
        </div>
      </Container>
      {/* Spans the section, not the container, like the Fork us runway. */}
      <div className="no-runtime-runway" aria-hidden="true" />
    </Section>
  );
}

function Flow({
  id,
  label,
  nodes,
  ghost,
}: {
  id: 'usual' | 'ours';
  label: string;
  nodes: readonly string[];
  ghost?: string;
}) {
  return (
    <div className="no-runtime-flow" data-flow={id}>
      <p className="no-runtime-flow-label">{label}</p>
      {nodes.map((node, i) => (
        <div className="no-runtime-hop" key={node}>
          {i > 0 ? <span className={`no-runtime-arrow${id === 'ours' ? ' is-direct' : ''}`} /> : null}
          <span
            className={`no-runtime-node${node === ghost ? ' is-ghost' : ''}${
              i === nodes.length - 1 ? ' is-agent' : ''
            }`}
          >
            {node}
          </span>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 4: Run the spec and see it pass**

Run: `npx nx test website -- src/components/landing/NoRuntimeBand.spec.tsx`
Expected: PASS, 6 tests.

- [ ] **Step 5: Add the CSS**

In `apps/website/src/styles/landing.css`, directly after the Fork-us block's closing `@media (max-width: 640px) { … }` rule (the one that sets `.open-source-strip-headline` to `clamp(44px, 13vw, 56px)`), append:

```css
/* The No-runtime band — components/landing/NoRuntimeBand.tsx.
 * Same register as Fork us (eyebrow, display headline, runway) at the full
 * section rhythm, but with a text link instead of a button so two adjacent
 * dark bands do not read as one. Copy left, two vertical flows right. */
.no-runtime {
  position: relative;
}
.no-runtime-grid {
  display: grid;
  grid-template-columns: minmax(0, 1.05fr) minmax(0, 1fr);
  gap: 56px;
  align-items: center;
}
.no-runtime-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  line-height: 1.4;
  color: var(--color-signal);
  margin: 0 0 22px;
}
.no-runtime-headline {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(56px, 8.5vw, 116px);
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: var(--color-text-primary);
  margin: 0;
}
.no-runtime-body {
  font-family: var(--font-sans);
  font-size: 17px;
  line-height: 1.55;
  color: var(--color-text-secondary);
  max-width: 480px;
  margin: 26px 0 0;
}
.no-runtime-link {
  display: inline-block;
  margin-top: 24px;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 600;
  color: var(--color-signal);
  text-decoration: none;
}
.no-runtime-link:hover {
  text-decoration: underline;
}

/* The flows. Each is a column of bordered mono nodes joined by 1.5px arrows;
 * the ours arrow is yellow and taller because it spans the hop that is not
 * there. Nodes share a min-width so the two columns line up. */
.no-runtime-figure {
  margin: 0;
}
.no-runtime-flows {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 32px;
}
.no-runtime-flow {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.no-runtime-flow-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 14px;
}
.no-runtime-hop {
  display: flex;
  flex-direction: column;
  align-items: center;
}
.no-runtime-node {
  display: block;
  box-sizing: border-box;
  min-width: 150px;
  padding: 13px 18px;
  border: 1.5px solid var(--color-text-primary);
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
  white-space: nowrap;
  color: var(--color-text-primary);
}
.no-runtime-node.is-agent {
  border-color: var(--color-signal);
  color: var(--color-signal);
}
/* The hop that is not there with Threadplane. Dashed, muted and struck
 * through — three signals, so none of them has to carry it alone. */
.no-runtime-node.is-ghost {
  border-style: dashed;
  border-color: var(--color-text-muted);
  color: var(--color-text-muted);
  text-decoration: line-through;
}
.no-runtime-arrow {
  position: relative;
  width: 1.5px;
  height: 36px;
  background: var(--color-text-muted);
}
.no-runtime-arrow::after {
  content: '';
  position: absolute;
  bottom: -1px;
  left: -4px;
  border: 5px solid transparent;
  border-top-color: var(--color-text-muted);
}
.no-runtime-arrow.is-direct {
  height: 74px;
  background: var(--color-signal);
}
.no-runtime-arrow.is-direct::after {
  border-top-color: var(--color-signal);
}
/* Visually hidden, read by assistive tech in place of the drawing. Same
 * recipe as .stage-skip. */
.no-runtime-caption {
  position: absolute;
  width: 1px;
  height: 1px;
  overflow: hidden;
  clip: rect(0 0 0 0);
  clip-path: inset(50%);
  white-space: nowrap;
}
/* The runway centreline, as on Fork us. */
.no-runtime-runway {
  pointer-events: none;
  position: absolute;
  left: 0;
  right: 0;
  bottom: 30px;
  height: 6px;
  background: repeating-linear-gradient(
    90deg,
    rgba(255, 175, 0, 0.5) 0 46px,
    transparent 46px 92px
  );
}
@media (max-width: 820px) {
  .no-runtime-grid {
    grid-template-columns: 1fr;
    gap: 44px;
  }
}
@media (max-width: 640px) {
  .no-runtime-headline {
    font-size: clamp(44px, 13vw, 56px);
  }
}
@media (max-width: 480px) {
  .no-runtime-flows {
    grid-template-columns: 1fr;
    gap: 36px;
  }
}
```

- [ ] **Step 6: Lint the two new files**

Run: `npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -A3 "NoRuntimeBand" || echo "no NoRuntimeBand lint output"`
Expected: `no NoRuntimeBand lint output` (warnings elsewhere are pre-existing; only errors matter).

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/landing/NoRuntimeBand.tsx apps/website/src/components/landing/NoRuntimeBand.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): the No-runtime band — two words over two flows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 6: Insert the band into the spine and pin the order

**Files:**
- Modify: `apps/website/src/app/page.tsx`
- Modify: `apps/website/e2e/website.spec.ts` (the `ids` array in the spine test)

- [ ] **Step 1: Add the id to the spine e2e**

In `apps/website/e2e/website.spec.ts`, in the test `'landing page renders the spine in order (live-stage spec §3)'`, change the `ids` array to:

```ts
  const ids = [
    'hero-heading',
    'proof-heading',
    'compatibility-heading',
    'architecture-heading',
    'no-runtime-heading',
    'open-source-heading',
    'stage-heading',
    'field-report-heading',
    'faq-heading',
  ];
```

- [ ] **Step 2: Insert the band in the page**

In `apps/website/src/app/page.tsx`:

Add the import after the `OpenSourceStrip` import:

```tsx
import { NoRuntimeBand } from '../components/landing/NoRuntimeBand';
```

Replace:

```tsx
      <EnterpriseArchitecture />

      {/* The open-source full stop: a loud dark band with one fork CTA. Copy
          lives in OPEN_SOURCE_STRIP (positioning.ts). */}
      <OpenSourceStrip />
```

with:

```tsx
      <EnterpriseArchitecture />

      {/* No runtime: the diagram above shows Threadplane reaching your agent
          directly; this band says so in two words. Copy lives in
          NO_RUNTIME_BAND (positioning.ts). Deliberately dark-on-dark with the
          band below; each dark section paints its own seam (spec §5). */}
      <NoRuntimeBand />

      {/* The open-source full stop: a loud dark band with one fork CTA. Copy
          lives in OPEN_SOURCE_STRIP (positioning.ts). */}
      <OpenSourceStrip />
```

- [ ] **Step 3: Run the whole website unit suite**

Run: `npx nx test website`
Expected: PASS, 0 failures. If `public-copy.spec.ts` fails, one of the new strings matched a barred pattern in `lib/public-copy-contract.ts`; reword the string in `positioning.ts` (the barred phrases are listed in `BANNED_CLAIMS` and `NARRATIVE_MENTIONS`), never the contract.

- [ ] **Step 4: Build, because lint and test do not typecheck**

Run: `rm -rf apps/website/.next && npx nx build website`
Expected: exits 0. A `CtaId` typo would surface only here.

- [ ] **Step 5: Run the spine e2e**

Run: `npx nx e2e website -- --grep "spine in order"`
Expected: 1 passed. If it times out on `page.goto`, a stale `apps/website/.next/dev` directory is the usual cause; `rm -rf apps/website/.next` and rerun.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/app/page.tsx apps/website/e2e/website.spec.ts
git commit -m "feat(website): the No-runtime band joins the homepage spine after the architecture diagram

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 7: Measure the flows at 1440 and 390

**Files:**
- Create: `apps/website/e2e/home-no-runtime.spec.ts`

- [ ] **Step 1: Write the measuring spec**

Create `apps/website/e2e/home-no-runtime.spec.ts`:

```ts
import { test, expect, type Page } from '@playwright/test';

const BAND = '#no-runtime';

/**
 * The unit spec proves the flows are drawn from the copy module; this proves
 * the drawing holds together in a real layout. Measured, not eyeballed: every
 * node in a flow shares that flow's centre line, no node's text overflows its
 * box, and on a phone the flows stack instead of squeezing.
 */
async function nodeReport(page: Page) {
  return page.evaluate((sel) => {
    const flows = Array.from(document.querySelectorAll<HTMLElement>(`${sel} [data-flow]`));
    return flows.map((flow) => {
      const nodes = Array.from(flow.querySelectorAll<HTMLElement>('.no-runtime-node'));
      return {
        id: flow.dataset['flow'],
        top: flow.getBoundingClientRect().top,
        centres: nodes.map((n) => {
          const r = n.getBoundingClientRect();
          return Math.round((r.left + r.right) / 2);
        }),
        overflowing: nodes.filter((n) => n.scrollWidth > n.clientWidth).map((n) => n.textContent),
      };
    });
  }, BAND);
}

test.describe('homepage No-runtime band', () => {
  test('aligns every node on its flow centre line and clips no text at 1440', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto('/');
    await expect(page.locator('#no-runtime-heading')).toHaveText('No runtime.');
    await page.locator(BAND).scrollIntoViewIfNeeded();
    const flows = await nodeReport(page);
    expect(flows.map((f) => f.id)).toEqual(['usual', 'ours']);
    for (const f of flows) {
      expect(f.overflowing, f.id).toEqual([]);
      expect(new Set(f.centres).size, `${f.id} centres ${f.centres.join(',')}`).toBe(1);
    }
    // Side by side: the two flows share a top edge.
    expect(Math.abs(flows[0].top - flows[1].top)).toBeLessThanOrEqual(1);
    // The ghost hop exists exactly once and only in the usual flow.
    await expect(page.locator(`${BAND} .no-runtime-node.is-ghost`)).toHaveCount(1);
    await expect(page.locator(`${BAND} [data-flow="ours"] .is-ghost`)).toHaveCount(0);
  });

  test('stacks the flows and still fits every node on a phone', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    await page.locator(BAND).scrollIntoViewIfNeeded();
    const flows = await nodeReport(page);
    for (const f of flows) {
      expect(f.overflowing, f.id).toEqual([]);
      expect(new Set(f.centres).size).toBe(1);
    }
    // Stacked: the ours flow starts below the usual one.
    expect(flows[1].top).toBeGreaterThan(flows[0].top + 100);
    // The page never scrolls sideways.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });

  test('carries one link, to the adapter guide, and no button', async ({ page }) => {
    await page.goto('/');
    const links = page.locator(`${BAND} a`);
    await expect(links).toHaveCount(1);
    await expect(links).toHaveAttribute('href', '/docs/choosing-an-adapter');
    await expect(page.locator(`${BAND} [data-ui="button"]`)).toHaveCount(0);
  });
});
```

- [ ] **Step 2: Run it**

Run: `npx nx e2e website -- home-no-runtime.spec.ts`
Expected: 3 passed. If the 390 test reports an overflowing node, the node text is wrapping or clipping: raise the `@media (max-width: 480px)` breakpoint in the CSS from Task 5 rather than shrinking the font below 12px.

- [ ] **Step 3: Commit**

```bash
git add apps/website/e2e/home-no-runtime.spec.ts
git commit -m "test(website): measure the No-runtime flows at desktop and phone widths

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 8: The FAQ entry

**Files:**
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`
- Test: `apps/website/src/components/landing/HomeFAQ.spec.tsx`

- [ ] **Step 1: Extend the FAQ spec**

Replace the body of the single test in `apps/website/src/components/landing/HomeFAQ.spec.tsx` so the file reads:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HomeFAQ } from './HomeFAQ';

describe('HomeFAQ', () => {
  it('asks only what the page above did not answer', () => {
    const { container } = render(<HomeFAQ />);
    const questions = [
      'Is Threadplane a backend agent framework?',
      'Can I use my existing Angular component library and design system?',
      'Does generated UI execute arbitrary code?',
      'Does Threadplane require a hosted service or an account?',
      'Does Threadplane have a runtime I need to deploy?',
    ];
    for (const q of questions) expect(screen.getByText(q)).toBeTruthy();
    expect(screen.queryByText('Does Threadplane require LangGraph?')).toBeNull();
    expect(screen.queryByText(/raw streaming SDK/)).toBeNull();
    expect(container.querySelectorAll('summary')).toHaveLength(5);
    expect(container.querySelectorAll('a')).toHaveLength(5);
  });

  it('answers the runtime question in the band’s own words', () => {
    render(<HomeFAQ />);
    const answer = screen.getByText(/no Threadplane server in the request path/);
    expect(answer.textContent).toMatch(/no key/);
    expect(answer.textContent).toMatch(/no production tier/);
    expect(answer.textContent).not.toMatch(/proxy/i);
    expect(answer.querySelector('a')?.getAttribute('href')).toBe('/docs/choosing-an-adapter');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx nx test website -- src/components/landing/HomeFAQ.spec.tsx`
Expected: FAIL — the fifth question is not rendered.

- [ ] **Step 3: Add the item**

In `apps/website/src/components/landing/HomeFAQ.tsx`, after the item whose `q` is `'Does Threadplane require a hosted service or an account?'` and before the closing `];`, add:

```tsx
  {
    q: 'Does Threadplane have a runtime I need to deploy?',
    a: (
      <>
        No. The adapters call your LangGraph or AG-UI server from the browser. There is no
        Threadplane server in the request path, no key, and no production tier.{' '}
        <a href="/docs/choosing-an-adapter">How it is wired</a>
      </>
    ),
  },
```

Also change the leading comment `// Four questions the page above does not answer (live-stage spec §3).` to `// Five questions the page above does not answer (live-stage spec §3; the runtime one from spec 2026-09-11).`

- [ ] **Step 4: Run it and see it pass**

Run: `npx nx test website -- src/components/landing/HomeFAQ.spec.tsx`
Expected: PASS, 2 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/HomeFAQ.tsx apps/website/src/components/landing/HomeFAQ.spec.tsx
git commit -m "feat(website): the homepage FAQ answers whether there is a runtime to deploy

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 9: Mark the old spec superseded and verify the whole change

**Files:**
- Modify: `docs/superpowers/specs/2026-09-08-preflight-checklist-design.md` (header only)

- [ ] **Step 1: Add the supersession note**

In `docs/superpowers/specs/2026-09-08-preflight-checklist-design.md`, directly after the line `**Supersedes:** the pitch-ladder device in …`, add:

```markdown
**Superseded on 2026-09-11** by `2026-09-11-homepage-trust-band-and-no-runtime-design.md`: the Threadplane and Yours columns and the three self-reported Airworthiness rows were removed; the five third-party rows remain.
```

- [ ] **Step 2: Full unit suite, lint, build**

Run:

```bash
npx nx test website && npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "^\s*[0-9]+:[0-9]+\s+error" ; rm -rf apps/website/.next && npx nx build website
```

Expected: tests pass with 0 failures; the grep prints no `error` lines (warnings are pre-existing); build exits 0.

- [ ] **Step 3: Full website e2e**

Run: `npx nx e2e website`
Expected: all passed. Before running, make sure no stray `next dev` or example serve is holding port 4308 (`lsof -i :4308`); a stale server serves the old bundle and the spine test will fail on the missing `no-runtime-heading`.

- [ ] **Step 4: Look at it in a browser, and measure the two things the spec calls out**

Start the site with the Browser pane (`preview_start` on the website dev server; do not use Bash for servers) and open `/`. Then:

- Scroll to `#proof`. Confirm five rows, one column, and that the boxes tick in sequence. Run in the console and confirm one distinct value:
  `new Set([...document.querySelectorAll('#proof .preflight-box')].map(b => Math.round(b.getBoundingClientRect().left))).size`
- Scroll to `#no-runtime`. Confirm the band reads as its own band above Fork us, not as one tall dark block. If it does not, apply the spec §5 fallback: delete the `.no-runtime-runway` rule and the `<div className="no-runtime-runway" …/>` element plus its spec assertion, and note it in the commit.
- Resize to 390px wide and confirm the copy sits above the flows and the flows stack.
- Take a screenshot of each band for the PR description.

- [ ] **Step 5: Confirm every href in both bands resolves**

Run from the worktree root, with the dev server still up on 4308:

```bash
for u in https://hvtracker.net/categories/agent-frameworks/ "https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework" https://hvtracker.net/agents/threadplane/ https://www.npmjs.com/package/@threadplane/langgraph https://www.npmjs.com/package/@threadplane/chat http://127.0.0.1:4308/docs/choosing-an-adapter; do printf '%s ' "$u"; curl -s -o /dev/null -w '%{http_code}\n' -L "$u"; done
```

Expected: every line ends in `200`.

- [ ] **Step 6: Commit**

```bash
git add docs/superpowers/specs/2026-09-08-preflight-checklist-design.md
git commit -m "docs(specs): mark the preflight checklist spec superseded

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

## Task 10: Open the pull request

- [ ] **Step 1: Push and open the PR**

```bash
git push -u origin blove/homepage-trust-no-runtime
gh pr create --title "feat(website): the trust band keeps only third-party proof, and a No-runtime band lands after the architecture diagram" --body "$(cat <<'EOF'
## What

- The homepage's dark proof band drops the 27-row preflight checklist to the five third-party Airworthiness rows (framework rank, OpenSSF Scorecard, live supply-chain badge, Angular range, signed provenance). About 1,100px becomes about 450px on desktop.
- A new **No runtime.** band sits between the architecture diagram and Fork us: two words in the Fork-us register, one sentence, one link, and two vertical flows — the usual path with a vendor runtime in the middle, and ours without it.
- One FAQ entry: does Threadplane have a runtime to deploy? No.

Spec: `docs/superpowers/specs/2026-09-11-homepage-trust-band-and-no-runtime-design.md`.

## Why

The checklist had become a feature list, and the only part of the band that was not self-reported was the scores. And the site never said the one thing the architecture diagram shows: nothing of ours sits between the browser and your agent. No cloud, no key, no dev-only flag.

## Guards

- Unit: the five rows, every row linked, the band copy pinned (including "no cloud, never no proxy"), the flows drawn from the copy module, one link and no button.
- e2e: spine order gains `no-runtime-heading`; a new spec measures node alignment at 1440 and stacking at 390.

## Screenshots

(attach the two band screenshots from Task 9)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 2: Watch CI, then verify on the preview**

The required check is `CI — required`. When the Vercel preview is up, open it and repeat the Task 9 Step 4 checks against the preview URL, because the website's e2e is known to pass against `next dev` and fail against a production build in a few focus-related cases.

---

## Self-review against the spec

- §2.1 removals → Tasks 1, 2 (data, renderer, CSS, guards). ✔
- §2.2 five rows, derived range, live badge, list label, new aside → Tasks 1, 2, 3. ✔
- §2.3 guards → Tasks 1, 2, 3. ✔
- §3.1 layout, eyebrow, headline, body, link with CTA id, flows, runway, breakpoints → Tasks 4, 5. ✔
- §3.2 figure + hidden caption, arrows hidden → Task 5 (`aria-hidden` on `.no-runtime-flows`, `.no-runtime-caption`). ✔
- §3.3 copy in positioning.ts with spec pins → Task 4. ✔
- §3.4 no proxy, no competitor names, copy contract → Task 4 tests + Task 6 Step 3. ✔
- §3.5 unit spec, spine e2e, measuring e2e → Tasks 5, 6, 7. ✔
- §4 FAQ → Task 8. ✔
- §5 dark-on-dark decision and fallback → Task 6 comment, Task 9 Step 4. ✔
- §7 verification → Task 9. ✔

Type consistency: `NO_RUNTIME_BAND.flows.usual.nodes` / `.ghost`, `.flows.ours.nodes`, `.link.href` / `.link.label`, `.figureCaption` are used identically in Tasks 4, 5, and 7. `ChecklistRow.href` is `string` in Task 1 and treated as always present in Task 2.
