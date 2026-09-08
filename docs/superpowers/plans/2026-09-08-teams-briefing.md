# Teams Briefing Block Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the homepage "For teams" section so the field-report form sits near the top beside a preview of the actual document, with contact demoted to a link — and correct the two false claims the section makes about that document.

**Architecture:** The document's facts (page count, six chapter titles, cover strings) move into one data module read by both the eyebrow and a new `FieldReportCover` component, so the page cannot describe the PDF differently from what the PDF is. A test asserts the declared page count against the PDF bytes. `TeamsBlock` loses the duplicated pilot timeline and outcome rows and becomes a two-column ask-plus-artifact.

**Tech Stack:** Next.js 15 App Router, React, plain CSS in `apps/website/src/styles/landing.css`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-teams-briefing-design.md`

---

## Background an engineer needs before starting

**Run the commands CI runs**: `npx nx test website`, `npx nx lint website`, `npx nx build website`. NOT `npx vitest run --root apps/website` — the nx executor is what CI uses and it swallows reporter output on a hard failure, so when it goes red run vitest directly alongside it to read the failure, then trust nx for the verdict. `nx test` does **not** type-check; `nx build` does.

**Free the ports before `nx e2e`.** Two separate e2e failures on the previous change were port 4308 held by an orphaned server and the Browser pane's dev server holding `apps/website/.next/dev/lock` — neither was a test defect. Run `lsof -ti:3000,4308 | xargs kill -9` and stop any preview server first.

**Facts about the PDF, already verified — do not re-derive, and do not "correct" them:**

- `apps/website/public/whitepaper.pdf` is **17 pages**. Both `pdfinfo` and counting `/Type /Page` objects agree. The site currently claims 18 in three places.
- The six chapters are **Streaming State Management, Thread Persistence, Tool-Call Rendering, Human Approval Flows, Generative UI, Deterministic Testing**.
- The cover reads `THREADPLANE · OPEN SOURCE · ANGULAR`, then *"Production-ready chat, threads, and generative UI for AI agents"*, then `threadplane.ai · 2026`.
- The strings the site currently advertises — "Error boundaries, fallbacks, observability" — return **zero** matches in the document.

**`.pilot-eyebrow` is shared with `/pilot-to-prod`.** Every other `.pilot-*` class belongs to `TeamsBlock` alone and can go. Deleting `.pilot-eyebrow` would break another page.

**Do not touch:** the section's `id="teams"`, its `tinted` surface, its position in `page.tsx`, `WhitePaperForm` itself, or the analytics keys `home_whitepaper`, `teams-block`, `hero_talk_to_engineers`.

**`WhitePaperForm` already renders its own disclosure and an "Already on the list?" direct-download link.** Do not add fine print of your own beneath the form.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/website/src/lib/field-report.ts` | The document's facts, single source | **Create** |
| `apps/website/src/lib/field-report.spec.ts` | Asserts the page count against the PDF | **Create** |
| `apps/website/src/components/landing/FieldReportCover.tsx` | The briefing preview | **Create** |
| `apps/website/src/components/landing/FieldReportCover.spec.tsx` | Cover render guards | **Create** |
| `apps/website/src/components/landing/TeamsBlock.tsx` | The section | Rewritten body |
| `apps/website/src/components/landing/TeamsBlock.spec.tsx` | Section guards | Rewritten |
| `apps/website/src/components/landing/WhitePaperBlock.tsx` | Library-page block | Copy corrections only |
| `apps/website/src/styles/landing.css` | Styles | New rules in, `.pilot-*`/`.teams-report-*` out |
| `apps/website/e2e/website.spec.ts:57` | Homepage spine | One id renamed |

---

## Task 1: The document's facts

**Files:**
- Create: `apps/website/src/lib/field-report.ts`
- Create: `apps/website/src/lib/field-report.spec.ts`

- [ ] **Step 1: Write the failing spec**

