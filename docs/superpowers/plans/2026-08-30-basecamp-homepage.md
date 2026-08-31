# Basecamp-Informed Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved homepage redesign — dark specimen "Yes wall" replacing `Differentiator`, a light elevated proof strip, a problem-first hero, a dark `FinalCTA` variant, and four surface treatments — per `docs/superpowers/specs/2026-08-27-basecamp-homepage-design.md`.

**Architecture:** `apps/website` is Next.js 16 / React 19. Since the style-substrate migration, primitives render `data-ui` attributes and ALL presentation lives in **unlayered CSS** under `apps/website/src/styles/` (`ui.css` for primitives, `landing.css` for landing components) — do NOT add inline `style` props or `@layer` wrappers. Dark sections work by **re-scoping the `--color-*` custom properties** inside `[data-ui="section"][data-surface="dark"]`, so every child primitive (Eyebrow, Button) picks up dark values with zero TS changes. This supersedes the spec's older "import `darkOverrides` in TS" note — same rule honored (never make `tokens.ts` theme-aware), cleaner mechanism.

**Tech Stack:** Next.js 16, React 19, Vitest + Testing Library (specs colocated, jsdom), plain CSS custom properties. Fonts already loaded via `next/font` as `--font-garamond` / `--font-inter` / `--font-mono`.

**Test command (memorize it):** `cd apps/website && npx vitest run --config vite.config.mts` — `nx test website` also works but run vitest directly for single files: `npx vitest run --config vite.config.mts src/components/landing/YesWall.spec.tsx`.

**Verification gate at the end:** production build (`npx nx build website --configuration=production`) + visual pass in the browser preview. Example-app strictness and bundle-budget failures show up only in prod builds.

---

### Task 1: Dark surface substrate (`Section` + CSS variable re-scope)

**Files:**
- Modify: `apps/website/src/components/ui/Section.tsx` (the `Surface` type, line 4)
- Modify: `apps/website/src/styles/ui.css` (section rules, ~line 141)
- Create: `apps/website/src/components/ui/Section.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/ui/Section.spec.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Section } from './Section';

describe('Section', () => {
  it('renders data-surface="dark" when asked', () => {
    const { container } = render(<Section surface="dark">x</Section>);
    const el = container.querySelector('[data-ui="section"]');
    expect(el?.getAttribute('data-surface')).toBe('dark');
  });

  it('defaults to canvas', () => {
    const { container } = render(<Section>x</Section>);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('canvas');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/ui/Section.spec.tsx`
Expected: FAIL — TS rejects `surface="dark"` (`Type '"dark"' is not assignable to type 'Surface'`).

- [ ] **Step 3: Extend the Surface union**

In `apps/website/src/components/ui/Section.tsx` change line 4:

```tsx
type Surface = 'canvas' | 'tinted' | 'white' | 'dark';
```

Nothing else in the component changes — the attribute already flows through.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/ui/Section.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the dark-scope CSS**

In `apps/website/src/styles/ui.css`, directly after the
`[data-ui="section"][data-surface="white"]` rule (~line 158), add:

```css
/* Dark section scope (homepage Yes wall + FinalCTA dark variant).
 * Values mirror libs/design-tokens/src/lib/dark.ts — the website hardwires
 * the light theme in TS, so dark sections re-scope the CSS variables instead.
 * If dark.ts changes, update here. Treatment B (spec): the canvas is a subtle
 * vertical gradient, and a 1px accent seam marks the light→dark boundary. */
[data-ui="section"][data-surface="dark"] {
  --color-canvas: rgb(17, 17, 17);
  --color-surface: rgb(28, 28, 28);
  --color-surface-tinted: rgb(44, 44, 44);
  --color-surface-dim: rgb(10, 10, 10);
  --color-border: rgb(45, 45, 45);
  --color-border-strong: rgb(60, 60, 60);
  --color-text-primary: rgb(245, 245, 245);
  --color-text-secondary: rgb(200, 200, 200);
  --color-text-muted: rgb(160, 160, 160);
  --color-text-inverted: rgb(17, 17, 17);
  --color-accent: #64c3fd;
  --color-accent-hover: #8dd4ff;
  --color-accent-glow: rgba(100, 195, 253, 0.25);
  --color-accent-border: rgba(100, 195, 253, 0.2);
  --color-accent-surface: rgba(100, 195, 253, 0.08);

  background: linear-gradient(180deg, #161616 0%, #0e0e0e 100%);
  color: var(--color-text-primary);
  position: relative;
}
/* 1px accent seam at the light→dark boundary. */
[data-ui="section"][data-surface="dark"]::before {
  content: '';
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  height: 1px;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(100, 195, 253, 0.55) 30%,
    rgba(100, 195, 253, 0.55) 70%,
    transparent
  );
  pointer-events: none;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/ui/Section.tsx apps/website/src/components/ui/Section.spec.tsx apps/website/src/styles/ui.css
git commit -m "feat(website): dark section surface with scoped token re-map"
```

---

### Task 2: `SectionHeader` primitive (centered + rail variants)

Treatment C. New sections use it; existing sections migrate opportunistically (NOT in this plan).

