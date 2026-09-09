# Navbar Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the website navbar with a single-row nav whose four triggers (`Libraries`, `Docs`, `Solutions`, `Pricing`) open hover panels, add a transparent-on-hero bar surface, condense the bar inside `/docs`, and turn the mobile drawer into a drill-in stack that replaces the Site/Docs tab strip.

**Architecture:** The navbar's information architecture becomes data in one module, `nav-config.ts`, which both the desktop panels and the mobile levels render from — so the two surfaces cannot drift. `Nav.tsx` shrinks to a shell that picks a surface; the desktop bar, the mobile stack, and the transparent/solid surface state each move into their own file. The docs drawer keeps mounting `DocsContextContent` unchanged, because its expand state is persisted and shared with the desktop sidebar.

**Tech Stack:** Next.js App Router, React 19 client components, TypeScript, Tailwind v4 utilities plus unlayered CSS in `src/styles/chrome.css`, `lucide-react` icons, Vitest + Testing Library (jsdom) for unit tests, Playwright for e2e.

**Spec:** `docs/superpowers/specs/2026-09-08-navbar-redesign-design.md`

---

## Orientation for the engineer

Read this before Task 1. It is the context you cannot get from the file tree.

**Where the nav lives.** `apps/website/src/app/layout.tsx` mounts `<Nav />` once, above `<div id="site-content">`. Every route gets the same navbar. The whole of it is `apps/website/src/components/shared/Nav.tsx` (~500 lines) plus presentation in `apps/website/src/styles/chrome.css`.

**Why `chrome.css` rules are unlayered.** Tailwind v4 puts utilities in `@layer utilities`, and unlayered author CSS beats every layer. The rules in `chrome.css` are deliberately outside `@layer` so they keep the precedence the inline styles they replaced had. **Do not wrap anything you add there in `@layer`** — utilities would start winning and rendering would change.

**`--nav-h` is measured, not derived.** It is declared in `chrome.css` at three steps (58px, 66px at `md`, 81px at `lg`) and read by six places: the mobile overlay's `top` (`chrome.css`), the docs shell padding and both sticky rails (`docs.css:79,84,99,1824,1827`), a page offset (`pages.css:277`), and `html`'s `scroll-padding-top` (`app/global.css:31`). The last time it was wrong, phones got 22px of dead space and anchors landed 81px under the nav. jsdom cannot measure layout, so `e2e/nav-height.spec.ts` is the only thing that can hold it honest.

**Colors.** `--ds-signal` (`#FFAF00`) is 1.84:1 on white and is **fill-only** — it never carries text. `--ds-scope` (`#15253E`, navy) is the accent role for text and links. In the nav, yellow does exactly two jobs: the `Talk to Us` fill and the active-link underline.

**Commands.**

```bash
npx nx test website -- --run src/components/shared/Nav.spec.tsx
```

**Nx does not forward the path filter to Vitest** — that command runs the whole website suite (140 files, ~1407 tests) and the trailing path is ignored. That is strictly stronger verification, so the commands in this plan keep it, but expect full-suite counts rather than one file's. To actually filter while iterating, bypass Nx:

```bash
cd apps/website && npx vitest run src/components/shared/Nav.spec.tsx
```

**Two traps with that second form.** Some specs resolve paths against `process.cwd()`, so running them from `apps/website` rather than through Nx changes their result. `src/lib/cockpit-retirement.spec.ts` fails 5 of 9 that way and passes under Nx — a false alarm that looks exactly like a regression you caused. So: use the filtered form only on the one spec you are iterating on, and **never** run the whole suite from `apps/website`. Every pass/fail claim in a report or a commit message must come from `npx nx test website`.

```bash
npx nx lint website
```

```bash
npx nx build website
```

**`nx test` and `nx lint` do not typecheck.** Vitest strips types and this ESLint config is not type-aware, so a type error passes both and only `nx build website` (or `tsc --noEmit`) catches it. Task 4 shipped a broken build behind 1411 passing tests and a clean lint that way: a bare `` const id = `${surface}_${item.ctaId}` `` widens to `string`, which is not assignable to the `CtaId` template-literal union. **Run the build at the end of every task that touches `.ts`/`.tsx`, not only at the end of the plan.**

Playwright specs need a dev server; the config starts one. To run a single e2e file — note the `--testFiles=` form, because a bare positional path fails on this Nx/Playwright executor with `unknown option '--_=…'`:

```bash
npx nx e2e website -- --testFiles=e2e/nav-height.spec.ts
```

**Playwright `.hover()` does not traverse.** It jumps straight to the target's centre in one step, so it never crosses the space between two elements. Any test whose subject is a *path* — a hover grace period, a dead zone between a trigger and its panel, a drag — is vacuous when written with `.hover()`: it passes identically whether the behaviour works or not. Task 4 shipped exactly such a test and only caught it because the mutation proof failed to fail. Use `page.mouse.move(x, y, { steps: 15 })` when the movement is the thing under test.

**An entrance animation makes geometry assertions flaky.** A test that samples several `boundingBox()` values in sequence can read them mid-interpolation — Task 4's four-item layout test failed roughly one run in five with a ~2px discrepancy after a 140ms transform was added. Await `getAnimations().finished` on the animating element before sampling. Waiting for the animation to settle is legitimate; a fixed `waitForTimeout` or a retry-until-green loop is masking, and the assertions themselves must not change.

**Several worktrees on this machine run this same suite.** Ports 4308 (website) and 4300 (the cockpit runtime webServer) are contended, and a neighbouring worktree can start a server *during* your run — which surfaces as a wall of `net::ERR_CONNECTION_REFUSED` with zero assertion failures, not as a normal test failure. Read the failures before believing them: if every one is a connection error, it is contention, not your change.

Never kill a server whose working directory is a different worktree — another session is using it. Identify a holder with `lsof -ti tcp:4308` then `lsof -a -p <pid> -d cwd -Fn`. To run in isolation regardless of who holds what, start your own server on a free port and point Playwright at it with `BASE_URL` (`playwright.config.ts` skips its own webServers when `BASE_URL` is set). Kill only orphans confirmed to be from this worktree.

**Free the port first.** A previous run's `next-server` can outlive it and hold the Playwright web-server port, and the failure does not say so. If a spec run hangs or the server will not start, find and kill the orphan before debugging anything else — one was found 19 minutes stale on port 4308 during Task 4. A stale server is also perfectly capable of serving an OLD bundle, so a green run against one proves nothing.

**Tests that will break, and which task fixes each.** These exist today in `src/components/shared/Nav.spec.tsx` and assert the old IA. Do not delete them ahead of time — each is rewritten in the task that changes its behavior:

| Test | Breaks because | Fixed in |
| --- | --- | --- |
| `retires Examples from desktop navigation without changing primary destinations or demos` | asserts a `Pilot to Prod` top-level link and a `Demo` dropdown button | Task 4 |
| `uses the existing header trigger for the control-plane Docs drawer` | asserts the `Docs` **tab** button carries `data-active` | Task 8 |
| `preserves the Site tab alongside the Docs control plane` | the Site tab is deleted | Task 8 |
| `retires Examples from mobile navigation without changing primary destinations or demos` | asserts a flat mobile link list | Task 8 |

---

## File Structure

| File | Responsibility | Task |
| --- | --- | --- |
| `apps/website/src/components/shared/nav-config.ts` (create) | The IA as data: triggers, panel columns, items, hrefs, icons, analytics ids, hero routes | 1 |
| `apps/website/src/components/shared/nav-config.spec.ts` (create) | Every href resolves to a real route; every analytics id is unique | 1 |
| `apps/website/src/components/shared/useNavSurface.ts` (create) | Transparent vs. solid, from route plus an IntersectionObserver sentinel | 2 |
| `apps/website/src/components/shared/useNavSurface.spec.tsx` (create) | Surface states without a layout engine | 2 |
| `apps/website/src/components/shared/NavDesktop.tsx` (create) | The bar row, the trigger buttons, the shared panel container | 3, 4 |
| `apps/website/src/components/shared/NavMobile.tsx` (create) | The drawer, its focus trap, and the drill-in stack | 7, 8 |
| `apps/website/src/components/shared/Nav.tsx` (modify) | Shell: reads the route, renders sentinel + desktop + mobile | 3, 5, 7 |
| `apps/website/src/components/shared/Nav.spec.tsx` (modify) | Rewritten assertions for the new IA | 4, 8 |
| `apps/website/src/styles/chrome.css` (modify) | Panel styling, surface states, docs height, drill-in; deletes `nav-demo-*` and `nav-mtabs` | 4, 5, 6, 8, 9 |
| `apps/website/e2e/nav-height.spec.ts` (modify) | Split into marketing steps on `/` and docs steps on `/docs` | 6 |
| `apps/website/e2e/nav-surface.spec.ts` (create) | Transparent at scroll 0 on every hero route; solid after scrolling | 5 |

`nav-config.ts` is the seam that matters: both surfaces render from it, so adding a destination is a data change rather than an edit in two components.

---

## Task 1: The IA as data

**Files:**
- Create: `apps/website/src/components/shared/nav-config.ts`
- Create: `apps/website/src/components/shared/nav-config.spec.ts`

Nothing consumes this yet. It lands as data plus a test that proves the data is not lying about routes.

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/shared/nav-config.spec.ts`:

```ts
import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { HERO_ROUTES, NAV_TRIGGERS, navItems } from './nav-config';
import { docsConfig } from '../../lib/docs-config';
import { getAllSolutionSlugs } from '../../lib/solutions-data';