Create `apps/website/src/lib/field-report.spec.ts`:

```ts
import { readFileSync } from 'node:fs';
import { describe, it, expect } from 'vitest';
import { FIELD_REPORT } from './field-report';

describe('FIELD_REPORT', () => {
  it('declares the page count the PDF actually has', () => {
    // The homepage advertised "18 pages" for a 17-page document, in exchange
    // for an email address. Counting the page objects in the file itself is
    // dependency-free and means regenerating the PDF at a different length
    // fails here instead of silently making the page lie.
    const pdf = readFileSync('public/whitepaper.pdf', 'latin1');
    const pages = (pdf.match(/\/Type\s*\/Page[^s]/g) || []).length;
    expect(pages).toBeGreaterThan(0);
    expect(FIELD_REPORT.pages).toBe(pages);
  });

  it('lists the six chapters the document actually contains', () => {
    // Not machine-checkable: the text lives in compressed streams. Verify by
    // hand with the command in the module's docblock when the PDF changes.
    expect(FIELD_REPORT.chapters).toEqual([
      'Streaming State Management',
      'Thread Persistence',
      'Tool-Call Rendering',
      'Human Approval Flows',
      'Generative UI',
      'Deterministic Testing',
    ]);
  });

  it('carries the cover strings the document prints', () => {
    expect(FIELD_REPORT.title).toBe('From Prototype to Production');
    expect(FIELD_REPORT.kicker).toBe('Threadplane · Open source · Angular');
    expect(FIELD_REPORT.subtitle).toBeTruthy();
    expect(FIELD_REPORT.year).toBe('2026');
  });
});
```

**Correction, found during execution:** the path above does not resolve. `readFileSync` anchors to `process.cwd()`, which is the **repo root** under both `nx test` and `vitest --root apps/website`; and `import.meta.url` is no help either, because jsdom makes it an `http:` URL. Anchor to the workspace root by walking up to `nx.json`, the way `cockpit-docs-links.spec.ts` in the same directory already does. The shipped spec has the working version.

- [ ] **Step 2: Run it and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `./field-report` does not exist.

- [ ] **Step 3: Create the module**

Create `apps/website/src/lib/field-report.ts`:

```ts
/**
 * The field report's own facts, in one place.
 *
 * These exist as data because the site got them wrong: it advertised "18
 * pages" for a 17-page document, and described the contents as "Error
 * boundaries, fallbacks, observability, deploy" — three phrases that return
 * zero matches in the file. Anything the site says about the document now
 * reads from here, and `field-report.spec.ts` pins the page count to the PDF
 * itself.
 *
 * To re-verify after regenerating the PDF:
 *
 *     pdftotext -f 1 -l 2 apps/website/public/whitepaper.pdf - | sed -n '1,40p'
 */
export const FIELD_REPORT = {
  /** Printed on the cover. */
  title: 'From Prototype to Production',
  /** The cover's header rule. */
  kicker: 'Threadplane · Open source · Angular',
  /** The cover's standfirst, verbatim. */
  subtitle: 'Production-ready chat, threads, and generative UI for AI agents.',
  /** The cover's date line. */
  year: '2026',
  /** Verified against the file, and asserted against it in the spec. */
  pages: 17,
  /** The table of contents, in document order. */
  chapters: [
    'Streaming State Management',
    'Thread Persistence',
    'Tool-Call Rendering',
    'Human Approval Flows',
    'Generative UI',
    'Deterministic Testing',
  ],
} as const;
```

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: PASS, 3 new tests.

- [ ] **Step 5: Mutation-test the page guard**

The guard is the point of this task, so prove it bites. Temporarily change `pages: 17` to `pages: 18` and run:

```bash
npx vitest run --root apps/website src/lib/field-report.spec.ts
```

Expected: FAIL with `expected 18 to be 17`. **Restore `17`** and confirm green before committing.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/field-report.ts apps/website/src/lib/field-report.spec.ts
git commit -m "feat(website): the field report's facts, pinned to the PDF

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: The briefing preview

