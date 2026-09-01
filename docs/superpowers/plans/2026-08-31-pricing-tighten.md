# Pricing Page Tightening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the pricing page's repetition per `docs/superpowers/specs/2026-08-31-pricing-tighten-design.md` — one MIT statement, no all-"Included" table block, no 700px compat table, no third tier restatement beside the lead form — while pinning the LeadForm's behavior untouched.

**Architecture:** Next.js 16 / React 19. Pricing components in `apps/website/src/components/pricing/`; pricing CSS in `apps/website/src/styles/marketing.css` (pricing-*, lead-form-* classes). `angular-support.mjs` is the single source of truth for supported majors — the hero's new compat clause must consume it, not hardcode. UNLAYERED CSS, no inline styles.

**Test command:** `cd apps/website && npx vitest run --config vite.config.mts` — baseline is ALL GREEN (48 files / 389+ tests). Any failure is yours.
**Branch:** `blove/pricing-tighten`, expected starting HEAD `66c67e51` or descendant.
**Visual verification surface:** Chrome MCP (the in-app pane returns blank frames after scrolls) — but subagents don't drive Chrome; the controller runs the visual gate. Subagents verify via tests + DOM-free reasoning.

---

### Task 1: Pin the LeadForm, then strip it to header + form

**Files:**
- Create: `apps/website/src/components/pricing/LeadForm.spec.tsx`
- Modify: `apps/website/src/components/pricing/LeadForm.tsx`
- Modify: `apps/website/src/styles/marketing.css`

- [ ] **Step 1: Write the pinning spec against the UNMODIFIED component**

Read `LeadForm.tsx` first: its submit handler's analytics events (grep `track(` — events around lines 43–68 use `source_section: 'lead-form'`), the field labels/placeholders, the success-state text. Write a spec in the WhitePaperBlock.spec pattern:

```tsx
// apps/website/src/components/pricing/LeadForm.spec.tsx
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LeadForm } from './LeadForm';

const trackMock = vi.fn();
vi.mock('../../lib/analytics/client', async (importOriginal) => {
  const mod = await importOriginal<Record<string, unknown>>();
  return { ...mod, track: (...args: unknown[]) => trackMock(...args) };
});

describe('LeadForm', () => {
  beforeEach(() => {
    trackMock.mockClear();
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true }));
  });

  it('submits and fires the lead analytics with the form payload', async () => {
    render(<LeadForm />);
    // Fill required fields — use the REAL labels from the component
    // (Name / Work email / Company, the team-size + timeline selects,
    // the Pilot-to-Prod radio). Adapt these queries to what exists:
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Dev' } });
    fireEvent.change(screen.getByLabelText(/work email/i), { target: { value: 'dev@example.com' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.submit(screen.getByRole('button', { name: /request enterprise quote/i }).closest('form')!);
    await waitFor(() => {
      const events = trackMock.mock.calls.map((c) => c[0]);
      expect(events.some((e) => String(e).includes('lead'))).toBe(true);
    });
  });
});
```

Adapt every literal to the real component (mocked module path, event names — use the EXACT event constants you find, not the `.includes('lead')` sketch; assert the success render if one exists). The spec must PASS unmodified. If required-field validation blocks a jsdom submit in a way that needs component changes, STOP (NEEDS_CONTEXT). Paste the passing run line.

- [ ] **Step 2: Strip the section chrome**

In `LeadForm.tsx`:
- The header becomes the rail pattern:
```tsx
          <div className="lead-form-rail">
            <Eyebrow tone="accent" className="lead-form-eyebrow">Enterprise</Eyebrow>
            <span className="lead-form-rail-line" aria-hidden="true" />
          </div>
```
  (heading + subhead keep their elements/ids below it, left-aligned).
- DELETE the `<ul className="lead-form-value-list">` block (the four
  checkmark cards) entirely — but FIRST find the "See how Pilot-to-Prod
  works →" link inside it and MOVE that link to directly under the
  `lead-form-subhead` paragraph, preserving its href and any onClick
  analytics, with `className="lead-form-p2p-link"`.
- The `lead-form-grid` two-column wrapper collapses: the form becomes the
  single child; rename/keep the wrapper as needed so the form gets
  `max-width: 640px` (left-aligned under the header, not centered).
- The form element and EVERYTHING inside it: byte-untouched.

- [ ] **Step 3: CSS (marketing.css)**

Delete the `lead-form-value-list` / value-item rules (grep `lead-form-value`).
Delete or neutralize `lead-form-grid` two-column rules (grep `lead-form-grid`)
— replace with `max-width: 640px;` on the form container. Remove centering
from `lead-form-header` (`text-align: center`, auto margins). Add:

```css
.lead-form-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.lead-form-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.lead-form-p2p-link {
  display: inline-block;
  margin-top: 10px;
  font-weight: 600;
  color: var(--color-accent);
}
```

