# Reliability Scope Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the homepage's dark Reliability band into a legible scope band with a Vx/Vy frame and one pitch-ladder device, and move the works-with logos into their own light compatibility section.

**Architecture:** Almost every change is subtractive. The hero's navy strip moves to become the dark section's masthead so there is one navy moment instead of two. The website's `[data-surface="dark"]` scope re-points its surface tokens to the navy family. The proof cells lose all card chrome. The logo row leaves the section entirely for a new light `Compatibility` component — which is what makes the logos legible, since they are dark marks drawn for light grounds.

**Tech Stack:** Next.js 15 App Router, React, Tailwind v4 `@theme` tokens, plain CSS in `apps/website/src/styles/`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-reliability-scope-redesign-design.md`

---

## Background an engineer needs before starting

**Run the commands CI runs.** `npx nx test website` and `npx nx lint website` — NOT `npx vitest run --root apps/website`. They are not equivalent: the nx executor crashes on module-scope imports that vitest tolerates, and it swallows the output when it does, so a failure shows as a bare "target test failed" with no assertion. `nx test` also does not type-check; `npx nx build website` does.

**The colours.** `--color-signal` `#FFAF00` is a FILL, never text or an icon colour on a light ground (1.84:1 on white). `--color-ink` `#0A0A0A` goes on top of it (10.73:1). `--color-scope` `#15253E` is the interactive ink on light and the ground on dark.

**`Section` surfaces** live in `apps/website/src/components/ui/Section.tsx` as a union: `'canvas' | 'tinted' | 'white' | 'dark' | 'signal'`. The scopes that re-point `--color-*` per band are in `apps/website/src/styles/ui.css`.

**Two guards must stay green untouched.** `apps/website/e2e/website.spec.ts` asserts `#proof-heading` is visible and `#proof[data-surface="dark"]` exists. This design keeps the id, the heading text and the dark surface, so if that spec goes red something drifted that was not meant to.

**Checked already, so you do not have to:** `style-contracts.spec.ts` pins nothing on `.proof-strip-cell` or any `.reliability-*` class, so removing the card chrome breaks no style contract.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/website/src/components/landing/Hero.tsx` | Homepage hero | Loses the trust strip |
| `apps/website/src/components/landing/Hero.spec.tsx` | Hero guard | Trust-line assertion moves out |
| `apps/website/src/components/landing/Reliability.tsx` | The proof band | Gains the masthead + pitch ladder; loses the works-with row and the ribbon data |
| `apps/website/src/components/landing/Reliability.spec.tsx` | Proof-band guard | Works-with assertions leave; ordering indices shift |
| `apps/website/src/components/landing/Compatibility.tsx` | **New** — the grouped works-with section | Created |
| `apps/website/src/components/landing/Compatibility.spec.tsx` | **New** — its guard | Created |
| `apps/website/src/app/page.tsx` | Homepage composition | Mounts `<Compatibility />` between Reliability and EnterpriseArchitecture |
| `apps/website/src/styles/ui.css` | Surface scopes | Dark scope surface tokens go navy |
| `apps/website/src/styles/landing.css` | Landing styles | Masthead rename, card chrome removed, ladder + compatibility styles |

---

## Task 1: The strip becomes the masthead

The hero's navy strip and the dark section start 78px apart in the same colour. Moving the strip to the section's top edge makes the sequence yellow → strip → scope, contiguous.

The class is renamed from `.hero-strip` / `.hero-trust` to `.proof-masthead`: after the move a `hero-` prefix would lie about where the element lives. (`.hero-trust` already has no CSS rule — it was removed as dead in #1059 — but the class is still in the markup and `Hero.spec.tsx` queries it.)

**Files:**
- Modify: `apps/website/src/components/landing/Hero.tsx`
- Modify: `apps/website/src/components/landing/Reliability.tsx`
- Modify: `apps/website/src/styles/landing.css`
- Test: `apps/website/src/components/landing/Hero.spec.tsx`
- Test: `apps/website/src/components/landing/Reliability.spec.tsx`

- [ ] **Step 1: Move the assertion between the two specs**

In `Hero.spec.tsx`, delete this line:

```tsx
    expect(document.querySelector('.hero-trust')?.textContent).toBe(HERO_TRUST_LINE);
