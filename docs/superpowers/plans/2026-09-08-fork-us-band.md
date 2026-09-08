# Fork Us Band Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the homepage's quiet 204px open-source strip into a loud ~461px band: an aviation eyebrow, a two-word display headline, an amber fork button, and a runway centreline.

**Architecture:** Three stacked elements inside the page container plus one full-section-width decorative rule outside it. No new component, no new file — `OpenSourceStrip` keeps its name, its id, and its place in `page.tsx`; only its markup, copy shape and styles change.

**Tech Stack:** Next.js 15 App Router, React, plain CSS in `apps/website/src/styles/landing.css`, Vitest + Testing Library, Playwright.

**Spec:** `docs/superpowers/specs/2026-09-08-fork-us-band-design.md`

---

## Background an engineer needs before starting

**Run the commands CI runs**: `npx nx test website`, `npx nx lint website`, `npx nx build website` — NOT `npx vitest run --root apps/website`. The nx executor is what CI uses, and it swallows reporter output on a hard failure: when it goes red, run vitest directly alongside it to read the actual failure, then trust nx for the verdict. `nx test` does **not** type-check; `nx build` does.

**Three things in the existing code will fight this change. All three are expected:**

1. **A guard exists specifically to prevent it.** `OpenSourceStrip.spec.tsx` asserts `data-tight === 'true'` and comments: *"The strip's own padding override keys off [data-tight]; dropping the prop silently restores the full 48-80px band this replaced."* We are now dropping that prop on purpose. The assertion inverts and **the comment must be rewritten** — leaving it would tell the next reader the opposite of the truth.

2. **The component docblock argues for quietness.** It says the section is "deliberately the quietest band on the page" because "there is no catch and no upsell." That reasoning no longer holds. Rewrite it; do not leave a docblock contradicting the component beneath it.

3. **A CSS comment justifies the wrong font.** `.open-source-strip-line` says it uses `--font-sans` because the line "carries an italic `<em>`, and Archivo Black has no italic." The `<em>` is being removed, so that constraint disappears and the headline takes `--font-display`.

**`Button`'s default variant is already `primary`.** Pass it explicitly anyway — the amber treatment is a decision the spec records, and an explicit prop keeps it visible. Verified: `[data-variant="primary"]` fills with `--color-signal` directly (`ui.css:273`), not by way of `--color-accent`, so it is amber on the dark surface with no surface-specific rule needed.

**Do not touch:** the `id="open-source-heading"` (pinned by the e2e spine at `website.spec.ts:56`), the section's position in `page.tsx`, the `cta_id: 'hero_github'` analytics payload, or `FinalCTA`.

---

## File Structure

| File | Responsibility | Change |
| --- | --- | --- |
| `apps/website/src/lib/positioning.ts` | The four copy strings | `OPEN_SOURCE_STRIP` reshaped |
| `apps/website/src/lib/positioning.spec.ts` | Copy guard | Follows the reshape |
| `apps/website/src/components/landing/OpenSourceStrip.tsx` | The band's markup | Rewritten body |
| `apps/website/src/components/landing/OpenSourceStrip.spec.tsx` | Render guards | Heading, tight, runway |
| `apps/website/src/styles/landing.css` | The band's styles | New rules in, old out |

---

## Task 1: The copy

**Files:**
- Modify: `apps/website/src/lib/positioning.ts:69-77`
- Modify: `apps/website/src/lib/positioning.spec.ts:159-171`

- [ ] **Step 1: Update the guard first**

In `positioning.spec.ts`, replace the whole `describe('homepage restructure copy (live-stage spec §3)')` block with:

```ts
describe('homepage restructure copy (live-stage spec §3)', () => {
  it('closes on the open-source offer: an aviation eyebrow, two words, the licence and the CTA', async () => {
    const { OPEN_SOURCE_STRIP } = await import('./positioning');
    expect(OPEN_SOURCE_STRIP.eyebrow).toBe('Squawk 1200');
    expect(OPEN_SOURCE_STRIP.headline).toBe('Fork us.');
    // The headline is set at up to 116px. More than two short words wraps,
    // and a wrapped headline stops reading as a full stop.
    expect(OPEN_SOURCE_STRIP.headline.length).toBeLessThanOrEqual(12);
    // The eyebrow sits on one line at 0.18em tracking beside nothing else.
    expect(OPEN_SOURCE_STRIP.eyebrow.length).toBeLessThanOrEqual(14);
    expect(OPEN_SOURCE_STRIP.licence).toBe('MIT');
    expect(OPEN_SOURCE_STRIP.cta).toBe('Fork on GitHub');
  });
});
```