**Files:**
- Create: `apps/website/src/components/ui/SectionHeader.tsx`
- Create: `apps/website/src/components/ui/SectionHeader.spec.tsx`
- Modify: `apps/website/src/styles/ui.css` (append)

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/ui/SectionHeader.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { SectionHeader } from './SectionHeader';

describe('SectionHeader', () => {
  it('renders eyebrow, heading with id, and aside in rail variant', () => {
    const { container } = render(
      <SectionHeader
        variant="rail"
        eyebrow="The Yes wall"
        heading="Yes, it does that."
        headingId="yes-wall-heading"
        aside="Sixteen questions teams ask before they commit."
      />,
    );
    const root = container.querySelector('[data-ui="section-header"]');
    expect(root?.getAttribute('data-variant')).toBe('rail');
    expect(screen.getByText('The Yes wall')).toBeTruthy();
    const h2 = screen.getByRole('heading', { level: 2 });
    expect(h2.id).toBe('yes-wall-heading');
    expect(h2.textContent).toBe('Yes, it does that.');
    expect(screen.getByText(/Sixteen questions/)).toBeTruthy();
  });

  it('defaults to centered variant with no aside', () => {
    const { container } = render(
      <SectionHeader eyebrow="Reliable" heading="Proof." />,
    );
    expect(
      container.querySelector('[data-ui="section-header"]')?.getAttribute('data-variant'),
    ).toBe('centered');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/ui/SectionHeader.spec.tsx`
Expected: FAIL — module `./SectionHeader` not found.

- [ ] **Step 3: Implement the component**

```tsx
// apps/website/src/components/ui/SectionHeader.tsx
import type { ReactNode } from 'react';
import { Eyebrow } from './Eyebrow';

type Variant = 'centered' | 'rail';

interface SectionHeaderProps {
  eyebrow: string;
  heading: ReactNode;
  /** id for the h2, for Section's ariaLabelledBy. */
  headingId?: string;
  /** Italic muted aside under the heading (rail variant). */
  aside?: ReactNode;
  /**
   * 'centered' — the classic kicker/H2 stack.
   * 'rail' — left-rail editorial variant (treatment C): kicker over a 2px
   * rule, heading below, italic aside. The PARENT owns the grid placement;
   * this component only renders the header block.
   */
  variant?: Variant;
}

export function SectionHeader({
  eyebrow,
  heading,
  headingId,
  aside,
  variant = 'centered',
}: SectionHeaderProps) {
  return (
    <header data-ui="section-header" data-variant={variant}>
      <Eyebrow tone="accent" className="section-header-eyebrow">
        {eyebrow}
      </Eyebrow>
      <h2 id={headingId} className="section-header-heading">
        {heading}
      </h2>
      {aside ? <p className="section-header-aside">{aside}</p> : null}
    </header>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/ui/SectionHeader.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the CSS**

Append to `apps/website/src/styles/ui.css`:

```css
/* UI primitive — SectionHeader (centered + rail variants, treatment C). */
[data-ui="section-header"] .section-header-eyebrow {
  margin-bottom: 16px;
}
[data-ui="section-header"] .section-header-heading {
  font-family: var(--font-garamond);
  font-size: var(--text-h2);
  line-height: var(--text-h2--line-height);
  font-weight: 700;
  letter-spacing: -0.015em;
  color: var(--color-text-primary);
  margin: 0;
}
[data-ui="section-header"] .section-header-aside {
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.6;
  font-style: italic;
  color: var(--color-text-muted);
  margin: 16px 0 0;
}
[data-ui="section-header"][data-variant="centered"] {
  text-align: center;
}
[data-ui="section-header"][data-variant="rail"] {
  text-align: left;
}
[data-ui="section-header"][data-variant="rail"] .section-header-eyebrow {
  border-top: 2px solid var(--color-text-primary);
  padding-top: 8px;
  margin-bottom: 14px;
}
[data-ui="section-header"][data-variant="rail"] .section-header-heading {
  font-size: clamp(32px, 3.4vw, 44px);
  line-height: 1.1;
  letter-spacing: -0.015em;
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/ui/SectionHeader.tsx apps/website/src/components/ui/SectionHeader.spec.tsx apps/website/src/styles/ui.css
git commit -m "feat(website): SectionHeader primitive with centered and rail variants"
```

---

### Task 3: Hero — problem-first subhead, chips, marker highlight

Changes F + treatment A. The H1, CTAs, proof pills, and analytics stay exactly as they are.

**Files:**
- Modify: `apps/website/src/lib/positioning.ts`
- Modify: `apps/website/src/components/landing/Hero.tsx`
- Modify: `apps/website/src/styles/landing.css` (hero block, ~line 19)
- Modify: `apps/website/src/components/landing/Hero.spec.tsx`

- [ ] **Step 1: Update the failing spec FIRST**

In `apps/website/src/components/landing/Hero.spec.tsx`, replace the
`'renders the locked H1 and subhead'` test body's subhead assertion. The old
test asserts `screen.getByText(HERO_SUBHEAD)`; the new subhead contains a
marker `<span>`, so assert on the container text and the chips:

```tsx
  it('renders the locked H1, problem-first subhead, and capability chips', async () => {
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toBe('Ship production agent UIs in Angular.');
    const subhead = document.querySelector('.hero-subhead');
    expect(subhead?.textContent).toContain('Everything after it takes six months.');
    expect(subhead?.textContent).toContain('keeps your backend exactly where it is');
    for (const chip of HERO_CHIPS) {
      expect(screen.getByText(chip)).toBeTruthy();
    }
    for (const proofPoint of POSITIONING_PROOF_POINTS) {
      expect(screen.getByText(proofPoint.label)).toBeTruthy();
    }
  });
```

Add `HERO_CHIPS` to the existing import from `../../lib/positioning` and
remove `HERO_SUBHEAD` from that import if it is no longer referenced anywhere
else in the spec.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/Hero.spec.tsx`
Expected: FAIL — `HERO_CHIPS` is not exported.

- [ ] **Step 3: Update positioning.ts**

In `apps/website/src/lib/positioning.ts` replace the `HERO_SUBHEAD` constant
(keep the export name — `site-metadata.ts` and others may reference it; grep
first: `grep -rn 'HERO_SUBHEAD' apps/website/src`) and add chips:

```ts
export const HERO_SUBHEAD = `The streaming demo takes an afternoon. Everything after it takes six months. Threadplane is the Angular layer that closes the gap — and it keeps your backend exactly where it is.`;

/** Capability nouns, demoted from the subheadline to chips (spec change F). */
export const HERO_CHIPS: readonly string[] = [
  'durable threads',
  'interrupts',
  'subagents',
  'planning + memory',
  'generative UI',
  'LangGraph + AG-UI',
];
```

If the `HERO_SUBHEAD` grep shows it used as a meta description anywhere,
leave those call sites alone — the constant's new value is the correct
description too.

- [ ] **Step 4: Update Hero.tsx**

In `apps/website/src/components/landing/Hero.tsx`:

Change the positioning import to:

```tsx
import { HERO_CHIPS, POSITIONING_PROOF_POINTS } from '../../lib/positioning';
```

Replace the `<p className="hero-subhead">{HERO_SUBHEAD}</p>` block with
(marker treatment A — at most two highlights, per spec):

```tsx
            <p className="hero-subhead">
              The streaming demo takes an afternoon.{' '}
              <span className="marker-highlight">
                Everything after it takes six months.
              </span>{' '}
              Threadplane is the Angular layer that closes the gap — and it{' '}
              <span className="marker-highlight">
                keeps your backend exactly where it is.
              </span>
            </p>
            <ul className="hero-chip-row" aria-label="Capabilities">
              {HERO_CHIPS.map((chip) => (
                <li key={chip} className="hero-chip">
                  {chip}
                </li>
              ))}
            </ul>
```

Place the `hero-chip-row` list between the subhead and the existing
`hero-cta-row` div.

- [ ] **Step 5: Add the CSS**

In `apps/website/src/styles/landing.css`, after the `.hero-subhead` rule
(~line 40), add:

```css
/* Treatment A — marker highlight. isolation:isolate is load-bearing: without
 * it the z-index:-1 sweep paints behind the section background and vanishes. */
.marker-highlight {
  position: relative;
  isolation: isolate;
  color: var(--color-text-primary);
  font-weight: 600;
}
.marker-highlight::before {
  content: '';
  position: absolute;
  inset: -1px -5px -3px;
  z-index: -1;
  background: linear-gradient(
    100deg,
    rgba(0, 64, 144, 0.14),
    rgba(0, 64, 144, 0.08) 85%
  );
  border-radius: 4px;
  transform: skewX(-6deg) rotate(-0.4deg);
}

.hero-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 7px;
  list-style: none;
  padding: 0;
  margin: 0 0 28px;
  max-width: 54ch;
}
.hero-chip {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-full);
  padding: 5px 11px;
  white-space: nowrap;
}
```

Also reduce `.hero-subhead`'s `margin-bottom` from `32px` to `20px` (the chip
row now carries the gap before the CTA row).

- [ ] **Step 6: Run the hero spec**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/Hero.spec.tsx`
Expected: PASS (all tests in file — the CTA/analytics tests are untouched).

- [ ] **Step 7: Check for other HERO_SUBHEAD-dependent specs, then run the whole suite**

Run: `grep -rn 'HERO_SUBHEAD' apps/website/src` — update any spec asserting the
old sentence (e.g. `site-metadata.spec.ts`) to assert the new one verbatim.
Then: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src/lib/positioning.ts apps/website/src/components/landing/Hero.tsx apps/website/src/styles/landing.css apps/website/src/components/landing/Hero.spec.tsx apps/website/src/lib/site-metadata.spec.ts
git commit -m "feat(website): problem-first hero subhead with capability chips and marker highlight"
```

---

### Task 4: `YesWall` component (change A — data + markup + spec)

**Files:**
- Create: `apps/website/src/components/landing/YesWall.tsx`
- Create: `apps/website/src/components/landing/YesWall.spec.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/landing/YesWall.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YesWall, YES_WALL_GROUPS } from './YesWall';

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: vi.fn(),
}));