**Files:**
- Create: `apps/website/src/components/landing/FieldReportCover.tsx`
- Create: `apps/website/src/components/landing/FieldReportCover.spec.tsx`

- [ ] **Step 1: Write the failing spec**

Create `apps/website/src/components/landing/FieldReportCover.spec.tsx`:

```tsx
// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FieldReportCover } from './FieldReportCover';
import { FIELD_REPORT } from '../../lib/field-report';

describe('FieldReportCover', () => {
  it('shows every chapter, in order', () => {
    const { container } = render(<FieldReportCover />);
    const items = Array.from(container.querySelectorAll('.field-report-toc li'));
    expect(items.map((li) => li.textContent?.replace(/^\d+/, '').trim())).toEqual([
      ...FIELD_REPORT.chapters,
    ]);
  });

  it('is readable rather than decorative', () => {
    // The old .wp-cover-wrap is aria-hidden because it is artwork. This one
    // carries the table of contents, which is the reason to download — hiding
    // it would withhold the substance from screen reader users.
    const { container } = render(<FieldReportCover />);
    expect(container.querySelector('[aria-hidden="true"].field-report-paper')).toBeNull();
    expect(screen.getByRole('heading', { level: 3 }).textContent).toBe(FIELD_REPORT.title);
    expect(container.querySelector('ol.field-report-toc')).toBeTruthy();
  });

  it('does not read the numbers twice', () => {
    // The <ol> already numbers the list for assistive tech; the drawn 01/02
    // markers are visual duplicates and must be hidden.
    const { container } = render(<FieldReportCover />);
    const nums = Array.from(container.querySelectorAll('.field-report-num'));
    expect(nums).toHaveLength(FIELD_REPORT.chapters.length);
    for (const n of nums) expect(n.getAttribute('aria-hidden')).toBe('true');
  });

  it('borrows the library pages’ paper styling', () => {
    // Same object the four library pages already show, so it is not a second
    // visual language for the same artifact.
    const { container } = render(<FieldReportCover />);
    expect(container.querySelector('.wp-paper.field-report-paper')).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `./FieldReportCover` does not exist.

- [ ] **Step 3: Create the component**

Create `apps/website/src/components/landing/FieldReportCover.tsx`:

```tsx
import { FIELD_REPORT } from '../../lib/field-report';

/**
 * The field report rendered as the object it is, contents included.
 *
 * It reuses `.wp-paper` — the tilted card the library pages already show —
 * so the same artifact does not get two visual languages, and adds its own
 * classes for the content the library version does not have.
 *
 * Deliberately NOT aria-hidden. The library page's cover is artwork and hides
 * itself; this one prints the table of contents, which is the reason anyone
 * gives up an email address for it.
 */