- [ ] **Step 2: Run it and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — `OPEN_SOURCE_STRIP.eyebrow` is `undefined`.

- [ ] **Step 3: Reshape the constant**

In `positioning.ts`, replace the `OPEN_SOURCE_STRIP` block with:

```ts
export const OPEN_SOURCE_STRIP = {
  /**
   * The US transponder code for VFR flight not receiving ATC services —
   * flying with nobody controlling you, which is the offer exactly. It is
   * texture, not information: the headline carries the whole meaning, so a
   * reader who does not fly loses nothing.
   */
  eyebrow: 'Squawk 1200',
  /** Two words at up to 116px. The band's entire argument. */
  headline: 'Fork us.',
  /** The licence tag beside the action. */
  licence: 'MIT',
  cta: 'Fork on GitHub',
} as const;
```

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: `positioning.spec.ts` passes. `OpenSourceStrip.spec.tsx` now FAILS — it still reads `.lead` and `.emphasis`. That is expected and Task 2 fixes it; do not patch it here.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/positioning.ts apps/website/src/lib/positioning.spec.ts
git commit -m "feat(website): the open-source copy becomes an eyebrow and two words

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 2: The component

**Files:**
- Modify: `apps/website/src/components/landing/OpenSourceStrip.tsx`
- Modify: `apps/website/src/components/landing/OpenSourceStrip.spec.tsx`

- [ ] **Step 1: Update the guards**

In `OpenSourceStrip.spec.tsx`:

**Replace** the first test (`renders the whole sentence as the section heading, emphasis included`) with:

```tsx
  it('makes the headline alone the section heading', () => {
    const { container } = render(<OpenSourceStrip />);
    const heading = screen.getByRole('heading', { level: 2 });
    // Two words, not a sentence: the section's accessible name is the offer.
    expect(heading.textContent).toBe(OPEN_SOURCE_STRIP.headline);
    expect(heading.querySelector('em')).toBeNull();
    // The eyebrow stays readable rather than aria-hidden, matching how
    // SectionHeader treats its own eyebrows.
    expect(container.querySelector('.open-source-strip-eyebrow')?.textContent).toBe(
      OPEN_SOURCE_STRIP.eyebrow,
    );
  });
```

**Replace** the third test (`sits on the dark surface at the tight rhythm`) with:

```tsx
  it('sits on the dark surface at the FULL rhythm, not the tight one', () => {
    const { container } = render(<OpenSourceStrip />);
    const section = container.querySelector('[data-ui="section"]');
    expect(section?.getAttribute('data-surface')).toBe('dark');
    // Deliberately absent. This band used to be the page's quiet beat and a
    // guard here asserted data-tight="true" to keep it that way; the section
    // is now a full stop, and it gets its ~461px from the standard section
    // padding rather than from any override of its own.
    expect(section?.getAttribute('data-tight')).toBeNull();
    expect(section?.classList.contains('open-source-strip')).toBe(true);
  });
```

**Rename** the fifth test from `is the page’s quiet beat: one action, no second CTA` to:

```tsx
  it('offers one action and no second CTA', () => {
```

(its body is unchanged — still `expect(container.querySelectorAll('a').length).toBe(1)`)

**Add** at the end of the `describe`:

```tsx
  it('marks the runway decorative and puts it outside the container', () => {
    const { container } = render(<OpenSourceStrip />);
    const runway = container.querySelector('.open-source-strip-runway');
    expect(runway?.getAttribute('aria-hidden')).toBe('true');
    expect(runway?.textContent).toBe('');
    // It spans the section, not the container, so it must not be nested in
    // one — inside, the container's gutters would clip the marking short.
    expect(runway?.closest('[data-ui="container"]')).toBeNull();
    expect(runway?.parentElement?.getAttribute('data-ui')).toBe('section');
  });
```

