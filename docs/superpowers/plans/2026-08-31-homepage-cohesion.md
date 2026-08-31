# Homepage Cohesion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `EcosystemStrip` with a thin `LogoRibbon` and rebuild the four homepage feature blocks with the rows structure and approved copy, per `docs/superpowers/specs/2026-08-31-homepage-cohesion-design.md`.

**Architecture:** `apps/website` is Next.js 16 / React 19. Presentation lives in UNLAYERED CSS under `apps/website/src/styles/` (`landing.css` for landing components) — no inline styles, no `@layer`. `FeatureBlock` is shared by six pages, so the rows structure is **opt-in by prop** (same pattern as `FinalCTA variant="dark"`); only the homepage adopts it now. `LogoRibbon` is homepage-only and replaces a deleted component.

**Tech Stack:** Vitest + Testing Library (colocated specs, jsdom).

**Test command:** `cd apps/website && npx vitest run --config vite.config.mts`
**Branch:** work on `blove/homepage-cohesion` (already exists, spec committed). Verify with `git log --oneline -1` → expect `f5e47610` or a descendant.

---

### Task 1: `LogoRibbon` component

**Files:**
- Create: `apps/website/src/components/landing/LogoRibbon.tsx`
- Create: `apps/website/src/components/landing/LogoRibbon.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (append)

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/landing/LogoRibbon.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LogoRibbon, RIBBON_ITEMS, RIBBON_MORE_COUNT } from './LogoRibbon';

describe('LogoRibbon', () => {
  it('renders eight named items and the more-count', () => {
    render(<LogoRibbon />);
    expect(RIBBON_ITEMS).toHaveLength(8);
    for (const item of RIBBON_ITEMS) {
      expect(screen.getByText(item.name)).toBeTruthy();
    }
    expect(screen.getByText(`+ ${RIBBON_MORE_COUNT} more`)).toBeTruthy();
  });

  it('is a labelled landmark with no links', () => {
    const { container } = render(<LogoRibbon />);
    const section = container.querySelector('section');
    expect(section?.getAttribute('aria-label')).toBe('Works with your agent stack');
    expect(container.querySelectorAll('a')).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/LogoRibbon.spec.tsx`
Expected: FAIL — module `./LogoRibbon` not found.

- [ ] **Step 3: Implement**

Logo paths are reused from the current `EcosystemStrip` (they exist in
`apps/website/public/logos/`). Note AWS Strands is in the "+ 4 more" set, so
its logo-reuse problem disappears with it.

```tsx
// apps/website/src/components/landing/LogoRibbon.tsx
interface RibbonItem {
  name: string;
  logoSrc: string;
}

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
 * The "works with" recognition line (spec change 1). Deliberately not a
 * Section: no heading, no subhead — the portability argument lives in the
 * Yes wall; this keeps only recognition. No links, no hover states.
 */
export function LogoRibbon() {
  return (
    <section aria-label="Works with your agent stack" className="logo-ribbon">
      <Container>
        <div className="logo-ribbon-line">
          <span className="logo-ribbon-label">Works with</span>
          {RIBBON_ITEMS.map((item) => (
            <span className="logo-ribbon-item" key={item.name}>
              <img
                src={item.logoSrc}
                alt=""
                aria-hidden="true"
                loading="lazy"
                decoding="async"
                className="logo-ribbon-logo"
              />
              <span className="logo-ribbon-name">{item.name}</span>
            </span>
          ))}
          <span className="logo-ribbon-more">+ {RIBBON_MORE_COUNT} more</span>
        </div>
      </Container>
    </section>
  );
}
```

Add `import { Container } from '../ui/Container';` at the top of the file.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/LogoRibbon.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Append CSS to landing.css**