describe('YesWall', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders 16 questions across 4 groups', () => {
    render(<YesWall />);
    const total = YES_WALL_GROUPS.reduce((n, g) => n + g.rows.length, 0);
    expect(YES_WALL_GROUPS).toHaveLength(4);
    expect(total).toBe(16);
    for (const group of YES_WALL_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
      for (const row of group.rows) {
        expect(screen.getByText(row.question)).toBeTruthy();
        expect(screen.getByText(row.api)).toBeTruthy();
      }
    }
  });

  it('answers every question Yes', () => {
    render(<YesWall />);
    expect(screen.getAllByText('Yes')).toHaveLength(16);
  });

  it('renders the dark specimen chrome', () => {
    const { container } = render(<YesWall />);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('dark');
    const mark = container.querySelector('.yes-wall-watermark');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
  });

  it('links the footer to the docs', () => {
    render(<YesWall />);
    const link = screen.getByRole('link', { name: /Every question answered/ });
    expect(link.getAttribute('href')).toBe('/docs');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/YesWall.spec.tsx`
Expected: FAIL — module `./YesWall` not found.

- [ ] **Step 3: Implement the component**

Every question must be answerable **yes without qualification** (spec rule);
API labels reuse `Differentiator`'s vocabulary where the row carries over.

```tsx
// apps/website/src/components/landing/YesWall.tsx
'use client';

import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { trackCtaClick } from '../../lib/analytics/client';

interface YesRow {
  question: string;
  api: string;
}

interface YesGroup {
  label: string;
  rows: YesRow[];
}

export const YES_WALL_GROUPS: readonly YesGroup[] = [
  {
    label: 'State that survives',
    rows: [
      { question: 'Can a conversation survive a page reload?', api: 'threadId + durable transports' },
      { question: 'Can I resume a thread days later, on another device?', api: 'checkpointed threads' },
      { question: 'Can I branch or replay a conversation from any point?', api: 'branch / replay' },
      { question: 'Can I persist threads without building a persistence layer?', api: 'durable transports' },
    ],
  },
  {
    label: 'Humans in the loop',
    rows: [
      { question: 'Can I stop the agent before it does something irreversible?', api: 'interrupt()' },
      { question: 'Can the pause survive a refresh while someone decides?', api: 'the pause is a checkpoint' },
      { question: 'Can I show the human what the agent is about to do?', api: '<chat-interrupt-panel>' },
      { question: "Can the human's decision land in the thread record?", api: 'submit({ resume })' },
    ],
  },
  {
    label: 'On my design system',
    rows: [
      { question: 'Can agent output render as my components, not a chat widget?', api: '@threadplane/render' },
      { question: 'Can I fall back per-component when a spec is unknown?', api: 'fallback + readiness gate' },
      { question: 'Can the browser own its own tools and render them inline?', api: 'client tools' },
    ],
  },
  {
    label: 'Shipping it',
    rows: [
      { question: 'Can I swap LangGraph for AG-UI without rewriting the UI?', api: 'one Agent contract' },
      { question: 'Can I unit-test components that depend on an agent?', api: 'provideFakeAgent' },
      { question: 'Can I run all of it inside my own VPC?', api: 'self-host, no runtime SaaS' },
      { question: 'Can I use every package commercially without a license fee?', api: 'MIT, all packages' },
      { question: 'Can I install it without phoning home?', api: 'installation is inert' },
    ],
  },
];

export function YesWall() {
  return (
    <Section surface="dark" id="yes-wall" ariaLabelledBy="yes-wall-heading">
      <Container>
        <div className="yes-wall">
          <div className="yes-wall-watermark" aria-hidden="true">
            Yes
          </div>
          <div className="yes-wall-grid">
            <SectionHeader
              variant="rail"
              eyebrow="Every question below has the same answer"
              heading="Yes, it does that."
              headingId="yes-wall-heading"
              aside="Sixteen questions teams ask before they commit — each linked to the API that answers it."
            />
            <div className="yes-wall-body">
              {YES_WALL_GROUPS.map((group, index) => (
                <div className="yes-wall-group" key={group.label}>
                  <div className="yes-wall-group-numeral" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </div>
                  <div className="yes-wall-group-rows">
                    <p className="yes-wall-group-label">{group.label}</p>
                    {group.rows.map((row) => (
                      <div className="yes-wall-row" key={row.question}>
                        <p className="yes-wall-question">
                          <em className="yes-wall-yes">Yes</em>
                          {row.question}
                        </p>
                        <p className="yes-wall-api">{row.api}</p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
              <div className="yes-wall-footer">
                <a
                  className="yes-wall-footer-link"
                  href="/docs"
                  onClick={() =>
                    trackCtaClick({
                      cta_id: 'home_yes_wall_docs',
                      track: 'developer',
                      surface: 'home',
                    })
                  }
                >
                  Every question answered, in the docs →
                </a>
                <p className="yes-wall-footer-count">16 questions · 16 yeses</p>
              </div>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

Note: check `trackCtaClick`'s real signature first with
`grep -n 'export function trackCtaClick' -A6 apps/website/src/lib/analytics/client.ts`
and match `Differentiator.tsx`'s existing call shape exactly — if it takes
different keys, mirror the Differentiator footer call, keeping
`cta_id: 'home_yes_wall_docs'`.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/YesWall.spec.tsx`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/YesWall.tsx apps/website/src/components/landing/YesWall.spec.tsx
git commit -m "feat(website): YesWall component — 16 questions, 4 groups, dark specimen"
```

---

### Task 5: YesWall CSS + wire into the page, remove `Differentiator`

**Files:**
- Modify: `apps/website/src/styles/landing.css` (append)
- Modify: `apps/website/src/app/page.tsx`
- Delete: `apps/website/src/components/landing/Differentiator.tsx`
- Delete: `apps/website/src/components/landing/Differentiator.spec.tsx`

- [ ] **Step 1: Append the specimen CSS to landing.css**

```css
/* ---------- Yes wall (dark specimen, spec change A + treatment B) ---------- */
.yes-wall {
  position: relative;
}
/* 330px italic Garamond watermark, gradient-filled, bleeding off the right. */
.yes-wall-watermark {
  position: absolute;
  right: -40px;
  top: -20px;
  font-family: var(--font-garamond);
  font-style: italic;
  font-weight: 800;
  font-size: clamp(160px, 24vw, 330px);
  line-height: 0.76;
  letter-spacing: -0.04em;
  background: linear-gradient(
    160deg,
    rgba(100, 195, 253, 0.16),
    rgba(100, 195, 253, 0.03) 70%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  pointer-events: none;
  user-select: none;
}
/* Radial accent glow rising behind the watermark (treatment B). */
.yes-wall::before {
  content: '';
  position: absolute;
  top: -160px;
  right: -120px;
  width: 640px;
  height: 560px;
  background: radial-gradient(
    closest-side,
    rgba(100, 195, 253, 0.13),
    rgba(100, 195, 253, 0.04) 55%,
    transparent 75%
  );
  pointer-events: none;
}
.yes-wall-grid {
  position: relative;
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 64px;
}
.yes-wall-group {
  display: grid;
  grid-template-columns: 112px 1fr;
}
.yes-wall-group + .yes-wall-group {
  margin-top: 34px;
}
.yes-wall-group-numeral {
  font-family: var(--font-garamond);
  font-size: 62px;
  font-weight: 700;
  line-height: 0.85;
  letter-spacing: -0.03em;
  color: var(--color-border-strong);
  padding-top: 14px;
}
.yes-wall-group-rows {
  border-top: 2px solid var(--color-text-primary);
}
.yes-wall-group-label {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-accent);
  margin: 0;
  padding: 13px 0 5px;
}
.yes-wall-row {
  display: grid;
  grid-template-columns: 1fr 250px;
  gap: 22px;
  align-items: baseline;
  border-top: 1px solid var(--color-border);
  padding: 12px 0;
  transition: background 140ms ease;
}
.yes-wall-row:hover {
  background: var(--color-accent-surface);
}
.yes-wall-question {
  font-family: var(--font-inter);
  font-size: 16px;
  line-height: 1.45;
  color: var(--color-text-primary);
  margin: 0;
}
.yes-wall-yes {
  font-family: var(--font-garamond);
  font-style: italic;
  font-weight: 700;
  font-size: 20px;
  color: var(--color-accent);
  text-shadow: 0 0 16px var(--color-accent-glow);
  margin-right: 13px;
}
.yes-wall-api {
  font-family: var(--font-mono);
  font-size: 12px;
  line-height: 1.4;
  color: var(--color-text-muted);
  text-align: right;
  margin: 0;
}
.yes-wall-footer {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  margin-top: 34px;
  padding-top: 20px;
  border-top: 1px solid var(--color-border);
}
.yes-wall-footer-link {
  font-family: var(--font-inter);
  font-size: 15px;
  font-weight: 500;
  color: var(--color-accent);
  text-decoration: underline;
  text-underline-offset: 3px;
}
.yes-wall-footer-count {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0;
}

/* Responsive: the specimen devices are the fragile part (spec). */
@media (max-width: 900px) {
  .yes-wall-grid {
    grid-template-columns: 1fr;
    gap: 40px;
  }
  .yes-wall-group {
    grid-template-columns: 1fr;
  }
  .yes-wall-group-numeral {
    font-size: 40px;
    padding: 0 0 8px;
  }
  .yes-wall-watermark {
    font-size: 140px;
    right: -16px;
  }
  .yes-wall-row {
    grid-template-columns: 1fr;
    gap: 4px;
  }
  .yes-wall-api {
    text-align: left;
    padding-left: 33px;
  }
}
```

- [ ] **Step 2: Swap the components in page.tsx**

In `apps/website/src/app/page.tsx`:
- Replace the import `import { Differentiator } from '../components/landing/Differentiator';` with `import { YesWall } from '../components/landing/YesWall';`
- Replace `<Differentiator />` with `<YesWall />` in the JSX.

- [ ] **Step 3: Delete Differentiator**

```bash
git rm apps/website/src/components/landing/Differentiator.tsx apps/website/src/components/landing/Differentiator.spec.tsx
```

Then verify nothing else imports it: `grep -rn 'Differentiator' apps/website/src` — expected: no matches (comments mentioning it in page.tsx may remain; update the `#approve` FeatureBlock comment that says "the Differentiator table" to say "the Yes wall").

- [ ] **Step 4: Run the whole suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS — the Differentiator spec is gone, YesWall spec passes, nothing else referenced the removed rows.

- [ ] **Step 5: Commit**

```bash
git add -A apps/website/src
git commit -m "feat(website): replace Differentiator with the Yes wall"
```

---

### Task 6: `ProofStrip` (change D — three honest cells, paper elevation)

**Files:**
- Create: `apps/website/src/components/landing/ProofStrip.tsx`
- Create: `apps/website/src/components/landing/ProofStrip.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (append)
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/landing/ProofStrip.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProofStrip, PROOF_CELLS } from './ProofStrip';

describe('ProofStrip', () => {
  it('renders three cells, each with a source link', () => {
    render(<ProofStrip />);
    expect(PROOF_CELLS).toHaveLength(3);
    for (const cell of PROOF_CELLS) {
      expect(screen.getByText(cell.caption)).toBeTruthy();
      const link = screen.getByRole('link', { name: new RegExp(cell.sourceLabel, 'i') });
      expect(link.getAttribute('href')).toBe(cell.sourceHref);
    }
  });

  it('renders the HVTrust grade as a live badge image, not text', () => {
    render(<ProofStrip />);
    const badge = screen.getByAltText(/HVTrust grade/i);
    expect(badge.getAttribute('src')).toBe('https://hvtracker.net/badge/threadplane.svg');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/ProofStrip.spec.tsx`
Expected: FAIL — module `./ProofStrip` not found.

- [ ] **Step 3: Implement**

Figures verified 2026-08-27 (spec, "Verification results"). The rank and
score WILL drift — the source-checked comment is part of the deliverable.

```tsx
// apps/website/src/components/landing/ProofStrip.tsx
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';

interface ProofCell {
  /** Big Garamond numeral, or null when the cell renders a live badge. */
  value: string | null;
  /** Small suffix set beside the numeral (e.g. "of 119"). */
  suffix?: string;
  caption: string;
  sourceLabel: string;
  sourceHref: string;
}

/**
 * Verified 2026-08-27 against live sources (see the homepage design spec,
 * "Verification results"). The rank and score drift over time — re-verify on
 * touch, and never "round up". The HVTrust grade is deliberately a LIVE badge:
 * it sits at 81.2 against an A-band floor of 80 and has flipped grade six
 * times in one month; a hardcoded letter would be wrong on some days.
 */
export const PROOF_CELLS: readonly ProofCell[] = [
  {
    value: '#13',
    suffix: 'of 119',
    caption: 'Of all agent frameworks ranked',
    sourceLabel: 'hvtracker.net',
    sourceHref: 'https://hvtracker.net/categories/agent-frameworks/',
  },
  {
    value: '8.1',
    suffix: '/10',
    caption: 'OpenSSF Scorecard, official API',
    sourceLabel: 'securityscorecards.dev',
    sourceHref:
      'https://api.securityscorecards.dev/projects/github.com/cacheplane/angular-agent-framework',
  },
  {
    value: null,
    caption: 'HVTrust supply-chain grade, live',
    sourceLabel: 'hvtracker.net/agents/threadplane',
    sourceHref: 'https://hvtracker.net/agents/threadplane/',
  },
];

export function ProofStrip() {
  return (
    <Section surface="tinted" tight id="proof" ariaLabelledBy="proof-heading">
      <Container>
        <div className="proof-strip-grid">
          <SectionHeader
            variant="rail"
            eyebrow="Reliable to the core"
            heading="Audited, scored, published."
            headingId="proof-heading"
            aside="Not self-reported — every number links to its source."
          />
          <ul className="proof-strip-cells">
            {PROOF_CELLS.map((cell) => (
              <li className="proof-strip-cell" key={cell.caption}>
                {cell.value ? (
                  <p className="proof-strip-value">
                    {cell.value}
                    {cell.suffix ? (
                      <span className="proof-strip-suffix"> {cell.suffix}</span>
                    ) : null}
                  </p>
                ) : (
                  <img
                    className="proof-strip-badge"
                    src="https://hvtracker.net/badge/threadplane.svg"
                    alt="HVTrust grade for Threadplane (live badge)"
                    loading="lazy"
                  />
                )}
                <p className="proof-strip-caption">{cell.caption}</p>
                <a
                  className="proof-strip-source"
                  href={cell.sourceHref}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {cell.sourceLabel}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/ProofStrip.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Add the paper-elevation CSS (treatment D)**

Append to `apps/website/src/styles/landing.css`:

```css
/* ---------- Proof strip (light, paper elevation — spec change D) ---------- */
.proof-strip-grid {
  display: grid;
  grid-template-columns: 300px 1fr;
  gap: 64px;
  align-items: start;
}
.proof-strip-cells {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 18px;
  list-style: none;
  margin: 0;
  padding: 0;
}
.proof-strip-cell {
  position: relative;
  background: var(--color-surface);
  background-image: linear-gradient(
    180deg,
    rgba(255, 255, 255, 0.9),
    rgba(251, 251, 251, 0.4)
  );
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 26px 24px 22px;
  box-shadow:
    0 1px 2px rgba(0, 0, 0, 0.04),
    0 12px 28px -12px rgba(28, 28, 28, 0.14);
}
/* 1px top highlight so the card reads as paper, not an outline. */
.proof-strip-cell::before {
  content: '';
  position: absolute;
  inset: 0 0 auto 0;
  height: 1px;
  border-radius: var(--radius-lg) var(--radius-lg) 0 0;
  background: linear-gradient(
    90deg,
    transparent,
    rgba(255, 255, 255, 0.9),
    transparent
  );
}
.proof-strip-value {
  font-family: var(--font-garamond);
  font-size: 58px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.028em;
  color: var(--color-text-primary);
  margin: 0;
}
.proof-strip-suffix {
  font-size: 18px;
  font-weight: 500;
  letter-spacing: 0;
  color: var(--color-text-muted);
}
.proof-strip-badge {
  height: 52px;
  width: auto;
  display: block;
}
.proof-strip-caption {
  font-family: var(--font-inter);
  font-size: 14px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 12px 0 0;
}
.proof-strip-source {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin-top: 9px;
}
@media (max-width: 900px) {
  .proof-strip-grid {
    grid-template-columns: 1fr;
    gap: 32px;
  }
  .proof-strip-cells {
    grid-template-columns: 1fr;
  }
}
```

Also change the tinted section band to the treatment-D gradient. In
`apps/website/src/styles/ui.css`, the rule
`[data-ui="section"][data-surface="tinted"]` currently reads
`background: var(--color-surface-tinted);` — leave it, and add directly below:

```css
/* Treatment D: the proof strip's tinted band is a whisper of gradient. Scoped
 * to #proof so other tinted sections keep the flat token. */
#proof[data-ui="section"][data-surface="tinted"] {
  background: linear-gradient(180deg, #fdfdfd, #f6f6f6);
}
```

- [ ] **Step 6: Insert into page.tsx**

In `apps/website/src/app/page.tsx` add
`import { ProofStrip } from '../components/landing/ProofStrip';` and render
`<ProofStrip />` between `<Promises />` and `<HomeFAQ />`.

- [ ] **Step 7: Run the suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src/components/landing/ProofStrip.tsx apps/website/src/components/landing/ProofStrip.spec.tsx apps/website/src/styles/landing.css apps/website/src/styles/ui.css apps/website/src/app/page.tsx
git commit -m "feat(website): proof strip — three verified cells with live HVTrust badge"
```

---

### Task 7: `FinalCTA` dark variant (partner section for the dark band)

`FinalCTA` is shared by **eight pages** (`/pricing`, `/chat`, `/langgraph`,
`/ag-ui`, `/render`, `/solutions`, `/solutions/[slug]`, `/pilot-to-prod`).
The dark treatment must be **opt-in via prop**; every other page keeps the
current tinted look untouched.

**Files:**
- Modify: `apps/website/src/components/landing/FinalCTA.tsx`
- Create: `apps/website/src/components/landing/FinalCTA.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (append)
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/landing/FinalCTA.spec.tsx
import { render } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FinalCTA } from './FinalCTA';

describe('FinalCTA', () => {
  it('defaults to the tinted surface (used by 8 non-home pages)', () => {
    const { container } = render(<FinalCTA />);
    expect(
      container.querySelector('[data-ui="section"]')?.getAttribute('data-surface'),
    ).toBe('tinted');
  });

  it('renders the dark surface when variant="dark"', () => {
    const { container } = render(<FinalCTA variant="dark" />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(container.querySelector('.final-cta-mark')).toBeTruthy();
  });
});
```

If rendering `<FinalCTA />` in jsdom fails on a child (e.g. `DemoCtaPair`
touching browser APIs), mock that child module the same way other landing
specs in this repo mock theirs — look at `Hero.spec.tsx`'s mock block for the
house pattern.

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/FinalCTA.spec.tsx`
Expected: FAIL — TS rejects unknown prop `variant`.

- [ ] **Step 3: Add the variant prop**

In `apps/website/src/components/landing/FinalCTA.tsx`:

Add to `FinalCTAProps`:

```tsx
  /**
   * 'dark' renders on the dark band — homepage only, pairing with the Yes
   * wall so the inverted treatment appears twice (spec: a lone dark band
   * reads as arbitrary). All other pages keep the default tinted surface.
   */
  variant?: 'default' | 'dark';
```

Add `variant = 'default',` to the destructured props. Change the `<Section>`
open tag to:

```tsx
    <Section
      surface={variant === 'dark' ? 'dark' : 'tinted'}
      ariaLabelledBy="final-cta-heading"
    >
```

And inside the `final-cta-inner` div, first child, add the watermark arrow
(dark variant only):

```tsx
          {variant === 'dark' ? (
            <div className="final-cta-mark" aria-hidden="true">
              →
            </div>
          ) : null}
```

- [ ] **Step 4: Add the CSS**

Append to `apps/website/src/styles/landing.css`:

```css
/* FinalCTA dark variant — the Yes wall's partner section. */
[data-surface="dark"] .final-cta-inner {
  position: relative;
}
.final-cta-mark {
  position: absolute;
  right: -30px;
  bottom: -70px;
  font-family: var(--font-garamond);
  font-style: italic;
  font-weight: 800;
  font-size: 210px;
  line-height: 1;
  letter-spacing: -0.04em;
  background: linear-gradient(
    160deg,
    rgba(100, 195, 253, 0.14),
    rgba(100, 195, 253, 0.03) 70%
  );
  -webkit-background-clip: text;
  background-clip: text;
  color: transparent;
  pointer-events: none;
  user-select: none;
}
```

Check `.final-cta-heading` / `.final-cta-subtext` rules in `landing.css`: if
they hardcode light colors (e.g. `color: rgb(28, 28, 28)`), change them to
`var(--color-text-primary)` / `var(--color-text-secondary)` so the dark scope
flows through. If they already use variables, no change.

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/FinalCTA.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 6: Homepage opts in**

In `apps/website/src/app/page.tsx` change `<FinalCTA />` to
`<FinalCTA variant="dark" />`.

- [ ] **Step 7: Run the whole suite (pricing spec renders FinalCTA — must stay green)**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS, including `src/app/pricing/page.spec.tsx`.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src/components/landing/FinalCTA.tsx apps/website/src/components/landing/FinalCTA.spec.tsx apps/website/src/styles/landing.css apps/website/src/app/page.tsx
git commit -m "feat(website): dark FinalCTA variant, homepage-only"
```

---

### Task 8: Shrink `HomeFAQ` to non-binary questions

Three current items become Yes-wall rows and leave the FAQ (spec, scope
section): "Does it work with my existing Angular app?", "Can I use this
without LangGraph?", "How do I test agent-driven components?". Seven remain.

**Files:**
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`

- [ ] **Step 1: Remove the three items**

In `apps/website/src/components/landing/HomeFAQ.tsx`, delete the three full
`{ q: ..., a: ... }` entries whose `q` values are exactly:
- `'Does it work with my existing Angular app?'`
- `'Can I use this without LangGraph?'`
- `'How do I test agent-driven components?'`

Leave the other seven untouched (AG-UI comparison, adapter choice,
Pilot-to-Prod, cost, production-ready, issues, SSR).

- [ ] **Step 2: Verify nothing asserts the removed strings**

Run: `grep -rn 'existing Angular app\|without LangGraph\|test agent-driven' apps/website/src apps/website/e2e`
Expected: no spec/e2e matches (only the component before your edit). If a
match appears in a spec, update that spec to drop the assertion.

- [ ] **Step 3: Run the suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/HomeFAQ.tsx
git commit -m "refactor(website): shrink HomeFAQ to non-binary questions"
```

---

### Task 9: Full verification gate

**Files:** none created — this task is evidence-gathering.

- [ ] **Step 1: Full unit suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS, 0 failures. Paste the summary line into the task report.

- [ ] **Step 2: Production build**

Run from repo root: `npx nx build website --configuration=production`
Expected: success. Prod-only failures (type strictness, bundle budgets) live
here — dev green does not count.

- [ ] **Step 3: Visual pass in the browser preview**

Start the site's dev server via the Browser pane (launch.json / preview
tools — never Bash) and check, at desktop AND ~375px width:

1. Hero: marker sweeps visible behind exactly two phrases (if invisible, the
   `isolation: isolate` rule was dropped); chips wrap cleanly.
2. Yes wall: dark band with visible top seam; watermark bleeding right but
   causing NO horizontal scrollbar (if it does, the parent `Section` needs
   `overflow: hidden` — add `overflow: hidden` to the
   `[data-ui="section"][data-surface="dark"]` rule); italic "Yes" drumbeat
   aligned; API column right-aligned at desktop, stacked at mobile.
3. Proof strip: three elevated cards; the live HVTrust badge loads (external
   image — if the browser console shows it blocked, check `next.config`
   image/CSP settings and report rather than inlining a stale grade).
4. FinalCTA: dark on the homepage; **open `/pricing` and `/langgraph` and
   confirm their FinalCTA is still tinted.**
5. Console: no hydration warnings or errors on `/`.

- [ ] **Step 4: Screenshot evidence**

Capture homepage screenshots (hero, Yes wall, proof strip, dark CTA) via the
browser preview and attach to the report.

- [ ] **Step 5: Commit any fixes, then stop**

Any fix found in step 3 gets its own small commit. Do NOT push, do NOT open a
PR — finishing the branch is a separate decision
(superpowers:finishing-a-development-branch).

---

## Deviations that require stopping

- If `trackCtaClick`'s signature differs from what Task 4 assumes, match the
  house call shape — that is expected adaptation, not a deviation.
- If the HVTrust badge URL 404s, STOP and report — do not substitute a
  hardcoded grade (spec rule: volatile figures must be live or absent).
- If any non-home page's FinalCTA renders dark, STOP — the prop default is
  wrong.