- [ ] **Step 2: Run and watch it fail**

```bash
npx nx test website
```

Expected: FAIL — the heading is still the full sentence and `.open-source-strip-runway` does not exist.

- [ ] **Step 3: Rewrite the component**

Replace the docblock and the `return` in `OpenSourceStrip.tsx`. **The import list does not change** — every symbol it already imports is still used.

```tsx
/**
 * The homepage's open-source beat: a dark full-stop band between the stage
 * and the teams block.
 *
 * It is deliberately loud. An earlier version was the quietest band on the
 * page — the reasoning was that the offer is "no catch, no upsell," so it
 * should not read as a second pitch. That restraint is now spent on purpose:
 * the open-source offer is one of the strongest things the product has to
 * say, and it is said here in four words and one aviation marking.
 *
 * The band takes its ~461px from the standard section rhythm; there is no
 * padding override, which is why `tight` is absent rather than false.
 *
 * The four library pages still close on `FinalCTA variant="dark"` — that
 * component is untouched.
 */
export function OpenSourceStrip() {
  return (
    <Section
      surface="dark"
      ariaLabelledBy="open-source-heading"
      className="open-source-strip"
    >
      <Container>
        <p className="open-source-strip-eyebrow">{OPEN_SOURCE_STRIP.eyebrow}</p>
        <h2 id="open-source-heading" className="open-source-strip-headline">
          {OPEN_SOURCE_STRIP.headline}
        </h2>
        <div className="open-source-strip-actions">
          <Button
            variant="primary"
            size="md"
            href={GITHUB_REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
            leadingIcon={<GitHubIcon />}
            onClick={() =>
              trackCtaClick({
                cta_id: 'hero_github',
                track: 'developer',
                surface: 'home',
                destination_url: GITHUB_REPO_URL,
              })
            }
          >
            {OPEN_SOURCE_STRIP.cta}
          </Button>
          <span className="open-source-strip-licence">
            {OPEN_SOURCE_STRIP.licence}
          </span>
        </div>
      </Container>
      {/* Spans the section rather than the container, so the marking runs
          edge to edge like paint on a runway. */}
      <div className="open-source-strip-runway" aria-hidden="true" />
    </Section>
  );
}
```

Note the licence now sits **after** the button, where it previously came before it.

- [ ] **Step 4: Run it**

```bash
npx nx test website
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/OpenSourceStrip.tsx apps/website/src/components/landing/OpenSourceStrip.spec.tsx
git commit -m "feat(website): the open-source strip becomes the Fork us band

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 3: The styles

**Files:**
- Modify: `apps/website/src/styles/landing.css:625-673`

- [ ] **Step 1: Replace the block**

Delete these rules entirely: the `[data-ui="section"][data-tight].open-source-strip` padding override (and the comment above it), `.open-source-strip-inner`, `.open-source-strip-line`, `.open-source-strip-line em`, and the `@media (max-width: 640px)` block that only adjusts `.open-source-strip-line`.

Keep `.open-source-strip-actions` and `.open-source-strip-licence` as selectors but replace their bodies. Add the rest:

```css
/* The Fork us band — components/landing/OpenSourceStrip.tsx.
 * No padding override: the band takes the standard --spacing-section-y, which
 * is where its ~461px comes from. The dark surface already sets position:
 * relative, but the runway depends on it, so it is set here too rather than
 * inherited from a rule that could change for unrelated reasons. */
.open-source-strip {
  position: relative;
}
.open-source-strip-eyebrow {
  font-family: var(--font-mono);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.18em;
  text-transform: uppercase;
  color: var(--color-signal);
  margin: 0 0 22px;
}
.open-source-strip-headline {
  /* --font-display is available here now: the italic <em> this line used to
     carry is gone, and Archivo Black has no italic. */
  font-family: var(--font-display);
  font-weight: 400;
  font-size: clamp(56px, 8.5vw, 116px);
  line-height: 0.9;
  letter-spacing: -0.04em;
  color: var(--color-text-primary);
  margin: 0;
}
.open-source-strip-actions {
  display: flex;
  align-items: center;
  gap: 20px;
  margin-top: 38px;
}
.open-source-strip-licence {
  font-family: var(--font-mono);
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  white-space: nowrap;
}
/* The runway centreline. A fixed 46px dash on a 92px period rather than a
 * proportional one, so it reads as the same painted marking at every width. */