```

Then remove `HERO_TRUST_LINE` from that file's import list from `'../../lib/positioning'` if nothing else in the file uses it — check with a grep before deleting, since removing a still-used import is a compile error.

In `Reliability.spec.tsx`, add inside the top-level `describe`:

```tsx
  it('opens with the trust masthead, so the yellow block closes into the dark band', () => {
    const { container } = render(<Reliability />);
    const mast = container.querySelector('.proof-masthead');
    expect(mast?.textContent).toBe(HERO_TRUST_LINE);
    // It must be the section's first child: it is the seam between the hero's
    // yellow and this band, not a line floating inside the content.
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.firstElementChild).toBe(mast);
  });
```

Add `HERO_TRUST_LINE` to the existing `'../../lib/positioning'` import in `Reliability.spec.tsx`.

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `.proof-masthead` does not exist, so `mast?.textContent` is `undefined`.

- [ ] **Step 3: Remove the strip from the hero**

In `Hero.tsx`, delete this line entirely:

```tsx
          <p className="hero-trust hero-strip">{HERO_TRUST_LINE}</p>
```

Remove `HERO_TRUST_LINE` from its import from `'../../lib/positioning'`.

- [ ] **Step 4: Render it as the section's masthead**

In `Reliability.tsx`, add `HERO_TRUST_LINE` to the existing import from `'../../lib/positioning'`, then make it the first child of `<Section>`, before `<Container>`:

```tsx
    <Section surface="dark" id="proof" ariaLabelledBy="proof-heading">
      {/* The seam. The hero's yellow block ends, this marks the boundary, the
        * scope band begins — which is where the ATC app puts its frequency
        * bar. It lived inside the hero until 2026-09-08, where it read as a
        * stray navy bar 78px above a much larger band of the same colour. */}
      <p className="proof-masthead">{HERO_TRUST_LINE}</p>
      <Container>
```

- [ ] **Step 5: Move the CSS**

In `landing.css`, rename the `.hero-strip` rule to `.proof-masthead` and drop the full-bleed maths — it is now the first child of a full-width section, so it does not need to break out of a container:

```css
/* The seam between the yellow hero and the scope band. Full width by virtue of
 * sitting outside the Container, so no calc(50% - 50vw) breakout is needed. */
.proof-masthead {
  /* [data-ui="section"] sets padding-top: var(--spacing-section-y), so a first
   * child would otherwise sit BELOW that padding with a navy gap above it —
   * which defeats the whole point. Pull it back up to the section's top edge
   * so it is flush against the hero's yellow.
   *
   * The matching bottom margin is not symmetry for its own sake: a negative
   * margin-top on an in-flow first child drags every following sibling up too,
   * so without it the band loses its whole top padding and the eyebrow sits
   * flush against this bar. Give back exactly what the top pulled away.
   *
   * Both halves assume this Section is not `tight` — that variant swaps in
   * --spacing-section-y-tight and the cancellation would no longer balance. */
  margin: calc(-1 * var(--spacing-section-y)) 0 var(--spacing-section-y);
  padding: 10px var(--spacing-container-x);
  background: var(--color-scope);
  color: #ffffff;
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  text-align: center;
}
```

Then confirm no `.hero-strip` or `.hero-trust` reference survives anywhere:

```bash
grep -rn "hero-strip\|hero-trust" apps/website/src || echo "clean"
```

Expected: `clean`

**Neither margin is checkable by a unit test** — jsdom applies no CSS. Verify in a real browser: the masthead's top must be flush with both the hero's bottom and the section's top (gap 0 on each), and the heading below it must keep roughly `--spacing-section-y` of clearance. Measured on the real page at 1280px after this change: 0, 0 and 143px.

- [ ] **Step 6: Run the tests**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx apps/website/src/components/landing/Hero.spec.tsx apps/website/src/components/landing/Reliability.tsx apps/website/src/components/landing/Reliability.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): the hero's trust strip becomes the proof band's masthead"
```

---

## Task 2: The dark scope stops fighting itself

