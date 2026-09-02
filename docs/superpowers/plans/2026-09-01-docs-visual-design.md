# Docs Visual Design Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the left-border docs callout with a header-band design, build an SVG diagram kit, replace all 5 ascii diagrams, add a "How it fits" diagram to every library intro, and add the master stack diagram to the homepage + adapter landing pages.

**Architecture:** A four-primitive SVG kit (`DiagramFrame`/`DiagramNode`/`DiagramEdge`/`DiagramPill`) in `apps/website/src/components/docs/diagrams/`, styled entirely by classes in `docs.css` (token vars only — an ESLint guard bans new static inline `style` props). Hand-placed compositions per diagram; one parametrized `StackDiagram` covers the canonical chat→contract→adapters→backends picture with a `highlight` prop, reused by four docs pages, two blog posts, and three marketing pages.

**Tech Stack:** Next.js (apps/website), MDX via next-mdx-remote (`MdxRenderer` components map), vitest + @testing-library/react, `npx nx test website` / `npx nx lint website`.

**Spec:** `docs/superpowers/specs/2026-09-01-docs-visual-design-design.md`

**Conventions for every task:**
- Working dir: repo root. Website content: `apps/website/content/docs/`, components: `apps/website/src/components/`, styles: `apps/website/src/styles/docs.css`.
- Specs are vitest + jsdom: start files with `// @vitest-environment jsdom` (see `apps/website/src/components/docs/LibraryMark.spec.tsx` for the idiom).
- Run tests with `npx nx test website` (full suite, fast, ~350 tests). Lint with `npx nx lint website`.
- NO inline `style` props anywhere (lint error). SVG geometry (x/y/width/d/viewBox) as attributes is fine; all colors/fonts go through CSS classes using `var(--color-*)` / `var(--font-*)`.

---

### Task 1: Callout header-band redesign

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Callout.tsx` (full rewrite)
- Modify: `apps/website/src/styles/docs.css:372-439` (replace the whole `mdx — Callout` block)
- Create: `apps/website/src/components/docs/mdx/Callout.spec.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Callout } from './Callout';

describe('Callout', () => {
  it('renders a header band with the given title and tone', () => {
    const { container } = render(
      <Callout type="warning" title="Heads up">body text</Callout>
    );
    const root = container.querySelector('[data-mdx="callout"]');
    expect(root?.getAttribute('data-tone')).toBe('warning');
    const band = container.querySelector('.mdx-callout-band');
    expect(band?.textContent).toContain('Heads up');
    expect(band?.querySelector('svg')).not.toBeNull();
  });

  it.each([
    ['info', 'Note'],
    ['tip', 'Tip'],
    ['warning', 'Warning'],
    ['danger', 'Danger'],
  ] as const)('falls back to the kind label for %s when title is omitted', (type, label) => {
    const { container } = render(<Callout type={type}>body</Callout>);
    expect(container.querySelector('.mdx-callout-title')?.textContent).toBe(label);
  });

  it('defaults to info and renders children in the body', () => {
    const { container } = render(<Callout>the body</Callout>);
    expect(container.querySelector('[data-mdx="callout"]')?.getAttribute('data-tone')).toBe('info');
    expect(container.querySelector('.mdx-callout-body')?.textContent).toBe('the body');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website`
Expected: the three new Callout tests FAIL (no `.mdx-callout-band` in the current markup); all pre-existing tests still pass.

- [ ] **Step 3: Rewrite `Callout.tsx`**

```tsx
import type { ReactNode } from 'react';

type CalloutType = 'tip' | 'warning' | 'info' | 'danger';

interface Props {
  type?: CalloutType;
  title?: string;
  children: ReactNode;
}

/** Band label when the author gives no title — the band never renders empty. */
const KIND_LABEL: Record<CalloutType, string> = {
  tip: 'Tip',
  warning: 'Warning',
  info: 'Note',
  danger: 'Danger',
};

const ICON_PATHS: Record<CalloutType, ReactNode> = {
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5M12 8h.01" />
    </>
  ),
  tip: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m8.5 12.5 2.5 2.5 4.5-5" />
    </>
  ),
  warning: (
    <>
      <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0Z" />
      <path d="M12 9v4M12 17h.01" />
    </>
  ),
  danger: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="m9 9 6 6M15 9l-6 6" />
    </>
  ),
};

export function Callout({ type = 'info', title, children }: Props) {
  return (
    <div data-mdx="callout" data-tone={type}>
      <div className="mdx-callout-band">
        <svg
          className="mdx-callout-icon"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          {ICON_PATHS[type]}
        </svg>
        <strong className="mdx-callout-title">{title ?? KIND_LABEL[type]}</strong>
      </div>
      <div className="mdx-callout-body">{children}</div>
    </div>
  );
}
```

- [ ] **Step 4: Replace the callout CSS block**

In `apps/website/src/styles/docs.css`, replace everything from `/* mdx — Callout */` (line 372) through the end of `.mdx-callout-body { ... }` (line 439) with:

```css
/* mdx — Callout (header band; tone via custom properties) */
[data-mdx="callout"] {
  --callout-tone-text: var(--color-accent);
  --callout-tone-surface: rgba(0, 64, 144, 0.06);
  background: var(--color-surface);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-md);
  overflow: hidden;
  margin: 20px 0;
}
[data-mdx="callout"][data-tone="tip"] {
  --callout-tone-text: #1a7a40;
  --callout-tone-surface: rgba(26, 122, 64, 0.07);
}
[data-mdx="callout"][data-tone="warning"] {
  /* Band text darkened from #D4850F for contrast on the tint. */
  --callout-tone-text: #b26d06;
  --callout-tone-surface: rgba(212, 133, 15, 0.08);
}
[data-mdx="callout"][data-tone="danger"] {
  --callout-tone-text: var(--color-angular-red);
  --callout-tone-surface: rgba(221, 0, 49, 0.06);
}
.mdx-callout-band {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 14px;
  background: var(--callout-tone-surface);
  border-bottom: 1px solid var(--color-border);
  color: var(--callout-tone-text);
}
.mdx-callout-icon {
  width: 14px;
  height: 14px;
  flex-shrink: 0;
}
.mdx-callout-title {
  font-family: Inter, system-ui, sans-serif;
  font-size: 13px;
  font-weight: 600;
  color: var(--callout-tone-text);
}
.mdx-callout-body {
  padding: 12px 14px;
  font-family: var(--font-inter);
  font-size: 15px;
  line-height: 1.6;
  color: var(--color-text-secondary);
}
.mdx-callout-body > :first-child { margin-top: 0; }
.mdx-callout-body > :last-child { margin-bottom: 0; }
```

Note: `.mdx-callout-header` / `.mdx-callout-header[data-has-title]` and the four `.mdx-callout-icon` background rules are gone. Grep for stale references: `grep -rn "mdx-callout-header" apps/website/src` must return nothing.

- [ ] **Step 5: Run tests + lint**

Run: `npx nx test website && npx nx lint website`
Expected: all tests PASS, lint clean.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/docs/mdx/Callout.tsx apps/website/src/components/docs/mdx/Callout.spec.tsx apps/website/src/styles/docs.css
git commit -m "feat(website): header-band docs callouts, retiring the left border"
```