- [ ] **Step 4: Re-run LeadForm.spec (MUST still pass) + full suite + commit**

```bash
git add apps/website/src
git commit -m "feat(website): lead form takes center stage — tier restatement cards deleted"
```

---

### Task 2: Comparison table — delete the SOFTWARE block

**Files:**
- Modify: `apps/website/src/components/pricing/PricingDetails.tsx`
- Modify: `apps/website/src/app/pricing/page.spec.tsx`

- [ ] **Step 1: Update page.spec FIRST (failing)**

`page.spec.tsx:30` asserts `getByRole('rowheader', { name: 'MIT-licensed software' })`. Replace with:

```tsx
    expect(screen.queryByRole('rowheader', { name: 'MIT-licensed software' })).toBeNull();
    expect(screen.getByRole('rowheader', { name: 'Private support channel' })).toBeTruthy();
    expect(screen.getByText(/identical on every path/i)).toBeTruthy();
```

Run the pricing page spec — expect FAIL (the null assertion fails against the current page). Paste it.

- [ ] **Step 2: PricingDetails.tsx**

- Delete the entire `Software` group from `COMPARISON_GROUPS` (six rows) and
  the now-unused `ALL_INCLUDED` rows within it. `Public documentation and
  examples` (in Support) still uses `ALL_INCLUDED` — keep the constant.
- Remove the now-unused `WEBSITE_PRICING_SUPPORT_SUMMARY` import (it only fed
  the deleted Angular row) — verify with grep before removing.
- With one group left, drop the group-header row: in the render, replace the
  `COMPARISON_GROUPS.map` + group-row `<tr>` with a single `<tbody>` over the
  remaining rows (keep the `COMPARISON_GROUPS` shape with one group if that
  is smaller — implementer's choice — but the rendered `pricing-comparison-group-row`
  header must NOT render when only one group exists; simplest is to flatten
  to a `COMPARISON_ROWS` array and delete the group machinery).
- The lede changes: `"The software stays open. The level of support and
  delivery changes."` → `"The software is identical on every path — MIT, all
  of it. What changes is support."`

- [ ] **Step 3: Run pricing page spec (PASS) + full suite + commit**

```bash
git add apps/website/src
git commit -m "feat(website): comparison table keeps only rows that differ"
```

---

### Task 3: Compatibility section → one hero clause

**Files:**
- Modify: `apps/website/src/app/pricing/page.tsx`
- Delete: `apps/website/src/components/pricing/CompatibilityMatrix.tsx`
- Delete: `apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx`
- Modify: `apps/website/src/components/pricing/angular-support.mjs`
- Modify: `apps/website/src/app/pricing/page.spec.tsx`
- Modify: `apps/website/src/styles/marketing.css`

- [ ] **Step 1: Hero license strip gains the compat clause**

In `page.tsx`, the license line becomes (importing from angular-support.mjs):

```tsx
import { WEBSITE_SUPPORTED_ANGULAR_VERSIONS } from '../../components/pricing/angular-support.mjs';
```
```tsx
            <p className="pricing-page-license-line">
              <span>Every package is MIT</span>
              <span aria-hidden="true">·</span>
              <span>Commercial use without registration or runtime checks</span>
              <span aria-hidden="true">·</span>
              <span>{WEBSITE_SUPPORTED_ANGULAR_VERSIONS}, CI-tested</span>
              <span aria-hidden="true">·</span>
              <strong>No Threadplane cloud</strong>
            </p>
```

(If the `.mjs` import trips the TS build, check how `PricingDetails.tsx`
imports it today and mirror that exactly.)

- [ ] **Step 2: Delete the section + component**

Remove the whole `<Section>` wrapping the Compatibility block from
`page.tsx` (Eyebrow "Compatibility", h2, body, `<CompatibilityMatrix />`)
plus the `CompatibilityMatrix` import. Then:

```bash
git rm apps/website/src/components/pricing/CompatibilityMatrix.tsx apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx
```

In `angular-support.mjs`: grep consumers of each export; delete
`WEBSITE_ANGULAR_SUPPORT_ROWS` (and `WEBSITE_PRICING_SUPPORT_SUMMARY` if
Task 2 left it orphaned); keep `WEBSITE_SUPPORTED_ANGULAR_MAJORS` and
`WEBSITE_SUPPORTED_ANGULAR_VERSIONS`. Zero orphaned exports remain.

Delete compat CSS: grep `pricing-page-compat\|compat-matrix\|compatibility`
in marketing.css and remove pricing-scoped hits; also delete the
`pricing-page-eyebrow-tight` rule if the deleted section was its only user
(grep first).

- [ ] **Step 3: page.spec updates**