`[data-surface="dark"] .proof-strip-cell` overrides the cell's `background-image` but not its `background`, which stays `var(--color-surface)` — neutral `rgb(28,28,28)` — on a navy ground. Fix the tokens, not the card.

**Files:**
- Modify: `apps/website/src/styles/ui.css` (inside `[data-ui="section"][data-surface="dark"]`)

- [ ] **Step 1: Re-point the surface tokens**

In `ui.css`, inside the `[data-ui="section"][data-surface="dark"]` rule, replace the six surface/border lines. Leave the accent lines and the `::before` seam alone — they were set correctly by the ATC retheme:

```css
  /* Navy-family surfaces. The ground goes DARKER and the surfaces go LIGHTER,
   * which is the hierarchy that was missing: before this, cards were neutral
   * rgb(28,28,28) floating on a navy ground — two unrelated darks. */
  --color-canvas: #0B1622;
  --color-surface: #15253E;
  --color-surface-tinted: #1B2E4D;
  --color-surface-dim: #08111B;
  --color-border: rgba(255, 255, 255, 0.12);
  --color-border-strong: rgba(255, 255, 255, 0.2);
```

And change the rule's own `background` to the deeper ground:

```css
  background: linear-gradient(180deg, #0b1622 0%, #0f1c2e 100%);
```

- [ ] **Step 2: Update the comment above the rule**

That comment says the accents mirror `dark.ts` while the surfaces deliberately do not. That is still true and now more so — extend it so the reason survives:

```css
/* Dark section scope (homepage proof band + FinalCTA dark variant).
 * The ACCENTS mirror libs/design-tokens/src/lib/dark.ts. The SURFACES
 * deliberately do not: this band is website-only and takes the ATC scope
 * navy, while dark.ts stays neutral because @threadplane/chat and the cockpit
 * consume it and a navy ground there would seam against embedded chat.
 * 2026-09-08: the surfaces moved to the navy family as well, because leaving
 * --color-surface neutral put grey-black cards on a navy ground.
 * Treatment B (spec): vertical gradient canvas, 1px accent seam at the
 * light→dark boundary. */
```

- [ ] **Step 3: Test and build**

```bash
npx nx test website && npx nx build website
```

Expected: both pass. These are token changes with no markup change, so nothing should move.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/ui.css
git commit -m "fix(website): the dark band's surfaces join its ground in the navy family"
```

---

## Task 3: The figures lose their card chrome

`.proof-strip-cell` carries a background, a gradient, a border, a radius, a 1px top highlight and two shadows. On a plate, figures sit on the ground under a rule. This is most of the busy-ness fix.

**Files:**
- Modify: `apps/website/src/styles/landing.css` (`.proof-strip-cell`, its `::before`, and both dark-scope overrides)

- [ ] **Step 1: Strip the chrome**

Replace the `.proof-strip-cell` rule with:

```css
.proof-strip-cell {
  position: relative;
  /* Grid items default to min-width:auto; the long mono source URLs would then
   * push the columns past the container. */
  min-width: 0;
  padding: 0 20px 0 0;
}
```

- [ ] **Step 2: Delete the rules that no longer have anything to style**

Remove all three of these blocks entirely — the base `::before` highlight, and both dark-scope overrides, which existed only to make the box read as paper:

- `.proof-strip-cell::before { ... }`
- `[data-ui="section"][data-surface="dark"] .proof-strip-cell { ... }`
- `[data-ui="section"][data-surface="dark"] .proof-strip-cell::before { ... }`

Then confirm nothing else referenced them:

```bash
grep -n "proof-strip-cell" apps/website/src/styles/landing.css
```

Expected: only the single rule from Step 1, plus the `.proof-strip-cells` container rules and any `@media` blocks that adjust the grid — those stay.

- [ ] **Step 3: Leave the watermark alone**

`.proof-strip-watermark` sits in the same area of `landing.css` and is NOT part of this change. `Reliability.spec.tsx` guards that it exists, is `aria-hidden`, carries `data-watermark-text="Proof"` and renders no text. With the radar grid and sweep rejected during design it no longer competes with anything, so it stays exactly as it is. Do not tidy it away while you are in this file.

- [ ] **Step 4: Test**

```bash
npx nx test website
```

Expected: PASS. (jsdom does not apply CSS, so this proves only that nothing structural broke — the visual check is Task 6.)

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/styles/landing.css
git commit -m "feat(website): proof figures sit on the ground, not in cards"
```

