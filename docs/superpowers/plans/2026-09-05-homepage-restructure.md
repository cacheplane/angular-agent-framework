# Homepage Restructure Implementation Plan (live-stage plan 1 of 3)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cut the homepage from twenty blocks to the eight-block spine in the live-stage spec §3, with Reliability merged and promoted, the final-mile argument promoted, one install moment, one teams block with one form, and a four-question FAQ, while the four capability `FeatureBlock`s stay in place until plan 3 replaces them with the stage.

**Architecture:** Every change is a composition change in `apps/website/src/app/page.tsx` plus one new or merged component per block. New copy lives in `positioning.ts` (single-source rule), so the public-copy scan and the positioning spec cover it. Removed components are deleted with their specs; the e2e that pinned them is updated in the same task. Nothing in `examples/` or `libs/` changes.

**Tech Stack:** Next.js app router (server components, `'use client'` where state is needed), Vitest with Testing Library (`// @vitest-environment jsdom`), Playwright website e2e, the website's unlayered CSS in `src/styles/landing.css`.

**Spec:** `docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md` §3, §9 (analytics for this plan: no new events), §13 plan 1.

---

## Conventions

- Run website unit tests from the repo root: `npx nx test website` (the whole suite) or `cd apps/website && npx vitest run <path>` for one file. Never run the suite from inside `apps/website` for `cockpit-retirement.spec.ts`; it resolves paths from the repo root.
- Website e2e: `npx playwright test -c apps/website/e2e/playwright.config.ts <spec files>`. Check the config path exists before the first run; if the config lives elsewhere, `grep -rn "testDir" apps/website/e2e/*.ts` finds it.
- Lint: `npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "`; zero errors, warnings tolerated.
- Commit after every task, message ending with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`.
- Branch off `origin/main` after `git fetch`: `git checkout -b blove/homepage-restructure origin/main`.

## File structure

| File | Responsibility |
|---|---|
| `apps/website/src/lib/positioning.ts` (modify) | New copy: final-mile heading and aside, reliability receipts, prove-it rows. |
| `apps/website/src/lib/positioning.spec.ts` (modify) | Pins the new copy and that every receipt links to a human page. |
| `apps/website/src/components/landing/Reliability.tsx` (new) | Merged proof band: four cells, three receipts, works-with logo footer with the adapter link. Replaces `ProofStrip.tsx` and `LogoRibbon.tsx`. |
| `apps/website/src/components/landing/Reliability.spec.tsx` (new) | Carries every guard from `ProofStrip.spec.tsx` and `LogoRibbon.spec.tsx`, plus the receipts. |
| `apps/website/src/components/landing/ScopeTable.tsx` (modify) | Becomes "The final mile": new heading and aside from positioning. |
| `apps/website/src/components/landing/FinalCTA.tsx` (modify) | Optional `rows` and `captionLinks` props. |
| `apps/website/src/components/landing/WhitePaperForm.tsx` (new) | The signup form and its states, extracted from `WhitePaperBlock.tsx` so two blocks can share it. |
| `apps/website/src/components/landing/TeamsBlock.tsx` (new) | Pilot copy, outcomes, four phases, and the field report form. Replaces `PilotBlock` on the homepage. |
| `apps/website/src/components/landing/HomeFAQ.tsx` (modify) | Four questions. |
| `apps/website/content/docs/chat/getting-started/coding-agents.mdx` (new) + `docs-config.ts` | The coding-agent prompt's new home. |
| `apps/website/content/docs/choosing-an-adapter/index.mdx`, `langgraph/guides/persistence.mdx`, `chat/getting-started/try-without-a-backend.mdx` (modify) | Receive the moved FAQ answers. |
| `apps/website/src/components/shared/SiteFooter.tsx`, `Footer.tsx` (modify) | Newsletter form hidden on `/`. |
| `apps/website/src/app/page.tsx` (modify) | The new composition. |
| Deleted | `ProofStrip.tsx` + spec, `LogoRibbon.tsx` + spec, `RuntimeParity.tsx`, `RuntimeParityToggle.tsx` + spec, `ThreeSteps.tsx`, `DemoShowcase.tsx` + spec, `CodingAgentQuickstart.tsx` + spec, `PilotBlock.tsx`. |
| `apps/website/e2e/website.spec.ts`, `demo-modal.spec.ts` (modify) | Section assertions and the demo modal's entry page. |
| `apps/website/src/styles/landing.css` (modify) | Receipts, logo footer, final-CTA rows, teams grid. |

---

### Task 1: Copy constants

**Files:**
- Modify: `apps/website/src/lib/positioning.ts`
- Test: `apps/website/src/lib/positioning.spec.ts`

- [ ] **Step 1: Write the failing tests**

Append to `positioning.spec.ts` inside its top-level `describe` (or as a new `describe` at the end of the file):

```ts
describe('homepage restructure copy (live-stage spec §3)', () => {
  it('pins the final-mile heading and aside', async () => {
    const { FINAL_MILE_HEADING, FINAL_MILE_ASIDE } = await import('./positioning');
    expect(FINAL_MILE_HEADING).toBe('Angular teams are building agents. The last mile is still messy.');
    expect(FINAL_MILE_ASIDE).toBe('What you start with, and what Threadplane adds.');
  });

  it('carries three reliability receipts, each linking a human-readable page', async () => {
    const { RELIABILITY_RECEIPTS } = await import('./positioning');
    expect(RELIABILITY_RECEIPTS.map((r) => r.claim)).toEqual([
      'Signed provenance on every release',
      'Three runtimes exercised end to end',
      'No content telemetry, no cloud',
    ]);
    for (const r of RELIABILITY_RECEIPTS) {
      expect(r.sourceLabel.length).toBeGreaterThan(0);
      const { hostname, pathname } = new URL(r.sourceHref, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), r.sourceHref).toBe(false);
      expect(pathname.startsWith('/api/'), r.sourceHref).toBe(false);
    }
  });

  it('carries the three prove-it rows the final CTA absorbs from the Test section', async () => {
    const { PROVE_IT_ROWS } = await import('./positioning');
    expect(PROVE_IT_ROWS).toEqual([
      { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
      { claim: 'Script tool calls and interrupts', api: 'mockLangGraphAgent()' },
      { claim: 'Same UI code in test and production', api: 'Agent' },
    ]);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/website && npx vitest run src/lib/positioning.spec.ts`
Expected: 3 FAIL, `FINAL_MILE_HEADING` undefined.

- [ ] **Step 3: Add the constants**

In `positioning.ts`, after the `HERO_TRUST_LINE` line, add:

```ts
// ── The final mile (live-stage spec §3, block 3) ─────────────────────────────
export const FINAL_MILE_HEADING = 'Angular teams are building agents. The last mile is still messy.';
export const FINAL_MILE_ASIDE = 'What you start with, and what Threadplane adds.';

// ── Reliability receipts (spec §3, block 2). Each links a page a human can read;
// the sourced numbers stay in Reliability.tsx beside them. ───────────────────
export interface ReliabilityReceipt {
  readonly claim: string;
  readonly detail: string;
  readonly sourceLabel: string;
  readonly sourceHref: string;
}
export const RELIABILITY_RECEIPTS: readonly ReliabilityReceipt[] = [
  {
    claim: 'Signed provenance on every release',
    detail: 'npm provenance attestations from OIDC trusted publishing, and a SLSA provenance file on each GitHub release.',
    sourceLabel: 'npmjs.com · provenance',
    sourceHref: 'https://www.npmjs.com/package/@threadplane/chat#provenance',
  },
  {
    claim: 'Three runtimes exercised end to end',
    detail: 'LangGraph, AG-UI and Mastra backends deployed and driven by browser tests on every merge, against one Angular contract.',
    sourceLabel: 'runtime portability matrix',
    sourceHref: '/docs/runtimes',
  },
  {
    claim: 'No content telemetry, no cloud',
    detail: 'Operational facts about how the product runs, never prompts, messages or tool data. MIT, self-hosted, no account.',
    sourceLabel: 'privacy policy',
    sourceHref: '/privacy',
  },
];

// ── Prove it without a backend (spec §3, block 5): the Test rows the final CTA
// absorbs. ────────────────────────────────────────────────────────────────────
export const PROVE_IT_ROWS = [
  { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
  { claim: 'Script tool calls and interrupts', api: 'mockLangGraphAgent()' },
  { claim: 'Same UI code in test and production', api: 'Agent' },
] as const;
```

Before committing, confirm the two internal hrefs resolve: `ls apps/website/content/docs/runtimes` must list an index page (if the runtimes landing is at a different slug, use that slug and keep the label), and `/privacy` exists under `src/app/privacy`.

- [ ] **Step 4: Run the tests and the public-copy scan**

Run: `cd apps/website && npx vitest run src/lib/positioning.spec.ts src/lib/public-copy.spec.ts`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/positioning.ts apps/website/src/lib/positioning.spec.ts
git commit -m "feat(website): single-source copy for the final mile, reliability receipts, and the prove-it rows

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 2: Reliability section (ProofStrip + LogoRibbon merged, receipts added)

**Files:**
- Create: `apps/website/src/components/landing/Reliability.tsx`
- Create: `apps/website/src/components/landing/Reliability.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (after the `.proof-strip-source` rules, around line 1210)
- Delete: `ProofStrip.tsx`, `ProofStrip.spec.tsx`, `LogoRibbon.tsx`, `LogoRibbon.spec.tsx` (in Task 9, once `page.tsx` no longer imports them)

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/website/src/components/landing/Reliability.spec.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Reliability, PROOF_CELLS, RIBBON_ITEMS, RIBBON_MORE_COUNT } from './Reliability';
import { RELIABILITY_RECEIPTS } from '../../lib/positioning';

describe('Reliability', () => {
  it('renders four cells, each with a source link', () => {
    render(<Reliability />);
    expect(PROOF_CELLS).toHaveLength(4);
    for (const cell of PROOF_CELLS) {
      expect(screen.getByText(cell.caption)).toBeTruthy();
      expect(screen.getByRole('link', { name: cell.sourceLabel }).getAttribute('href')).toBe(cell.sourceHref);
    }
  });

  it('renders the HVTrust grade as a live badge image, not text', () => {
    render(<Reliability />);
    expect(screen.getByAltText(/HVTrust grade/i).getAttribute('src')).toBe('https://hvtracker.net/badge/threadplane.svg');
  });

  it('renders three receipts under the cells, each with a source link', () => {
    render(<Reliability />);
    const list = screen.getByRole('list', { name: 'Receipts' });
    expect(list.querySelectorAll('li')).toHaveLength(3);
    for (const r of RELIABILITY_RECEIPTS) {
      expect(screen.getByText(r.claim)).toBeTruthy();
      expect(screen.getByRole('link', { name: r.sourceLabel }).getAttribute('href')).toBe(r.sourceHref);
    }
  });

  it('keeps the dark band, the id the e2e pins, the watermark, and the framing', () => {
    const { container } = render(<Reliability />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    expect(section?.getAttribute('id')).toBe('proof');
    const mark = container.querySelector('.proof-strip-watermark');
    expect(mark?.getAttribute('aria-hidden')).toBe('true');
    expect(mark?.textContent).toBe('');
    expect(screen.getByText('Reliable to the core')).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Audited, scored, published.' }).id).toBe('proof-heading');
  });

  it('carries the works-with line as a compatibility claim with an adapter link', () => {
    const { container } = render(<Reliability />);
    expect(RIBBON_ITEMS).toHaveLength(8);
    expect(screen.getByText('Works with')).toBeTruthy();
    for (const item of RIBBON_ITEMS) expect(screen.getByText(item.name)).toBeTruthy();
    expect(screen.getByText(`+ ${RIBBON_MORE_COUNT} more`)).toBeTruthy();
    for (const img of Array.from(container.querySelectorAll('img.reliability-logo'))) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
    expect(screen.getByRole('link', { name: 'Choose an adapter →' }).getAttribute('href')).toBe('/docs/choosing-an-adapter');
  });

  it('links every number and receipt to a human-readable page, never a raw API', () => {
    for (const href of [...PROOF_CELLS.map((c) => c.sourceHref), ...RELIABILITY_RECEIPTS.map((r) => r.sourceHref)]) {
      const { hostname, pathname } = new URL(href, 'https://threadplane.ai');
      expect(hostname.startsWith('api.'), href).toBe(false);
      expect(pathname.startsWith('/api/'), href).toBe(false);
    }
  });
});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `cd apps/website && npx vitest run src/components/landing/Reliability.spec.tsx`
Expected: FAIL, cannot resolve `./Reliability`.

- [ ] **Step 3: Create the component**

```tsx
// apps/website/src/components/landing/Reliability.tsx
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../pricing/angular-support.mjs';
import { RELIABILITY_RECEIPTS } from '../../lib/positioning';

interface ProofCell {
  /** Big Garamond numeral, or null when the cell renders a live badge. */
  value: string | null;
  suffix?: string;
  caption: string;
  sourceLabel: string;
  sourceHref: string;
}

/**
 * Verified 2026-09-04 against live sources (homepage design spec, "Verification
 * results"). The rank and score drift; re-verify on touch and never round up.
 * The HVTrust grade is a LIVE badge on purpose: it sits near the A-band floor
 * and has flipped several times in a month.
 *
 * Every href is a page a human can read. The Scorecard number comes from
 * api.securityscorecards.dev, but the LINK goes to the scorecard.dev viewer.
 */
export const PROOF_CELLS: readonly ProofCell[] = [
  { value: '#8', suffix: 'of 119', caption: 'Of all agent frameworks ranked', sourceLabel: 'hvtracker.net', sourceHref: 'https://hvtracker.net/categories/agent-frameworks/' },
  { value: '8.2', suffix: '/10', caption: 'OpenSSF Scorecard, official scan', sourceLabel: 'scorecard.dev', sourceHref: 'https://scorecard.dev/viewer/?uri=github.com/cacheplane/angular-agent-framework' },
  { value: null, caption: 'HVTrust supply-chain grade, live', sourceLabel: 'hvtracker.net/agents', sourceHref: 'https://hvtracker.net/agents/threadplane/' },
  {
    // Derived from the published peer range, never hardcoded.
    value: `${WEBSITE_SUPPORTED_ANGULAR_MAJORS[0]}–${WEBSITE_SUPPORTED_ANGULAR_MAJORS.at(-1)}`,
    caption: 'Angular majors supported, CI-tested',
    sourceLabel: 'npmjs.com',
    sourceHref: 'https://www.npmjs.com/package/@threadplane/langgraph',
  },
];

interface RibbonItem { name: string; logoSrc: string; }

export const RIBBON_ITEMS: readonly RibbonItem[] = [
  { name: 'OpenAI', logoSrc: '/logos/providers/openai.svg' },
  { name: 'Anthropic', logoSrc: '/logos/providers/anthropic.svg' },
  { name: 'Gemini', logoSrc: '/logos/providers/google.svg' },
  { name: 'Bedrock', logoSrc: '/logos/providers/bedrock.svg' },
  { name: 'LangGraph', logoSrc: '/logos/langgraph.svg' },
  { name: 'AG-UI', logoSrc: '/logos/ag-ui.svg' },
  { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
  { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
];
/** Azure OpenAI, Pydantic AI, Microsoft Agent Framework, AWS Strands. */
export const RIBBON_MORE_COUNT = 4;

/**
 * The reliability section (live-stage spec §3, block 2): the sourced proof
 * band, a second line of receipts in the same grammar, and the works-with line
 * as its footer, so the two-runtime claim sits inside the trust argument.
 *
 * "Works with" is a compatibility claim, never a customer claim: logos are
 * `alt="" aria-hidden` beside visible names, and no wording may imply these
 * companies use Threadplane. Reliability.spec.tsx guards that.
 */
export function Reliability() {
  return (
    <Section surface="dark" id="proof" ariaLabelledBy="proof-heading">
      <Container>
        <div className="proof-strip">
          <div className="proof-strip-watermark" aria-hidden="true" data-watermark-text="Proof" />
          <div className="proof-strip-grid">
            <SectionHeader
              variant="rail"
              eyebrow="Reliable to the core"
              heading="Audited, scored, published."
              headingId="proof-heading"
              aside="Not self-reported — every number links to its source."
            />
            <ul className="proof-strip-cells" role="list">
              {PROOF_CELLS.map((cell) => (
                <li className="proof-strip-cell" key={cell.caption}>
                  {cell.value ? (
                    <p className="proof-strip-value">
                      {cell.value}
                      {cell.suffix ? <span className="proof-strip-suffix"> {cell.suffix}</span> : null}
                    </p>
                  ) : (
                    <img
                      className="proof-strip-badge"
                      src="https://hvtracker.net/badge/threadplane.svg"
                      alt="HVTrust grade for Threadplane (live badge)"
                      width={91}
                      height={20}
                      loading="lazy"
                      referrerPolicy="no-referrer"
                    />
                  )}
                  <p className="proof-strip-caption">{cell.caption}</p>
                  <a className="proof-strip-source" href={cell.sourceHref} target="_blank" rel="noopener noreferrer">
                    {cell.sourceLabel}
                  </a>
                </li>
              ))}
            </ul>
            <ul className="reliability-receipts" role="list" aria-label="Receipts">
              {RELIABILITY_RECEIPTS.map((r) => {
                const external = r.sourceHref.startsWith('http');
                return (
                  <li className="reliability-receipt" key={r.claim}>
                    <p className="reliability-receipt-claim">{r.claim}</p>
                    <p className="reliability-receipt-detail">{r.detail}</p>
                    <a
                      className="proof-strip-source"
                      href={r.sourceHref}
                      {...(external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    >
                      {r.sourceLabel}
                    </a>
                  </li>
                );
              })}
            </ul>
            <div className="reliability-works-with" aria-label="Works with your agent stack">
              <span className="reliability-works-with-label">Works with</span>
              {RIBBON_ITEMS.map((item) => (
                <span className="reliability-works-with-item" key={item.name}>
                  <img src={item.logoSrc} alt="" aria-hidden="true" loading="lazy" decoding="async" className="reliability-logo" />
                  <span className="reliability-works-with-name">{item.name}</span>
                </span>
              ))}
              <span className="reliability-works-with-more">+ {RIBBON_MORE_COUNT} more</span>
              <a className="reliability-works-with-link" href="/docs/choosing-an-adapter">Choose an adapter →</a>
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 4: Add the CSS**

Append to `landing.css` directly after the `[data-ui="section"][data-surface="dark"] .proof-strip-source` rule:

```css
/* Reliability receipts: a second line under the four cells, same grammar,
 * smaller type. Reliability.tsx. */
.reliability-receipts {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 20px;
  list-style: none;
  margin: 0;
  padding: 24px 0 0;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}
.reliability-receipt { min-width: 0; }
.reliability-receipt-claim {
  font-family: var(--font-inter);
  font-size: 15px;
  font-weight: 600;
  line-height: 1.4;
  color: var(--color-text-primary);
  margin: 0;
}
.reliability-receipt-detail {
  font-family: var(--font-inter);
  font-size: 13px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 6px 0 0;
}
/* Works-with footer line, inside the dark band. */
.reliability-works-with {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 22px;
  padding-top: 22px;
  border-top: 1px solid rgba(255, 255, 255, 0.12);
}
.reliability-works-with-label,
.reliability-works-with-more {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.reliability-works-with-item { display: inline-flex; align-items: center; gap: 7px; white-space: nowrap; }
.reliability-logo { width: 16px; height: 16px; object-fit: contain; }
.reliability-works-with-name { font-family: var(--font-inter); font-size: 13px; font-weight: 500; color: var(--color-text-secondary); }
.reliability-works-with-link {
  margin-left: auto;
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  color: var(--color-accent);
}
@media (max-width: 860px) {
  .reliability-receipts { grid-template-columns: 1fr; }
  .reliability-works-with-link { margin-left: 0; }
}
```

Check the dark band's text tokens: if `--color-text-primary` is not light on `[data-surface="dark"]`, scope the two colour rules the way `.proof-strip-source` is scoped (`[data-ui="section"][data-surface="dark"] .reliability-receipt-claim`).

- [ ] **Step 5: Run the spec and the style contract**

Run: `cd apps/website && npx vitest run src/components/landing/Reliability.spec.tsx src/styles/style-contracts.spec.ts`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/Reliability.tsx apps/website/src/components/landing/Reliability.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): Reliability section — proof cells, three receipts, works-with footer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 3: The final mile (ScopeTable reframed)

**Files:**
- Modify: `apps/website/src/components/landing/ScopeTable.tsx`
- Test: `apps/website/src/components/landing/ScopeTable.spec.tsx` (new)

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/website/src/components/landing/ScopeTable.spec.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ScopeTable } from './ScopeTable';
import { FINAL_MILE_ASIDE, FINAL_MILE_HEADING } from '../../lib/positioning';

describe('ScopeTable as the final-mile section', () => {
  it('leads with the last-mile line and keeps the table and its anchor', () => {
    const { container } = render(<ScopeTable />);
    expect(screen.getByRole('heading', { name: FINAL_MILE_HEADING }).id).toBe('why-heading');
    expect(screen.getByText(FINAL_MILE_ASIDE)).toBeTruthy();
    expect(screen.getByText('The final mile')).toBeTruthy();
    expect(container.querySelector('[data-ui="section"]')?.getAttribute('id')).toBe('why');
    expect(screen.getAllByRole('row')).toHaveLength(5);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `cd apps/website && npx vitest run src/components/landing/ScopeTable.spec.tsx`
Expected: FAIL on the heading name.

- [ ] **Step 3: Reframe the header**

In `ScopeTable.tsx`, add the import `import { FINAL_MILE_ASIDE, FINAL_MILE_HEADING } from '../../lib/positioning';` and replace the `SectionHeader` with:

```tsx
        <SectionHeader
          variant="rail"
          eyebrow="The final mile"
          heading={FINAL_MILE_HEADING}
          headingId="why-heading"
          aside={FINAL_MILE_ASIDE}
        />
```

- [ ] **Step 4: Run and commit**

Run: `cd apps/website && npx vitest run src/components/landing/ScopeTable.spec.tsx`
Expected: PASS.

```bash
git add apps/website/src/components/landing/ScopeTable.tsx apps/website/src/components/landing/ScopeTable.spec.tsx
git commit -m "feat(website): the scope table leads with the last-mile line

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 4: FinalCTA absorbs the Test rows and a second caption link

**Files:**
- Modify: `apps/website/src/components/landing/FinalCTA.tsx`
- Modify: `apps/website/src/components/landing/FinalCTA.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the failing tests**

Append inside `describe('FinalCTA', ...)`:

```tsx
  it('renders optional rows above the headline in the claim/api grammar', () => {
    render(
      <FinalCTA
        rows={[
          { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
          { claim: 'Same UI code in test and production', api: 'Agent' },
        ]}
      />,
    );
    const list = screen.getByRole('list', { name: 'What you can prove first' });
    expect(list.querySelectorAll('li')).toHaveLength(2);
    expect(screen.getByText('provideFakeAgent()')).toBeTruthy();
  });

  it('renders no rows list when rows are omitted', () => {
    render(<FinalCTA />);
    expect(screen.queryByRole('list', { name: 'What you can prove first' })).toBeNull();
  });

  it('renders extra caption links after the first, separated by " · "', () => {
    render(
      <FinalCTA
        primary={{ label: 'Go', href: '/go' }}
        caption="MIT · no account, no cloud"
        captionLink={{ label: 'Talk to an engineer', href: '/contact' }}
        captionLinks={[{ label: 'Setup prompt for coding agents', href: '/docs/chat/getting-started/coding-agents' }]}
      />,
    );
    expect(screen.getByText(/MIT · no account, no cloud/).textContent).toBe(
      'MIT · no account, no cloud · Talk to an engineer · Setup prompt for coding agents',
    );
    expect(screen.getByRole('link', { name: 'Setup prompt for coding agents' }).getAttribute('href')).toBe(
      '/docs/chat/getting-started/coding-agents',
    );
  });
```

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/website && npx vitest run src/components/landing/FinalCTA.spec.tsx`
Expected: 3 FAIL.

- [ ] **Step 3: Implement**

In `FinalCTA.tsx`:

Add to `FinalCTAProps`:

```ts
  /** Optional claim/api rows rendered above the headline (the homepage's
   *  "prove it without a backend" moment). Omitted everywhere else. */
  rows?: readonly { claim: string; api: string }[];
  /** Further caption links, rendered after `captionLink`. */
  captionLinks?: readonly { label: string; href: string }[];
```

Add `rows = [], captionLinks = []` to the destructured defaults. Render the rows immediately inside `.final-cta-inner`, before the mark:

```tsx
          {rows.length > 0 ? (
            <ul className="final-cta-rows" role="list" aria-label="What you can prove first">
              {rows.map((row) => (
                <li className="final-cta-row" key={row.claim}>
                  <span className="final-cta-row-claim">{row.claim}</span>
                  <span className="final-cta-row-api">{row.api}</span>
                </li>
              ))}
            </ul>
          ) : null}
```

Change the caption condition to `caption || captionLink || captionLinks.length > 0` and append after the `captionLink` fragment:

```tsx
              {captionLinks.map((link) => (
                <span key={link.href}>
                  {' · '}
                  <a href={link.href}>{link.label}</a>
                </span>
              ))}
```

Append to `landing.css` after the existing `.final-cta-caption` rules (search for `.final-cta-caption`):

```css
/* Prove-it rows above the closing headline. FinalCTA.tsx `rows`. */
.final-cta-rows {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 12px 24px;
  list-style: none;
  margin: 0 0 28px;
  padding: 0;
  text-align: left;
}
.final-cta-row { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
.final-cta-row-claim { font-family: var(--font-inter); font-size: 14px; color: var(--color-text-secondary); }
.final-cta-row-api { font-family: var(--font-mono); font-size: 12px; color: var(--color-accent); overflow-wrap: anywhere; }
@media (max-width: 860px) { .final-cta-rows { grid-template-columns: 1fr; } }
```

- [ ] **Step 4: Run and commit**

Run: `cd apps/website && npx vitest run src/components/landing/FinalCTA.spec.tsx`
Expected: all PASS.

```bash
git add apps/website/src/components/landing/FinalCTA.tsx apps/website/src/components/landing/FinalCTA.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): FinalCTA takes prove-it rows and extra caption links

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 5: WhitePaperForm extracted; TeamsBlock merges pilot and field report

**Files:**
- Create: `apps/website/src/components/landing/WhitePaperForm.tsx`
- Modify: `apps/website/src/components/landing/WhitePaperBlock.tsx`
- Create: `apps/website/src/components/landing/TeamsBlock.tsx`
- Create: `apps/website/src/components/landing/TeamsBlock.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/website/src/components/landing/TeamsBlock.spec.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { TeamsBlock } from './TeamsBlock';

vi.mock('../../lib/analytics/client', () => ({
  track: vi.fn(),
  trackCtaClick: vi.fn(),
  trackWhitepaperDownloadClick: vi.fn(),
}));

const formPolicy = {
  version: 'test',
  disclosures: { whitepaper: 'Whitepaper disclosure', newsletter: 'Newsletter disclosure', contact: 'Contact disclosure' },
} as never;

describe('TeamsBlock', () => {
  it('renders the pilot heading, four outcomes, four phases, both CTAs, and one email form', () => {
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    expect(screen.getByRole('heading', { name: 'Shipping inside a large Angular platform?' }).id).toBe('pilot-heading');
    expect(container.querySelectorAll('.pilot-row')).toHaveLength(4);
    expect(container.querySelectorAll('.pilot-step')).toHaveLength(4);
    expect(screen.getByRole('link', { name: 'Talk to an engineer' }).getAttribute('href')).toBe('/contact?source=home_enterprise&track=enterprise');
    expect(screen.getByRole('link', { name: 'See the pilot program' }).getAttribute('href')).toBe('/pilot-to-prod');
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByLabelText('Email address')).toBeTruthy();
    expect(screen.getByText('Whitepaper disclosure')).toBeTruthy();
  });

  it('frames the field report as the takeaway, not a second section', () => {
    render(<TeamsBlock formPolicy={formPolicy} />);
    expect(screen.getByText('Field report')).toBeTruthy();
    expect(screen.getByText('From Prototype to Production')).toBeTruthy();
    expect(screen.queryByRole('heading', { name: 'The last-mile gap in Angular AI.' })).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/website && npx vitest run src/components/landing/TeamsBlock.spec.tsx`
Expected: FAIL, cannot resolve `./TeamsBlock`.

- [ ] **Step 3: Extract the form**

Create `WhitePaperForm.tsx` by moving everything in `WhitePaperBlock.tsx` from `type WhitepaperId` through the end of the `submit` function, plus the JSX from the `state === 'done'` ternary through the `wp-already` paragraph, into a client component:

```tsx
// apps/website/src/components/landing/WhitePaperForm.tsx
'use client';
import { useRef, useState } from 'react';
import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { FORM_POLICY_REFRESH_MESSAGE, growthFormRequestSnapshot, type GrowthFormRequestSnapshot } from '../../lib/growth/form-client';
import { Button } from '../ui/Button';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';

export type WhitepaperId = 'overview' | 'angular' | 'render' | 'chat';

export const PDF_PATHS: Record<WhitepaperId, { href: string; download: string }> = {
  overview: { href: '/whitepaper.pdf', download: 'angular-agent-readiness-guide.pdf' },
  angular: { href: '/whitepapers/angular.pdf', download: 'angular-streaming-guide.pdf' },
  render: { href: '/whitepapers/render.pdf', download: 'angular-genui-guide.pdf' },
  chat: { href: '/whitepapers/chat.pdf', download: 'angular-chat-guide.pdf' },
};

interface WhitePaperFormProps {
  paper: WhitepaperId;
  formPolicy: PublicFormPolicy;
  /** Analytics surface + section, so the teams block and the library pages report separately. */
  surface: string;
  sourceSection: string;
  /** Ids must be unique per page; two forms on one page would collide. */
  idPrefix: string;
}

export function WhitePaperForm({ paper, formPolicy, surface, sourceSection, idPrefix }: WhitePaperFormProps) {
  const pdf = PDF_PATHS[paper];
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error' | 'stale'>('idle');
  const submissionSnapshot = useRef<GrowthFormRequestSnapshot<{ email: string; paper: WhitepaperId }> | null>(null);
  const disclosureId = `${idPrefix}-growth-disclosure`;
  const inputId = `${idPrefix}-email`;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('submitting');
    track(analyticsEvents.marketingWhitepaperSignupSubmit, { surface, source_section: sourceSection, paper });
    try {
      const snapshot = growthFormRequestSnapshot(submissionSnapshot.current, { email, paper });
      submissionSnapshot.current = snapshot;
      const res = await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...snapshot.facts,
          acquisition_session_id: snapshot.acquisition_session_id,
          submission_id: snapshot.submission_id,
          policy_version: formPolicy.version,
        }),
      });
      if (res.status === 409) { submissionSnapshot.current = null; setState('stale'); return; }
      if (res.status >= 400 && res.status < 500) submissionSnapshot.current = null;
      if (!res.ok) throw new Error('whitepaper_signup_failed');
      submissionSnapshot.current = null;
      track(analyticsEvents.marketingWhitepaperSignupSuccess, { surface, source_section: sourceSection, paper });
      setState('done');
    } catch {
      track(analyticsEvents.marketingWhitepaperSignupFail, { surface, source_section: sourceSection, paper, error_reason: 'api_error' });
      setState('error');
    }
  };

  const download = (ctaId: 'home_whitepaper_direct' | 'home_whitepaper_direct_inline') => () =>
    trackWhitepaperDownloadClick(paper, { surface, source_section: sourceSection, cta_id: ctaId });

  return (
    <>
      {state === 'done' ? (
        <div className="wp-success">
          ✓ Check your inbox — the guide is on its way.{' '}
          <a href={pdf.href} download={pdf.download} onClick={download('home_whitepaper_direct')} className="wp-success-link">Or download directly.</a>
        </div>
      ) : state === 'stale' ? (
        <div role="alert" className="wp-form">
          <p className="wp-disclosure">{FORM_POLICY_REFRESH_MESSAGE}</p>
          <Button type="button" variant="primary" size="lg" onClick={() => window.location.reload()}>Refresh page</Button>
        </div>
      ) : (
        <form onSubmit={submit} className="wp-form">
          <label htmlFor={inputId} className="sr-only">Email address</label>
          <input id={inputId} type="email" autoComplete="email" placeholder="you@company.com" value={email}
            onChange={(e) => setEmail(e.target.value)} required disabled={state === 'submitting'} className="wp-email-input" />
          <p id={disclosureId} className="wp-disclosure">{formPolicy.disclosures.whitepaper}</p>
          <Button type="submit" variant="primary" size="lg" disabled={state === 'submitting' || !email} aria-describedby={disclosureId}>
            {state === 'submitting' ? 'Sending…' : 'Download (free)'}
          </Button>
        </form>
      )}
      {state === 'error' && (
        <p className="wp-error">
          Something went wrong — please try again or{' '}
          <a href={pdf.href} download={pdf.download} className="wp-error-link">download directly</a>.
        </p>
      )}
      {state !== 'done' && (
        <p className="wp-already">
          Already on the list?{' '}
          <a href={pdf.href} download={pdf.download} onClick={download('home_whitepaper_direct_inline')} className="wp-already-link">Download the PDF directly.</a>
        </p>
      )}
    </>
  );
}
```

Then reduce `WhitePaperBlock.tsx` to the section chrome: keep `ROWS`, the header, the tilted cover, and replace the form/state JSX with `<WhitePaperForm paper={paper} formPolicy={formPolicy} surface="home_whitepaper" sourceSection="whitepaper-block" idPrefix={`wp-${paper}`} />`. Remove the now-unused imports (`useRef`, `useState`, `growthFormRequestSnapshot`, `track`, `trackWhitepaperDownloadClick`, `analyticsEvents`, `FORM_POLICY_REFRESH_MESSAGE`, `Button` if unused). Keep the `'use client'` directive only if something else in the file needs it; the block itself is now static.

Run `cd apps/website && npx vitest run src/components/landing/WhitePaperBlock.spec.tsx` and confirm every existing case still passes (the input id was `wp-email`; the spec uses labels and roles, so the `wp-overview-email` id is fine. If a case queries `#wp-email`, change the query to `getByLabelText('Email address')`).

- [ ] **Step 4: Create TeamsBlock**

```tsx
// apps/website/src/components/landing/TeamsBlock.tsx
'use client';

import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import { WhitePaperForm } from './WhitePaperForm';

const TIMELINE = [
  { phase: '01', title: 'Discover', body: 'Map your stack, surfaces, and the agentic work that earns its keep.' },
  { phase: '02', title: 'Build', body: 'A working demo on your real data, in your real app.' },
  { phase: '03', title: 'Harden', body: 'Observability, error boundaries, deploy paths, on-call patterns.' },
  { phase: '04', title: 'Train', body: 'Your team owns the stack. We leave you with a runbook, not a black box.' },
];

const OUTCOMES = [
  { claim: 'A working agent demo on your domain', tail: 'your data' },
  { claim: 'Hardened error, fallback, observability patterns', tail: 'production-ready' },
  { claim: 'Deploy-ready integration', tail: 'your CI/CD' },
  { claim: 'Team trained on the framework', tail: 'runbook, yours' },
];

/**
 * For teams (live-stage spec §3, block 6): the pilot program and the field
 * report in one block, with the page's one email form. Replaces PilotBlock +
 * WhitePaperBlock on the homepage; the library pages keep WhitePaperBlock.
 */
export function TeamsBlock({ formPolicy }: { formPolicy: PublicFormPolicy }) {
  return (
    <Section surface="tinted" id="teams" ariaLabelledBy="pilot-heading">
      <Container>
        <div className="pilot-block-grid">
          <div>
            <div className="pilot-rail">
              <Eyebrow tone="accent" className="pilot-eyebrow">For teams</Eyebrow>
              <span className="pilot-rail-line" aria-hidden="true" />
            </div>
            <h2 id="pilot-heading" className="pilot-heading">Shipping inside a large Angular platform?</h2>
            <p className="pilot-subhead">
              Bring your backend, security model, and design system. Work directly with Threadplane
              engineers on architecture, rollout, testing, and production hardening.
            </p>
            <div className="pilot-rows">
              {OUTCOMES.map((o) => (
                <div className="pilot-row" key={o.claim}>
                  <p className="pilot-row-claim">{o.claim}</p>
                  <p className="pilot-row-tail">{o.tail}</p>
                </div>
              ))}
            </div>
            <div className="pilot-cta-row">
              <Button variant="primary" size="lg" href="/contact?source=home_enterprise&track=enterprise"
                onClick={() => trackCtaClick({ cta_id: 'hero_talk_to_engineers', track: 'enterprise', surface: 'home' })}>
                Talk to an engineer
              </Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod">See the pilot program</Button>
            </div>
          </div>

          <div className="teams-aside">
            <div className="pilot-steps">
              {TIMELINE.map((t) => (
                <div className="pilot-step" key={t.phase}>
                  <span className="pilot-step-num" aria-hidden="true">{t.phase}</span>
                  <div>
                    <div className="pilot-step-title">{t.title}</div>
                    <div className="pilot-step-body">{t.body}</div>
                  </div>
                </div>
              ))}
            </div>
            <div className="teams-report">
              <div className="wp-cover-badge">Field report · 18 pages</div>
              <p className="teams-report-title">From Prototype to Production</p>
              <p className="teams-report-desc">Six production-readiness dimensions for Angular AI teams. Error boundaries, fallbacks, observability, deploy. Free.</p>
              <WhitePaperForm paper="overview" formPolicy={formPolicy} surface="home_whitepaper" sourceSection="teams-block" idPrefix="teams-wp" />
            </div>
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

Append to `landing.css` after the `.pilot-step-body` rule:

```css
/* TeamsBlock: phases stacked over the field report card. */
.teams-aside { display: flex; flex-direction: column; gap: 28px; }
.teams-report {
  padding: 22px 24px;
  border: 1px solid var(--color-border);
  border-radius: 12px;
  background: var(--color-canvas);
}
.teams-report-title { font-family: var(--font-garamond); font-size: 26px; font-weight: 700; line-height: 1.1; margin: 10px 0 6px; color: var(--color-text-primary); }
.teams-report-desc { font-family: var(--font-inter); font-size: 14px; line-height: 1.5; color: var(--color-text-secondary); margin: 0 0 16px; }
```

- [ ] **Step 5: Run the specs**

Run: `cd apps/website && npx vitest run src/components/landing/TeamsBlock.spec.tsx src/components/landing/WhitePaperBlock.spec.tsx`
Expected: all PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/WhitePaperForm.tsx apps/website/src/components/landing/WhitePaperBlock.tsx apps/website/src/components/landing/TeamsBlock.tsx apps/website/src/components/landing/TeamsBlock.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): TeamsBlock merges the pilot program and the field report around one form

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 6: FAQ trimmed to four; the moved answers land in docs

**Files:**
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`
- Create: `apps/website/src/components/landing/HomeFAQ.spec.tsx`
- Modify: `apps/website/content/docs/choosing-an-adapter/index.mdx`, `apps/website/content/docs/langgraph/guides/persistence.mdx`, `apps/website/content/docs/chat/getting-started/try-without-a-backend.mdx`

- [ ] **Step 1: Write the failing spec**

```tsx
// apps/website/src/components/landing/HomeFAQ.spec.tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { HomeFAQ } from './HomeFAQ';

describe('HomeFAQ', () => {
  it('asks only what the page above did not answer', () => {
    render(<HomeFAQ />);
    const questions = [
      'Is Threadplane a backend agent framework?',
      'Can I use my existing Angular component library and design system?',
      'Does generated UI execute arbitrary code?',
      'Does Threadplane require a hosted service or an account?',
    ];
    for (const q of questions) expect(screen.getByText(q)).toBeTruthy();
    expect(screen.queryByText('Does Threadplane require LangGraph?')).toBeNull();
    expect(screen.queryByText(/raw streaming SDK/)).toBeNull();
    expect(screen.getAllByRole('heading', { level: 3 }).length + 0).toBeLessThanOrEqual(4);
  });
});
```

If the `FAQ` primitive renders questions as `<button>` or `<summary>` rather than `<h3>`, replace the last assertion with a count of those elements; open `src/components/ui/FAQ.tsx` to see which.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/website && npx vitest run src/components/landing/HomeFAQ.spec.tsx`
Expected: FAIL on the removed questions still being present.

- [ ] **Step 3: Trim `ITEMS`**

In `HomeFAQ.tsx`, keep exactly these four entries of `ITEMS`, with their current answer JSX unchanged: "Is Threadplane a backend agent framework?", "Can I use my existing Angular component library and design system?", "Does generated UI execute arbitrary code?", "Does Threadplane require a hosted service or an account?". Delete the other eight. Remove the now-unused imports (`formatAngularRange`, `WEBSITE_SUPPORTED_ANGULAR_MAJORS`). Keep the file's comment about barred copy above the array so the public-copy spec's counter-fixture rationale still reads true.

- [ ] **Step 4: Move the answers into docs**

Append to `content/docs/choosing-an-adapter/index.mdx`:

```mdx

## Frequently asked

**Does Threadplane require LangGraph?** No. `@threadplane/ag-ui` connects any AG-UI-compatible backend, and `@threadplane/langgraph` is the direct LangGraph adapter.

**What is the difference between the two adapters?** Both implement the same `Agent` contract. LangGraph adds native threads, checkpoints, history, and branch mapping; AG-UI maps the protocol's events and depends on what the backend emits.

**How does Threadplane differ from a raw streaming SDK?** A streaming SDK gives you events. Threadplane gives you the Angular state model, chat UX, threads, approvals, generated UI, recovery, and tests on top of them.

**How does it compare with other Angular agent UI libraries?** Threadplane is the runtime-neutral Angular UI layer: direct LangGraph and AG-UI adapters, a fake-agent test path, design-system-owned generated UI, and no hosted layer in the loop.
```

Append to `content/docs/langgraph/guides/persistence.mdx`:

```mdx

## Where threads and checkpoints live

In your backend's persistence layer. Threadplane exposes thread, history, and resume behavior in the UI; durability comes from the runtime you operate.
```

Append to `content/docs/chat/getting-started/try-without-a-backend.mdx`:

```mdx

## Testing without a model

`provideFakeAgent()` streams canned tokens in-process, and the mock transports script tool calls and interrupts, so component specs stay deterministic and fast. See the [testing guide](/docs/langgraph/guides/testing).
```

The Angular-versions answer is already the installation guide's peer table, and the telemetry answer is the privacy page; neither needs a new paragraph.

- [ ] **Step 5: Run the spec and the copy scans**

Run: `cd apps/website && npx vitest run src/components/landing/HomeFAQ.spec.tsx src/lib/public-copy.spec.ts`
Expected: all PASS (the source scan still finds JSX fragments in `HomeFAQ.tsx`; four answers are enough).

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/HomeFAQ.tsx apps/website/src/components/landing/HomeFAQ.spec.tsx apps/website/content/docs
git commit -m "feat(website): homepage FAQ keeps four questions; the rest move to the docs they answer

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 7: The coding-agent prompt moves to a docs page

**Files:**
- Create: `apps/website/content/docs/chat/getting-started/coding-agents.mdx`
- Modify: `apps/website/src/lib/docs-config.ts` (the `chat` → `getting-started` pages array)
- Test: `apps/website/src/lib/docs-config.spec.ts` if it exists (otherwise the docs e2e); plus a small spec that the page's prompt equals `CODING_AGENT_PROMPT`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/coding-agents-page.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { CODING_AGENT_PROMPT } from './positioning';
import { docsConfig } from './docs-config';

const PAGE = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'content', 'docs', 'chat', 'getting-started', 'coding-agents.mdx');

describe('coding-agents docs page', () => {
  it('carries the maintained prompt verbatim inside a fenced block', () => {
    const mdx = readFileSync(PAGE, 'utf8');
    expect(mdx).toContain('```text\n' + CODING_AGENT_PROMPT + '\n```');
    expect(mdx).toContain('/AGENTS.md');
    expect(mdx).toContain('/llms-full.txt');
  });

  it('is registered in the chat getting-started nav', () => {
    const chat = docsConfig.find((lib: { id: string }) => lib.id === 'chat') as { sections: { id: string; pages: { slug: string }[] }[] };
    const gettingStarted = chat.sections.find((s) => s.id === 'getting-started')!;
    expect(gettingStarted.pages.map((p) => p.slug)).toContain('coding-agents');
  });
});
```

Adjust the `docsConfig` import name to whatever `docs-config.ts` actually exports (`grep -n "^export" apps/website/src/lib/docs-config.ts`).

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/website && npx vitest run src/lib/coding-agents-page.spec.ts`
Expected: FAIL, file not found.

- [ ] **Step 3: Create the page and register it**

Write `content/docs/chat/getting-started/coding-agents.mdx` with this exact content, where the fenced block is the `CODING_AGENT_PROMPT` string from `positioning.ts` copied verbatim (the spec checks byte equality):

```mdx
---
title: Coding agents
description: A maintained setup prompt for Claude Code, Codex and other coding agents adding Threadplane to an Angular app, plus the machine-readable references they should read first.
---

# Coding agents

Threadplane publishes maintained, machine-readable setup context. Give your coding agent the prompt below; it starts with a fake agent, verifies the Angular surface, then connects LangGraph or AG-UI.

```text
<CODING_AGENT_PROMPT verbatim>
```

## What the agent should read

- [AGENTS.md](/AGENTS.md), the repository-level playbook.
- [The full agent reference](/llms-full.txt), every docs page in one file.
- [Try without a backend](/docs/chat/getting-started/try-without-a-backend), the human quickstart the prompt starts from.
```

In `docs-config.ts`, add `{ title: 'Coding agents', slug: 'coding-agents', section: 'getting-started' },` after the `Try without a backend` entry.

- [ ] **Step 4: Run and commit**

Run: `cd apps/website && npx vitest run src/lib/coding-agents-page.spec.ts src/lib/public-copy.spec.ts`
Expected: PASS.

```bash
git add apps/website/content/docs/chat/getting-started/coding-agents.mdx apps/website/src/lib/docs-config.ts apps/website/src/lib/coding-agents-page.spec.ts
git commit -m "docs(website): coding-agent setup prompt gets its own getting-started page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 8: Footer newsletter form hidden on the homepage

**Files:**
- Modify: `apps/website/src/components/shared/SiteFooter.tsx`, `apps/website/src/components/shared/Footer.tsx`
- Modify: `apps/website/src/components/shared/SiteFooter.spec.tsx`

- [ ] **Step 1: Write the failing test**

Append inside the SiteFooter `describe`:

```tsx
  it('hides the newsletter form on the homepage, whose field report form is the one form', () => {
    pathname.current = '/';
    render(<SiteFooter formPolicy={formPolicy} />);
    expect(screen.queryByRole('button', { name: /subscribe/i })).toBeNull();
    expect(screen.queryByText(formPolicy.disclosures.newsletter)).toBeNull();
    expect(document.querySelector('footer')).not.toBeNull();
  });
```

The existing test `'hands the server-owned policy through to the footer newsletter form'` must set `pathname.current = '/pricing'` (or any non-home route) before rendering; check what the spec's `pathname` helper defaults to and set it explicitly.

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/website && npx vitest run src/components/shared/SiteFooter.spec.tsx`
Expected: the new case FAILS (subscribe button present).

- [ ] **Step 3: Implement**

`Footer.tsx`: add a prop `showNewsletter?: boolean` (default `true`) to `Footer` and render `{showNewsletter ? <NewsletterForm formPolicy={formPolicy} /> : null}`.

`SiteFooter.tsx`:

```tsx
export function SiteFooter({ formPolicy }: { formPolicy: PublicFormPolicy }) {
  const pathname = usePathname();
  if (pathname === '/docs' || pathname?.startsWith('/docs/')) return null;
  // The homepage carries the field report form; a second capture in the
  // footer is the duplication the live-stage spec removes (§3, block 6).
  return <Footer formPolicy={formPolicy} showNewsletter={pathname !== '/'} />;
}
```

- [ ] **Step 4: Run and commit**

Run: `cd apps/website && npx vitest run src/components/shared/SiteFooter.spec.tsx`
Expected: all PASS.

```bash
git add apps/website/src/components/shared/SiteFooter.tsx apps/website/src/components/shared/Footer.tsx apps/website/src/components/shared/SiteFooter.spec.tsx
git commit -m "feat(website): the footer newsletter form steps aside on the homepage

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 9: The new composition, the deletions, and the e2e

**Files:**
- Modify: `apps/website/src/app/page.tsx`
- Delete: `ProofStrip.tsx`, `ProofStrip.spec.tsx`, `LogoRibbon.tsx`, `LogoRibbon.spec.tsx`, `RuntimeParity.tsx`, `RuntimeParityToggle.tsx`, `RuntimeParityToggle.spec.tsx`, `ThreeSteps.tsx`, `DemoShowcase.tsx`, `DemoShowcase.spec.tsx`, `CodingAgentQuickstart.tsx`, `CodingAgentQuickstart.spec.tsx`, `PilotBlock.tsx`
- Modify: `apps/website/src/lib/positioning.ts` (`PARITY_SNIPPETS`), `apps/website/src/lib/section-media.ts` if only the removed sections used a key
- Modify: `apps/website/e2e/website.spec.ts`, `apps/website/e2e/demo-modal.spec.ts`

- [ ] **Step 1: Update the e2e first (it is the failing test for this task)**

In `website.spec.ts`:

Replace the feature-blocks test with:

```ts
test('landing page renders the spine in order (live-stage spec §3)', async ({ page }) => {
  await page.goto('/');
  const ids = ['hero-heading', 'proof-heading', 'why-heading', 'stream-heading', 'persist-heading', 'approve-heading', 'render-heading', 'final-cta-heading', 'pilot-heading', 'faq-heading'];
  const tops: number[] = [];
  for (const id of ids) {
    const el = page.locator(`#${id}`);
    await expect(el).toBeAttached();
    tops.push((await el.boundingBox())?.y ?? -1);
  }
  expect([...tops].sort((a, b) => a - b)).toEqual(tops);
  await expect(page.locator('#test-heading')).toHaveCount(0);
  await expect(page.locator('#parity-heading')).toHaveCount(0);
  await expect(page.locator('#how-it-works-heading')).toHaveCount(0);
  await expect(page.locator('#coding-agent-heading')).toHaveCount(0);
  await expect(page.locator('#whitepaper-block')).toHaveCount(0);
  await expect(page.locator('main form')).toHaveCount(1);
});
```

In the footer newsletter e2e (the block that fills `footer.getByLabel('Email')`), change `await page.goto('/')` to `await page.goto('/pricing')`.

In `demo-modal.spec.ts`, change both `page.goto('/')` to `page.goto('/langgraph')` (the library pages render `FinalCTA` with its default `DemoCtaPair`, which opens the same dialog). Confirm with `grep -n "FinalCTA" apps/website/src/app/langgraph/page.tsx`; if that page passes a `primary`, use `/chat` or `/render` instead, whichever renders the default pair.

- [ ] **Step 2: Rewrite `page.tsx`**

Replace the imports and body so the JSX reads:

```tsx
import { Hero } from '../components/landing/Hero';
import { Reliability } from '../components/landing/Reliability';
import { ScopeTable } from '../components/landing/ScopeTable';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { MediumSwitcher } from '../components/landing/MediumSwitcher';
import { SECTION_MEDIA } from '../lib/section-media';
import { buildPanes } from '../lib/build-panes';
import { TeamsBlock } from '../components/landing/TeamsBlock';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { PROVE_IT_ROWS } from '../lib/positioning';
import { createPageMetadata, HERO_SECONDARY_HREF, HOME_DESCRIPTION, HOME_TITLE, INSTALL_OPTIONS } from '../lib/site-metadata';
import { getFormPolicy } from '../lib/growth/form-policy';

export const metadata = createPageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, pathname: '/', type: 'website' });