Add: `expect(screen.getByText(/Angular 20, 21, 22, CI-tested/i)).toBeTruthy();`
Remove/adjust any assertion referencing the compat section (grep
'Compatibility\|Angular version support' in the spec). If the spec's
prohibited-strings test (line ~45) is unrelated, leave it.

- [ ] **Step 4: Full suite + commit**

```bash
git add -A apps/website/src
git commit -m "feat(website): compatibility collapses into the hero license strip"
```

---

### Task 4: FAQ 10 → 6

**Files:**
- Modify: `apps/website/src/components/pricing/PricingFAQ.tsx`
- Modify: `apps/website/src/components/pricing/PricingFAQ.spec.tsx`

- [ ] **Step 1: Spec first**

`PricingFAQ.spec.tsx` holds an `EXPECTED_QUESTIONS` array — trim it to the
six survivors IN ORDER: 'Does Threadplane have a cloud service?', 'Does
Threadplane store my conversations or agent data?', 'Are model or hosting
costs included?', 'What am I paying for?', 'What is Production Assurance?',
'What is Pilot-to-Prod?'. The spec also asserts an answer string from the
deleted "Is Threadplane free?" item (line ~53, /every published Threadplane
package is MIT-licensed/i) — replace that assertion with one from a
SURVIVING answer (read the surviving answers and pick a distinctive phrase).
Run → FAIL. Paste it.

- [ ] **Step 2: Delete the four items**

Remove the full `{ q, a }` entries for: 'Is Threadplane free?', 'Can I use
every package commercially?', 'Does a paid plan unlock different software?',
'Can I modify or redistribute the source?'.

- [ ] **Step 3: Spec PASS + full suite + commit**

```bash
git add apps/website/src
git commit -m "copy(website): pricing FAQ keeps only genuinely open questions"
```

---

### Task 5: Rail headers + tier-grid centering

**Files:**
- Modify: `apps/website/src/components/pricing/PricingDetails.tsx`
- Modify: `apps/website/src/components/pricing/PricingFAQ.tsx`
- Modify: `apps/website/src/components/pricing/CompareTable.tsx` (and/or marketing.css)
- Modify: `apps/website/src/styles/marketing.css`

- [ ] **Step 1: Rail conversion**

`PricingDetails.tsx` has two `pricing-section-heading-wrap` headers (boundary
+ comparison), each: kicker `<p className="pricing-section-kicker">` + h2 +
body. Wrap each kicker in the rail:

```tsx
      <div className="pricing-section-rail">
        <p className="pricing-section-kicker">…</p>
        <span className="pricing-section-rail-line" aria-hidden="true" />
      </div>
```

Same for `PricingFAQ.tsx`'s header (read it — it has kicker "Questions" +
"Pricing FAQ." heading; if it uses Eyebrow, wrap that). CSS:

```css
.pricing-section-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.pricing-section-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
```

Remove centering from `pricing-section-heading-wrap` and the FAQ header
(grep `text-align: center` near those rules in marketing.css; also `margin:
… auto` max-width centering — keep max-widths, left-align). The page HERO
stays centered — do not touch `pricing-page-hero-inner`.

- [ ] **Step 2: Center the tier-card grid**

Find the container of the three `pricing-plan-card`s in `CompareTable.tsx`
(the section/grid wrapper class) and its rule in marketing.css. Diagnose the
left-cluster: likely a `grid-template-columns: repeat(3, <fixed>)` or
max-width without `margin-inline: auto`. Fix so the three cards center as a
group in the container (e.g. `justify-content: center` on the grid or
`margin-inline: auto` on a max-width wrapper). Do not resize the cards.

- [ ] **Step 3: Run CompareTable.spec + pricing page spec + full suite; commit**

```bash
git add apps/website/src
git commit -m "refactor(website): pricing rail headers and centered tier grid"
```

---

### Task 6: Verification gate (controller-run)

- [ ] Full suite green; `npx nx build website --configuration=production` exit 0.
- [ ] Chrome MCP visual pass at 1440px + ~375px (device toolbar or narrow
  window): hero strip has 4 clauses on one/two lines; tier cards centered;
  boundary + comparison + FAQ + lead-form all rail-headed and left-aligned;
  table has NO all-Included rows and NO group header; no compat section;
  form full-width-ish alone with the P2P link present under the subhead.
- [ ] Measure total page height (expect roughly 4,300–4,800px, down from
  7,049px) — report the number.
- [ ] Count "MIT" occurrences in rendered page text — expect ≤ 3 (hero
  clause, boundary lede, FinalCTA caption). Report the count.
- [ ] Commit any fixes; stop. No push/PR — separate decision.

## Deviations that require stopping

- LeadForm spec unattainable without component changes (Task 1 Step 1).
- Any consumer of CompatibilityMatrix outside pricing (grep says none:
  pricing/page.tsx + marketing.css only — verify).
- The `.mjs` hero import breaking the prod build with no house pattern to
  mirror.