---

## Task 4: The Vx/Vy frame and the pitch ladder

**Files:**
- Modify: `apps/website/src/components/landing/Reliability.tsx`
- Modify: `apps/website/src/styles/landing.css`
- Test: `apps/website/src/components/landing/Reliability.spec.tsx`

- [ ] **Step 1: Write the failing test**

`Reliability.spec.tsx` currently asserts `screen.getByText('Reliable to the core')` inside the "keeps the dark band…" test. Change that string to `'Climb performance'`, then add:

```tsx
  it('frames the section as a climb and hides the instrument from assistive tech', () => {
    const { container } = render(<Reliability />);
    expect(
      screen.getByText(/Vx clears today’s obstacle; Vy gets you to altitude\./),
    ).toBeTruthy();
    const ladder = container.querySelector('.proof-ladder');
    expect(ladder?.getAttribute('aria-hidden')).toBe('true');
    // The words carry the argument; the drawing carries none of it.
    expect(ladder?.textContent).toBe('');
  });
```

Note the curly apostrophe in `today’s` — the aside uses a typographic apostrophe, and a straight one will not match.

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — the eyebrow still reads "Reliable to the core" and `.proof-ladder` does not exist.

- [ ] **Step 3: Change the eyebrow and the aside**

In `Reliability.tsx`, in the `<SectionHeader>` props, change `eyebrow` and `aside`. The `heading` and `headingId` do NOT change — `e2e/website.spec.ts` pins `#proof-heading`, and the heading is a working claim:

```tsx
              eyebrow="Climb performance"
              heading="Audited, scored, published."
              headingId="proof-heading"
              aside="Vx clears today’s obstacle; Vy gets you to altitude. Not self-reported — every number links to its source."
```

- [ ] **Step 4: Add the pitch ladder**

In `Reliability.tsx`, between `<SectionHeader />` and the `<ul className="proof-strip-cells">`, add:

```tsx
            {/* Attitude indicator: pitch ladder either side of an amber
              * waterline, nose above the horizon. A divider that happens to
              * mean something — it pays off the Vx/Vy line above it. Purely
              * decorative, so aria-hidden. */}
            <svg
              className="proof-ladder"
              viewBox="0 0 700 46"
              aria-hidden="true"
              focusable="false"
            >
              <g className="proof-ladder-rungs">
                <line x1="150" y1="34" x2="245" y2="34" />
                <line x1="455" y1="34" x2="550" y2="34" />
                <line x1="196" y1="16" x2="245" y2="16" />
                <line x1="455" y1="16" x2="504" y2="16" />
              </g>
              <g className="proof-ladder-wing">
                <line x1="290" y1="26" x2="330" y2="26" />
                <line x1="370" y1="26" x2="410" y2="26" />
              </g>
              <circle className="proof-ladder-dot" cx="350" cy="26" r="2.5" />
            </svg>
```

- [ ] **Step 5: Style it**

Append to `landing.css`:

```css
/* Attitude indicator between the framing copy and the figures. Hairlines only:
 * it is a divider first and an instrument second, and the section's problem
 * was too many competing layers. */
.proof-ladder {
  display: block;
  width: 100%;
  height: auto;
  max-width: 700px;
  margin: 4px 0 26px;
}
.proof-ladder-rungs line {
  stroke: rgba(255, 255, 255, 0.3);
  stroke-width: 1;
}
.proof-ladder-wing line {
  stroke: var(--color-signal);
  stroke-width: 2.5;
}
.proof-ladder-dot {
  fill: var(--color-signal);
}
```

- [ ] **Step 6: Fix the ordering assertion the new element shifts**

`Reliability.spec.tsx` has:

```tsx
    const children = container.querySelector('.proof-strip-grid')!.children;
    expect(children[1].className).toBe('proof-strip-cells');
    expect(children[2].className).toBe('reliability-receipts');
    expect(children[3].className).toBe('reliability-works-with');
```