export default async function HomePage() {
  const formPolicy = getFormPolicy();
  const [streamPanes, persistPanes, approvePanes, renderPanes] = await Promise.all(
    (['stream', 'persist', 'approve', 'render'] as const).map((key) =>
      buildPanes(SECTION_MEDIA[key], SECTION_MEDIA[key].video?.url ?? ''),
    ),
  );

  return (
    <>
      <Hero />
      <Reliability />
      <ScopeTable />

      {/* The four capability acts stay as FeatureBlocks until plan 3 replaces
          them with the live stage (spec §4). */}
      <FeatureBlock id="stream" ... unchanged ... />
      <FeatureBlock id="persist" ... unchanged ... />
      <FeatureBlock id="approve" ... unchanged ... />
      <FeatureBlock id="render" ... unchanged ... />

      <FinalCTA
        variant="dark"
        rows={PROVE_IT_ROWS}
        headline="Prove the Angular UI before you connect the backend."
        subtext="Start with a fake agent, render a real Threadplane surface, then swap in LangGraph or AG-UI when the integration is ready."
        primary={{ label: 'Start the quickstart', href: INSTALL_OPTIONS[0].quickstartHref, ctaId: 'hero_quickstart' }}
        secondary={{ label: 'Run live examples', href: HERO_SECONDARY_HREF, ctaId: 'hero_live_demo' }}
        caption="MIT · no account, no cloud"
        captionLink={{ label: 'Talk to an engineer', href: '/contact' }}
        captionLinks={[{ label: 'Setup prompt for coding agents', href: '/docs/chat/getting-started/coding-agents' }]}
      />
      <TeamsBlock formPolicy={formPolicy} />
      <HomeFAQ />
      <RecentArticles />
    </>
  );
}
```

Keep the four `FeatureBlock` elements exactly as they are today (copy them from the current file); only the Test block goes. If `PROVE_IT_ROWS`'s readonly tuple type does not satisfy `rows`, widen the prop to `readonly { readonly claim: string; readonly api: string }[]`.

- [ ] **Step 3: Delete the retired components and their dead data**

```bash
cd apps/website/src/components/landing && git rm -q ProofStrip.tsx ProofStrip.spec.tsx LogoRibbon.tsx LogoRibbon.spec.tsx RuntimeParity.tsx RuntimeParityToggle.tsx RuntimeParityToggle.spec.tsx ThreeSteps.tsx DemoShowcase.tsx DemoShowcase.spec.tsx CodingAgentQuickstart.tsx CodingAgentQuickstart.spec.tsx PilotBlock.tsx
```

Then `grep -rn "PARITY_SNIPPETS\|AdapterGuideLink\|DemoShowcase\|LogoRibbon\|ProofStrip\|PilotBlock\|ThreeSteps\|RuntimeParity\|CodingAgentQuickstart" apps/website/src apps/website/e2e`. Remove `PARITY_SNIPPETS` from `positioning.ts` if nothing else imports it (and its assertion in `positioning.spec.ts` if one exists). `AdapterGuideLink` stays if a docs or solutions page uses it; otherwise delete it and its spec. `SECTION_MEDIA.test` stays (the solutions pages and `section-media.spec.ts` read it). Leave `home_runtime_parity_toggle`, `home_demo`, `home_coding_agent_*` in the analytics unions; retired ids are harmless and the events pipeline may still receive late clients.

- [ ] **Step 4: Typecheck, unit suite, lint**

```bash
npx nx test website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "×|Test Files|Tests |failed"
npx nx lint website 2>&1 | sed 's/\x1b\[[0-9;]*m//g' | grep -E "problems|error  "
```

Expected: all tests pass; zero lint errors. Common failures and their fixes: `section-media.spec.ts` cross-checks featured ids against the demo (unchanged, should pass); `public-copy.spec.ts` "actually walks the component tree" still finds `HomeFAQ.tsx`; `cockpit-retirement.spec.ts` scans the tree (run from the repo root).

- [ ] **Step 5: Build and e2e**

```bash
rm -rf apps/website/.next && npx nx build website 2>&1 | tail -5
npx playwright test -c apps/website/e2e/playwright.config.ts website.spec.ts demo-modal.spec.ts home-hero.spec.ts public-copy.spec.ts
```

Expected: build succeeds; the four specs pass. If `public-copy.spec.ts` (the production crawl) needs a running server, follow its header comment for the local invocation.

- [ ] **Step 6: Look at it**

Start the site (`npx nx serve website` or the `.claude/launch.json` entry if one exists) and open `/`. Check: the dark Reliability band shows four cells, three receipts and the works-with line; the final-mile heading sits directly under it; the final CTA carries the three rows; the teams block shows one form; the footer has no subscribe box on `/` but does on `/pricing`. Screenshot at 1280 and 390 widths.

- [ ] **Step 7: Commit**

```bash
git add -A apps/website
git commit -m "feat(website): homepage restructure — eight-block spine, Reliability merged, final mile promoted, one install moment, one form, four FAQs

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