export function FieldReportCover() {
  return (
    <div className="field-report-cover">
      <div className="wp-paper field-report-paper">
        <div>
          <p className="field-report-kicker">{FIELD_REPORT.kicker}</p>
          <h3 className="field-report-title">{FIELD_REPORT.title}</h3>
          <p className="field-report-sub">{FIELD_REPORT.subtitle}</p>
          <p className="field-report-toc-label">Contents</p>
          <ol className="field-report-toc">
            {FIELD_REPORT.chapters.map((chapter, i) => (
              <li key={chapter}>
                <span className="field-report-num" aria-hidden="true">
                  {String(i + 1).padStart(2, '0')}
                </span>
                {chapter}
              </li>
            ))}
          </ol>
        </div>
        <p className="field-report-foot">
          <span>threadplane.ai</span>
          <span>{FIELD_REPORT.year}</span>
        </p>
      </div>
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
git add apps/website/src/components/landing/FieldReportCover.tsx apps/website/src/components/landing/FieldReportCover.spec.tsx
git commit -m "feat(website): the briefing preview shows the real contents

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The section

**Files:**
- Modify: `apps/website/src/components/landing/TeamsBlock.tsx`
- Modify: `apps/website/src/components/landing/TeamsBlock.spec.tsx`

- [ ] **Step 1: Replace the spec**

Replace the whole `describe('TeamsBlock')` body in `TeamsBlock.spec.tsx` (keep the file's existing imports, the `vi.mock`, and the `formPolicy` fixture exactly as they are, and add `FIELD_REPORT` to the imports):

```tsx
describe('TeamsBlock', () => {
  it('leads with the ask: eyebrow, heading, then the form', () => {
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    const heading = screen.getByRole('heading', { level: 2 });
    expect(heading.textContent).toBe('What breaks between a demo and production.');
    expect(heading.id).toBe('field-report-heading');
    expect(container.querySelectorAll('form')).toHaveLength(1);
    expect(screen.getByLabelText('Work email')).toBeTruthy();
    expect(screen.getByText(formPolicy.disclosures.whitepaper)).toBeTruthy();
  });

  it('derives the page count rather than typing it', () => {
    // The section claimed "18 pages" for a 17-page document. Reading it from
    // FIELD_REPORT means the guard against the PDF covers this string too.
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    const eyebrow = container.querySelector('[data-ui="eyebrow"]');
    expect(eyebrow?.textContent).toContain(`${FIELD_REPORT.pages} pages`);
    expect(eyebrow?.textContent).toContain('Preflight briefing');
  });

  it('shows the briefing beside the ask', () => {
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    expect(container.querySelector('.field-report-paper')).toBeTruthy();
  });

  it('makes contact the secondary ask, not a rival button', () => {
    // Two same-weight buttons is what stopped the old section saying which
    // ask mattered. The arrow is decorative so the accessible name stays clean.
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    const link = screen.getByRole('link', { name: 'Talk to an engineer' });
    expect(link.getAttribute('href')).toBe('/contact?source=home_enterprise&track=enterprise');
    expect(link.getAttribute('data-ui')).not.toBe('button');
    // Exactly one button in the whole section, and it belongs to the form.
    // (SubmitButton wraps Button, so the form's submit carries data-ui too.)
    const buttons = container.querySelectorAll('[data-ui="button"]');
    expect(buttons).toHaveLength(1);
    expect(buttons[0].closest('form')).toBeTruthy();
  });

  it('no longer repeats the pilot programme the dedicated page owns', () => {
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    expect(container.querySelectorAll('.pilot-step')).toHaveLength(0);
    expect(container.querySelectorAll('.pilot-row')).toHaveLength(0);
    expect(screen.queryByRole('link', { name: 'See the pilot program' })).toBeNull();
  });

  it('never advertises topics the document does not contain', () => {
    // "Error boundaries", "fallbacks" and "observability" each return zero
    // matches in whitepaper.pdf. They were on this page for months.
    const { container } = render(<TeamsBlock formPolicy={formPolicy} />);
    const text = container.textContent ?? '';
    for (const phrase of ['Error boundaries', 'fallbacks', 'observability', '18 pages']) {
      expect(text).not.toContain(phrase);
    }
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — the heading is still "Shipping inside a large Angular platform?" with id `pilot-heading`.

- [ ] **Step 3: Rewrite the component**

Replace the whole of `TeamsBlock.tsx` with:

```tsx
'use client';

import type { PublicFormPolicy } from '../../lib/growth/form-policy';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { trackCtaClick } from '../../lib/analytics/client';
import { WhitePaperForm } from './WhitePaperForm';
import { FieldReportCover } from './FieldReportCover';
import { FIELD_REPORT } from '../../lib/field-report';

/**
 * For teams: the field report is the ask, contact is the follow-up.
 *
 * The previous version inverted its own goals — the form sat at y=618 in a
 * 916px section, below a four-step pilot timeline that `/pilot-to-prod`
 * already covers in full, while a same-weight amber button sent people to
 * contact instead. The timeline and the outcome rows are gone, the form sits
 * beside a preview of the actual document, and contact is a link.
 *
 * Everything the section says about the report reads from FIELD_REPORT, which
 * is pinned to the PDF — this block previously advertised a page count and a
 * contents list that the file did not match.
 */
export function TeamsBlock({ formPolicy }: { formPolicy: PublicFormPolicy }) {
  return (
    <Section surface="tinted" id="teams" ariaLabelledBy="field-report-heading">
      <Container>
        <div className="teams-grid">
          <div>
            <Eyebrow tone="accent" className="teams-eyebrow">
              Preflight briefing
              <span className="teams-eyebrow-meta">
                {' '}· {FIELD_REPORT.pages} pages · free
              </span>
            </Eyebrow>
            <h2 id="field-report-heading" className="teams-heading">
              What breaks between a demo and production.
            </h2>
            <WhitePaperForm
              paper="overview"
              formPolicy={formPolicy}
              surface="home_whitepaper"
              sourceSection="teams-block"
              idPrefix="teams-wp"
            />
          </div>
          <FieldReportCover />
        </div>

        <div className="teams-contact">
          <p className="teams-contact-copy">
            Shipping inside a large Angular platform? Bring your backend, security
            model, and design system.
          </p>
          <a
            className="teams-contact-link"
            href="/contact?source=home_enterprise&track=enterprise"
            onClick={() =>
              trackCtaClick({
                cta_id: 'hero_talk_to_engineers',
                track: 'enterprise',
                surface: 'home',
              })
            }
          >
            Talk to an engineer <span aria-hidden="true">→</span>
          </a>
        </div>
      </Container>
    </Section>
  );
}
```

The `TIMELINE` and `OUTCOMES` consts are deleted with the old body.

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Update the e2e spine**

In `apps/website/e2e/website.spec.ts:57`, change `'pilot-heading',` to `'field-report-heading',`. **This is the only test edit this change makes** — the spine catches accidental removals, and this rename is deliberate.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/TeamsBlock.tsx apps/website/src/components/landing/TeamsBlock.spec.tsx apps/website/e2e/website.spec.ts
git commit -m "feat(website): For teams leads with the briefing, not the pilot timeline

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: The same false claims on the library pages

**Files:**
- Modify: `apps/website/src/components/landing/WhitePaperBlock.tsx:7-11,57`

`WhitePaperBlock` is used by the four library pages and repeats both errors. Correcting only the homepage would knowingly leave them live.

- [ ] **Step 1: Fix the rows and the badge**

Add the import:

```tsx
import { FIELD_REPORT } from '../../lib/field-report';
```

Replace `ROWS` with:

```tsx
const ROWS = [
  { claim: 'Six production-readiness dimensions', tail: `${FIELD_REPORT.pages} pages` },
  // Was "Error boundaries, fallbacks, observability, deploy" — three phrases
  // with zero matches in whitepaper.pdf. These are the document's actual
  // chapters.
  { claim: 'Streaming, persistence, tool calls, approvals, generative UI, testing', tail: 'the six chapters' },
  { claim: 'No vendor pitch — what we learned shipping it', tail: 'free' },
];
```

and the cover badge (line 57) with:

```tsx
                <div className="wp-cover-badge">Field report · {FIELD_REPORT.pages} pages</div>
```

Leave the third row alone. Its wording is questioned in spec §9 and is the owner's call, not a copy edit.

- [ ] **Step 2: Test, lint, build**

```bash
npx nx test website && npx nx lint website && npx nx build website
```

Expected: all pass, 0 lint errors. `WhitePaperBlock.spec.tsx` does not assert any of the changed strings, so it needs no edit.

- [ ] **Step 3: Confirm the claims are gone site-wide**

```bash
grep -rn "18 pages\|Error boundaries, fallbacks" apps/website/src || echo "clean"
```

Expected: `clean`

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/WhitePaperBlock.tsx
git commit -m "fix(website): the library pages described a document we do not send

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 5: The styles

**Files:**
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Add the new rules**

Append to `landing.css`:

```css
/* For teams — components/landing/TeamsBlock.tsx.
 * Ask left, briefing right. The cover is a fixed 400px so the form column
 * keeps a comfortable measure rather than stretching across the section. */
.teams-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 400px;
  gap: 64px;
  align-items: center;
}
.teams-eyebrow {
  margin-bottom: 18px;
}
.teams-eyebrow-meta {
  color: var(--color-text-muted);
}
.teams-heading {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(36px, 4.2vw, 54px);
  line-height: 1.02;
  letter-spacing: -0.03em;
  color: var(--color-text-primary);
  margin: 0 0 30px;
  max-width: 16ch;
}
.teams-contact {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: 14px;
  margin-top: 40px;
  padding-top: 24px;
  border-top: 1px solid var(--color-border);
}
.teams-contact-copy {
  margin: 0;
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.teams-contact-link {
  font-size: 15px;
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: none;
  white-space: nowrap;
}
.teams-contact-link:hover {
  text-decoration: underline;
}

/* The briefing preview — components/landing/FieldReportCover.tsx.
 * .wp-paper supplies the tilt, border and shadow; these rules only style the
 * content the library pages' version does not carry. */
.field-report-cover {
  display: flex;
  justify-content: center;
  min-width: 0;
}
.field-report-paper {
  width: 100%;
  max-width: 390px;
}
.field-report-kicker {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 14px;
  padding-bottom: 14px;
  border-bottom: 1px solid var(--color-border);
}
.field-report-title {
  font-family: var(--font-display);
  font-weight: 400;
  font-size: 25px;
  line-height: 1.1;
  letter-spacing: -0.02em;
  color: var(--color-text-primary);
  margin: 0 0 6px;
}
.field-report-sub {
  font-size: 12.5px;
  line-height: 1.5;
  color: var(--color-text-secondary);
  margin: 0 0 20px;
}
.field-report-toc-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 10px;
}
.field-report-toc {
  list-style: none;
  margin: 0;
  padding: 0;
}
.field-report-toc li {
  display: flex;
  align-items: baseline;
  gap: 10px;
  padding: 6px 0;
  font-size: 12.5px;
  color: var(--color-text-primary);
}
.field-report-toc li + li {
  border-top: 1px dotted var(--color-border);
}
.field-report-num {
  flex: 0 0 auto;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  color: var(--color-signal);
}
.field-report-foot {
  display: flex;
  justify-content: space-between;
  font-family: var(--font-mono);
  font-size: 9.5px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  border-top: 1px solid var(--color-border);
  padding-top: 12px;
  margin: 20px 0 0;
}
@media (max-width: 900px) {
  .teams-grid {
    /* minmax(0,…) not 1fr: a bare 1fr keeps an auto minimum, and the cover
       would push the stacked column past the viewport. */
    grid-template-columns: minmax(0, 1fr);
    gap: 44px;
  }
  .field-report-cover {
    justify-content: flex-start;
  }
}
```

- [ ] **Step 2: Remove what the section no longer renders**

Delete these rules from `landing.css`: `.pilot-block-grid`, `.pilot-rail`, `.pilot-rail-line`, `.pilot-heading`, `.pilot-subhead`, `.pilot-cta-row`, `.pilot-rows`, `.pilot-row`, `.pilot-row-claim`, `.pilot-row-tail`, `.pilot-steps`, `.pilot-step`, `.pilot-step:last-child`, `.pilot-step-num`, `.pilot-step-title`, `.pilot-step-body`, `.teams-block-grid`, `.teams-aside`, `.teams-report`, `.teams-report-badge`, `.teams-report-title`, `.teams-report-desc`, plus any `@media` rule that only adjusts one of them.

**Keep `.pilot-eyebrow`** — `/pilot-to-prod` uses it. Keep every `.wp-*` rule.

Before deleting each one, confirm it is unused:

```bash
for c in pilot-block-grid pilot-rail pilot-rail-line pilot-heading pilot-subhead pilot-cta-row pilot-rows pilot-row pilot-row-claim pilot-row-tail pilot-steps pilot-step pilot-step-num pilot-step-title pilot-step-body teams-block-grid teams-aside teams-report teams-report-badge teams-report-title teams-report-desc; do
  hits=$(grep -rl "\b$c\b" apps/website/src --include='*.tsx' | grep -v '\.spec\.' | wc -l | tr -d ' ')
  [ "$hits" != "0" ] && echo "STILL USED: $c"
done; echo "check complete"
```

Expected: `check complete` with no `STILL USED` lines.

- [ ] **Step 3: Test, lint, build**

```bash
npx nx test website && npx nx lint website && npx nx build website
```

Expected: all pass, 0 lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/landing.css
git commit -m "feat(website): briefing block styles in, pilot timeline styles out

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 6: Verification

- [ ] **Step 1: The CI commands**

```bash
npx nx test website
npx nx lint website
npx nx build website
```

All pass; 0 lint errors.

- [ ] **Step 2: e2e**

```bash
lsof -ti:3000,4308 | xargs kill -9 2>/dev/null
npx nx e2e website
```

Stop any Browser pane preview server first — it holds `apps/website/.next/dev/lock` and the run will fail to start a web server. The spine test must pass with `field-report-heading`; everything else must pass unchanged.

- [ ] **Step 3: Measure the thing the redesign was for**

Start the dev server through the Browser pane (`website-dev`), restarting it if one is already running. At a 1440px viewport:

```javascript
const s = document.querySelector('#teams');
const top = scrollY + s.getBoundingClientRect().top;
const rel = (el) => Math.round(scrollY + el.getBoundingClientRect().top - top);
const form = s.querySelector('form');
const h = document.querySelector('#field-report-heading');
({ sectionH: Math.round(s.getBoundingClientRect().height),
   formTop: rel(form),
   headingLeft: Math.round(h.getBoundingClientRect().left),
   proofHeadingLeft: Math.round(document.querySelector('#proof-heading').getBoundingClientRect().left),
   chapters: s.querySelectorAll('.field-report-toc li').length,
   buttons: s.querySelectorAll('[data-ui="button"]').length,
   buttonsOutsideForm: [...s.querySelectorAll('[data-ui="button"]')].filter((b) => !b.closest('form')).length,
   pagesClaimed: s.querySelector('[data-ui="eyebrow"]').textContent.match(/(\d+) pages/)?.[1] })
```

Expected: `formTop` **under 320** (it was 618), `chapters` **6**, `buttons` **1** and `buttonsOutsideForm` **0** — the only button is the form's own submit — `pagesClaimed` **"17"**, and `headingLeft` equal to `proofHeadingLeft`.

- [ ] **Step 4: Check the phone**

Emulate 390px, reload, then:

```javascript
({ overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
   cols: getComputedStyle(document.querySelector('.teams-grid')).gridTemplateColumns })
```

Expected: `overflow` **false**, and `cols` a single track.

- [ ] **Step 5: Look at it**

Screenshot the section. Confirm the cover reads as a document rather than a card, the six chapters are legible at their 12.5px, and the form is the first thing the eye lands on.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): teams briefing verification pass

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Out of scope

- **`WhitePaperBlock`'s "No vendor pitch — what we learned shipping it."** Spec §9: the document's chapters were script-generated, which makes the line hard to defend, but rewriting it or rewriting the document is the owner's call.
- The section does not move in `page.tsx`, and `/pilot-to-prod` is untouched.
- No change to `WhitePaperForm`, the form policy, or any analytics key.