```css
/* ---------- LogoRibbon — components/landing/LogoRibbon.tsx ---------- */
.logo-ribbon {
  background: var(--color-canvas);
  border-top: 1px solid var(--color-border);
  border-bottom: 1px solid var(--color-border);
}
.logo-ribbon-line {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px 26px;
  padding: 16px 0;
}
.logo-ribbon-label {
  font-family: var(--font-mono);
  font-size: 10.5px;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
.logo-ribbon-item {
  display: inline-flex;
  align-items: center;
  gap: 7px;
  white-space: nowrap;
}
.logo-ribbon-logo {
  width: 16px;
  height: 16px;
  object-fit: contain;
}
.logo-ribbon-name {
  font-family: var(--font-inter);
  font-size: 13px;
  font-weight: 500;
  color: var(--color-text-secondary);
}
.logo-ribbon-more {
  font-family: var(--font-mono);
  font-size: 10.5px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: var(--color-text-muted);
}
```

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/LogoRibbon.tsx apps/website/src/components/landing/LogoRibbon.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): LogoRibbon — thin works-with line"
```

---

### Task 2: Wire ribbon into the page, delete `EcosystemStrip`

**Files:**
- Modify: `apps/website/src/app/page.tsx`
- Delete: `apps/website/src/components/landing/EcosystemStrip.tsx`
- Modify: `apps/website/src/styles/landing.css` (remove the ecosystem block)

- [ ] **Step 1: Swap in page.tsx**

Replace `import { EcosystemStrip } from '../components/landing/EcosystemStrip';`
with `import { LogoRibbon } from '../components/landing/LogoRibbon';` and
`<EcosystemStrip />` with `<LogoRibbon />` (position unchanged: directly after
`<Hero />`, before `<YesWall />`).

- [ ] **Step 2: Delete the component**

```bash
git rm apps/website/src/components/landing/EcosystemStrip.tsx
```

Then verify consumers: `grep -rn 'EcosystemStrip' apps/website/src apps/website/e2e`
Expected: no matches. If any page other than the homepage imports it, STOP and
report — the spec says it is homepage-only.

- [ ] **Step 3: Remove the ecosystem CSS**

In `apps/website/src/styles/landing.css`, the EcosystemStrip block runs from
the comment `/* EcosystemStrip — components/landing/EcosystemStrip.tsx */`
(~line 557) to just before `/* Promises — components/landing/Promises.tsx */`
(~line 678). Delete it — **EXCEPT** one rule inside it that also serves
another component. This media query (~lines 621–627):

```css
@media (max-width: 640px) {
  .ecosystem-subhead,
  .demo-showcase__subhead {
    text-align: left;
  }
}
```

must be rewritten (not deleted) to keep the demo-showcase half:

```css
/* Centered ragged text is fine at 2 lines on desktop but becomes a 6-line
 * ragged column on phones; left-align for readability. */
@media (max-width: 640px) {
  .demo-showcase__subhead {
    text-align: left;
  }
}
```

Relocate that rewritten rule next to the `.demo-showcase__subhead` rules
(~line 1007 region) so it lives with its component.

After the removal: `grep -cin 'ecosystem' apps/website/src/styles/landing.css`
Expected: 0.

- [ ] **Step 4: Run the whole suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS (no spec references EcosystemStrip — verified at plan time).

- [ ] **Step 5: Commit**

```bash
git add -A apps/website/src
git commit -m "feat(website): replace EcosystemStrip with LogoRibbon"
```

---

### Task 3: `FeatureBlock` rows variant

**Files:**
- Modify: `apps/website/src/components/landing/FeatureBlock.tsx`
- Create: `apps/website/src/components/landing/FeatureBlock.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (append)

- [ ] **Step 1: Write the failing test**

```tsx
// apps/website/src/components/landing/FeatureBlock.spec.tsx
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { FeatureBlock } from './FeatureBlock';

const base = {
  eyebrow: 'Render',
  headline: 'Agent output, rendered as your components.',
  body: 'Two sentences.',
  cta: { label: 'See it', href: '/render' },
  visual: <div data-testid="visual" />,
};

describe('FeatureBlock', () => {
  it('rows variant renders claims with API tails and no cards', () => {
    const { container } = render(
      <FeatureBlock
        {...base}
        rows={[
          { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
          { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
        ]}
      />,
    );
    expect(screen.getByText('Your design system, not a chat widget')).toBeTruthy();
    expect(screen.getByText('@threadplane/render')).toBeTruthy();
    expect(container.querySelector('.feature-block-card-row')).toBeNull();
    expect(container.querySelector('.feature-block-bullets')).toBeNull();
    expect(container.querySelector('.feature-block-rail')).toBeTruthy();
  });

  it('bullets variant (the five non-home pages) still renders bullets and cards', () => {
    const { container } = render(
      <FeatureBlock
        {...base}
        bullets={['First bullet', 'Second bullet']}
        supportingCards={[{ title: 'chat-timeline', description: 'Drop-in surface.' }]}
      />,
    );
    expect(screen.getByText('First bullet')).toBeTruthy();
    expect(screen.getByText('chat-timeline')).toBeTruthy();
    expect(container.querySelector('.feature-block-rows')).toBeNull();
    expect(container.querySelector('.feature-block-rail')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/FeatureBlock.spec.tsx`