.open-source-strip-runway {
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
@media (max-width: 640px) {
  .open-source-strip-headline {
    font-size: clamp(44px, 13vw, 56px);
  }
  .open-source-strip-actions {
    flex-wrap: wrap;
    gap: 14px;
  }
}
```

- [ ] **Step 2: Confirm nothing dangles**

```bash
grep -n "open-source-strip-inner\|open-source-strip-line" apps/website/src/styles/landing.css apps/website/src/components/landing/OpenSourceStrip.tsx || echo "clean"
```

Expected: `clean`

- [ ] **Step 3: Test, lint, build**

```bash
npx nx test website && npx nx lint website && npx nx build website
```

Expected: all pass, lint 0 errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/styles/landing.css
git commit -m "feat(website): display headline, amber action and runway centreline

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Task 4: Verification

- [ ] **Step 1: The CI commands**

```bash
npx nx test website
npx nx lint website
npx nx build website
```

All pass; lint 0 errors (68 warnings is the current baseline).

- [ ] **Step 2: The guard that must not move**

```bash
npx nx e2e website
```

Free port 3000 first if a dev server holds it. `website.spec.ts:48` asserts the spine order including `open-source-heading`. It must pass **unchanged** — if you find yourself editing the e2e spec, stop, because something drifted that was not meant to.

- [ ] **Step 3: Measure it in a real browser**

Start the dev server through the Browser pane (`website-dev` in `.claude/launch.json`). If a server is already running, **restart it** — a stale dev server serving an old bundle has cost this project real time before. Then at a 1440px viewport:

```javascript
const s = document.querySelector('.open-source-strip');
const h = document.querySelector('.open-source-strip-headline');
const r = document.querySelector('.open-source-strip-runway');
const proofH = document.querySelector('#proof-heading');
({ bandH: Math.round(s.getBoundingClientRect().height),
   headlineSize: getComputedStyle(h).fontSize,
   headlineFont: getComputedStyle(h).fontFamily,
   headlineLines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)),
   headlineLeft: Math.round(h.getBoundingClientRect().left),
   proofHeadingLeft: Math.round(proofH.getBoundingClientRect().left),
   runwaySpansSection: Math.round(r.getBoundingClientRect().width) === Math.round(s.getBoundingClientRect().width),
   tight: s.getAttribute('data-tight') })
```

Expected: `bandH` ≈ 440–470, `headlineSize` `116px`, `headlineFont` containing `Archivo Black`, `headlineLines` **1**, `headlineLeft` **equal to** `proofHeadingLeft` (the band shares every other section's left edge), `runwaySpansSection` **true**, `tight` **null**.

- [ ] **Step 4: Check the phone**

Emulate 390px wide, reload, then:

```javascript
const h = document.querySelector('.open-source-strip-headline');
({ lines: Math.round(h.getBoundingClientRect().height / parseFloat(getComputedStyle(h).lineHeight)),
   overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth })
```

Expected: `lines` **1**, `overflow` **false**.

- [ ] **Step 5: Look at it**

Screenshot the band and the block beneath it in one frame. Confirm by eye that the runway reads as a marking rather than as a border between the two sections, and that the amber fork button and `TeamsBlock`'s amber "Talk to an engineer" below it are both legible as separate asks. Both were flagged during design and accepted — you are confirming they look as accepted, not re-litigating them.

- [ ] **Step 6: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): Fork us band verification pass

Co-Authored-By: Claude Opus 5 <noreply@anthropic.com>"
```

---

## Out of scope

- The section does not move in `page.tsx`.
- `FinalCTA` is untouched.
- No repository stats. Rejected during design as more text, against the brief.
