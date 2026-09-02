# Customer Concept Graphics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a compact scale to the SVG diagram kit and use it for a homepage "How it works" concept grid, plus marketing graphics for /render (spec→components transform) and /pilot-to-prod (engagement journey).

**Architecture:** Extends the existing diagram kit (`apps/website/src/components/docs/diagrams/`) with a `compact` scale (no min-width, larger type ramp via CSS under `[data-scale="compact"]`) and a `metaStyle` variant on `DiagramNode` for mono meta lines. A new generic `DiagramSection` landing component wraps any diagram child; `StackDiagramSection` becomes a thin wrapper over it. Four compact concept compositions feed a new `HomeConceptGrid` section; two standard-scale compositions (`RenderTransform`, `PilotJourney`) go on `/render` and `/pilot-to-prod`.

**Tech Stack:** Next.js (apps/website), React Server Components, vitest + jsdom + @testing-library/react, token-styled CSS in `docs.css`/`landing.css` (inline-style lint guard applies).

**Spec:** `docs/superpowers/specs/2026-09-02-customer-concept-graphics-design.md` — its §5 "What we are communicating" table is a SHIPPING GATE: every graphic's claim must be verified against the docs/libs during implementation and review.

**Conventions (established by the prior arc — follow exactly):**
- Kit geometry: arrows stop 4px short of the target edge; edges NEVER run continuously under a pill (segment → pill → segment+arrow); 16px outer margins; slug unique per rendered instance.
- Standard-scale text-fit heuristics (640 viewBox): mono title 12.5px ≈ 7.5px/char, sans title 11px/600 ≈ 5.5px/char, meta 10.5px ≈ 5.2px/char, vs inner width w−32; keep ≥10px slack.
- Compact-scale heuristics (320 viewBox, ramp from Task 1): mono title 13.5px ≈ 8.1px/char, sans title 12px/600 ≈ 6px/char, meta 11px ≈ 5.5px/char, pill 10.5px ≈ 6.3px/char.
- Implementers verify every string against these heuristics AND against the target pages'/libs' actual wording (grep libs before attributing anything to a package); report deviations. Reviewers re-measure in a real browser.
- Tests: `npx nx test website`; lint: `npx nx lint website` (0 errors); spec files start with `// SPDX-License-Identifier: MIT` and `// @vitest-environment jsdom`.

---

### Task 1: Kit compact scale + mono meta variant

**Files:**
- Modify: `apps/website/src/components/docs/diagrams/DiagramFrame.tsx` (scale union)
- Modify: `apps/website/src/components/docs/diagrams/DiagramNode.tsx` (metaStyle prop)
- Modify: `apps/website/src/styles/docs.css` (compact overrides + mono meta, in the kit block)
- Modify: `apps/website/src/components/docs/diagrams/primitives.spec.tsx`
- Modify: `apps/website/src/styles/style-contracts.spec.ts`

- [ ] **Step 1: Extend the failing spec** — append to `primitives.spec.tsx`:

```tsx
it('DiagramFrame accepts the compact scale', () => {
  const { container } = render(
    <DiagramFrame slug="c" viewWidth={320} viewHeight={150} label="x" scale="compact">
      <g />
    </DiagramFrame>
  );
  expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
});

it('DiagramNode renders a mono meta when metaStyle is mono', () => {
  const { container } = render(
    <svg>
      <DiagramNode x={0} y={0} w={200} h={64} title="spec" meta='{ "component": "Form" }' metaStyle="mono" />
    </svg>
  );
  expect(container.querySelector('g.tp-diagram-node')?.getAttribute('data-meta')).toBe('mono');
});
```

- [ ] **Step 2: Run to verify failure** — `npx nx test website`. Expected: the two new tests FAIL (scale type error surfaces at runtime as attribute mismatch; `data-meta` absent).

- [ ] **Step 3: Implement.** In `DiagramFrame.tsx` change the scale prop to:

```tsx
  /** Marketing pages render the same SVG larger; compact cards render it small with a bigger type ramp. */
  scale?: 'docs' | 'marketing' | 'compact';
```

In `DiagramNode.tsx` add to the props interface and destructuring:

```tsx
  /** 'mono' for code-shaped meta lines (JSON fragments, API names); default Inter. */
  metaStyle?: 'sans' | 'mono';
```

with `metaStyle = 'sans'` default, and add `data-meta={metaStyle}` to the `<g className="tp-diagram-node" …>` attributes. Extend the component JSDoc: compact-scale compositions author at a ~320 viewBox with the compact type ramp (eyebrow 10 / mono title 13.5 / sans title 12 / meta 11 / pill 10.5, in viewBox units) — same baseline offsets apply.

- [ ] **Step 4: CSS.** In `docs.css`, immediately after the existing `.tp-diagram-figure[data-scale="marketing"]` rule, add:

```css
/* Compact scale: card-sized diagrams (~320 viewBox). No floor — a compact
 * figure fills its card and never scrolls; legibility comes from the larger
 * type ramp below, not from render width. */
.tp-diagram-figure[data-scale="compact"] .tp-diagram-svg {
  min-width: 0;
  max-width: 100%;
}
.tp-diagram-figure[data-scale="compact"] .tp-diagram-eyebrow { font-size: 10px; }
.tp-diagram-figure[data-scale="compact"] .tp-diagram-title { font-size: 13.5px; }
.tp-diagram-figure[data-scale="compact"] .tp-diagram-node[data-title="sans"] .tp-diagram-title { font-size: 12px; }
.tp-diagram-figure[data-scale="compact"] .tp-diagram-meta { font-size: 11px; }
.tp-diagram-figure[data-scale="compact"] .tp-diagram-pill text { font-size: 10.5px; }
.tp-diagram-node[data-meta="mono"] .tp-diagram-meta { font-family: var(--font-mono); }
```

- [ ] **Step 5: Style contract.** In `style-contracts.spec.ts`, append after the `.tp-diagram-svg` entry:

```ts
  {
    file: 'docs.css',
    selector: '.tp-diagram-figure[data-scale="compact"] .tp-diagram-svg',
    why: 'Compact card diagrams must never inherit the 600px phone floor: inside a grid card that floor would force an internal scroll where none is affordable. Losing this override silently reintroduces it.',
    requires: {
      'min-width': /min-width:\s*0/,
    },
  },
```

- [ ] **Step 6: Run** `npx nx test website && npx nx lint website` — PASS, 0 errors.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/docs/diagrams apps/website/src/styles
git commit -m "feat(website): compact diagram scale + mono meta variant"
```

---

### Task 2: Generic DiagramSection; StackDiagramSection becomes a wrapper

**Files:**
- Create: `apps/website/src/components/landing/DiagramSection.tsx`
- Create: `apps/website/src/components/landing/DiagramSection.spec.tsx`
- Modify: `apps/website/src/components/landing/StackDiagramSection.tsx`

- [ ] **Step 1: Failing spec** (`DiagramSection.spec.tsx`):

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DiagramSection } from './DiagramSection';

describe('DiagramSection', () => {
  it('renders heading, body, and its diagram child', () => {
    const { container, getByText } = render(
      <DiagramSection id="j" eyebrow="Journey" headline="The headline" body="The body.">
        <figure className="tp-diagram-figure" data-scale="marketing" />
      </DiagramSection>
    );
    expect(getByText('The headline').tagName).toBe('H2');
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('j-heading');
    expect(container.querySelector('figure.tp-diagram-figure')).not.toBeNull();
  });
});
```

Run `npx nx test website` — FAIL (module not found).

- [ ] **Step 2: Implement `DiagramSection.tsx`** (the current StackDiagramSection body with the diagram generalized to children):

```tsx
// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';

interface DiagramSectionProps {
  id: string;
  eyebrow: string;
  headline: string;
  body: ReactNode;
  children: ReactNode;
}

/**
 * A landing section framing any kit diagram with a centered header + body.
 * The `.stack-diagram-*` classes predate the generalization and are shared.
 */
export function DiagramSection({ id, eyebrow, headline, body, children }: DiagramSectionProps) {
  return (
    <Section surface="tinted" id={id} ariaLabelledBy={`${id}-heading`}>
      <Container>
        <div className="stack-diagram-section">
          <SectionHeader variant="centered" eyebrow={eyebrow} heading={headline} headingId={`${id}-heading`} />
          <p className="stack-diagram-body">{body}</p>
          {children}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 3: Rewrite `StackDiagramSection.tsx` as a thin wrapper** (same public API, no visual change; its existing spec must keep passing untouched):

```tsx
// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react';
import { DiagramSection } from './DiagramSection';
import { StackDiagram, type StackHighlight } from '../docs/diagrams';