---

### Task 2: Diagram kit primitives

**Files:**
- Create: `apps/website/src/components/docs/diagrams/DiagramFrame.tsx`
- Create: `apps/website/src/components/docs/diagrams/DiagramNode.tsx`
- Create: `apps/website/src/components/docs/diagrams/DiagramEdge.tsx`
- Create: `apps/website/src/components/docs/diagrams/DiagramPill.tsx`
- Create: `apps/website/src/components/docs/diagrams/primitives.spec.tsx`
- Modify: `apps/website/src/styles/docs.css` (append kit classes at end of the mdx components region, right before the `DocsSidebar` comment block at ~line 713)

- [ ] **Step 1: Write the failing spec**

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

describe('diagram kit primitives', () => {
  it('DiagramFrame renders a labeled svg with dot ground, arrow marker, and caption', () => {
    const { container, getByText } = render(
      <DiagramFrame slug="t" viewWidth={640} viewHeight={200} label="test diagram" caption="a caption">
        <DiagramEdge d="M10 10 H100" slug="t" arrow />
      </DiagramFrame>
    );
    const svg = container.querySelector('svg.tp-diagram-svg');
    expect(svg?.getAttribute('viewBox')).toBe('0 0 640 200');
    expect(svg?.getAttribute('aria-label')).toBe('test diagram');
    expect(container.querySelector('pattern#t-dots')).not.toBeNull();
    expect(container.querySelector('marker#t-arrow')).not.toBeNull();
    expect(container.querySelector('path.tp-diagram-edge')?.getAttribute('marker-end')).toBe('url(#t-arrow)');
    expect(getByText('a caption').tagName).toBe('FIGCAPTION');
  });

  it('DiagramFrame passes the marketing scale through as a data attribute', () => {
    const { container } = render(
      <DiagramFrame slug="m" viewWidth={640} viewHeight={200} label="x" scale="marketing">
        <g />
      </DiagramFrame>
    );
    expect(container.querySelector('figure')?.getAttribute('data-scale')).toBe('marketing');
  });

  it('DiagramNode renders eyebrow, title, meta and tone', () => {
    const { container } = render(
      <svg>
        <DiagramNode x={0} y={0} w={200} h={64} eyebrow="Adapter" title="@threadplane/ag-ui" meta="toAgent()" tone="accent" />
      </svg>
    );
    const g = container.querySelector('g.tp-diagram-node');
    expect(g?.getAttribute('data-tone')).toBe('accent');
    expect(g?.querySelector('.tp-diagram-eyebrow')?.textContent).toBe('ADAPTER');
    expect(g?.querySelector('.tp-diagram-title')?.textContent).toBe('@threadplane/ag-ui');
    expect(g?.querySelector('.tp-diagram-meta')?.textContent).toBe('toAgent()');
  });

  it('DiagramNode centers a title-only node when align is middle', () => {
    const { container } = render(
      <svg>
        <DiagramNode x={0} y={0} w={200} h={40} title="LangGraph Platform" align="middle" titleStyle="sans" tone="dim" />
      </svg>
    );
    const title = container.querySelector('.tp-diagram-title');
    expect(title?.getAttribute('text-anchor')).toBe('middle');
    expect(container.querySelector('g.tp-diagram-node')?.getAttribute('data-title')).toBe('sans');
  });

  it('DiagramPill renders a centered label', () => {
    const { container } = render(
      <svg>
        <DiagramPill cx={100} cy={50} w={120} label="SSE" />
      </svg>
    );
    const text = container.querySelector('.tp-diagram-pill text');
    expect(text?.textContent).toBe('SSE');
    expect(text?.getAttribute('text-anchor')).toBe('middle');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website`
Expected: FAIL — modules not found.

- [ ] **Step 3: Implement the four primitives**

`DiagramFrame.tsx`:

```tsx
import type { ReactNode } from 'react';

interface DiagramFrameProps {
  /** Unique per rendered diagram; namespaces the SVG defs ids (`{slug}-dots`, `{slug}-arrow`). */
  slug: string;
  viewWidth: number;
  viewHeight: number;
  /** Accessible one-sentence description of what the diagram shows. */
  label: string;
  caption?: string;
  /** Marketing pages render the same SVG larger. */
  scale?: 'docs' | 'marketing';
  children: ReactNode;
}

export function DiagramFrame({
  slug,
  viewWidth,
  viewHeight,
  label,
  caption,
  scale = 'docs',
  children,
}: DiagramFrameProps) {
  return (
    <figure className="tp-diagram-figure" data-scale={scale}>
      <svg
        className="tp-diagram-svg"
        viewBox={`0 0 ${viewWidth} ${viewHeight}`}
        role="img"
        aria-label={label}
      >
        <defs>
          <pattern id={`${slug}-dots`} width="16" height="16" patternUnits="userSpaceOnUse">
            <circle className="tp-diagram-dot" cx="1" cy="1" r="1" />
          </pattern>
          <marker
            id={`${slug}-arrow`}
            viewBox="0 0 8 8"
            refX="7"
            refY="4"
            markerWidth="7"
            markerHeight="7"
            orient="auto-start-reverse"
          >
            <path
              className="tp-diagram-arrowhead"
              d="M1 1 L7 4 L1 7"
              strokeWidth="1.4"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </marker>
        </defs>
        <rect width={viewWidth} height={viewHeight} rx="10" fill={`url(#${slug}-dots)`} />
        {children}
      </svg>
      {caption ? <figcaption className="tp-diagram-caption">{caption}</figcaption> : null}
    </figure>
  );
}
```

`DiagramNode.tsx`:

```tsx
interface DiagramNodeProps {
  x: number;
  y: number;
  w: number;
  h: number;
  title: string;
  eyebrow?: string;
  meta?: string;
  tone?: 'neutral' | 'accent' | 'dim';
  /** 'middle' centers text horizontally (title-only summary nodes). */
  align?: 'start' | 'middle';
  /** 'sans' for prose-y titles (backend lists); default mono for package names. */
  titleStyle?: 'mono' | 'sans';
}

const PAD = 16;

export function DiagramNode({
  x,
  y,
  w,
  h,
  title,
  eyebrow,
  meta,
  tone = 'neutral',
  align = 'start',
  titleStyle = 'mono',
}: DiagramNodeProps) {
  const tx = align === 'middle' ? x + w / 2 : x + PAD;
  const anchor = align === 'middle' ? 'middle' : undefined;
  // Baselines: with an eyebrow the stack is eyebrow/title/meta; without it the
  // title floats up; a title-only node vertically centers.
  const titleY = eyebrow ? y + 38 : meta ? y + 26 : y + h / 2 + 4;
  const metaY = eyebrow ? y + 54 : y + 42;
  return (
    <g className="tp-diagram-node" data-tone={tone} data-title={titleStyle}>
      <rect x={x} y={y} width={w} height={h} rx="10" />
      {eyebrow ? (
        <text className="tp-diagram-eyebrow" x={tx} y={y + 20} textAnchor={anchor}>
          {eyebrow.toUpperCase()}
        </text>
      ) : null}
      <text className="tp-diagram-title" x={tx} y={titleY} textAnchor={anchor}>
        {title}
      </text>
      {meta ? (
        <text className="tp-diagram-meta" x={tx} y={metaY} textAnchor={anchor}>
          {meta}
        </text>
      ) : null}
    </g>
  );
}
```

`DiagramEdge.tsx`:

```tsx
interface DiagramEdgeProps {
  /** SVG path data; orthogonal segments (H/V) preferred. */
  d: string;
  /** DiagramFrame slug — required when arrow is true, to reference `{slug}-arrow`. */
  slug?: string;
  arrow?: boolean;
}

export function DiagramEdge({ d, slug, arrow = false }: DiagramEdgeProps) {
  return (
    <path
      className="tp-diagram-edge"
      d={d}
      markerEnd={arrow && slug ? `url(#${slug}-arrow)` : undefined}
    />
  );
}
```

`DiagramPill.tsx`:

```tsx
interface DiagramPillProps {
  /** Center of the pill. */
  cx: number;
  cy: number;
  w: number;
  label: string;
}

const PILL_H = 24;

export function DiagramPill({ cx, cy, w, label }: DiagramPillProps) {
  return (
    <g className="tp-diagram-pill">
      <rect x={cx - w / 2} y={cy - PILL_H / 2} width={w} height={PILL_H} rx={PILL_H / 2} />
      <text x={cx} y={cy + 3.5} textAnchor="middle">
        {label}
      </text>
    </g>
  );
}
```

- [ ] **Step 4: Append kit CSS to `docs.css`**

Insert immediately before the `/*\n * DocsSidebar` comment block:

```css
/* mdx — diagram kit (components/docs/diagrams/*) */
.tp-diagram-figure {
  margin: 24px 0;
  overflow-x: auto;
}
.tp-diagram-svg {
  display: block;
  width: 100%;
  min-width: 480px;
  max-width: 680px;
  margin: 0 auto;
}
.tp-diagram-figure[data-scale="marketing"] .tp-diagram-svg {
  max-width: 860px;
}
.tp-diagram-dot { fill: var(--color-border); }
.tp-diagram-caption {
  font-family: var(--font-inter);
  font-size: 13px;
  color: var(--color-text-muted);
  text-align: center;
  margin-top: 10px;
}
.tp-diagram-node rect {
  fill: var(--color-surface);
  stroke: var(--color-border);
}
.tp-diagram-node[data-tone="accent"] rect {
  fill: var(--color-accent-surface);
  stroke: var(--color-accent-border);
}
.tp-diagram-node[data-tone="dim"] rect {
  fill: var(--color-surface-dim);
  stroke: var(--color-border);
}
.tp-diagram-eyebrow {
  font-family: var(--font-mono);
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.1em;
  fill: var(--color-text-muted);
}
.tp-diagram-node[data-tone="accent"] .tp-diagram-eyebrow { fill: var(--color-accent); }
.tp-diagram-title {
  font-family: var(--font-mono);
  font-size: 12.5px;
  font-weight: 700;
  fill: var(--color-text-primary);
}
.tp-diagram-node[data-title="sans"] .tp-diagram-title {
  font-family: var(--font-inter);
  font-size: 11px;
  font-weight: 600;
  fill: var(--color-text-secondary);
}
.tp-diagram-meta {
  font-family: var(--font-inter);
  font-size: 10.5px;
  fill: var(--color-text-muted);
}
.tp-diagram-edge {
  fill: none;
  stroke: var(--color-text-muted);
  stroke-width: 1.2;
}
.tp-diagram-arrowhead {
  fill: none;
  stroke: var(--color-text-muted);
}
.tp-diagram-pill rect {
  fill: var(--color-accent-surface);
  stroke: var(--color-accent-border);
}
.tp-diagram-pill text {
  font-family: var(--font-mono);
  font-size: 10px;
  fill: var(--color-accent);
  text-anchor: middle;
}
```

- [ ] **Step 5: Run tests + lint**

Run: `npx nx test website && npx nx lint website`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/docs/diagrams apps/website/src/styles/docs.css
git commit -m "feat(website): SVG diagram kit primitives on a dot grid"
```

---

### Task 3: StackDiagram composition + MDX registration

**Files:**
- Create: `apps/website/src/components/docs/diagrams/StackDiagram.tsx`
- Create: `apps/website/src/components/docs/diagrams/StackDiagram.spec.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`

- [ ] **Step 1: Write the failing spec**

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StackDiagram } from './StackDiagram';

function toneOf(container: HTMLElement, title: string): string | null {
  const titles = Array.from(container.querySelectorAll('.tp-diagram-title'));
  const t = titles.find((el) => el.textContent === title);
  return t?.closest('g.tp-diagram-node')?.getAttribute('data-tone') ?? null;
}

describe('StackDiagram', () => {
  it('renders the canonical five-node stack', () => {
    const { container } = render(<StackDiagram />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/chat');
    expect(titles).toContain('@threadplane/langgraph');
    expect(titles).toContain('@threadplane/ag-ui');
    expect(container.querySelector('.tp-diagram-pill text')?.textContent).toBe('Agent contract · signals + events$');
  });

  it.each([
    ['ag-ui', '@threadplane/ag-ui'],
    ['langgraph', '@threadplane/langgraph'],
    ['chat', '@threadplane/chat'],
  ] as const)('highlight=%s accents that node', (highlight, title) => {
    const { container } = render(<StackDiagram highlight={highlight} />);
    expect(toneOf(container, title)).toBe('accent');
  });

  it('highlight=runtimes accents the backend row', () => {
    const { container } = render(<StackDiagram highlight="runtimes" />);
    expect(toneOf(container, 'LangGraph Platform')).toBe('accent');
    expect(toneOf(container, 'CrewAI · Mastra · MS Agent Fwk · Strands · …')).toBe('accent');
  });

  it('renders a caption when given', () => {
    const { getByText } = render(<StackDiagram caption="the caption" />);
    expect(getByText('the caption')).not.toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement `StackDiagram.tsx`**

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

export type StackHighlight = 'none' | 'chat' | 'langgraph' | 'ag-ui' | 'runtimes' | 'contract';

interface StackDiagramProps {
  highlight?: StackHighlight;
  caption?: string;
  scale?: 'docs' | 'marketing';
}

/**
 * The canonical Threadplane stack: chat UI on top, the Agent contract as a
 * labeled seam, the two runtime adapters, and their backends. `highlight`
 * accents the node(s) a given page is about; `contract` accents both adapters.
 */
export function StackDiagram({ highlight = 'none', caption, scale = 'docs' }: StackDiagramProps) {
  const slug = `stack-${highlight}`;
  const adapters = highlight === 'contract';
  const backends = highlight === 'runtimes';
  return (
    <DiagramFrame
      slug={slug}
      viewWidth={640}
      viewHeight={344}
      scale={scale}
      label="Threadplane stack: the chat UI consumes the Agent contract; the LangGraph and AG-UI adapters implement it against their backends."
      caption={caption}
    >
      <DiagramNode
        x={190} y={18} w={260} h={64}
        eyebrow="Chat UI"
        title="@threadplane/chat"
        meta="<chat> · <chat-message-list> · <chat-input>"
        tone={highlight === 'chat' ? 'accent' : 'neutral'}
      />
      <DiagramEdge d="M320 82 V116" slug={slug} arrow />
      <DiagramPill cx={320} cy={136} w={230} label="Agent contract · signals + events$" />
      <DiagramEdge d="M320 148 V178 H180 V200" slug={slug} arrow />
      <DiagramEdge d="M320 178 H460 V200" slug={slug} arrow />
      <DiagramNode
        x={60} y={204} w={240} h={52}
        eyebrow="Adapter"
        title="@threadplane/langgraph"
        tone={highlight === 'langgraph' || adapters ? 'accent' : 'neutral'}
      />
      <DiagramNode
        x={340} y={204} w={240} h={52}
        eyebrow="Adapter"
        title="@threadplane/ag-ui"
        tone={highlight === 'ag-ui' || adapters ? 'accent' : 'neutral'}
      />
      <DiagramEdge d="M180 256 V280" slug={slug} arrow />
      <DiagramEdge d="M460 256 V280" slug={slug} arrow />
      <DiagramNode
        x={60} y={284} w={240} h={40}
        title="LangGraph Platform"
        align="middle" titleStyle="sans"
        tone={backends ? 'accent' : 'dim'}
      />
      <DiagramNode
        x={340} y={284} w={240} h={40}
        title="CrewAI · Mastra · MS Agent Fwk · Strands · …"
        align="middle" titleStyle="sans"
        tone={backends ? 'accent' : 'dim'}
      />
    </DiagramFrame>
  );
}
```

- [ ] **Step 4: Register in `MdxRenderer.tsx`**

Add import `import { StackDiagram } from './diagrams/StackDiagram';` and add `StackDiagram,` to the `mdxComponents` map (keep `AgUiArchDiagram` for now — it is removed in Task 4).

- [ ] **Step 5: Run tests, then commit**

Run: `npx nx test website && npx nx lint website`
Expected: PASS.

```bash
git add apps/website/src/components/docs/diagrams/StackDiagram.tsx apps/website/src/components/docs/diagrams/StackDiagram.spec.tsx apps/website/src/components/docs/MdxRenderer.tsx
git commit -m "feat(website): StackDiagram — the canonical stack schematic"
```

---

### Task 4: Replace ascii + retire AgUiArchDiagram

**Files:**
- Modify: `apps/website/content/docs/ag-ui/getting-started/introduction.mdx:17-29`
- Modify: `apps/website/content/docs/langgraph/concepts/agent-contract.mdx` (the ```` ```text ```` fan-in fence)
- Modify: `apps/website/content/blog/2026-05-21-build-fullstack-agentic-angular-apps-using-ag-ui.mdx:62`
- Modify: `apps/website/content/blog/2026-08-31-what-changes-when-the-runtime-changes.mdx:117`
- Delete: `apps/website/src/components/docs/AgUiArchDiagram.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx` (drop AgUiArchDiagram import + registration)
- Modify: `apps/website/src/styles/docs.css` (delete the `.ag-ui-arch-*` rule block, ~lines 195–260 — find with `grep -n "ag-ui-arch" apps/website/src/styles/docs.css`)

- [ ] **Step 1: Replace the ag-ui intro ascii diagram**

In `ag-ui/getting-started/introduction.mdx`, replace the whole ```` ```text ```` fence under `## How it fits` (the `@threadplane/chat … +--> @threadplane/ag-ui` tree) with:

```mdx
<StackDiagram
  highlight="ag-ui"
  caption="Backend speaks AG-UI over SSE → the adapter exposes the signal-shaped Agent contract → the chat UI renders."
/>
```

- [ ] **Step 2: Replace the agent-contract fan-in ascii**

In `langgraph/concepts/agent-contract.mdx`, replace the ```` ```text ```` fence (the `LangGraph Platform -- @threadplane/langgraph --+ …` fan-in) with:

```mdx
<StackDiagram
  highlight="contract"
  caption="Every adapter — including one you write — meets the UI at the same Agent contract."
/>
```

- [ ] **Step 3: Swap the two blog usages**

Replace `<AgUiArchDiagram />` with `<StackDiagram highlight="ag-ui" />` in both blog posts listed above.

- [ ] **Step 4: Retire the old component**

Delete `AgUiArchDiagram.tsx`; remove its import and map entry from `MdxRenderer.tsx`; delete the `.ag-ui-arch-*` CSS block (including its mobile `@media` override — grep to catch all of it). Verify: `grep -rn "AgUiArchDiagram\|ag-ui-arch" apps/website` returns nothing.

- [ ] **Step 5: Run tests + lint, verify the pages render**

Run: `npx nx test website && npx nx lint website`
Expected: PASS.
Then start the dev server and load `/docs/ag-ui/getting-started/introduction`, `/docs/langgraph/concepts/agent-contract`, and one of the two blog posts; the kit diagram must render with no console errors.

- [ ] **Step 6: Commit**

```bash
git add -A apps/website
git commit -m "refactor(website): replace ascii + HTML arch diagrams with StackDiagram"
```

---

### Task 5: "How it fits" for langgraph, chat, runtimes intros

**Files:**
- Modify: `apps/website/content/docs/langgraph/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/chat/getting-started/introduction.mdx`
- Modify: `apps/website/content/docs/runtimes/getting-started/introduction.mdx`

- [ ] **Step 1: Add the sections**

In each file, insert a `## How it fits` section directly after the intro paragraph(s) and before the first existing `##` heading (langgraph: before `## What is \`injectAgent()\`?`; chat: before `## Two-Tier Architecture`; runtimes: before `## The runtimes`). Content per file:

langgraph:

```mdx
## How it fits

<StackDiagram
  highlight="langgraph"
  caption="The LangGraph adapter implements the Agent contract natively against LangGraph Platform — threads, runs, and checkpoints included."
/>
```

chat:

```mdx
## How it fits

<StackDiagram
  highlight="chat"
  caption="The chat primitives and compositions consume only the Agent contract — the runtime below is swappable."
/>
```

runtimes:

```mdx
## How it fits

<StackDiagram
  highlight="runtimes"
  caption="The same Angular surface, measured against every runtime that speaks LangGraph or AG-UI."
/>
```

- [ ] **Step 2: Verify rendering, run tests, commit**

Run: `npx nx test website`
Expected: PASS. Load each of the three intro pages on the dev server; diagrams render.

```bash
git add apps/website/content/docs
git commit -m "docs(website): How-it-fits stack diagrams for langgraph, chat, runtimes intros"
```

---

### Task 6: AgUiArchitecturePipeline (ag-ui concepts/architecture)

**Files:**
- Create: `apps/website/src/components/docs/diagrams/AgUiArchitecturePipeline.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx` (register)
- Modify: `apps/website/content/docs/ag-ui/concepts/architecture.mdx` (replace the ```` ```text ```` vertical pipeline fence)
- Modify: `apps/website/src/components/docs/diagrams/compositions.spec.tsx` (create; grows in later tasks)

- [ ] **Step 1: Start the compositions spec (failing)**

Create `compositions.spec.tsx`:

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { AgUiArchitecturePipeline } from './AgUiArchitecturePipeline';

/**
 * Compositions are hand-placed layouts; the spec guards that each mounts,
 * is labeled for screen readers, and names its load-bearing packages.
 * Later tasks append one describe block per composition.
 */
describe('AgUiArchitecturePipeline', () => {
  it('mounts with an accessible label and the pipeline stages', () => {
    const { container } = render(<AgUiArchitecturePipeline />);
    expect(container.querySelector('svg[role="img"]')?.getAttribute('aria-label')).toBeTruthy();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/ag-ui');
    expect(titles).toContain('AbstractAgent');
  });
});
```

Run: `npx nx test website` — expected FAIL (module not found).

- [ ] **Step 2: Implement the composition**

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'agui-pipeline';

/** Vertical pipeline from an Angular component down to the AG-UI backend. */
export function AgUiArchitecturePipeline() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={420}
      label="AG-UI adapter pipeline: an Angular component reads the Agent contract, toAgent reduces AG-UI events into signals via the AbstractAgent protocol client, which talks to the backend."
    >
      <DiagramNode x={170} y={16} w={300} h={44} title="Your Angular component" align="middle" titleStyle="sans" />
      <DiagramEdge d="M320 60 V80" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={84} w={300} h={64}
        eyebrow="Agent contract" title="@threadplane/chat"
        meta="messages · status · toolCalls · state · events$"
      />
      <DiagramEdge d="M320 148 V168" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={172} w={300} h={64}
        eyebrow="Adapter" title="@threadplane/ag-ui"
        meta="toAgent() reduces AG-UI events into signals"
        tone="accent"
      />
      <DiagramEdge d="M320 236 V256" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={260} w={300} h={56}
        eyebrow="Protocol client" title="AbstractAgent" meta="@ag-ui/client"
      />
      <DiagramEdge d="M320 316 V336" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={340} w={300} h={44}
        title="AG-UI backend — or an in-process fake agent"
        align="middle" titleStyle="sans" tone="dim"
      />
    </DiagramFrame>
  );
}
```

Register in `MdxRenderer.tsx` (import + map entry `AgUiArchitecturePipeline,`).

- [ ] **Step 3: Replace the mdx fence**

In `ag-ui/concepts/architecture.mdx`, replace the ```` ```text ```` fence (the `Angular component | v @threadplane/chat …` chain) with `<AgUiArchitecturePipeline />`.

- [ ] **Step 4: Test + verify + commit**

Run: `npx nx test website && npx nx lint website` — PASS. Load `/docs/ag-ui/concepts/architecture` on the dev server.

```bash
git add -A apps/website
git commit -m "docs(website): kit pipeline diagram for AG-UI architecture page"
```

---

### Task 7: A2uiMessageFlow (chat/a2ui overview + a2ui intro)

**Files:**
- Create: `apps/website/src/components/docs/diagrams/A2uiMessageFlow.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx` (register)
- Modify: `apps/website/content/docs/chat/a2ui/overview.mdx` (replace the FIRST ```` ```text ```` fence — the `assistant text starts with ---a2ui_JSON--- …` pipeline; the second fence, JSONL payload examples, stays)
- Modify: `apps/website/content/docs/a2ui/getting-started/introduction.mdx` (add `## How it fits` before `## What the package owns`, reusing the same diagram)
- Modify: `apps/website/src/components/docs/diagrams/compositions.spec.tsx`

- [ ] **Step 1: Append the failing spec block**

```tsx
import { A2uiMessageFlow } from './A2uiMessageFlow';

describe('A2uiMessageFlow', () => {
  it('mounts and names the parser and surface store stages', () => {
    const { container } = render(<A2uiMessageFlow />);
    expect(container.querySelector('svg[role="img"]')).not.toBeNull();
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('createA2uiMessageParser()');
    expect(titles).toContain('createA2uiSurfaceStore()');
  });
});
```

Run: `npx nx test website` — FAIL.

- [ ] **Step 2: Implement**

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'a2ui-flow';

/** How an assistant message becomes a live A2UI surface. */
export function A2uiMessageFlow() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={420}
      label="A2UI message flow: the content classifier detects the a2ui_JSON sentinel, the parser reads JSONL messages, the surface store applies them by surface id, and the surface component renders progressive state."
    >
      <DiagramNode
        x={170} y={16} w={300} h={44}
        title="Assistant message · ---a2ui_JSON--- sentinel"
        align="middle" titleStyle="sans" tone="dim"
      />
      <DiagramEdge d="M320 60 V80" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={84} w={300} h={56}
        eyebrow="@threadplane/chat" title="Content classifier"
        meta="switches the message into A2UI mode"
      />
      <DiagramEdge d="M320 140 V160" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={164} w={300} h={56}
        eyebrow="@threadplane/a2ui" title="createA2uiMessageParser()"
        meta="parses streamed JSONL messages"
        tone="accent"
      />
      <DiagramEdge d="M320 220 V240" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={244} w={300} h={56}
        eyebrow="@threadplane/a2ui" title="createA2uiSurfaceStore()"
        meta="applies messages by surface id"
        tone="accent"
      />
      <DiagramEdge d="M320 300 V320" slug={SLUG} arrow />
      <DiagramNode
        x={170} y={324} w={300} h={56}
        eyebrow="Surface" title="<a2ui-surface>"
        meta="renders progressive state through your catalog"
      />
    </DiagramFrame>
  );
}
```

Register in `MdxRenderer.tsx`.

- [ ] **Step 3: Wire into content**

- `chat/a2ui/overview.mdx`: replace the first ```` ```text ```` fence with `<A2uiMessageFlow />`.
- `a2ui/getting-started/introduction.mdx`: insert before `## What the package owns`:

```mdx
## How it fits

<A2uiMessageFlow />
```

- [ ] **Step 4: Test + verify + commit**

Run: `npx nx test website` — PASS. Load `/docs/chat/a2ui/overview` and `/docs/a2ui/getting-started/introduction`.

```bash
git add -A apps/website
git commit -m "docs(website): A2UI message-flow diagram for overview and intro"
```

---

### Task 8: Render diagrams (intro + json-render-vs-a2ui)

**Files:**
- Create: `apps/website/src/components/docs/diagrams/RenderHowItFits.tsx`
- Create: `apps/website/src/components/docs/diagrams/RenderVsA2ui.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx` (register both)
- Modify: `apps/website/content/docs/render/getting-started/introduction.mdx` (add `## How it fits` before `## Why @threadplane/render?`)
- Modify: `apps/website/content/docs/render/concepts/json-render-vs-a2ui.mdx` (replace the ```` ```text ```` three-package fence)
- Modify: `apps/website/src/components/docs/diagrams/compositions.spec.tsx`

- [ ] **Step 1: Append failing spec blocks**

```tsx
import { RenderHowItFits } from './RenderHowItFits';
import { RenderVsA2ui } from './RenderVsA2ui';

describe('RenderHowItFits', () => {
  it('mounts and shows the spec-to-components pipeline', () => {
    const { container } = render(<RenderHowItFits />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/render');
  });
});

describe('RenderVsA2ui', () => {
  it('mounts and shows both packages under chat', () => {
    const { container } = render(<RenderVsA2ui />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/render');
    expect(titles).toContain('@threadplane/a2ui');
    expect(titles).toContain('@threadplane/chat');
  });
});
```

Run: `npx nx test website` — FAIL.

- [ ] **Step 2: Implement `RenderHowItFits.tsx`**

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'render-fits';

/** JSON spec in, your Angular components out. */
export function RenderHowItFits() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={300}
      label="How @threadplane/render fits: the agent emits a JSON spec; render resolves it through your registry, state, functions, and handlers into your own Angular components."
    >
      <DiagramNode
        x={170} y={16} w={300} h={44}
        title="Agent output — a JSON Spec"
        align="middle" titleStyle="sans" tone="dim"
      />
      <DiagramEdge d="M320 60 V88" slug={SLUG} arrow />
      <DiagramPill cx={320} cy={78} w={110} label="validated spec" />
      <DiagramNode
        x={170} y={104} w={300} h={64}
        eyebrow="Renderer" title="@threadplane/render"
        meta="registry · state store · functions · handlers"
        tone="accent"
      />
      <DiagramEdge d="M320 168 V196" slug={SLUG} arrow />
      <DiagramPill cx={320} cy={186} w={140} label="bindings + events" />
      <DiagramNode
        x={170} y={212} w={300} h={44}
        title="Your Angular components"
        align="middle" titleStyle="sans"
      />
    </DiagramFrame>
  );
}
```

Note the pill overlaps its edge midpoint deliberately — the pill rect masks the line beneath the label.

- [ ] **Step 3: Implement `RenderVsA2ui.tsx`**

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';

const SLUG = 'render-vs-a2ui';

/** The three-package split behind generative UI in chat. */
export function RenderVsA2ui() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={240}
      label="json-render versus A2UI: chat detects assistant content and mounts a surface; @threadplane/render renders specs through an Angular registry, while @threadplane/a2ui defines the A2UI v0.9 message and component types."
    >
      <DiagramNode
        x={170} y={16} w={300} h={64}
        eyebrow="Chat UI" title="@threadplane/chat"
        meta="detects content · manages streaming · mounts surfaces"
      />
      <DiagramEdge d="M320 80 V110 H180 V132" slug={SLUG} arrow />
      <DiagramEdge d="M320 110 H460 V132" slug={SLUG} arrow />
      <DiagramNode
        x={60} y={136} w={240} h={64}
        eyebrow="json-render" title="@threadplane/render"
        meta="renders a Spec via registry · state · functions"
        tone="accent"
      />
      <DiagramNode
        x={340} y={136} w={240} h={64}
        eyebrow="A2UI" title="@threadplane/a2ui"
        meta="A2UI v0.9 message + component types"
        tone="accent"
      />
    </DiagramFrame>
  );
}
```

Register both in `MdxRenderer.tsx`.

- [ ] **Step 4: Wire into content**

- `render/getting-started/introduction.mdx`: insert before `## Why @threadplane/render?`:

```mdx
## How it fits

<RenderHowItFits />
```

- `render/concepts/json-render-vs-a2ui.mdx`: replace the ```` ```text ```` fence with `<RenderVsA2ui />`.

- [ ] **Step 5: Test + verify + commit**

Run: `npx nx test website` — PASS. Load both pages on the dev server.

```bash
git add -A apps/website
git commit -m "docs(website): render pipeline + render-vs-a2ui kit diagrams"
```

---

### Task 9: MiddlewareHowItFits + TelemetryHowItFits

**Files:**
- Create: `apps/website/src/components/docs/diagrams/MiddlewareHowItFits.tsx`
- Create: `apps/website/src/components/docs/diagrams/TelemetryHowItFits.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx` (register both)
- Modify: `apps/website/content/docs/middleware/getting-started/introduction.mdx` (add `## How it fits` before `## What it does`)
- Modify: `apps/website/content/docs/telemetry/getting-started/introduction.mdx` (add `## How it fits` before `## Entry points`)
- Modify: `apps/website/src/components/docs/diagrams/compositions.spec.tsx`

- [ ] **Step 1: Append failing spec blocks**

```tsx
import { MiddlewareHowItFits } from './MiddlewareHowItFits';
import { TelemetryHowItFits } from './TelemetryHowItFits';

describe('MiddlewareHowItFits', () => {
  it('mounts and places the middleware between frontend and graph', () => {
    const { container } = render(<MiddlewareHowItFits />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('threadplane-middleware');
  });
});

describe('TelemetryHowItFits', () => {
  it('mounts and shows both entry points feeding ingest', () => {
    const { container } = render(<TelemetryHowItFits />);
    const titles = Array.from(container.querySelectorAll('.tp-diagram-title')).map((t) => t.textContent);
    expect(titles).toContain('@threadplane/telemetry');
  });
});
```

Run: `npx nx test website` — FAIL.

- [ ] **Step 2: Implement `MiddlewareHowItFits.tsx`** (horizontal: frontend → middleware → graph)

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'middleware-fits';

/** The Python middleware sits between the Angular frontend and your graph. */
export function MiddlewareHowItFits() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={150}
      label="How threadplane-middleware fits: the Angular frontend sends client tools in the run payload; the middleware binds them inside your LangGraph graph."
    >
      <DiagramNode
        x={24} y={40} w={180} h={64}
        eyebrow="Frontend" title="@threadplane/chat"
        meta="<chat [clientTools]>"
      />
      <DiagramEdge d="M204 72 H228" slug={SLUG} arrow />
      <DiagramPill cx={230} cy={26} w={130} label="client_tools" />
      <DiagramNode
        x={232} y={40} w={190} h={64}
        eyebrow="Python" title="threadplane-middleware"
        meta="bind_client_tools · interrupts"
        tone="accent"
      />
      <DiagramEdge d="M422 72 H446" slug={SLUG} arrow />
      <DiagramNode
        x={450} y={40} w={166} h={64}
        title="Your LangGraph graph"
        align="middle" titleStyle="sans" tone="dim"
      />
    </DiagramFrame>
  );
}
```

- [ ] **Step 3: Implement `TelemetryHowItFits.tsx`** (fan-in: two entry points → package → ingest)

```tsx
import { DiagramFrame } from './DiagramFrame';
import { DiagramNode } from './DiagramNode';
import { DiagramEdge } from './DiagramEdge';
import { DiagramPill } from './DiagramPill';

const SLUG = 'telemetry-fits';

/** Browser and Node entry points feed sampled events to the ingest endpoint. */
export function TelemetryHowItFits() {
  return (
    <DiagramFrame
      slug={SLUG}
      viewWidth={640}
      viewHeight={300}
      label="How @threadplane/telemetry fits: browser and Node entry points emit events through the shared package, which posts sampled events to the ingest endpoint."
    >
      <DiagramNode x={60} y={16} w={240} h={48} eyebrow="Entry" title="browser" meta="stream + UI events" />
      <DiagramNode x={340} y={16} w={240} h={48} eyebrow="Entry" title="node" meta="server + build events" />
      <DiagramEdge d="M180 64 V88 H320 V104" slug={SLUG} arrow />
      <DiagramEdge d="M460 64 V88 H320" slug={SLUG} />
      <DiagramNode
        x={170} y={108} w={300} h={56}
        eyebrow="Package" title="@threadplane/telemetry"
        meta="event names · sampling · payload shape"
        tone="accent"
      />
      <DiagramEdge d="M320 164 V192" slug={SLUG} arrow />
      <DiagramPill cx={320} cy={182} w={130} label="sampled events" />
      <DiagramNode
        x={170} y={208} w={300} h={44}
        title="threadplane.ai/api/ingest"
        align="middle" titleStyle="sans" tone="dim"
      />
    </DiagramFrame>
  );
}
```

Register both in `MdxRenderer.tsx`.

Before wiring content, read both intros and adjust the eyebrow/meta strings to match what those pages actually claim (e.g. exact entry-point names in `telemetry/getting-started/introduction.mdx` under `## Entry points`) — the topology stays as coded.

- [ ] **Step 4: Wire into content**

Insert into each intro at the position listed in **Files**:

```mdx
## How it fits

<MiddlewareHowItFits />
```

```mdx
## How it fits

<TelemetryHowItFits />
```

- [ ] **Step 5: Test + verify + commit**

Run: `npx nx test website && npx nx lint website` — PASS. Load both intro pages.

```bash
git add -A apps/website
git commit -m "docs(website): middleware + telemetry How-it-fits diagrams"
```

---

### Task 10: Marketing — StackDiagramSection + homepage

**Files:**
- Create: `apps/website/src/components/landing/StackDiagramSection.tsx`
- Create: `apps/website/src/components/landing/StackDiagramSection.spec.tsx`
- Modify: `apps/website/src/styles/landing.css` (append section classes)
- Modify: `apps/website/src/app/page.tsx` (insert after `<YesWall />`)

- [ ] **Step 1: Write the failing spec**

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { StackDiagramSection } from './StackDiagramSection';

describe('StackDiagramSection', () => {
  it('renders heading, body, and a marketing-scaled stack diagram', () => {
    const { container, getByText } = render(
      <StackDiagramSection
        id="architecture"
        eyebrow="Architecture"
        headline="One contract between your UI and any runtime"
        body="The body copy."
        highlight="none"
      />
    );
    expect(getByText('One contract between your UI and any runtime').tagName).toBe('H2');
    expect(container.querySelector('section')?.getAttribute('aria-labelledby')).toBe('architecture-heading');
    expect(container.querySelector('figure.tp-diagram-figure')?.getAttribute('data-scale')).toBe('marketing');
  });
});
```

Run: `npx nx test website` — FAIL.

- [ ] **Step 2: Implement the section component**

```tsx
import type { ReactNode } from 'react';
import { Section } from '../ui/Section';
import { Container } from '../ui/Container';
import { Eyebrow } from '../ui/Eyebrow';
import { StackDiagram, type StackHighlight } from '../docs/diagrams/StackDiagram';

interface StackDiagramSectionProps {
  id: string;
  eyebrow: string;
  headline: string;
  body: ReactNode;
  highlight?: StackHighlight;
  caption?: string;
}

export function StackDiagramSection({
  id,
  eyebrow,
  headline,
  body,
  highlight = 'none',
  caption,
}: StackDiagramSectionProps) {
  return (
    <Section surface="tinted" id={id} ariaLabelledBy={`${id}-heading`}>
      <Container>
        <div className="stack-diagram-section">
          <Eyebrow tone="accent">{eyebrow}</Eyebrow>
          <h2 id={`${id}-heading`} className="stack-diagram-headline">
            {headline}
          </h2>
          <p className="stack-diagram-body">{body}</p>
          <StackDiagram highlight={highlight} caption={caption} scale="marketing" />
        </div>
      </Container>
    </Section>
  );
}
```

Append to `landing.css` (match the file's existing class style — check its heading classes for the exact Garamond pattern before writing):

```css
/* StackDiagramSection */
.stack-diagram-section {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  gap: 12px;
}
.stack-diagram-headline {
  font-family: var(--font-garamond);
  font-size: clamp(1.75rem, 3.5vw, 2.5rem);
  color: var(--color-text-primary);
  margin: 0;
}
.stack-diagram-body {
  font-family: var(--font-inter);
  font-size: 1.05rem;
  line-height: 1.6;
  color: var(--color-text-secondary);
  max-width: 620px;
  margin: 0 0 12px;
}
```

- [ ] **Step 3: Insert on the homepage**

In `apps/website/src/app/page.tsx`, import `StackDiagramSection` and insert between `<YesWall />` and the DemoShowcase `<Section>`:

```tsx
<StackDiagramSection
  id="architecture"
  eyebrow="Architecture"
  headline="One contract between your UI and any runtime"
  body="Your Angular components consume a signal-shaped Agent contract. Adapters implement it — swap the runtime underneath without touching the UI."
  caption="The chat surface never imports a runtime SDK — only the contract."
/>
```

- [ ] **Step 4: Test + verify + commit**

Run: `npx nx test website && npx nx lint website` — PASS. Load `/` on the dev server; check the section renders between the Yes wall and the demo showcase, at both desktop and 375px widths (the figure scrolls horizontally, the page must not).

```bash
git add -A apps/website
git commit -m "feat(website): homepage architecture section with the master stack diagram"
```

---

### Task 11: Marketing — adapter pages (/langgraph, /ag-ui)

**Files:**
- Modify: `apps/website/src/app/langgraph/page.tsx`
- Modify: `apps/website/src/app/ag-ui/page.tsx`

- [ ] **Step 1: Insert the sections**

In each page, import `StackDiagramSection` from `../../components/landing/StackDiagramSection` and insert directly after the hero `</Section>` (the first Section in the returned JSX):

`/langgraph`:

```tsx
<StackDiagramSection
  id="langgraph-architecture"
  eyebrow="Where it sits"
  headline="Native LangGraph, behind the Agent contract"
  body="The adapter speaks LangGraph Platform directly — threads, runs, checkpoints — and hands your components the same signal-shaped contract every Threadplane surface consumes."
  highlight="langgraph"
/>
```

`/ag-ui`:

```tsx
<StackDiagramSection
  id="ag-ui-architecture"
  eyebrow="Where it sits"
  headline="One adapter, every AG-UI backend"
  body="toAgent() wraps any AbstractAgent into the Agent contract. The backends change; your Angular surface doesn't."
  highlight="ag-ui"
/>
```

- [ ] **Step 2: Test + verify + commit**

Run: `npx nx test website` — PASS (both pages have `page.spec.tsx` files; if a spec asserts on section order/count, update it to include the new section). Load `/langgraph` and `/ag-ui` on the dev server.

```bash
git add apps/website/src/app/langgraph/page.tsx apps/website/src/app/ag-ui/page.tsx
git commit -m "feat(website): stack diagram sections on the adapter landing pages"
```

---

### Task 12: Full verification pass

- [ ] **Step 1: Suite + lint**

Run: `npx nx test website && npx nx lint website`
Expected: PASS, no lint errors (warnings tolerated; errors not — pipe through `sed -e 's/\x1b\[[0-9;]*m//g'` before grepping if counting).

- [ ] **Step 2: Production build**

Run: `npx nx build website --configuration=production`
Expected: builds clean.

- [ ] **Step 3: Visual sweep**

On the dev server, load and eyeball every touched page: the 4 docs pages with replaced diagrams, the 7 intros, one blog post, `/`, `/langgraph`, `/ag-ui`. Check: no horizontal page scroll at 375px (diagrams scroll inside their figure), callouts render the band on pages using `<Callout>` (e.g. `/docs/ag-ui/getting-started/introduction` has two), no console errors.

- [ ] **Step 4: Commit any fixes**

```bash
git add -A apps/website
git commit -m "fix(website): visual-sweep fixes for callouts and diagrams"
```

(Skip the commit if the sweep found nothing.)