Expected: FAIL — TS rejects `rows` prop / missing required `bullets`.

- [ ] **Step 3: Restructure the props and render**

In `apps/website/src/components/landing/FeatureBlock.tsx`, replace the
interface and the text-column body:

```tsx
export interface FeatureRow {
  claim: string;
  api: string;
}

export interface FeatureBlockProps {
  eyebrow: string;
  headline: string;
  body: ReactNode;
  /**
   * Rows structure (homepage, spec 2026-08-31): claim left, mono API right,
   * in the Yes wall's row grammar. Renders the rail eyebrow and NO cards.
   * Mutually exclusive with bullets/supportingCards.
   */
  rows?: FeatureRow[];
  /** Legacy structure — the five non-home consumers. */
  bullets?: string[];
  supportingCards?: { title: string; description: string }[];
  cta: { label: string; href: string };
  visual: ReactNode;
  /** If true, visual on the left; text on the right. Used to alternate sections. */
  visualLeft?: boolean;
  /** Section surface — defaults to canvas. */
  surface?: 'canvas' | 'tinted' | 'white';
  /** Anchor id + aria-labelledby target. */
  id?: string;
}
```

Destructure `rows,` alongside the existing props (`bullets` and
`supportingCards` default to `undefined`). In the text column, replace the
eyebrow line and the bullets + card-row region with:

```tsx
            {rows ? (
              <div className="feature-block-rail">
                <Eyebrow tone="accent" className="feature-block-eyebrow">{eyebrow}</Eyebrow>
                <span className="feature-block-rail-line" aria-hidden="true" />
              </div>
            ) : (
              <Eyebrow tone="accent" className="feature-block-eyebrow">{eyebrow}</Eyebrow>
            )}
            <h2 id={headingId} className="feature-block-heading">
              {headline}
            </h2>
            <p className="feature-block-body">
              {body}
            </p>
            {rows ? (
              <div className="feature-block-rows">
                {rows.map((row) => (
                  <div className="feature-block-row" key={row.claim}>
                    <span className="feature-block-row-claim">{row.claim}</span>
                    <span className="feature-block-row-api">{row.api}</span>
                  </div>
                ))}
              </div>
            ) : (
              <>
                <ul className="feature-block-bullets">
                  {(bullets ?? []).map((b) => (
                    <li key={b} className="feature-block-bullet">
                      <span aria-hidden="true" className="feature-block-bullet-check">
                        ✓
                      </span>
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="feature-block-card-row">
                  {(supportingCards ?? []).map((sc) => (
                    <Card key={sc.title} padding="md" surface="tinted">
                      <div className="feature-block-card-title">
                        {sc.title}
                      </div>
                      <div className="feature-block-card-desc">
                        {sc.description}
                      </div>
                    </Card>
                  ))}
                </div>
              </>
            )}
```

Everything else (heading, CTA, visual column, grid) stays as-is.

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/FeatureBlock.spec.tsx`
Expected: PASS (2 tests).

- [ ] **Step 5: Append the rows CSS to landing.css**

Place it directly after the existing `.feature-block-cta` rule:

```css
/* Rows variant (homepage): the Yes wall's claim→API grammar, light. */
.feature-block-rail {
  display: flex;
  align-items: baseline;
  gap: 14px;
}
.feature-block-rail-line {
  flex: 1;
  height: 1px;
  background: var(--color-border);
}
.feature-block-rows {
  margin-top: 20px;
  border-top: 2px solid var(--color-text-primary);
  max-width: 46ch;
}
.feature-block-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 16px;
  align-items: baseline;
  border-bottom: 1px solid var(--color-border);
  padding: 9px 0;
}
.feature-block-row-claim {
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.45;
  color: var(--color-text-primary);
}
.feature-block-row-api {
  font-family: var(--font-mono);
  font-size: 11.5px;
  line-height: 1.4;
  color: var(--color-text-muted);
  white-space: nowrap;
}
@media (max-width: 640px) {
  .feature-block-row {
    grid-template-columns: 1fr;
    gap: 2px;
  }
}
```


- [ ] **Step 6: Run the whole suite (five other pages exercise the bullets variant)**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/landing/FeatureBlock.tsx apps/website/src/components/landing/FeatureBlock.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): FeatureBlock rows variant in the Yes wall grammar"
```

---

### Task 4: Homepage adopts rows + approved copy

**Files:**
- Modify: `apps/website/src/app/page.tsx` (the four `<FeatureBlock>` calls)