interface StackDiagramSectionProps {
  id: string;
  eyebrow: string;
  headline: string;
  body: ReactNode;
  highlight?: StackHighlight;
  caption?: string;
}

/** The canonical stack diagram in a DiagramSection frame (homepage + adapter pages). */
export function StackDiagramSection({ id, eyebrow, headline, body, highlight = 'none', caption }: StackDiagramSectionProps) {
  return (
    <DiagramSection id={id} eyebrow={eyebrow} headline={headline} body={body}>
      <StackDiagram highlight={highlight} caption={caption} scale="marketing" />
    </DiagramSection>
  );
}
```

- [ ] **Step 4: Run** `npx nx test website && npx nx lint website` — PASS (including the untouched `StackDiagramSection.spec.tsx`), 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing
git commit -m "refactor(website): generic DiagramSection; StackDiagramSection wraps it"
```

---

### Task 3: Compact compositions — StreamConcept + RenderConcept

**Files:**
- Create: `apps/website/src/components/docs/diagrams/StreamConcept.tsx`
- Create: `apps/website/src/components/docs/diagrams/RenderConcept.tsx`
- Modify: `apps/website/src/components/docs/diagrams/index.ts` (export both)
- Create: `apps/website/src/components/docs/diagrams/concepts.spec.tsx`

Before coding: read `/docs/langgraph/guides/streaming` and `/docs/render/getting-started/introduction` content files so every label matches the docs' own vocabulary; grep `libs/langgraph` for `injectAgent` and `libs/render` for the registry naming. Report label sources.

- [ ] **Step 1: Failing spec** (`concepts.spec.tsx`; later tasks append):

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StreamConcept } from './StreamConcept';
import { RenderConcept } from './RenderConcept';

/** Compact homepage concept cards: each must mount labeled, at compact scale,
 * and carry its load-bearing API/package names. */
describe('StreamConcept', () => {
  it('mounts compact with the signals claim', () => {
    const { container } = render(<StreamConcept />);
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('injectAgent()');
  });
});

describe('RenderConcept', () => {
  it('mounts compact and accents the your-components claim', () => {
    const { container } = render(<RenderConcept />);
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    expect(container.querySelectorAll('g.tp-diagram-node[data-tone="accent"]').length).toBeGreaterThan(0);
  });
});
```

Run `npx nx test website` — FAIL.

- [ ] **Step 2: Implement `StreamConcept.tsx`** (draft geometry — verify fit with the compact heuristics and adjust honestly, keeping the 4px-arrow and margin conventions; report changes):

```tsx
// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'concept-stream';

/** Homepage concept card: tokens arrive as signals; the UI updates itself. */
export function StreamConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={160}
      scale="compact"
      label="Streaming concept: a user message goes to injectAgent, tokens come back as signals, and the UI updates itself."
    >
      <DiagramNode x={16} y={16} w={116} h={44} title="User message" align="middle" titleStyle="sans" tone="dim" />
      <DiagramEdge d="M132 38 H146" slug={SLUG} arrow />
      <DiagramNode x={150} y={16} w={154} h={64} eyebrow="Signals" title="injectAgent()" meta="messages · status" tone="accent" />
      <DiagramEdge d="M227 80 V96" slug={SLUG} arrow />
      <DiagramNode x={100} y={100} w={180} h={44} title="UI updates itself" align="middle" titleStyle="sans" />
    </DiagramFrame>
  );
}
```

- [ ] **Step 3: Implement `RenderConcept.tsx`** (the spec fragment must be a REAL shape from the render docs — copy an abbreviated valid fragment from `/docs/render` content, mono meta via Task 1's `metaStyle`):

```tsx
// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'concept-render';