The ladder is inserted at index 1, so cells and receipts shift by one. The works-with row leaves in Task 5, so drop that line here and let Task 5 own the final shape. Rename the test to `'orders the ladder, cells, then receipts'` at the same time — leaving the old name would have it claiming to check a row it no longer checks. Replace the body with:

```tsx
    const children = container.querySelector('.proof-strip-grid')!.children;
    expect(children[1].getAttribute('class')).toBe('proof-ladder');
    expect(children[2].className).toBe('proof-strip-cells');
    expect(children[3].className).toBe('reliability-receipts');
```

`className` on an SVG element is an `SVGAnimatedString`, not a string — that is why this line uses `getAttribute('class')` while the others do not. Using `.className` there silently compares an object to a string and fails in a confusing way.

- [ ] **Step 7: Test**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add apps/website/src/components/landing/Reliability.tsx apps/website/src/components/landing/Reliability.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): the proof band is framed as a climb, with a pitch ladder"
```

---

## Task 5: Compatibility becomes its own section

The logo row leaves the dark band. This is what makes the logos legible — they are dark marks drawn for light grounds, so on a light section they need no treatment at all and there is no filter to guard.

**Files:**
- Create: `apps/website/src/components/landing/Compatibility.tsx`
- Create: `apps/website/src/components/landing/Compatibility.spec.tsx`
- Modify: `apps/website/src/components/landing/Reliability.tsx`
- Modify: `apps/website/src/components/landing/Reliability.spec.tsx`
- Modify: `apps/website/src/app/page.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the new component's spec first**

Create `apps/website/src/components/landing/Compatibility.spec.tsx`:

```tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { Compatibility, COMPATIBILITY_GROUPS, COMPATIBILITY_MORE_COUNT } from './Compatibility';

describe('Compatibility', () => {
  it('renders a light section with a stable id', () => {
    const { container } = render(<Compatibility />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('tinted');
    expect(section?.getAttribute('id')).toBe('compatibility');
  });

  it('groups every item under a labelled heading', () => {
    render(<Compatibility />);
    for (const group of COMPATIBILITY_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
      for (const item of group.items) expect(screen.getByText(item.name)).toBeTruthy();
    }
    expect(screen.getByText(`+ ${COMPATIBILITY_MORE_COUNT} more`)).toBeTruthy();
  });

  it('states compatibility in words and never implies a customer', () => {
    const { container } = render(<Compatibility />);
    // The claim used to exist only as alt="" plus a spec comment. A reader
    // could not see it. Now it is on the page.
    expect(screen.getByText(/Compatibility, not endorsement/)).toBeTruthy();
    expect(container.textContent).not.toMatch(/trusted by|customers|our clients|powered by/i);
  });

  it('marks every logo decorative, since the visible name carries the meaning', () => {
    const { container } = render(<Compatibility />);
    const logos = container.querySelectorAll('img.compatibility-logo');
    const withLogos = COMPATIBILITY_GROUPS.flatMap((g) => g.items).filter((i) => i.logoSrc);
    expect(logos).toHaveLength(withLogos.length);
    for (const img of Array.from(logos)) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
  });

  it('links to the adapter guide', () => {
    render(<Compatibility />);
    expect(
      screen.getByRole('link', { name: 'Choose an adapter →' }).getAttribute('href'),
    ).toBe('/docs/choosing-an-adapter');
  });
});
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `./Compatibility` does not exist.

- [ ] **Step 3: Create the component**

Create `apps/website/src/components/landing/Compatibility.tsx`:

```tsx
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { AdapterGuideLink } from './AdapterGuideLink';

interface CompatibilityItem {
  readonly name: string;
  /** null for an entry we support but have no mark for. */
  readonly logoSrc: string | null;
}

interface CompatibilityGroup {
  readonly label: string;
  readonly items: readonly CompatibilityItem[];
}

/**
 * Grouped rather than a flat run: the previous single row put a model provider
 * beside a protocol as though they were the same kind of thing, which is not
 * the information someone evaluating this needs.
 *
 * This section is LIGHT on purpose. These marks are drawn for light grounds —
 * Anthropic's is #181818 — and on the dark band they were invisible. Moving
 * them here is the fix; no CSS filter is involved.
 */