- [ ] **Step 1: Replace the four blocks' content props**

Each block keeps its `id`, `eyebrow`, `cta`, `visual`, `visualLeft`, and
loses `bullets` + `supportingCards` in favor of `rows`. Copy verbatim from
the spec (headline / body / rows):

**Stream** (`id="stream"`):
```tsx
        headline="One provider. A whole agent surface."
        body={
          <>
            <code className="home-code">provideAgent</code> wires the agent into DI;{' '}
            <code className="home-code">injectAgent()</code> hands back signals — messages(), status(), error() — plus durable threads and tool progress.
          </>
        }
        rows={[
          { claim: 'Signals, not promises', api: 'injectAgent()' },
          { claim: 'Threads that branch, resume, replay', api: 'threadId' },
          { claim: 'Same contract on LangGraph and AG-UI', api: 'runtime adapters' },
        ]}
```

**Render** (`id="render"`):
```tsx
        headline="Agent output, rendered as your components."
        body="The server emits a JSON spec. Angular renders it with components you own — json-render and A2UI both speak it."
        rows={[
          { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
          { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
          { claim: 'Schema on the server, trust in the client', api: 'validated specs' },
        ]}
```

**Ship** (`id="ship"`):
```tsx
        headline="Demos stream. Production recovers."
        body="The seams that turn a demo into an app: error boundaries, readiness gates, and threads that outlive deploys."
        rows={[
          { claim: 'error() / status() / reload() on every agent', api: 'boundary signals' },
          { claim: 'Fallback content where specs go wrong', api: 'readiness gate' },
          { claim: 'Conversations restore across sessions', api: 'thread persistence' },
        ]}
```

**Approve** (`id="approve"`, name unchanged per spec decision 3):
```tsx
        headline="Nothing irreversible without a human."
        body={
          <>
            <code className="home-code">interrupt()</code> freezes the run inside the checkpoint. Your UI renders the proposal;{' '}
            <code className="home-code">submit({'{ resume }'})</code> continues with the decision on the record.
          </>
        }
        rows={[
          { claim: 'The pause is a checkpoint, not a modal', api: 'interrupt()' },
          { claim: 'The proposal renders in your UI', api: '<chat-interrupt-panel>' },
          { claim: 'The decision lands beside the action it gated', api: 'submit({ resume })' },
        ]}
```

Delete each block's `bullets={[...]}` and `supportingCards={[...]}` arrays.
The old `body` values are replaced entirely. Keep each block's existing
comment lines (update the `#approve` comment if it references bullets).

- [ ] **Step 2: Grep for orphaned copy assertions**

Run: `grep -rn 'Patterns built for production\|Build the Angular UI layer\|Generative UI that renders\|Nothing irreversible happens' apps/website/src apps/website/e2e`
Expected: matches only in non-home pages' own content (e.g. `/render` page may
reuse a headline) — homepage-tied spec/e2e assertions must be updated to the
new headlines. Report what you found and fixed.

- [ ] **Step 3: Run the whole suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src apps/website/e2e
git commit -m "feat(website): homepage feature blocks adopt rows structure and new copy"
```

---

### Task 5: Verification gate

- [ ] **Step 1: Full suite** — `cd apps/website && npx vitest run --config vite.config.mts` → paste summary.
- [ ] **Step 2: Prod build** — from repo root: `npx nx build website --configuration=production` → must succeed.
- [ ] **Step 3: Visual pass** via the Browser pane dev server (`website-dev` launch config), 1440px AND 375px:
  1. Ribbon: single hairline band under the hero; wraps cleanly on mobile; no heading gap where EcosystemStrip was.
  2. Four blocks: rail kicker + hairline; three rows with right-aligned mono APIs at desktop, stacked at mobile; NO supporting cards anywhere on the homepage; switcher unchanged.
  3. `/langgraph` and `/render`: their FeatureBlocks still render bullets + cards (the legacy variant).
  4. Console clean; no horizontal scroll at 375px (measure `scrollWidth` at an EMULATED viewport — a hidden pane reports clientWidth 0, which false-positives).
- [ ] **Step 4: Commit any fixes; stop.** Do not push or open a PR — that is a separate decision.

## Deviations that require stopping

- Any non-home page importing `EcosystemStrip` (spec says homepage-only).
- Any consumer passing BOTH `rows` and `bullets` after Task 4.
- A missing logo file at any `RIBBON_ITEMS` path (verify with `ls` before assuming).