/** Homepage concept card: a JSON spec renders as your components. */
export function RenderConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={160}
      scale="compact"
      label="Generative UI concept: the agent emits a JSON spec; @threadplane/render resolves it through your registry into your own components."
    >
      <DiagramNode x={16} y={16} w={126} h={64} eyebrow="Spec" title='{ "type": …' meta='"props": { … } }' metaStyle="mono" tone="dim" />
      <DiagramEdge d="M142 48 H156" slug={SLUG} arrow />
      <DiagramNode x={160} y={16} w={144} h={64} eyebrow="Render" title="your registry" titleStyle="sans" meta="@threadplane/render" tone="accent" />
      <DiagramEdge d="M232 80 V96" slug={SLUG} arrow />
      <DiagramNode x={80} y={100} w={200} h={44} title="Your components, your styles" align="middle" titleStyle="sans" />
    </DiagramFrame>
  );
}
```

- [ ] **Step 4: Export both from `index.ts`; run** `npx nx test website && npx nx lint website` — PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/docs/diagrams
git commit -m "feat(website): Stream + Render compact concept diagrams"
```

---

### Task 4: Compact compositions — ApproveConcept + ShipConcept

**Files:**
- Create: `apps/website/src/components/docs/diagrams/ApproveConcept.tsx`
- Create: `apps/website/src/components/docs/diagrams/ShipConcept.tsx`
- Modify: `apps/website/src/components/docs/diagrams/index.ts`, `concepts.spec.tsx`

Before coding: read the interrupts guide and persistence guide content. Per the spec's §5 table: ApproveConcept stays runtime-neutral on durability; ShipConcept phrases against the contract, not a runtime.

- [ ] **Step 1: Append failing spec blocks** (imports at top):

```tsx
import { ApproveConcept } from './ApproveConcept';
import { ShipConcept } from './ShipConcept';

describe('ApproveConcept', () => {
  it('mounts compact with the interrupt/resume loop', () => {
    const { container } = render(<ApproveConcept />);
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('compact');
    const pills = Array.from(container.querySelectorAll('.tp-diagram-pill text')).map((t) => t.textContent);
    expect(pills).toContain('interrupt');
    expect(pills).toContain('resume');
  });
});

describe('ShipConcept', () => {
  it('mounts compact with the thread crossing reload and deploy', () => {
    const { container } = render(<ShipConcept />);
    const pills = Array.from(container.querySelectorAll('.tp-diagram-pill text')).map((t) => t.textContent);
    expect(pills).toContain('reload');
    expect(pills).toContain('deploy');
  });
});
```

Run — FAIL.

- [ ] **Step 2: Implement `ApproveConcept.tsx`** (the register-mock topology at compact scale; pills sit in edge breaks):

```tsx
// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'concept-approve';

/** Homepage concept card: nothing irreversible without a human. */
export function ApproveConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={184}
      scale="compact"
      label="Approval concept: the agent plans an action, an interrupt pauses the thread for a human decision, and resume continues exactly there."
    >
      <DiagramNode x={16} y={16} w={126} h={52} eyebrow="Agent" title="plans an action" titleStyle="sans" />
      <DiagramEdge d="M142 42 H154" slug={SLUG} />
      <DiagramPill cx={182} cy={42} w={62} label="interrupt" />
      <DiagramEdge d="M210 42 H222" slug={SLUG} arrow />
      <DiagramNode x={226} y={16} w={78} h={52} eyebrow="Human" title="decide" titleStyle="sans" tone="accent" />
      <DiagramEdge d="M265 68 V104 H120" slug={SLUG} />
      <DiagramPill cx={92} cy={104} w={56} label="resume" />
      <DiagramEdge d="M64 104 H79 M79 104 V120" slug={SLUG} arrow />
      <DiagramNode x={16} y={124} w={126} h={44} title="acts — or doesn't" align="middle" titleStyle="sans" />
    </DiagramFrame>
  );
}
```

Note the resume loop runs right-to-left then down; verify pill breaks leave no line under either pill and the final arrow lands 4px above the bottom node. Adjust coordinates honestly and report.