export const COMPATIBILITY_GROUPS: readonly CompatibilityGroup[] = [
  {
    label: 'Model providers',
    items: [
      { name: 'OpenAI', logoSrc: '/logos/providers/openai.svg' },
      { name: 'Anthropic', logoSrc: '/logos/providers/anthropic.svg' },
      { name: 'Gemini', logoSrc: '/logos/providers/google.svg' },
      { name: 'Bedrock', logoSrc: '/logos/providers/bedrock.svg' },
    ],
  },
  {
    label: 'Agent runtimes',
    items: [
      { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
      { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
      { name: 'AWS Strands', logoSrc: null },
    ],
  },
  {
    label: 'Protocols',
    items: [
      { name: 'LangGraph', logoSrc: '/logos/langgraph.svg' },
      { name: 'AG-UI', logoSrc: '/logos/ag-ui.svg' },
    ],
  },
];

/**
 * Azure OpenAI, Pydantic AI, Microsoft Agent Framework.
 *
 * Was 4 and included AWS Strands, which is now named above — it is already
 * named twice elsewhere on the page (a reliability receipt cites it), so
 * hiding it in a count was odd. Decrement this if another is promoted.
 */
export const COMPATIBILITY_MORE_COUNT = 3;

export function Compatibility() {
  return (
    <Section surface="tinted" id="compatibility" ariaLabelledBy="compatibility-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="Compatibility"
          heading="Your backend, your models, your runtime."
          headingId="compatibility-heading"
          aside="Threadplane is the UI layer. What it talks to is your choice — and swapping any of it does not mean rewriting the interface."
        />
        <div className="compatibility-groups">
          {COMPATIBILITY_GROUPS.map((group) => (
            <div className="compatibility-group" key={group.label}>
              <p className="compatibility-group-label">{group.label}</p>
              <ul className="compatibility-items" role="list">
                {group.items.map((item) => (
                  <li className="compatibility-item" key={item.name}>
                    {item.logoSrc ? (
                      <img
                        src={item.logoSrc}
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="compatibility-logo"
                      />
                    ) : null}
                    <span className="compatibility-name">{item.name}</span>
                  </li>
                ))}
                {group.label === 'Agent runtimes' ? (
                  <li className="compatibility-more">+ {COMPATIBILITY_MORE_COUNT} more</li>
                ) : null}
              </ul>
            </div>
          ))}
        </div>
        <div className="compatibility-footer">
          <AdapterGuideLink className="compatibility-link" />
          <p className="compatibility-disclaimer">
            Compatibility, not endorsement — no company here is claimed as a customer.
          </p>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 4: Style it**

Append to `landing.css`:

```css
/* Compatibility — light ground on purpose: these marks are drawn for light
 * backgrounds and were invisible on the dark band. */
.compatibility-groups {
  margin-top: 26px;
}
.compatibility-group {
  padding: 16px 0;
  border-top: 1px solid var(--color-border);
}
.compatibility-group-label {
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0;
}
.compatibility-items {
  display: flex;
  flex-wrap: wrap;
  gap: 10px 26px;
  list-style: none;
  margin: 10px 0 0;
  padding: 0;
}
.compatibility-item {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  white-space: nowrap;
  font-family: var(--font-sans);
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-primary);
}
.compatibility-logo {
  width: 17px;
  height: 17px;
  object-fit: contain;
}
.compatibility-more {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--color-text-muted);
  align-self: center;
}
.compatibility-footer {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
  border-top: 1px solid var(--color-border);
  padding-top: 18px;
}
.compatibility-disclaimer {
  font-size: 12.5px;
  color: var(--color-text-muted);
  margin: 0;
}
```

- [ ] **Step 5: Remove the row from Reliability**

In `Reliability.tsx`, delete the whole `<ul className="reliability-works-with"> … </ul>` block, and delete the now-unused `RIBBON_ITEMS` / `RibbonItem` / `RIBBON_MORE_COUNT` declarations and the `AdapterGuideLink` import.

Then confirm nothing still imports them:

```bash
grep -rn "RIBBON_ITEMS\|RIBBON_MORE_COUNT" apps/website/src || echo "clean"
```

Expected: `clean`

Remove the now-dead `.reliability-works-with*` and `.reliability-logo` rules from `landing.css`:

```bash
grep -n "reliability-works-with\|reliability-logo" apps/website/src/styles/landing.css
```

Delete every rule that grep lists.

- [ ] **Step 6: Update Reliability's spec**

Delete the whole `it('carries the works-with line as a compatibility claim with an adapter link', …)` test — it now belongs to `Compatibility.spec.tsx`. Remove `RIBBON_ITEMS` / `RIBBON_MORE_COUNT` from that file's imports.

The ordering test loses its last row, since works-with is gone:

```tsx
  it('orders the ladder, cells, then receipts', () => {
    const { container } = render(<Reliability />);
    const children = container.querySelector('.proof-strip-grid')!.children;
    expect(children[1].getAttribute('class')).toBe('proof-ladder');
    expect(children[2].className).toBe('proof-strip-cells');
    expect(children[3].className).toBe('reliability-receipts');
    expect(children).toHaveLength(4);
  });
```

- [ ] **Step 7: Mount it on the homepage**

In `apps/website/src/app/page.tsx`, add the import beside the others:

```tsx
import { Compatibility } from '../components/landing/Compatibility';
```

and mount it between the two existing sections:

```tsx
      <Reliability />
      <Compatibility />
      <EnterpriseArchitecture />
```

- [ ] **Step 8: Test and build**

```bash
npx nx test website && npx nx lint website && npx nx build website
```

Expected: all pass, `nx lint` with 0 errors.

- [ ] **Step 9: Commit**

```bash
git add apps/website/src/components/landing apps/website/src/app/page.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): compatibility becomes its own light section, grouped"
```

---

## Task 6: Verification

- [ ] **Step 1: The suites CI runs**

```bash
npx nx test website
npx nx lint website
npx nx build website
```

All three must pass; lint with 0 errors (65 pre-existing warnings are expected).

- [ ] **Step 2: The guard that should not have moved**

```bash
npx nx e2e website -- --grep "landing page"
```

`e2e/website.spec.ts` asserts `#proof-heading` is visible and `#proof[data-surface="dark"]` exists. This design keeps all three, so it must pass **unchanged**. If it fails, something drifted that was not meant to — do not edit the spec to match, find what moved.

- [ ] **Step 3: Full e2e**

```bash
npx nx e2e website
```

Free port 3000 first if a dev server is running — the Playwright config starts its own and will fail with "Process from config.webServer was not able to start" if the port is taken.

- [ ] **Step 4: Look at it**

Start the dev server through the Browser pane preview tools (`website-dev` already exists in `.claude/launch.json`), then check the homepage at desktop and at 390px:

- Every logo in `#compatibility` is legible. This is the headline fix — Anthropic and Mastra were the invisible ones.
- The seam has no sliver of yellow: the masthead sits directly against the hero's yellow above and the scope band below, with nothing between.
- The figures read against the ground now that the cards are gone, and nothing looks like it lost a background it needed.
- The pitch ladder reads as a divider, not as clip art.

- [ ] **Step 5: Sample contrast from the rendered page**

In the Browser pane console:

```javascript
const s = document.querySelector('#proof');
const cell = document.querySelector('.proof-strip-value');
({ ground: getComputedStyle(s).backgroundImage,
   figure: getComputedStyle(cell).color,
   surface: getComputedStyle(s).getPropertyValue('--color-surface') })
```

Expected: ground is the `#0b1622 → #0f1c2e` gradient, `--color-surface` is `#15253E`, and the figure colour is a near-white.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): reliability redesign verification pass"
```

---

## Out of scope

- `libs/design-tokens/src/lib/dark.ts` and the cockpit's neutral dark surfaces. The divergence is deliberate and documented in `ui.css`.
- The second, 97px `[data-surface="dark"]` band further down the homepage. It inherits Task 2's token change; look at it during Task 6 Step 4, but do not redesign it here.
- The `.arch-flow-log-source` badge contrast issue in the docs, tracked separately.
