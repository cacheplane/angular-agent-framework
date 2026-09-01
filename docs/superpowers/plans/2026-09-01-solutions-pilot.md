# Solutions + Pilot Back Half Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** The ninth arc per `docs/superpowers/specs/2026-09-01-solutions-pilot-arc-design.md`: kill per-solution accent theming, rail the remaining centered headers, proof-cell the capability metrics, and ledger the pilot outcomes.

**Architecture:** Next.js 16 / React 19; UNLAYERED CSS (`pages.css` holds sol-/pilot- rules). `solution.color` has exactly two consumers: `lib/solutions-data.ts` (definition, 5 values) and `app/solutions/[slug]/page.tsx` (threading) — the index page does not use it. No page specs exist for these routes yet.

**Test command:** `cd apps/website && npx vitest run --config vite.config.mts` — baseline all green (53 files; count from a fresh run before starting).
**Branch:** `blove/solutions-pilot` — create from `blove/final-review-fixes` (the fix batch, PR #922 pending): `git checkout -b blove/solutions-pilot blove/final-review-fixes`. If #922 has merged by start time, branch from origin/main instead and note it.

---

### Task 1: /solutions/[slug] — accent removal + rails + proof metrics

**Files:**
- Modify: `apps/website/src/app/solutions/[slug]/page.tsx`
- Modify: `apps/website/src/lib/solutions-data.ts`
- Create: `apps/website/src/app/solutions/[slug]/page.spec.tsx`
- Modify: `apps/website/src/styles/pages.css`

- [ ] **Step 1: Spec FIRST (failing).** New spec rendering ONE solution page (pick the first slug from `getAllSolutionSlugs()`):

```tsx
// apps/website/src/app/solutions/[slug]/page.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import SolutionPage from './page';
import { getAllSolutionSlugs } from '../../../lib/solutions-data';

vi.mock('../../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
}));

describe('SolutionPage', () => {
  it('renders navy rails with no per-solution accent theming', async () => {
    const slug = getAllSolutionSlugs()[0];
    const ui = await SolutionPage({ params: Promise.resolve({ slug }) });
    const { container } = render(ui);
    expect(container.querySelectorAll('[data-accent-text]')).toHaveLength(0);
    expect(container.querySelectorAll('.sol-page-rail').length).toBeGreaterThanOrEqual(3);
    expect(container.querySelector('.sol-page-metric')).toBeTruthy();
    expect(screen.getByRole('heading', { level: 1 })).toBeTruthy();
  });
});
```

Adapt mocks if children demand more (async CodeShowcase-style components: mock to `() => null` if present — check imports). Run → FAIL (no `.sol-page-rail` exists). Paste it.

- [ ] **Step 2: Page changes.**
  - Delete the `accent` prop from `PainPoints`, `Architecture`, `Capabilities` (signatures + call sites) and every `style={{ '--accent': … }}` + `data-accent-text` attribute in the file (hero Eyebrow included). All Eyebrows: `tone="accent"`, keep classNames.
  - Each `sol-page-section-header` gains the railkick as its first child:
```tsx
          <div className="sol-page-rail">
            <Eyebrow tone="accent" className="sol-page-eyebrow-tight">…</Eyebrow>
            <span className="sol-page-rail-line" aria-hidden="true" />
          </div>
```
    (the Eyebrow MOVES into the rail; the h2/intro stay below).
  - Hero eyebrow: plain `tone="accent"` — hero layout otherwise untouched (heroes stay centered sitewide).
- [ ] **Step 3: Data.** In `solutions-data.ts`: remove the `color` field from the interface and all 5 entries (verify zero remaining consumers first: `grep -rn 'solution.color\|\.color' apps/website/src/app/solutions apps/website/src/components` — the only hits must be the ones you're deleting).
- [ ] **Step 4: CSS (pages.css).**
  - Delete the `[data-accent-text]` rule block (~line 1172) IF grep shows zero remaining `data-accent-text` in tsx (index page has none — verify).
  - `sol-page-section-header`: remove `text-align: center` (and auto-margin centering; keep max-widths).
  - Add:
```css
.sol-page-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.sol-page-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
```
  - `sol-page-metric`: restyle as a proof numeral — replace its current color/size with:
```css
.sol-page-metric {
  font-family: var(--font-garamond);
  font-size: 40px;
  font-weight: 700;
  line-height: 0.9;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
}
```
    (replace the existing rule's typography wholesale; keep any margin it had).
- [ ] **Step 5:** Spec PASS; full suite green; commit: `feat(website): solution pages join the design language — navy, rails, proof metrics`

---

### Task 2: /solutions index rail

**Files:**
- Modify: `apps/website/src/app/solutions/page.tsx`
- Modify: `apps/website/src/styles/pages.css`

- [ ] **Step 1:** The "By use case" header (`sol-index-eyebrow-tight` + `sol-index-h2`) gains the railkick (same pattern; classes `sol-index-rail`/`sol-index-rail-line`, CSS values identical). Remove that header's centering in pages.css (grep `sol-index-` rules; hero stays centered). Cards untouched.
- [ ] **Step 2:** Full suite; commit: `refactor(website): rail the solutions index header`

---

### Task 3: /pilot-to-prod back half

**Files:**
- Modify: `apps/website/src/app/pilot-to-prod/page.tsx`
- Modify: `apps/website/src/styles/pages.css`
- Create: `apps/website/src/app/pilot-to-prod/page.spec.tsx`

- [ ] **Step 1: Spec FIRST (failing):** minimal spec asserting: ≥2 `.pilot-rail2` rails, 4 `.pilot-outcome-row`s, zero `.pilot-outcomes-grid`, h1 present. (Async page? check — if the page is sync, no await needed. Mock analytics + any async child as in Task 1.) Run → FAIL; paste.
- [ ] **Step 2:** Both `pilot-section-header` blocks gain the railkick (`pilot-rail2`/`pilot-rail2-line` — the homepage PilotBlock already owns `pilot-rail`; do NOT collide). Outcomes grid becomes the ledger:

```tsx
          <div className="pilot-outcome-rows">
            {[
              { claim: 'Live on your data, in your app — not in a sandbox.', tail: 'working demo' },
              { claim: 'Error, fallback, and observability built in from the start.', tail: 'hardened patterns' },
              { claim: 'Integrated with your CI/CD, your auth, your data.', tail: 'deploy-ready' },
              { claim: 'Your engineers own the framework and the runbook.', tail: 'trained team' },
            ].map((o) => (
              <div className="pilot-outcome-row" key={o.tail}>
                <p className="pilot-outcome-claim">{o.claim}</p>
                <p className="pilot-outcome-tail">{o.tail}</p>
              </div>
            ))}
          </div>
```

  Remove the `Card` import if now unused in the file (grep within file first).
- [ ] **Step 3: CSS.** Delete `pilot-outcomes-grid`/`pilot-outcome-h3`/`pilot-outcome-body` rules (zero-consumer verify). Remove `pilot-section-header`'s centering. Add `pilot-rail2`(+line) with the standard values and the rows ledger (copy `.pilot-rows`-family values from landing.css — 2px cap `--color-text-primary`, 1fr/auto baseline grid, 16px gap, inter 15px claim, mono 11.5px muted nowrap tail, 640px stack):

```css
.pilot-rail2 {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.pilot-rail2-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.pilot-outcome-rows {
  margin-top: 22px;
  border-top: 2px solid var(--color-text-primary);
  max-width: 56ch;
}
.pilot-outcome-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: baseline;
  border-bottom: 1px solid var(--color-border);
  padding: 10px 0;
}
.pilot-outcome-claim {
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.5;
  color: var(--color-text-primary);
  margin: 0;
}
.pilot-outcome-tail {
  font-family: var(--font-mono);
  font-size: 11.5px;
  color: var(--color-text-muted);
  white-space: nowrap;
  margin: 0;
}
@media (max-width: 640px) {
  .pilot-outcome-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
```

- [ ] **Step 4:** Spec PASS; full suite; prod build (`npx nx build website --configuration=production`); commit: `feat(website): pilot back half joins the language — rails and outcome ledger`

---

### Task 4: Verification gate (controller-run)

- [ ] Full suite + prod build green.
- [ ] Chrome at 1440px: one slug page (navy everywhere, 3+ rails, serif metrics), the index rail, pilot rails + ledger; 390px: no h-scroll on all three routes.
- [ ] Confirm zero `data-accent-text` and zero `color:` in solutions-data remain.
- [ ] Commit fixes; stop. No push/PR — separate decision.

## Deviations that require stopping

- Any third consumer of `solution.color` surfacing in step 3's grep.
- Slug-page children that can't render in jsdom without component changes.