- [ ] **Step 3: Implement `ShipConcept.tsx`** (a thread line crossing survival events):

```tsx
// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'concept-ship';

/** Homepage concept card: the thread survives everything between question and answer. */
export function ShipConcept() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={320}
      viewHeight={140}
      scale="compact"
      label="Durability concept: a thread starts, survives a page reload and a deploy, and resumes with its history intact."
    >
      <DiagramNode x={16} y={44} w={78} h={52} eyebrow="Thread" title="starts" titleStyle="sans" />
      <DiagramEdge d="M94 70 H106" slug={SLUG} />
      <DiagramPill cx={132} cy={70} w={52} label="reload" />
      <DiagramEdge d="M158 70 H168" slug={SLUG} />
      <DiagramPill cx={194} cy={70} w={52} label="deploy" />
      <DiagramEdge d="M220 70 H232" slug={SLUG} arrow />
      <DiagramNode x={236} y={44} w={68} h={52} eyebrow="Thread" title="resumes" titleStyle="sans" tone="accent" />
    </DiagramFrame>
  );
}
```

- [ ] **Step 4: Export from `index.ts`; run tests + lint** — PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/docs/diagrams
git commit -m "feat(website): Approve + Ship compact concept diagrams"
```

---

### Task 5: HomeConceptGrid section + homepage insertion

**Files:**
- Create: `apps/website/src/components/landing/HomeConceptGrid.tsx`
- Create: `apps/website/src/components/landing/HomeConceptGrid.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (grid + card classes)
- Modify: `apps/website/src/app/page.tsx` (insert after the Architecture section)

Before coding: re-read `page.tsx` and the FeatureBlock headings so no card sentence duplicates a neighboring headline; confirm the anchors `#stream`, `#render`, `#ship`, `#approve` exist as FeatureBlock ids.

- [ ] **Step 1: Failing spec:**

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { HomeConceptGrid } from './HomeConceptGrid';

describe('HomeConceptGrid', () => {
  it('renders four compact concept cards with anchor links', () => {
    const { container } = render(<HomeConceptGrid />);
    expect(container.querySelectorAll('.home-concept-card')).toHaveLength(4);
    expect(container.querySelectorAll('figure[data-scale="compact"]')).toHaveLength(4);
    const hrefs = Array.from(container.querySelectorAll('a.home-concept-link')).map((a) => a.getAttribute('href'));
    expect(hrefs).toEqual(['#stream', '#render', '#approve', '#ship']);
  });

  it('is a labeled section', () => {
    const { container } = render(<HomeConceptGrid />);
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('how-it-works-heading');
  });
});
```

Run — FAIL.

- [ ] **Step 2: Implement `HomeConceptGrid.tsx`:**

```tsx
// SPDX-License-Identifier: MIT
import type { ReactNode } from 'react';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { SectionHeader } from '../ui/SectionHeader';
import { StreamConcept, RenderConcept, ApproveConcept, ShipConcept } from '../docs/diagrams';

interface ConceptCard {
  anchor: string;
  title: string;
  sentence: string;
  diagram: ReactNode;
}

/** Card order mirrors the FeatureBlock order below (stream, render, approve, ship). */
const CARDS: ConceptCard[] = [
  {
    anchor: '#stream',
    title: 'Stream',
    sentence: 'Tokens arrive as signals — the UI updates itself, no subscription plumbing.',
    diagram: <StreamConcept />,
  },
  {
    anchor: '#render',
    title: 'Render',
    sentence: 'Agent output arrives as a JSON spec and renders as your components.',
    diagram: <RenderConcept />,
  },
  {
    anchor: '#approve',
    title: 'Approve',
    sentence: 'Interrupts pause the thread for a human decision, then resume exactly there.',
    diagram: <ApproveConcept />,
  },
  {
    anchor: '#ship',
    title: 'Ship',
    sentence: 'Threads live behind the Agent contract — they outlast reloads and deploys.',
    diagram: <ShipConcept />,
  },
];