---

### Task 10: PR

- [ ] **Step 1: Push and open**

```bash
git push -u origin blove/homepage-restructure
gh pr create --title "feat(website): homepage restructure (live-stage plan 1 of 3)" --body-file - <<'EOF'
## Why

Twenty blocks, no argument, the same claims repeated up to five times, the reliability proof a strip, the final-mile argument fourteenth. Spec: `docs/superpowers/specs/2026-09-05-homepage-live-stage-design.md` §3; this is plan 1 of 3 (`docs/superpowers/plans/2026-09-05-homepage-restructure.md`).

## What

- Reliability: proof strip + works-with ribbon merged into one dark band with three sourced receipts (provenance, three runtimes, no content telemetry) and an adapter link.
- The final mile: the scope table promoted to third with the launch narrative's line as its heading.
- One install moment: the Test section's rows fold into the final CTA.
- One form: pilot + field report merged into `TeamsBlock`; the footer newsletter form hides on `/`.
- FAQ trimmed to four; the eight moved answers now live on the docs pages they point at.
- The coding-agent prompt has its own docs page, linked from the final CTA caption.
- Removed from the homepage: runtime parity, three steps, "See it running", coding-agent quickstart, the Test act.

The four capability FeatureBlocks stay until plan 3 replaces them with the live stage.

## Tests

Unit: new specs for Reliability, ScopeTable, TeamsBlock, HomeFAQ, the coding-agents page, FinalCTA rows/caption links, SiteFooter home gating; positioning copy pinned; public-copy scans green. e2e: spine order and absence of retired sections, footer form on `/pricing`, demo modal from `/langgraph`.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

---

## Self-review

**Spec coverage (§3):** block 1 unchanged; block 2 → Task 2; block 3 → Task 3; block 4 deferred to plan 3 by design, with the FeatureBlocks kept (Task 9 comment); block 5 → Tasks 1, 4, 9; block 6 → Tasks 5, 8; block 7 → Task 6; block 8 unchanged. Removals → Task 9. The coding-agent move → Task 7. "Choose an adapter" link → Task 2. No new analytics events (§9 says none for this plan).

**Deviation from the spec, stated:** the footer newsletter form is hidden on `/` only, not removed site-wide. The footer is mounted from the root layout, so removing the form outright would drop the newsletter capture on every page, which §3 did not intend.

**Placeholders:** the `<CODING_AGENT_PROMPT verbatim>` marker in Task 7 is an instruction to paste the constant's text, and the spec asserts byte equality, so it cannot ship as a placeholder. The `... unchanged ...` in Task 9's JSX refers to copying the existing FeatureBlock elements, which the step says explicitly.

**Type consistency:** `RELIABILITY_RECEIPTS` fields (`claim`, `detail`, `sourceLabel`, `sourceHref`) match between Task 1 and Task 2; `PROVE_IT_ROWS` (`claim`, `api`) matches `FinalCTA.rows`; `WhitePaperForm` props (`paper`, `formPolicy`, `surface`, `sourceSection`, `idPrefix`) match both call sites; `TeamsBlock` takes `formPolicy` and `page.tsx` passes it.