const APP_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'app');

/**
 * `/docs/:library/:section/:slug` is a dynamic route, so a page file cannot
 * prove it exists. `docsConfig` is what the route renders from, so that is
 * what a docs href has to be checked against.
 */
function docsHrefResolves(href: string): boolean {
  if (href === '/docs') return true;
  const [, , library, section, slug] = href.split('/');
  if (!library) return false;
  if (!section) return existsSync(join(APP_ROOT, 'docs', library, 'page.tsx'));
  return docsConfig.some(
    (entry) =>
      entry.id === library &&
      entry.sections.some(
        (group) =>
          group.id === section && group.pages.some((page) => page.slug === slug),
      ),
  );
}

/**
 * `/solutions/:slug` is a dynamic route too. `getAllSolutionSlugs()` is what
 * `generateStaticParams` renders from, so that is what a solutions href has to
 * be checked against.
 */
function solutionsHrefResolves(href: string): boolean {
  if (href === '/solutions') return true;
  const [, , slug] = href.split('/');
  return Boolean(slug) && getAllSolutionSlugs().includes(slug);
}

function staticHrefResolves(href: string): boolean {
  return existsSync(join(APP_ROOT, ...href.split('/').filter(Boolean), 'page.tsx'));
}

describe('nav-config', () => {
  it('points every internal link at a route that exists', () => {
    const unresolved = navItems()
      .filter((item) => !item.external)
      .filter((item) => {
        if (item.href.startsWith('/docs')) return !docsHrefResolves(item.href);
        if (item.href.startsWith('/solutions')) return !solutionsHrefResolves(item.href);
        return !staticHrefResolves(item.href);
      })
      .map((item) => `${item.label} → ${item.href}`);

    expect(unresolved).toEqual([]);
  });

  it('sends every external link somewhere over https', () => {
    const bad = navItems()
      .filter((item) => item.external)
      .filter((item) => !item.href.startsWith('https://'))
      .map((item) => item.label);

    expect(bad).toEqual([]);
  });

  it('gives every destination a unique analytics id', () => {
    const ids = navItems().map((item) => item.ctaId);
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('gives every panel item a label and a description', () => {
    const thin = navItems()
      .filter((item) => !item.label.trim() || !item.description.trim())
      .map((item) => item.ctaId);

    expect(thin).toEqual([]);
  });

  it('names four triggers, in order', () => {
    expect(NAV_TRIGGERS.map((trigger) => trigger.label)).toEqual([
      'Libraries',
      'Docs',
      'Solutions',
      'Pricing',
    ]);
  });

  it('lists only routes that actually render a hero', () => {
    // Landing pages join this list in the change that gives each one a hero.
    // Listing a white page here renders navy links over nothing.
    expect(HERO_ROUTES).toEqual(['/']);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test website -- --run src/components/shared/nav-config.spec.ts`

Expected: FAIL — `Failed to resolve import "./nav-config"`.

- [ ] **Step 3: Write the config**

Create `apps/website/src/components/shared/nav-config.ts`:

```ts
import type { ComponentType } from 'react';
import {
  BarChart3,
  BookOpen,
  Braces,
  Building2,
  Compass,
  Lightbulb,
  Map as MapIcon,
  MessageSquare,
  Newspaper,
  Play,
  Rocket,
  ShieldCheck,
  Users,
} from 'lucide-react';
import type { LibraryId } from '../../lib/docs-config';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';

export type NavIcon = ComponentType<{ size?: number; 'aria-hidden'?: boolean }>;

export interface NavItem {
  readonly label: string;
  /** One whole literal — never assembled from interpolated fragments, so the
   *  rendered-copy scan in lib/public-copy.spec.ts can see all of it. */
  readonly description: string;
  readonly href: string;
  readonly external?: true;
  /** Renders the library's own mark instead of `icon`. */
  readonly library?: LibraryId;
  readonly icon?: NavIcon;
  /** Analytics suffix. Prefixed with `nav_` or `mobile_nav_` at the call site. */
  readonly ctaId: string;
}

export interface NavColumn {
  readonly heading?: string;
  readonly items: readonly NavItem[];
}

export interface NavPanel {
  readonly columns: readonly NavColumn[];
  readonly footer?: NavItem & { readonly lead: string };
}

export type NavTrigger =
  | { readonly kind: 'link'; readonly id: string; readonly label: string; readonly href: string; readonly ctaId: string }
  | { readonly kind: 'panel'; readonly id: string; readonly label: string; readonly panel: NavPanel };

const LIBRARIES: NavPanel = {
  columns: [
    {
      items: [
        {
          label: '@threadplane/langgraph',
          description: 'LangGraph and LangChain agents in Angular',
          href: '/langgraph',
          library: 'langgraph',
          ctaId: 'libraries_langgraph',
        },
        {
          label: '@threadplane/ag-ui',
          description: 'The AG-UI protocol — CrewAI, Mastra, MAF',
          href: '/ag-ui',
          library: 'ag-ui',
          ctaId: 'libraries_ag_ui',
        },
        {
          label: '@threadplane/chat',
          description: 'Chat, timeline, and thread primitives',
          href: '/chat',
          library: 'chat',
          ctaId: 'libraries_chat',
        },
        {
          label: '@threadplane/render',
          description: 'Generative UI from agent output',
          href: '/render',
          library: 'render',
          ctaId: 'libraries_render',
        },
      ],
    },
  ],
  footer: {
    lead: 'Not sure which one?',
    label: 'Choosing an adapter',
    description: 'The four libraries side by side',
    href: '/docs/choosing-an-adapter',
    icon: Compass,
    ctaId: 'libraries_choosing_an_adapter',
  },
};

const DOCS: NavPanel = {
  columns: [
    {
      heading: 'Start here',
      items: [
        {
          label: 'Documentation',
          description: 'Every library, one shell',
          href: '/docs',
          icon: BookOpen,
          ctaId: 'docs_documentation',
        },
        {
          label: 'Quick start',
          description: 'An agent on screen in ten minutes',
          href: '/docs/langgraph/getting-started/quickstart',
          icon: Rocket,
          ctaId: 'docs_quick_start',
        },
        {
          label: 'Choosing an adapter',
          description: 'The four libraries side by side',
          href: '/docs/choosing-an-adapter',
          icon: Compass,
          ctaId: 'docs_choosing_an_adapter',
        },
      ],
    },
    {
      heading: 'Go deeper',
      items: [
        {
          label: 'Guides',
          description: 'Streaming, persistence, interrupts, memory',
          href: '/docs/langgraph/guides/streaming',
          icon: MapIcon,
          ctaId: 'docs_guides',
        },
        {
          label: 'Concepts',
          description: 'The agent contract, signals, and state',
          href: '/docs/langgraph/concepts/agent-contract',
          icon: Lightbulb,
          ctaId: 'docs_concepts',
        },
        {
          label: 'API reference',
          description: 'injectAgent, provideAgent, transports',
          href: '/docs/langgraph/api/inject-agent',
          icon: Braces,
          ctaId: 'docs_api_reference',
        },
      ],
    },
    {
      heading: 'See it running',
      // Derived from DEMOS so the nav, the footer, and the mobile stack cannot
      // disagree about where a demo lives.
      items: DEMOS.map((demo) => ({
        label: demo.label,
        description: new URL(demo.href).host,
        href: demo.href,
        external: true as const,
        icon: Play,
        ctaId: `docs_demo_${demoCtaSuffix(demo.key)}`,
      })),
    },
  ],
};

const SOLUTIONS: NavPanel = {
  columns: [
    {
      heading: 'Use cases',
      items: [
        {
          label: 'Customer support',
          description: 'Deflection with a human in the loop',
          href: '/solutions/customer-support',
          icon: MessageSquare,
          ctaId: 'solutions_customer_support',
        },
        {
          label: 'Analytics',
          description: 'Conversational data exploration',
          href: '/solutions/analytics',
          icon: BarChart3,
          ctaId: 'solutions_analytics',
        },
        {
          label: 'Compliance',
          description: 'Auditable, approval-gated agents',
          href: '/solutions/compliance',
          icon: ShieldCheck,
          ctaId: 'solutions_compliance',
        },
      ],
    },
    {
      heading: 'Company',
      items: [
        {
          label: 'Pilot to Prod',
          description: 'How a pilot becomes a shipped surface',
          href: '/pilot-to-prod',
          icon: Building2,
          ctaId: 'solutions_pilot_to_prod',
        },
        {
          label: 'Blog',
          description: 'Engineering notes and release write-ups',
          href: '/blog',
          icon: Newspaper,
          ctaId: 'solutions_blog',
        },
        {
          label: 'About',
          description: 'Who is behind Threadplane',
          href: '/about',
          icon: Users,
          ctaId: 'solutions_about',
        },
      ],
    },
  ],
};

export const NAV_TRIGGERS: readonly NavTrigger[] = [
  { kind: 'panel', id: 'libraries', label: 'Libraries', panel: LIBRARIES },
  { kind: 'panel', id: 'docs', label: 'Docs', panel: DOCS },
  { kind: 'panel', id: 'solutions', label: 'Solutions', panel: SOLUTIONS },
  { kind: 'link', id: 'pricing', label: 'Pricing', href: '/pricing', ctaId: 'pricing' },
];

/** Every destination in the nav, flattened — for tests and for analytics audits. */
export function navItems(): readonly NavItem[] {
  return NAV_TRIGGERS.flatMap((trigger) => {
    if (trigger.kind === 'link') {
      return [
        {
          label: trigger.label,
          description: trigger.label,
          href: trigger.href,
          ctaId: trigger.ctaId,
        } satisfies NavItem,
      ];
    }
    const items = trigger.panel.columns.flatMap((column) => column.items);
    return trigger.panel.footer ? [...items, trigger.panel.footer] : items;
  });
}

/**
 * Routes whose page opens on a colored hero, where the bar renders transparent
 * at scroll 0.
 *
 * `/` is the only one today. The library landing pages open on white; listing
 * one before it has a hero renders navy links over a white page with no bar
 * behind them. Each page joins this list in the change that gives it a hero.
 */
export const HERO_ROUTES: readonly string[] = ['/'];
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test website -- --run src/components/shared/nav-config.spec.ts`

Expected: PASS, 6 tests.

If `points every internal link at a route that exists` fails, check the slug against `src/lib/docs-config.ts` or `src/lib/solutions-data.ts` rather than loosening the assertion.

**The one exception, and it bit the first run of this task:** a failure that names *every* href in a family means the family is a dynamic route the test has no resolver for — not that the hrefs are wrong. `/docs/*` and `/solutions/*` both have resolvers above. Repointing such links at a static hub to make the test pass silently destroys the IA; add the resolver instead.

- [ ] **Step 4b: Prove each dynamic-route resolver is not vacuous**

A resolver that returns `true` for everything passes this test while catching nothing. For each of `docsHrefResolves` and `solutionsHrefResolves`, temporarily repoint one href at a slug that does not exist (`/solutions/does-not-exist`), confirm the test FAILS naming that href, then restore it and confirm it passes.

- [ ] **Step 5: Confirm the new copy clears the public-copy contract**

Run: `npx nx test website -- --run src/lib/public-copy.spec.ts`

Expected: PASS. This spec's `renderedCopyFiles` scan walks every non-spec `.ts`/`.tsx`/`.mjs` under `src/`, so it reads the descriptions you just wrote. A failure names the banned phrase — reword the description.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/shared/nav-config.ts apps/website/src/components/shared/nav-config.spec.ts
git commit -m "feat(website): describe the navbar IA as data"
```

---

## Task 2: The bar's surface state

**Files:**
- Create: `apps/website/src/components/shared/useNavSurface.ts`
- Create: `apps/website/src/components/shared/useNavSurface.spec.tsx`

A hook returning `'transparent' | 'solid'` plus the ref for the sentinel element that decides it. An IntersectionObserver, not a scroll listener: it is cheaper, and the in-app Browser pane suspends scroll events, which would make a listener-based version look broken during local verification when it is not.

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/shared/useNavSurface.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { act, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useNavSurface } from './useNavSurface';

let observerCallback: ((entries: { isIntersecting: boolean }[]) => void) | null = null;
const disconnect = vi.fn();

function Probe({ pathname }: { pathname: string }) {
  const { surface, sentinelRef } = useNavSurface(pathname);
  return (
    <>
      <div ref={sentinelRef} data-testid="sentinel" />
      <span data-testid="surface">{surface}</span>
    </>
  );
}

describe('useNavSurface', () => {
  beforeEach(() => {
    observerCallback = null;
    disconnect.mockClear();
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        constructor(callback: (entries: { isIntersecting: boolean }[]) => void) {
          observerCallback = callback;
        }
        observe() {}
        disconnect = disconnect;
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is transparent at rest on a hero route', () => {
    render(<Probe pathname="/" />);
    expect(screen.getByTestId('surface').textContent).toBe('transparent');
  });

  it('is solid on a route with no hero, and observes nothing there', () => {
    render(<Probe pathname="/docs/langgraph/getting-started/introduction" />);
    expect(screen.getByTestId('surface').textContent).toBe('solid');
    expect(observerCallback).toBeNull();
  });

  it('solidifies once the sentinel scrolls out of view', () => {
    render(<Probe pathname="/" />);
    act(() => observerCallback?.([{ isIntersecting: false }]));
    expect(screen.getByTestId('surface').textContent).toBe('solid');
  });

  it('goes transparent again when the sentinel returns', () => {
    render(<Probe pathname="/" />);
    act(() => observerCallback?.([{ isIntersecting: false }]));
    act(() => observerCallback?.([{ isIntersecting: true }]));
    expect(screen.getByTestId('surface').textContent).toBe('transparent');
  });

  it('stays solid without an IntersectionObserver rather than flashing transparent', () => {
    vi.stubGlobal('IntersectionObserver', undefined);
    render(<Probe pathname="/" />);
    // Server render and very old browsers land here. A hero route with no way
    // to detect scrolling must not sit transparent forever once scrolled.
    expect(screen.getByTestId('surface').textContent).toBe('solid');
  });

  it('disconnects on unmount', () => {
    const view = render(<Probe pathname="/" />);
    view.unmount();
    expect(disconnect).toHaveBeenCalledOnce();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test website -- --run src/components/shared/useNavSurface.spec.tsx`

Expected: FAIL — `Failed to resolve import "./useNavSurface"`.

- [ ] **Step 3: Write the hook**

Create `apps/website/src/components/shared/useNavSurface.ts`:

```ts
'use client';

import { useEffect, useRef, useState } from 'react';
import { HERO_ROUTES } from './nav-config';

export type NavSurface = 'transparent' | 'solid';

/**
 * Whether the bar renders over the page or on its own white ground.
 *
 * The trigger is an IntersectionObserver on a sentinel at the top of the
 * document rather than a scroll listener: it is cheaper, and the in-app
 * Browser pane suspends scroll events, so a listener-based version looks
 * broken during local verification when it is not. Either way this state has
 * to be confirmed in a real browser window.
 */
export function useNavSurface(pathname: string): {
  surface: NavSurface;
  sentinelRef: React.RefObject<HTMLDivElement | null>;
} {
  const isHeroRoute = HERO_ROUTES.includes(pathname);
  const sentinelRef = useRef<HTMLDivElement>(null);
  // Starts false so a hero route with no observer renders solid rather than
  // sitting transparent over scrolled content forever.
  const [atTop, setAtTop] = useState(false);

  useEffect(() => {
    if (!isHeroRoute) {
      setAtTop(false);
      return undefined;
    }
    const sentinel = sentinelRef.current;
    if (!sentinel || typeof IntersectionObserver !== 'function') return undefined;

    setAtTop(true);
    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries.at(-1);
        if (entry) setAtTop(entry.isIntersecting);
      },
      { threshold: 0 },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [isHeroRoute, pathname]);

  return { surface: isHeroRoute && atTop ? 'transparent' : 'solid', sentinelRef };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx nx test website -- --run src/components/shared/useNavSurface.spec.tsx`

Expected: PASS, 6 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/shared/useNavSurface.ts apps/website/src/components/shared/useNavSurface.spec.tsx
git commit -m "feat(website): derive the nav bar surface from route and scroll"
```

---

## Task 3: Extract the desktop bar, unchanged

**Files:**
- Create: `apps/website/src/components/shared/NavDesktop.tsx`
- Modify: `apps/website/src/components/shared/Nav.tsx`

A pure move. No behavior changes, so every existing test must still pass — that is what proves the move was clean. Task 4 changes what it renders.

- [ ] **Step 1: Move the desktop markup into a new component**

Create `apps/website/src/components/shared/NavDesktop.tsx`. Move these exact ranges out of `Nav.tsx` **without editing a character of them** — this task's only proof of correctness is that the existing tests still pass, so any "while I'm here" change destroys that proof:

| Lines in `Nav.tsx` | What |
| --- | --- |
| 18–22 | the `links` array |
| 69–118 | `function DemoDropdown()` |
| 247–270 | `const trackNavLink = …` (becomes an exported `function`) |
| 285–345 | the `<div className="hidden lg:flex items-center gap-8">` block under `{/* Desktop links */}` |

`MenuIcon` (37–51) and `CloseIcon` (53–67) stay put for now — Task 7 moves them with the drawer.

```tsx
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import {
  trackCtaClick,
  trackExternalLinkClick,
} from '../../lib/analytics/client';
import { Button } from '../ui/Button';
import { GitHubIcon } from '../ui/GitHubIcon';
import { GITHUB_REPO_URL } from '../../lib/positioning';
import { DEMOS, demoCtaSuffix } from '../../lib/demos';

export const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Pricing', href: '/pricing', external: false },
];

export function trackNavLink(
  label: string,
  href: string,
  external: boolean,
  surface: 'nav' | 'mobile_nav',
) {
  const slug = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '');
  const ctaId: `nav_${string}` | `mobile_nav_${string}` =
    surface === 'nav' ? `nav_${slug}` : `mobile_nav_${slug}`;
  if (external) {
    trackExternalLinkClick(href, { surface, cta_id: ctaId, cta_text: label });
    return;
  }
  trackCtaClick({
    surface,
    destination_url: href,
    cta_id: ctaId,
    cta_text: label,
  });
}

// ... DemoDropdown moved here verbatim from Nav.tsx ...

export function NavDesktop() {
  // The <div className="hidden lg:flex items-center gap-8"> block from Nav.tsx,
  // moved verbatim.
}
```

- [ ] **Step 2: Consume it from `Nav.tsx`**

In `Nav.tsx`, delete the moved code and replace the desktop `<div>` with `<NavDesktop />`, importing `links` and `trackNavLink` from `./NavDesktop` for the mobile list that still uses them.

- [ ] **Step 3: Run the existing suite to verify nothing changed**

Run: `npx nx test website -- --run src/components/shared/Nav.spec.tsx`

Expected: PASS, unchanged. A failure here means the move was not verbatim — fix the move, do not edit the test.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/shared/NavDesktop.tsx apps/website/src/components/shared/Nav.tsx
git commit -m "refactor(website): extract the desktop nav row into its own component"
```

---

## Task 4: Desktop triggers and panels

**Files:**
- Modify: `apps/website/src/components/shared/NavDesktop.tsx`
- Modify: `apps/website/src/components/shared/Nav.spec.tsx:106-152` (the `retires Examples from desktop navigation…` test)
- Modify: `apps/website/src/styles/chrome.css`

- [ ] **Step 1: Write the failing test**

In `apps/website/src/components/shared/Nav.spec.tsx`, **replace** `retires Examples from desktop navigation without changing primary destinations or demos` with:

```tsx
  it('opens a panel per trigger and links each library from it', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    const navigation = screen.getByRole('navigation');

    const libraries = within(navigation).getByRole('button', { name: 'Libraries' });
    expect(libraries.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(libraries);
    expect(libraries.getAttribute('aria-expanded')).toBe('true');

    const panel = document.getElementById(
      libraries.getAttribute('aria-controls') ?? '',
    );
    if (!panel) throw new Error('Expected the trigger to control a panel');
    expect(
      within(panel).getByRole('link', { name: /@threadplane\/langgraph/ }).getAttribute('href'),
    ).toBe('/langgraph');
    expect(
      within(panel).getByRole('link', { name: /@threadplane\/render/ }).getAttribute('href'),
    ).toBe('/render');
    expect(
      within(panel).getByRole('link', { name: /Choosing an adapter/ }).getAttribute('href'),
    ).toBe('/docs/choosing-an-adapter');
  });

  it('keeps Pricing a plain link and retires the Demo dropdown', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    const navigation = screen.getByRole('navigation');

    expect(
      within(navigation).getByRole('link', { name: 'Pricing' }).getAttribute('href'),
    ).toBe('/pricing');
    expect(within(navigation).queryByRole('button', { name: /^Demo/ })).toBeNull();

    fireEvent.click(within(navigation).getByRole('button', { name: 'Docs' }));
    expect(
      screen.getByRole('link', { name: /LangGraph demo/ }).getAttribute('href'),
    ).toBe('https://demo.threadplane.ai');
    expect(
      screen.getByRole('link', { name: /AG-UI demo/ }).getAttribute('href'),
    ).toBe('https://ag-ui.threadplane.ai');
  });

  it('shows one panel at a time and closes on Escape, restoring trigger focus', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    const navigation = screen.getByRole('navigation');
    const libraries = within(navigation).getByRole('button', { name: 'Libraries' });
    const solutions = within(navigation).getByRole('button', { name: 'Solutions' });

    fireEvent.click(libraries);
    fireEvent.click(solutions);
    expect(libraries.getAttribute('aria-expanded')).toBe('false');
    expect(solutions.getAttribute('aria-expanded')).toBe('true');

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(solutions.getAttribute('aria-expanded')).toBe('false');
    expect(document.activeElement).toBe(solutions);
  });

  it('tags panel link analytics with the trigger it came from', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    const navigation = screen.getByRole('navigation');
    fireEvent.click(within(navigation).getByRole('button', { name: 'Solutions' }));
    fireEvent.click(screen.getByRole('link', { name: /Blog/ }));

    expect(trackCtaClick).toHaveBeenCalledWith({
      surface: 'nav',
      destination_url: '/blog',
      cta_id: 'nav_solutions_blog',
      cta_text: 'Blog',
    });
  });

  it('still links the repository from the bar', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    expect(
      within(screen.getByRole('navigation'))
        .getByRole('link', { name: 'GitHub repository' })
        .getAttribute('href'),
    ).toBe('https://github.com/cacheplane/angular-agent-framework');
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test website -- --run src/components/shared/Nav.spec.tsx`

Expected: FAIL — `Unable to find role="button" and name "Libraries"`.

- [ ] **Step 3: Rewrite `NavDesktop.tsx` to render from the config**

In `apps/website/src/components/shared/NavDesktop.tsx`, **delete `DemoDropdown`** (nothing references it after this task, and an unused non-exported function fails lint) and replace the `NavDesktop` component. **Keep the exported `links` array and `trackNavLink`** — the mobile drawer still imports them until Task 8, and Task 9 deletes them.

```tsx
'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import {
  trackCtaClick,
  trackExternalLinkClick,
} from '../../lib/analytics/client';
import { Button } from '../ui/Button';
import { GitHubIcon } from '../ui/GitHubIcon';
import { GITHUB_REPO_URL } from '../../lib/positioning';
import { LibraryMark } from '../docs/LibraryMark';
import { NAV_TRIGGERS, type NavItem, type NavPanel } from './nav-config';

/** Matches the docs sidebar's grace: long enough to cross the gap diagonally. */
const OPEN_DELAY_MS = 100;
const CLOSE_DELAY_MS = 150;

export function trackNavItem(item: NavItem, surface: 'nav' | 'mobile_nav') {
  // Annotated, not inferred: a bare template literal widens to `string`, which
  // is not assignable to CtaId (`nav_${string}` | `mobile_nav_${string}`).
  // Nothing but `nx build website` catches that.
  const ctaId: `nav_${string}` | `mobile_nav_${string}` =
    surface === 'nav' ? `nav_${item.ctaId}` : `mobile_nav_${item.ctaId}`;
  if (item.external) {
    trackExternalLinkClick(item.href, {
      surface,
      cta_id: ctaId,
      cta_text: item.label,
    });
    return;
  }
  trackCtaClick({
    surface,
    destination_url: item.href,
    cta_id: ctaId,
    cta_text: item.label,
  });
}

export function NavPanelItem({
  item,
  surface,
  onNavigate,
}: {
  item: NavItem;
  surface: 'nav' | 'mobile_nav';
  onNavigate?: () => void;
}) {
  const Icon = item.icon;
  const body = (
    <>
      <span className="nav-panel-item-chip" aria-hidden="true">
        {item.library ? (
          <LibraryMark library={item.library} size={20} />
        ) : Icon ? (
          <Icon size={16} aria-hidden={true} />
        ) : null}
      </span>
      <span className="nav-panel-item-text">
        <span className="nav-panel-item-label">{item.label}</span>
        <span className="nav-panel-item-desc">{item.description}</span>
      </span>
    </>
  );
  const onClick = () => {
    trackNavItem(item, surface);
    onNavigate?.();
  };

  if (item.external) {
    return (
      <a
        href={item.href}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onClick}
        className="nav-panel-item"
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={item.href} onClick={onClick} className="nav-panel-item">
      {body}
    </Link>
  );
}

function Panel({ panel, id }: { panel: NavPanel; id: string }) {
  return (
    <div id={id} className="nav-panel" data-columns={panel.columns.length}>
      <div className="nav-panel-cols">
        {panel.columns.map((column, index) => (
          <div key={column.heading ?? index} className="nav-panel-col">
            {column.heading ? (
              <span className="nav-panel-col-head">{column.heading}</span>
            ) : null}
            {column.items.map((item) => (
              <NavPanelItem key={item.ctaId} item={item} surface="nav" />
            ))}
          </div>
        ))}
      </div>
      {panel.footer ? (
        <div className="nav-panel-footer">
          <span className="nav-panel-footer-lead">{panel.footer.lead}</span>
          <NavPanelItem item={panel.footer} surface="nav" />
        </div>
      ) : null}
    </div>
  );
}

export function NavDesktop() {
  const [openId, setOpenId] = useState<string | null>(null);
  const panelPrefix = useId();
  const triggerRefs = useRef(new Map<string, HTMLButtonElement>());
  const openTimer = useRef<number | null>(null);
  const closeTimer = useRef<number | null>(null);

  const clearTimers = useCallback(() => {
    if (openTimer.current !== null) window.clearTimeout(openTimer.current);
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current);
    openTimer.current = null;
    closeTimer.current = null;
  }, []);

  useEffect(() => clearTimers, [clearTimers]);

  useEffect(() => {
    if (!openId) return undefined;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      clearTimers();
      triggerRefs.current.get(openId)?.focus();
      setOpenId(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [clearTimers, openId]);

  const scheduleOpen = (id: string) => {
    clearTimers();
    openTimer.current = window.setTimeout(() => setOpenId(id), OPEN_DELAY_MS);
  };
  const scheduleClose = () => {
    clearTimers();
    closeTimer.current = window.setTimeout(() => setOpenId(null), CLOSE_DELAY_MS);
  };

  const panelId = (id: string) => `${panelPrefix}-${id}`;

  return (
    <div
      className="hidden lg:flex items-center gap-8 nav-desktop"
      onMouseLeave={scheduleClose}
    >
      {NAV_TRIGGERS.map((trigger) =>
        trigger.kind === 'link' ? (
          <Link
            key={trigger.id}
            href={trigger.href}
            onMouseEnter={() => {
              clearTimers();
              setOpenId(null);
            }}
            onClick={() =>
              trackCtaClick({
                surface: 'nav',
                destination_url: trigger.href,
                cta_id: `nav_${trigger.ctaId}`,
                cta_text: trigger.label,
              })
            }
            className="text-sm font-mono transition-colors nav-link"
          >
            {trigger.label}
          </Link>
        ) : (
          <button
            key={trigger.id}
            type="button"
            ref={(node) => {
              if (node) triggerRefs.current.set(trigger.id, node);
              else triggerRefs.current.delete(trigger.id);
            }}
            onMouseEnter={() => scheduleOpen(trigger.id)}
            onClick={() => {
              clearTimers();
              setOpenId((current) => (current === trigger.id ? null : trigger.id));
            }}
            aria-expanded={openId === trigger.id}
            {/* Only while open: the panel is conditionally rendered, so a
                constant aria-controls references an id not in the DOM. */}
            aria-controls={openId === trigger.id ? panelId(trigger.id) : undefined}
            className="text-sm font-mono transition-colors nav-link nav-trigger"
          >
            {trigger.label}
            <ChevronDown
              size={14}
              strokeWidth={2}
              aria-hidden="true"
              data-open={openId === trigger.id || undefined}
              className="nav-trigger-caret"
            />
          </button>
        ),
      )}

      <a
        href={GITHUB_REPO_URL}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() =>
          trackExternalLinkClick(GITHUB_REPO_URL, {
            surface: 'nav',
            cta_id: 'nav_github',
            cta_text: 'GitHub',
          })
        }
        className="transition-colors nav-link"
        aria-label="GitHub repository"
      >
        <GitHubIcon />
      </a>
      <Button
        variant="primary"
        size="md"
        href="/contact"
        onClick={() =>
          trackCtaClick({
            surface: 'nav',
            destination_url: '/contact',
            cta_id: 'nav_talk_to_us',
            cta_text: 'Talk to Us',
          })
        }
      >
        Talk to Us
      </Button>

      {NAV_TRIGGERS.filter((trigger) => trigger.kind === 'panel').map((trigger) =>
        trigger.kind === 'panel' && openId === trigger.id ? (
          <div
            key={trigger.id}
            className="nav-panel-shell"
            onMouseEnter={clearTimers}
            onMouseLeave={scheduleClose}
          >
            <Panel panel={trigger.panel} id={panelId(trigger.id)} />
          </div>
        ) : null,
      )}
    </div>
  );
}
```

Note that `NavPanelItem` and `trackNavItem` are **exported**: Task 8's mobile levels render the same items through the same component, which is what keeps the two surfaces from drifting.

- [ ] **Step 4: Add the panel styling**

Append to `apps/website/src/styles/chrome.css`, **outside any `@layer`**:

```css
/* Nav panels
 *
 * No borders and no dividers anywhere: the hovered item separates itself with a
 * soft shadow on white. Yellow is fill-only (1.84:1 on white) so it appears
 * here only as the footer arrow chip — never as text, never as a panel wash. */
.nav-trigger {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: none;
  border: none;
  cursor: pointer;
}
.nav-trigger-caret {
  color: var(--color-text-muted);
  transition: transform 0.18s;
}
.nav-trigger-caret[data-open] {
  transform: rotate(180deg);
}
.nav-panel-shell {
  position: absolute;
  top: 100%;
  left: 0;
  right: 0;
  z-index: 60;
}
.nav-panel {
  background: var(--color-surface-tinted, #fafafa);
  border-radius: 12px;
  box-shadow: 0 1px 3px rgba(10, 10, 10, 0.08), 0 8px 24px rgba(10, 10, 10, 0.06);
  padding: 28px 24px 24px;
}
.nav-panel-cols {
  display: grid;
  gap: 26px;
}
.nav-panel[data-columns='2'] .nav-panel-cols {
  grid-template-columns: 1fr 1fr;
}
.nav-panel[data-columns='3'] .nav-panel-cols {
  grid-template-columns: repeat(3, 1fr);
}
.nav-panel[data-columns='1'] .nav-panel-cols {
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}
.nav-panel-col-head {
  display: block;
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--color-text-muted);
  margin: 0 0 12px 13px;
}
.nav-panel-item {
  display: flex;
  gap: 11px;
  align-items: flex-start;
  padding: 12px 13px;
  border-radius: 10px;
  text-decoration: none;
  transition: background 0.15s, box-shadow 0.15s;
}
.nav-panel-item:hover,
.nav-panel-item:focus-visible {
  background: var(--color-surface);
  box-shadow: 0 1px 2px rgba(10, 10, 10, 0.06), 0 6px 16px rgba(10, 10, 10, 0.05);
}
.nav-panel-item-chip {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  background: rgba(21, 37, 62, 0.07);
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--color-accent);
  flex: none;
}
.nav-panel-item-label {
  display: block;
  font-family: var(--font-mono);
  font-size: 12px;
  font-weight: 700;
  line-height: 1.3;
  color: var(--color-accent);
}
.nav-panel-item-desc {
  display: block;
  font-size: 11px;
  line-height: 1.5;
  color: var(--color-text-muted);
  margin-top: 4px;
}
.nav-panel-footer {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-top: 18px;
}
.nav-panel-footer-lead {
  font-family: var(--font-mono);
  font-size: 12px;
  color: var(--color-text-muted);
  padding-left: 13px;
}
.nav-panel-footer .nav-panel-item-chip {
  background: var(--color-signal, #ffaf00);
  color: var(--color-text-primary);
}
```

The panel shell is absolutely positioned against the nav row, so give the row a positioning context:

```css
.nav-desktop {
  position: static;
}
.nav-bar > div {
  position: relative;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `npx nx test website -- --run src/components/shared/Nav.spec.tsx`

Expected: PASS. The four mobile tests listed in the orientation table still fail if you touched the mobile half — you should not have.

- [ ] **Step 6: Verify in a real browser**

Start the preview and check the panels open on hover, close on mouse-out, and that the caret rotates:

```bash
npx nx serve website
```

Visit `http://localhost:3000`, hover `Libraries`, `Docs`, and `Solutions`. Confirm no borders or dividers inside the panel and that the only yellow is the footer arrow chip and the `Talk to Us` button.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/shared/NavDesktop.tsx apps/website/src/components/shared/Nav.spec.tsx apps/website/src/styles/chrome.css
git commit -m "feat(website): render the desktop nav as four triggers with hover panels"
```

---

## Task 5: The transparent bar

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`
- Modify: `apps/website/src/styles/chrome.css`
- Create: `apps/website/e2e/nav-surface.spec.ts`

- [ ] **Step 1: Wire the hook and render the sentinel**

In `apps/website/src/components/shared/Nav.tsx`, call the hook and stamp the result on the bar. The sentinel is rendered **outside** the fixed nav so that it scrolls; `body` is its containing block, so `top: 0` means the top of the document.

```tsx
const { surface, sentinelRef } = useNavSurface(pathname);
```

```tsx
      <div ref={sentinelRef} className="nav-scroll-sentinel" aria-hidden="true" />
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 nav-bar"
        data-site-navigation=""
        data-surface={surface}
      >
```

- [ ] **Step 2: Add the surface CSS**

In `apps/website/src/styles/chrome.css`, replace the existing `.nav-bar` rule:

```css
.nav-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  box-shadow: var(--shadow-sm);
}
```

with:

```css
/* Two surfaces, no shadow in either.
 *
 * Transparent is only ever reached on a HERO_ROUTES page at scroll 0, where the
 * ground behind the bar is the hero's saturated yellow. Navy on that yellow is
 * roughly 8:1, so this is a stylistic state, not an accessibility concession. */
.nav-bar {
  background: var(--color-surface);
  border-bottom: 1px solid var(--color-border);
  transition: background 0.2s, border-color 0.2s;
}
.nav-bar[data-surface='transparent'] {
  background: transparent;
  border-bottom-color: transparent;
}
.nav-bar[data-surface='transparent'] .nav-link,
.nav-bar[data-surface='transparent'] .nav-trigger,
.nav-bar[data-surface='transparent'] .nav-trigger-caret {
  color: var(--color-accent);
}
.nav-bar[data-surface='transparent'] [data-ui='button'][data-variant='primary'] {
  background: var(--color-accent);
  color: var(--color-text-inverted);
}
.nav-scroll-sentinel {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 8px;
  pointer-events: none;
}
@media (prefers-reduced-motion: reduce) {
  .nav-bar {
    transition: none;
  }
}
```

The CTA selector is `[data-ui='button'][data-variant='primary']`, verified against `src/components/ui/Button.tsx:64-70,92-98`: `Button` stamps `data-ui="button"`, `data-variant`, and `data-size` on its root and adds **no class of its own** — `className={cn(className)}` passes through only what the caller supplies, and the nav's CTA supplies none. A `.btn` selector would match nothing and fail silently. Note also that a `Button` with `href` renders an `<a>`, so it is `getByRole('link')` in tests, not `getByRole('button')`.

- [ ] **Step 3: Write the e2e**

Create `apps/website/e2e/nav-surface.spec.ts`:

```ts
import { test, expect } from '@playwright/test';
import { HERO_ROUTES } from '../src/components/shared/nav-config';

/**
 * A hand-maintained hero-route list drifts. A unit test over the list cannot
 * catch a page that stopped rendering a hero, so the guard has to visit the
 * page and read the computed background.
 */
for (const route of HERO_ROUTES) {
  test(`the nav is transparent at rest on ${route}`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    const nav = page.locator('nav').first();
    await expect(nav).toHaveAttribute('data-surface', 'transparent');

    const background = await nav.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(background).toBe('rgba(0, 0, 0, 0)');
  });

  test(`the nav solidifies once ${route} is scrolled`, async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(route);
    await page.mouse.wheel(0, 600);

    const nav = page.locator('nav').first();
    await expect(nav).toHaveAttribute('data-surface', 'solid');
    const background = await nav.evaluate(
      (el) => getComputedStyle(el).backgroundColor,
    );
    expect(background).not.toBe('rgba(0, 0, 0, 0)');
  });
}

test('the nav is solid on a route with no hero', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/docs/langgraph/getting-started/introduction');
  await expect(page.locator('nav').first()).toHaveAttribute(
    'data-surface',
    'solid',
  );
});
```

- [ ] **Step 4: Run the e2e to verify it passes**

Run: `npx nx e2e website -- --testFiles=e2e/nav-surface.spec.ts`

Expected: PASS, 3 tests.

If `solidifies once scrolled` fails, the sentinel is not scrolling — check that it rendered outside `<nav>` and that no ancestor has `position: relative` making `top: 0` mean something other than the top of the document.

- [ ] **Step 4b: Decide the deferred `setAtTop(true)` question**

Task 2 left this open deliberately, because jsdom cannot measure layout and the answer needs a real browser. `useNavSurface` optimistically assumes top-of-page on effect entry, before the observer's first (asynchronous) callback lands.

- The **common case** — a fresh load of `/` at scroll 0 — is why the optimistic set exists. Removing it makes every normal load flash solid over the hero before flipping to transparent.
- The **inverse case** — a hero route that mounts *already scrolled*, via a `#hash` deep link or back-navigation with scroll restoration — flashes transparent over white content instead.

Neither is free; a boolean-then-correct approach always picks which case flashes. The fix that resolves both is seeding `atTop` from a synchronous `sentinel.getBoundingClientRect()` inside the effect, which is available immediately rather than waiting on the observer.

Check both cases in a real browser: load `/`, then load `/#open-source`, then navigate away and press Back. If either flashes visibly, implement the `getBoundingClientRect()` seed and re-run Task 2's spec. If neither does, delete the deferral comment in `useNavSurface.ts` and record here that it was checked and left alone.

- [ ] **Step 4c: Confirm the surface against a deployed preview, not only the dev server**

`reactStrictMode` is unset in `apps/website/next.config.ts`, so it takes Next's default of `true` and effects double-invoke in dev — the observer is created, disconnected, and recreated on every mount. This repo has already been bitten by website e2e passing against `next dev` and failing only against deployed prod, so a green local run is not sufficient evidence here. Confirm the transparent and solid states on the Vercel preview build before calling this done.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx apps/website/src/styles/chrome.css apps/website/e2e/nav-surface.spec.ts
git commit -m "feat(website): render the nav transparent over the hero until scrolled"
```

---

## Task 6: Condense the bar inside docs

**Files:**
- Modify: `apps/website/src/styles/chrome.css:29-40`
- Modify: `apps/website/src/components/shared/Nav.tsx`
- Modify: `apps/website/e2e/nav-height.spec.ts`

**Read this first.** Every width step in `nav-height.spec.ts` currently navigates to `/docs/langgraph/getting-started/introduction`. Once docs has its own height, those steps are measuring the docs bar against marketing values. The steps move to `/`; a docs set is added beside them.

- [ ] **Step 1: Rewrite the e2e so it fails against today's CSS**

In `apps/website/e2e/nav-height.spec.ts`, replace the `STEPS` loop (leaving the two positional tests below it untouched):

```ts
const STEPS = [
  { width: 375, note: 'phone — px-6 py-4' },
  { width: 767, note: 'phone — last px before md' },
  { width: 768, note: 'tablet — md padding, no lg link row' },
  { width: 1023, note: 'tablet — last px before lg' },
  { width: 1024, note: 'desktop — lg link row appears' },
  { width: 1440, note: 'desktop' },
];

/**
 * `--nav-h` is route-dependent as of the navbar redesign: marketing routes keep
 * the measured 58/66/81 ladder, and /docs is a flat 58 at every width. Both
 * have to be measured, because the declared value is rounded up off the
 * rendered height and only a browser knows what that height is.
 */
const SURFACES = [
  { name: 'marketing', url: '/' },
  { name: 'docs', url: '/docs/langgraph/getting-started/introduction' },
];

for (const surface of SURFACES) {
  for (const step of STEPS) {
    test(`--nav-h matches the rendered nav on ${surface.name} at ${step.width}px (${step.note})`, async ({
      page,
    }) => {
      await page.setViewportSize({ width: step.width, height: 800 });
      await page.goto(surface.url);

      const nav = page.locator('nav').first();
      await expect(nav).toBeVisible();

      const measured = await nav.evaluate((el) => el.getBoundingClientRect().height);
      const variable = await page.evaluate(() =>
        parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')),
      );

      expect(variable).toBeGreaterThanOrEqual(measured);
      expect(variable - measured).toBeLessThanOrEqual(1);
    });
  }
}

test('the docs nav does not grow with the breakpoint', async ({ page }) => {
  const heights: number[] = [];
  for (const width of [375, 768, 1440]) {
    await page.setViewportSize({ width, height: 800 });
    await page.goto('/docs/langgraph/getting-started/introduction');
    heights.push(
      await page
        .locator('nav')
        .first()
        .evaluate((el) => el.getBoundingClientRect().height),
    );
  }
  const [phone] = heights;
  for (const height of heights) expect(Math.abs(height - phone)).toBeLessThanOrEqual(1);
});
```

- [ ] **Step 2: Run the e2e to verify it fails**

Run: `npx nx e2e website -- --testFiles=e2e/nav-height.spec.ts`

Expected: FAIL on `the docs nav does not grow with the breakpoint` — the docs nav is still 81px at 1440 and 58px at 375.

- [ ] **Step 3: Give docs its own height and padding**

In `apps/website/src/styles/chrome.css`, after the existing three `--nav-h` steps, add:

```css
/* Docs condenses to one height at every width. The three marketing steps exist
 * because padding grows at md while the tall link row only appears at lg; docs
 * keeps the short padding throughout, so it has no such asymmetry. Still
 * measured, not derived — e2e/nav-height.spec.ts pins both ladders. */
:root:has(.nav-bar[data-route='docs']) {
  --nav-h: 58px;
}
```

`:has()` on `:root` is supported in every browser this site targets; it is used so a single declaration reaches `--nav-h` without threading a class onto `<html>` from a client component.

**Why this one declaration beats the media queries above it, regardless of order.** `:has()` takes the specificity of its most specific argument, so `:root:has(.nav-bar[data-route='docs'])` scores (0,3,0) against plain `:root`'s (0,1,0). Media queries add nothing to specificity, so the docs value wins at every width without needing `!important` or a position after the `@media` blocks. The `<nav>` is server-rendered, so the selector matches on first paint and there is no flash of the marketing height.

Then add the condensed padding and the demoted CTA:

```css
.nav-bar[data-route='docs'] > div {
  padding-top: 10px;
  padding-bottom: 10px;
}
.nav-bar[data-route='docs'] [data-ui='button'][data-variant='primary'] {
  background: none;
  color: var(--color-accent);
  padding-inline: 0;
  box-shadow: none;
}
```

- [ ] **Step 4: Stamp the route on the bar**

In `apps/website/src/components/shared/Nav.tsx`, add the attribute beside `data-surface`:

```tsx
        data-route={isDocsPage ? 'docs' : 'marketing'}
```

`isDocsPage` is already computed in this component from `usePathname()`.

- [ ] **Step 5: Run the e2e to verify it passes**

Run: `npx nx e2e website -- --testFiles=e2e/nav-height.spec.ts`

Expected: PASS, 15 tests (6 marketing + 6 docs + the flat-height test + the two positional tests).

If a marketing step now fails by more than 1px, the declared value needs re-measuring — read the measured height out of the failure message and raise the declaration to the next whole pixel. Never lower it: the offsets must clear the nav rather than tuck content under it.

- [ ] **Step 6: Verify every `--nav-h` consumer at the docs height**

The value moved, so everything reading it has to be re-checked in a browser. Run the docs shell suites:

```bash
npx nx e2e website -- --testFiles=e2e/docs-shell.spec.ts --testFiles=e2e/docs.spec.ts --testFiles=e2e/workspace-shell.spec.ts
```

Expected: PASS. These cover the docs column's top padding (`docs.css:79`), both sticky rails (`docs.css:99,1824`), and the drawer's `top` (`chrome.css:163`).

Then confirm anchor jumps by hand — `scroll-padding-top` in `app/global.css:31` has no spec. Visit `/docs/langgraph/guides/streaming`, click a TOC entry, and confirm the heading lands below the nav rather than under it.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/styles/chrome.css apps/website/src/components/shared/Nav.tsx apps/website/e2e/nav-height.spec.ts
git commit -m "feat(website): condense the nav to one height inside docs"
```

---

## Task 7: Extract the mobile drawer, unchanged

**Files:**
- Create: `apps/website/src/components/shared/NavMobile.tsx`
- Modify: `apps/website/src/components/shared/Nav.tsx`

Another pure move. The focus trap, the scroll lock, the `inert` handling, the desktop-breakpoint auto-close, the focus restore, and the ⌘K search handoff all move together — they are one machine and splitting them would break it.

- [ ] **Step 1: Move the drawer**

Create `apps/website/src/components/shared/NavMobile.tsx` exporting `NavMobile`. Move these ranges out of `Nav.tsx`, verbatim:

| Lines in `Nav.tsx` | What |
| --- | --- |
| 24–34 | `toAnalyticsLibrary` — only the drawer's docs-page capture uses it, and `preserves page-level analytics for Docs links` depends on it surviving the move |
| 37–67 | `MenuIcon` and `CloseIcon` |
| 121–160 | `open` and `mobileTab` state, `mobileTriggerRef`, `mobileDialogRef`, `restoreMobileFocusRef`, `pendingMobileSearchRef`, `cancelScheduledMobileRestoreRef`, `cancelScheduledMobileRestore`, `closeMobileMenu` |
| 162–245 | every `useEffect` that reads `open` — scroll lock, `inert`, the desktop media query, focus restore, the focus trap |
| 346–362 | the hamburger button |
| 364–515 | the overlay `<div role="dialog">` and everything inside it |

**Hazard introduced by Task 6:** `chrome.css` now has `.nav-bar[data-route='docs'] > div { padding-block: 16px }`. Today `<nav>` has exactly one direct `div` child, and the mobile overlay is deliberately a *sibling* of `<nav>` rather than a child ("to avoid stacking context issues", per the comment in `Nav.tsx`). If this task moves the overlay inside `<nav>` — for instance to solve that stacking problem a different way — it silently inherits the docs-only padding. Keep it outside, or scope that rule to a class.

`navRef` stays in `Nav.tsx` (the `<nav>` element is still rendered there) and is passed down, because the drawer sets `nav.inert` while it is open.

`NavMobile` takes what it can no longer compute for itself:

```tsx
export interface NavMobileProps {
  readonly isDocsPage: boolean;
  readonly docsLibrary: LibraryId | null;
  readonly activeSection: string;
  readonly activeSlug: string;
  /** The <nav> element, so the drawer can make it inert while open. */
  readonly navRef: React.RefObject<HTMLElement | null>;
}
```

- [ ] **Step 2: Consume it from `Nav.tsx`**

`Nav.tsx` keeps `usePathname()`, the path parsing, `navRef`, and `useNavSurface`, and renders `<NavMobile … />` in place of the hamburger and the overlay.

- [ ] **Step 3: Run the existing suite to verify nothing changed**

Run: `npx nx test website -- --run src/components/shared/Nav.spec.tsx`

Expected: PASS, unchanged. Any failure means the move was not verbatim.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/shared/NavMobile.tsx apps/website/src/components/shared/Nav.tsx
git commit -m "refactor(website): extract the mobile nav drawer into its own component"
```

---

## Task 8: The mobile drill-in stack

**Files:**
- Modify: `apps/website/src/components/shared/NavMobile.tsx`
- Modify: `apps/website/src/components/shared/Nav.spec.tsx` (three tests replaced)
- Modify: `apps/website/src/styles/chrome.css`

The rule that decides what the Docs level shows: **on a `/docs` route it hosts `DocsContextContent`; anywhere else it shows the marketing Docs panel.** There is no docs context to show off a docs route, and the tree is the whole reason the drawer exists on one.

- [ ] **Step 1: Write the failing tests**

In `apps/website/src/components/shared/Nav.spec.tsx`, **delete** these three tests entirely — the behavior they describe no longer exists:

- `uses the existing header trigger for the control-plane Docs drawer`
- `preserves the Site tab alongside the Docs control plane`
- `retires Examples from mobile navigation without changing primary destinations or demos`

Add in their place:

```tsx
  it('opens pre-pushed to the docs tree on a docs route, with no tab strip', () => {
    pathnameRef.current = '/docs/langgraph/guides/streaming';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    // The Site/Docs tab strip is gone; depth carries that meaning now.
    expect(within(dialog).queryByRole('button', { name: 'Site' })).toBeNull();
    expect(within(dialog).getByRole('button', { name: 'Search docs' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Learn' })).toBeTruthy();
    expect(within(dialog).getByRole('button', { name: 'Back to menu' })).toBeTruthy();
  });

  it('opens at the root on a marketing route', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    expect(within(dialog).getByRole('button', { name: 'Libraries' })).toBeTruthy();
    expect(within(dialog).getByRole('link', { name: 'Pricing' }).getAttribute('href')).toBe(
      '/pricing',
    );
    expect(within(dialog).queryByRole('button', { name: 'Back to menu' })).toBeNull();
  });

  it('pushes a level and comes back', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Libraries' }));
    expect(
      within(dialog).getByRole('link', { name: /@threadplane\/chat/ }).getAttribute('href'),
    ).toBe('/chat');

    fireEvent.click(within(dialog).getByRole('button', { name: 'Back to menu' }));
    expect(within(dialog).getByRole('button', { name: 'Libraries' })).toBeTruthy();
    expect(within(dialog).queryByRole('link', { name: /@threadplane\/chat/ })).toBeNull();
  });

  it('shows the marketing Docs panel off a docs route', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });

    fireEvent.click(within(dialog).getByRole('button', { name: 'Docs' }));
    expect(
      within(dialog).getByRole('link', { name: /Quick start/ }).getAttribute('href'),
    ).toBe('/docs/langgraph/getting-started/quickstart');
    // There is no docs context off a docs route, so the tree must not appear.
    expect(within(dialog).queryByRole('button', { name: 'Learn' })).toBeNull();
  });

  it('Escape pops a level before it closes the drawer', async () => {
    pathnameRef.current = '/';
    render(<Nav />);
    const trigger = screen.getByRole('button', { name: 'Open menu' });
    fireEvent.click(trigger);
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Solutions' }));

    fireEvent.keyDown(document, { key: 'Escape' });
    expect(screen.getByRole('dialog', { name: 'Mobile navigation' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Solutions' })).toBeTruthy();

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(document.activeElement).toBe(trigger);
  });

  it('moves focus into the level it just pushed', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Libraries' }));

    expect(document.activeElement).toBe(
      within(dialog).getByRole('button', { name: 'Back to menu' }),
    );
  });

  it('tags mobile panel analytics with the trigger it came from', () => {
    pathnameRef.current = '/';
    render(<Nav />);
    fireEvent.click(screen.getByRole('button', { name: 'Open menu' }));
    const dialog = screen.getByRole('dialog', { name: 'Mobile navigation' });
    fireEvent.click(within(dialog).getByRole('button', { name: 'Libraries' }));
    fireEvent.click(within(dialog).getByRole('link', { name: /@threadplane\/render/ }));

    expect(trackCtaClick).toHaveBeenCalledWith({
      surface: 'mobile_nav',
      destination_url: '/render',
      cta_id: 'mobile_nav_libraries_render',
      cta_text: '@threadplane/render',
    });
  });
```

The remaining mobile tests — Escape at depth 0, close-button focus restore, `inert`, the desktop-breakpoint auto-close, the search handoff, the nested library menu, and `preserves page-level analytics for Docs links` — must keep passing untouched. They are the machine you are not allowed to break.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test website -- --run src/components/shared/Nav.spec.tsx`

Expected: FAIL — `Unable to find role="button" and name "Back to menu"`.

- [ ] **Step 3: Add the level state**

In `apps/website/src/components/shared/NavMobile.tsx`, replace `mobileTab` with a level:

```tsx
type MobileLevel = { kind: 'root' } | { kind: 'panel'; id: string };

const rootLevel: MobileLevel = { kind: 'root' };
const initialLevel = (isDocsPage: boolean): MobileLevel =>
  isDocsPage ? { kind: 'panel', id: 'docs' } : rootLevel;
```

```tsx
const [level, setLevel] = useState<MobileLevel>(() => initialLevel(isDocsPage));
```

Reset it whenever the drawer opens, so a stale depth never survives a close:

```tsx
  useEffect(() => {
    if (open) setLevel(initialLevel(isDocsPage));
  }, [isDocsPage, open]);
```

- [ ] **Step 4: Make Escape pop before it closes**

In the drawer's existing `onKeyDown` handler, replace the Escape branch:

```tsx
      if (event.key === 'Escape') {
        event.preventDefault();
        if (level.kind === 'panel') {
          setLevel(rootLevel);
          return;
        }
        closeMobileMenu();
        return;
      }
```

and add `level` to that effect's dependency array.

- [ ] **Step 5: Re-run the focus trap per level**

The trap effect currently runs once per open. Add `level` to its dependencies so it re-collects the focusable set and focuses the new level's first item:

```tsx
  }, [closeMobileMenu, level, open]);
```

Because the back row is the first focusable element in a pushed level, `focusable()[0]?.focus()` already satisfies `moves focus into the level it just pushed`.

- [ ] **Step 6: Render the levels**

Replace the tab strip and both branches of the drawer body:

```tsx
            {level.kind === 'panel' ? (
              <button
                type="button"
                className="nav-mobile-back"
                onClick={() => setLevel(rootLevel)}
              >
                <ChevronLeft size={16} strokeWidth={2} aria-hidden="true" />
                Back to menu
              </button>
            ) : null}

            {level.kind === 'root' ? (
              <div className="nav-mobile-list">
                {NAV_TRIGGERS.map((trigger) =>
                  trigger.kind === 'link' ? (
                    <Link
                      key={trigger.id}
                      href={trigger.href}
                      onClick={() => {
                        trackCtaClick({
                          surface: 'mobile_nav',
                          destination_url: trigger.href,
                          cta_id: `mobile_nav_${trigger.ctaId}`,
                          cta_text: trigger.label,
                        });
                        closeMobileMenu();
                      }}
                      className="nav-mobile-row"
                    >
                      {trigger.label}
                    </Link>
                  ) : (
                    <button
                      key={trigger.id}
                      type="button"
                      className="nav-mobile-row"
                      onClick={() => setLevel({ kind: 'panel', id: trigger.id })}
                    >
                      {trigger.label}
                      <ChevronRight size={16} strokeWidth={2} aria-hidden="true" />
                    </button>
                  ),
                )}
                <a
                  href={GITHUB_REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    trackExternalLinkClick(GITHUB_REPO_URL, {
                      surface: 'mobile_nav',
                      cta_id: 'mobile_nav_github',
                      cta_text: 'GitHub',
                    });
                    closeMobileMenu();
                  }}
                  className="nav-mobile-github-link"
                >
                  <GitHubIcon /> GitHub
                </a>
                <div className="nav-mobile-cta-wrap">
                  <Button
                    variant="primary"
                    size="lg"
                    href="/contact"
                    onClick={() => {
                      trackCtaClick({
                        surface: 'mobile_nav',
                        destination_url: '/contact',
                        cta_id: 'mobile_nav_talk_to_us',
                        cta_text: 'Talk to Us',
                      });
                      closeMobileMenu();
                    }}
                    className="nav-mobile-cta"
                  >
                    Talk to Us
                  </Button>
                </div>
              </div>
            ) : null}

            {level.kind === 'panel' && level.id === 'docs' && isDocsPage ? (
              <div
                onClickCapture={(event) => {
                  const link = (
                    event.target as HTMLElement
                  ).closest<HTMLAnchorElement>('a[data-docs-navlink]');
                  if (!link) return;
                  trackCtaClick({
                    surface: 'mobile_nav',
                    destination_url: link.getAttribute('href') ?? link.href,
                    cta_id: 'mobile_nav_docs_page',
                    cta_text: link.textContent?.trim() ?? 'Docs page',
                    library: toAnalyticsLibrary(docsLibrary),
                  });
                }}
              >
                <DocsContextContent
                  activeLibrary={docsLibrary}
                  activeSection={activeSection || 'getting-started'}
                  activeSlug={activeSlug || 'introduction'}
                  mobile
                  onNavigate={() => closeMobileMenu()}
                  onSearchHandoff={() => closeMobileMenu(true)}
                />
              </div>
            ) : null}

            {level.kind === 'panel' && !(level.id === 'docs' && isDocsPage) ? (
              <div className="nav-mobile-panel">
                {mobilePanel(level.id)?.columns.map((column, index) => (
                  <div key={column.heading ?? index} className="nav-mobile-group">
                    {column.heading ? (
                      <span className="nav-panel-col-head">{column.heading}</span>
                    ) : null}
                    {column.items.map((item) => (
                      <NavPanelItem
                        key={item.ctaId}
                        item={item}
                        surface="mobile_nav"
                        onNavigate={() => closeMobileMenu()}
                      />
                    ))}
                  </div>
                ))}
                {mobilePanel(level.id)?.footer ? (
                  <NavPanelItem
                    item={mobilePanel(level.id)!.footer!}
                    surface="mobile_nav"
                    onNavigate={() => closeMobileMenu()}
                  />
                ) : null}
              </div>
            ) : null}
```

with this helper beside `initialLevel`:

```tsx
const mobilePanel = (id: string) => {
  const trigger = NAV_TRIGGERS.find((entry) => entry.id === id);
  return trigger?.kind === 'panel' ? trigger.panel : undefined;
};
```

Import `ChevronLeft` and `ChevronRight` from `lucide-react`, `NAV_TRIGGERS` from `./nav-config`, and `NavPanelItem` from `./NavDesktop`.

- [ ] **Step 7: Style the levels**

Append to `apps/website/src/styles/chrome.css`:

```css
/* Mobile drill-in
 *
 * Rows are full-width and at least 44px tall — this is the whole surface on a
 * phone, so nothing here gets denser than the desktop panel. */
.nav-mobile-back {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  min-height: 44px;
  padding: 11px 10px 13px;
  background: none;
  border: none;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 13px;
  font-weight: 700;
  cursor: pointer;
}
.nav-mobile-row {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
  min-height: 44px;
  padding: 13px 10px;
  border-radius: 9px;
  background: none;
  border: none;
  text-align: left;
  color: var(--color-accent);
  font-family: var(--font-mono);
  font-size: 14px;
  font-weight: 600;
  text-decoration: none;
  cursor: pointer;
}
.nav-mobile-row svg {
  margin-left: auto;
  color: var(--color-text-muted);
}
.nav-mobile-panel {
  animation: nav-level-in 0.18s ease-out;
}
.nav-mobile-group + .nav-mobile-group {
  margin-top: 18px;
}
@keyframes nav-level-in {
  from {
    opacity: 0;
    transform: translateX(12px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}
@media (prefers-reduced-motion: reduce) {
  .nav-mobile-panel {
    animation: none;
  }
}
```

- [ ] **Step 8: Run the tests to verify they pass**

Run: `npx nx test website -- --run src/components/shared/Nav.spec.tsx`

Expected: PASS, including every untouched test in the machine list from Step 1.

- [ ] **Step 9: Verify on a real phone viewport**

```bash
npx nx serve website
```

At a 390px viewport: open the drawer on `/` and confirm rows push and pop; open it on `/docs/langgraph/guides/streaming` and confirm it opens straight into the tree with a back row above it, that `Search docs` still closes the drawer and opens search, and that collapsing a section there leaves it collapsed in the desktop sidebar after you widen the window.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/components/shared/NavMobile.tsx apps/website/src/components/shared/Nav.spec.tsx apps/website/src/styles/chrome.css
git commit -m "feat(website): replace the mobile tab strip with a drill-in stack"
```

---

## Task 9: Delete what the redesign replaced

**Files:**
- Modify: `apps/website/src/components/shared/NavDesktop.tsx`
- Modify: `apps/website/src/styles/chrome.css:99-143,195-224`

- [ ] **Step 1: Delete the dead code**

From `NavDesktop.tsx`, delete `DemoDropdown`, the `links` array, and `trackNavLink` — Task 8 removed the last importer.

From `chrome.css`, delete `.nav-demo-dropdown`, `.nav-demo-trigger`, `.nav-demo-trigger:hover`, `.nav-demo-caret`, `.nav-demo-caret[data-open]`, `.nav-demo-menu`, `.nav-demo-item`, `.nav-demo-item:hover`, `.nav-mtabs`, `.nav-mtab`, `.nav-mtab[data-active]`, `.nav-msubtabs-wrap`, `.nav-msubtabs`, `.nav-msubtab`, `.nav-msubtab[data-active]`, and `.nav-mobile-site-link`.

- [ ] **Step 2: Prove nothing still references them**

```bash
grep -rn "nav-demo\|nav-mtab\|nav-msubtab\|nav-mobile-site-link\|DemoDropdown\|trackNavLink" apps/website/src apps/website/e2e
```

Expected: no output. Any hit is a live reference — restore that rule rather than deleting the caller.

- [ ] **Step 3: Run the full website unit suite**

Run: `npx nx test website`

Expected: PASS.

- [ ] **Step 4: Lint**

Run: `npx nx lint website`

Expected: no errors. Warnings are pre-existing and not a gate; strip ANSI before grepping if you script this.

- [ ] **Step 5: Run the full e2e suite**

Run: `npx nx e2e website`

Expected: PASS. `blog.spec.ts`, `solutions.spec.ts`, `website.spec.ts`, and `public-copy.spec.ts` all navigate through the header — they are the backstop for anything the unit tests could not see.

- [ ] **Step 6: Build**

Run: `npx nx build website`

Expected: success. If Turbopack panics about the workspace root, remove a stale dev directory first: `rm -rf apps/website/.next`.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/shared/NavDesktop.tsx apps/website/src/styles/chrome.css
git commit -m "chore(website): delete the demo dropdown and mobile tab strip"
```

---

## Verification checklist

Before opening a PR, confirm each of these ran and passed — not that it should pass:

- [ ] `npx nx test website` — full unit suite

  Observed during Task 1: `src/app/docs/docs-structured-data.spec.tsx` timed out at 5000ms in a full-suite run and passed in isolation. It is untouched by this branch, so it is load-related rather than a regression here — but do not wave it away if it recurs. Reproduce it in isolation before calling it a flake, and read the raw failure window rather than the loudest grep hit.
- [ ] `npx nx lint website` — no errors
- [ ] `npx nx e2e website` — full Playwright suite
- [ ] `npx nx build website` — production build
- [ ] Anchor jumps land below the nav on a docs page (no spec covers `scroll-padding-top`)
- [ ] The nav is transparent over the homepage hero and solid after scrolling, checked in a real browser window rather than the in-app Browser pane
- [ ] A section collapsed in the mobile docs drawer is still collapsed in the desktop sidebar

## Known follow-ups, deliberately not in this plan

- Landing-page heroes for `/langgraph`, `/render`, `/chat`, `/ag-ui`, each adding its own route to `HERO_ROUTES` in the same change.
- Any analytics dashboard or saved query filtering on `nav_demo_langgraph` / `nav_demo_ag_ui`. Those ids retire here; the demos are reached as `nav_docs_demo_langgraph` and `nav_docs_demo_ag_ui`.