export function HomeConceptGrid() {
  return (
    <Section surface="canvas" id="how-it-works" ariaLabelledBy="how-it-works-heading">
      <Container>
        <div className="home-concept">
          <SectionHeader
            variant="centered"
            eyebrow="How it works"
            heading="Four ideas carry the whole surface"
            headingId="how-it-works-heading"
          />
          <div className="home-concept-grid">
            {CARDS.map((card) => (
              <div key={card.anchor} className="home-concept-card">
                {card.diagram}
                <h3 className="home-concept-title">{card.title}</h3>
                <p className="home-concept-sentence">{card.sentence}</p>
                <a className="home-concept-link" href={card.anchor}>
                  See it live
                </a>
              </div>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

Card ORDER in `CARDS` must match the spec test (`stream, render, approve, ship`). The heading must not rhyme with the Architecture headline ("Your UI talks to one contract, never to a runtime") or the DemoShowcase heading ("One chat UI. Two runtimes. Same code.") — the draft above satisfies that; improve it only if you find something better while reading the page, and report.

- [ ] **Step 3: CSS** — append to `landing.css`:

```css
/* HomeConceptGrid */
.home-concept {
  display: flex;
  flex-direction: column;
  gap: 28px;
}
.home-concept-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 20px;
}
@media (max-width: 767px) {
  .home-concept-grid {
    grid-template-columns: 1fr;
  }
}
.home-concept-card {
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-lg);
  padding: 20px 20px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.home-concept-card .tp-diagram-figure {
  margin: 0 0 10px;
}
.home-concept-title {
  font-family: var(--font-inter);
  font-size: 1rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin: 0;
}
.home-concept-sentence {
  font-family: var(--font-inter);
  font-size: 0.9rem;
  line-height: 1.55;
  color: var(--color-text-secondary);
  margin: 0;
}
.home-concept-link {
  font-family: var(--font-mono);
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--color-accent);
  text-decoration: none;
  margin-top: 4px;
}
.home-concept-link:hover {
  text-decoration: underline;
}
```

- [ ] **Step 4: Homepage insertion** — in `page.tsx`, import `HomeConceptGrid` and insert directly AFTER the `<StackDiagramSection … id="architecture" …/>` block and BEFORE the DemoShowcase `<Section>`. The architecture section is tinted and DemoShowcase is canvas; this section is canvas — verify the resulting surface sequence alternates (tinted → canvas → canvas is acceptable only if the card grid visually separates; if it reads as one blob, switch DemoShowcase's neighbor handling is NOT in scope — instead give this section `surface="tinted"`? NO: two adjacent tinted sections (architecture + this) would blob. Keep `canvas` and verify in the browser; report what you see).

- [ ] **Step 5: Run tests + lint; then dev-server check** — load `/`, confirm the grid renders 2×2 desktop / 1-col at 375px, cards never scroll internally, anchors jump to the FeatureBlocks.

- [ ] **Step 6: Commit**

```bash
git add -A apps/website
git commit -m "feat(website): homepage How-it-works concept grid"
```

---

### Task 6: RenderTransform + /render section

**Files:**
- Create: `apps/website/src/components/docs/diagrams/RenderTransform.tsx`
- Modify: `apps/website/src/components/docs/diagrams/index.ts`, `compositions.spec.tsx`
- Modify: `apps/website/src/app/render/page.tsx` (DiagramSection after the hero)

Before coding: read `/render`'s page.tsx fully (hero is `surface="canvas"`, first FeatureBlock id="schemas") and the render docs for a REAL abbreviated spec fragment and honest pill labels (the prior arc established: no "validated spec" — validation is the app's job).

- [ ] **Step 1: Append failing spec block** to `compositions.spec.tsx`:

```tsx
import { RenderTransform } from './RenderTransform';

describe('RenderTransform', () => {
  it('mounts at standard scale with spec, render, and result stages', () => {
    const { container } = render(<RenderTransform />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/render');
    expect(container.querySelectorAll('.tp-diagram-pill')).toHaveLength(2);
  });
});
```

Run — FAIL.

- [ ] **Step 2: Implement `RenderTransform.tsx`** (640 viewBox, horizontal, mono-meta spec fragment; draft — verify fit + honest labels):

```tsx
// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'render-transform';

/** /render marketing graphic: schema on the wire, your design system on screen. */
export function RenderTransform() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={150}
      label="Generative UI transform: the agent emits a JSON spec; @threadplane/render resolves it through your registry, state, and handlers into components you own."
    >
      <DiagramNode
        x={20} y={40} w={170} h={70}
        eyebrow="On the wire" title='{ "type": "form",' meta='  "props": { … } }' metaStyle="mono" tone="dim"
      />
      <DiagramEdge d="M190 75 H206" slug={SLUG} />
      <DiagramPill cx={238} cy={75} w={80} label="JSON Spec" />
      <DiagramEdge d="M278 75 H292" slug={SLUG} arrow />
      <DiagramNode
        x={296} y={40} w={180} h={70}
        eyebrow="Renderer" title="@threadplane/render" meta="registry · state · handlers" tone="accent"
      />
      <DiagramEdge d="M476 75 H488" slug={SLUG} arrow />
      <DiagramNode
        x={492} y={40} w={128} h={70}
        eyebrow="On screen" title="your components" titleStyle="sans" meta="your styles · your rules"
      />
    </DiagramFrame>
  );
}
```

(That draft has only one pill; the spec test requires 2 — add a second pill labeled `bindings + events` in an edge break between renderer and result, widening the gap accordingly, or change the geometry honestly and update the test to the final pill count. Either way test and diagram must agree AND labels must be verified against the render docs.)

- [ ] **Step 3: Insert on `/render`** — in `render/page.tsx`, import `DiagramSection` and `RenderTransform`, insert after the hero `</Section>`:

```tsx
<DiagramSection
  id="render-transform"
  eyebrow="Generative UI"
  headline="Schema on the wire, your design system on screen"
  body="The agent never emits HTML. It emits a spec your registry resolves — so generated UI ships with your components, your styles, and your rules."
>
  <RenderTransform />
</DiagramSection>
```

Check the page's existing headings for copy collisions (esp. the `#schemas` FeatureBlock) and adjust minimally; report.

- [ ] **Step 4: Tests + lint + dev-server check of `/render`; commit**

```bash
git add -A apps/website
git commit -m "feat(website): render transform graphic on /render"
```

---

### Task 7: PilotJourney + /pilot-to-prod section

**Files:**
- Create: `apps/website/src/components/docs/diagrams/PilotJourney.tsx`
- Modify: `apps/website/src/components/docs/diagrams/index.ts`, `compositions.spec.tsx`
- Modify: `apps/website/src/app/pilot-to-prod/page.tsx`

MANDATORY first step: read `pilot-to-prod/page.tsx` in full. The page's phases are its FeatureBlocks (`id="discover"`, `id="build"`, `id="harden"`) plus an outcomes section — the diagram's phase titles and meta deliverables MUST be lifted from that copy verbatim-or-abbreviated, not invented. The draft below uses the block ids as titles; replace metas with the page's actual row copy and report the mapping.

- [ ] **Step 1: Append failing spec block:**

```tsx
import { PilotJourney } from './PilotJourney';

describe('PilotJourney', () => {
  it('mounts with three phase nodes on the journey line', () => {
    const { container } = render(<PilotJourney />);
    expect(container.querySelectorAll('g.tp-diagram-node')).toHaveLength(3);
    expect(container.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBeTruthy();
  });
});
```

Run — FAIL.

- [ ] **Step 2: Implement `PilotJourney.tsx`** (draft; metas to be replaced from the page):

```tsx
// SPDX-License-Identifier: MIT
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'pilot-journey';

/** /pilot-to-prod: the engagement as three phases with concrete gates. */
export function PilotJourney() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={170}
      label="Pilot to production journey: discover, build, and harden phases connected by concrete gates."
    >
      <DiagramNode x={24} y={40} w={180} h={84} eyebrow="Phase 1" title="Discover" titleStyle="sans" meta="replace from page copy" />
      <DiagramEdge d="M204 82 H218" slug={SLUG} />
      <DiagramPill cx={252} cy={82} w={90} label="gate label" />
      <DiagramEdge d="M297 82 H311" slug={SLUG} arrow />
      <DiagramNode x={315} y={40} w={150} h={84} eyebrow="Phase 2" title="Build" titleStyle="sans" meta="replace from page copy" tone="accent" />
      <DiagramEdge d="M465 82 H479" slug={SLUG} arrow />
      <DiagramNode x={483} y={40} w={136} h={84} eyebrow="Phase 3" title="Harden" titleStyle="sans" meta="replace from page copy" />
    </DiagramFrame>
  );
}
```

The two literal strings `"replace from page copy"` and `"gate label"` are DELIBERATE red flags: the implementer MUST substitute the page's real deliverables/gates (abbreviated to fit the standard-scale meta heuristic) before committing, and the reviewer must diff them against the page. A commit containing those literals is a task failure. Only one of the two inter-phase gaps has a gate pill in the draft; add the second gate pill (with an edge break) if the page copy provides a natural second gate, else remove the first for symmetry — report the choice.

- [ ] **Step 3: Insert on the page** — after the hero `</Section>` in `pilot-to-prod/page.tsx`:

```tsx
<DiagramSection
  id="pilot-journey"
  eyebrow="The engagement"
  headline="Three phases, each with a gate you can point at"
  body="No open-ended consulting arc: each phase ends with something running that you keep."
>
  <PilotJourney />
</DiagramSection>
```

Verify heading/body against the page's hero + outcomes copy for collisions; adjust minimally and report.

- [ ] **Step 4: Tests + lint + dev-server check; commit**

```bash
git add -A apps/website
git commit -m "feat(website): pilot journey graphic on /pilot-to-prod"
```

---

### Task 8: Communication audit (spec §5 gate)

**Files:** none expected (fixes only if the audit fails a row)

- [ ] **Step 1:** For each of the six graphics, verify its §5 table row against the actual docs/libs on disk:
  - StreamConcept: does any label imply zero setup? (`provideAgent` is required — the card must not deny it.)
  - RenderConcept/RenderTransform: no validation implied; spec fragments match a real documented shape (`grep` the render docs for the fragment's keys).
  - ApproveConcept: labels runtime-neutral (no LangGraph-only durability claim). Check the interrupts guide + the ag-ui event mapping for what both runtimes support.
  - ShipConcept: phrased against the Agent contract; confirm the langgraph persistence docs support "outlast reloads and deploys" and that nothing claims AG-UI history (out of scope per its own intro).
  - PilotJourney: every meta string traceable to `pilot-to-prod/page.tsx` copy.
- [ ] **Step 2:** Check the homepage reads as three distinct layers (architecture → how-it-works → demo): load `/`, read the three headings in sequence; no rhyme, no repeated claim. Fix copy if needed.
- [ ] **Step 3:** `grep -rn "CopilotKit" apps/website/src apps/website/content` → must return nothing new (competitor-mention rule).
- [ ] **Step 4:** Write the audit findings (row-by-row pass/fail + any fixes made) into the task report. Commit any fixes:

```bash
git add -A apps/website
git commit -m "fix(website): communication-audit fixes for concept graphics"
```

(Skip the commit if nothing needed fixing.)

---

### Task 9: Full verification pass

- [ ] **Step 1:** `rm -rf apps/website/.next && npx nx test website --skip-nx-cache && npx nx lint website` — PASS, 0 lint errors.
- [ ] **Step 2:** `npx nx build website --configuration=production` — green. (If Turbopack panics with "leaves the filesystem root", `rm -rf apps/website/.next` first — stale dev artifacts.)
- [ ] **Step 3:** Playwright docs suite still green: `cd apps/website && npx playwright test --grep "Docs slug page"` (kit CSS changed; the docs pages must be unaffected).
- [ ] **Step 4:** Browser sweep at 375px and desktop: `/` (grid 2×2 → 1-col, compact cards never scroll, anchors work), `/render`, `/pilot-to-prod` (sections alternate surfaces, diagrams scroll internally only at standard scale), plus one docs page spot-check (`/docs/ag-ui/getting-started/introduction`) to confirm compact CSS leaked nothing.
- [ ] **Step 5:** Commit any sweep fixes:

```bash
git add -A apps/website
git commit -m "fix(website): verification-sweep fixes for concept graphics"
```
