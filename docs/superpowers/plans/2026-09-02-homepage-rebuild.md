# Homepage Rebuild Implementation Plan (website)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild the threadplane.ai homepage around the exact category, a live take-over-able hero demo, and an install dialog that leads to a no-backend first success, while keeping the lower sections' components, CSS, and analytics ids.

**Architecture:** Copy and code snippets move into `positioning.ts` as the single source. New client components (`HeroDemo`, `InstallDialog`, `RuntimeParity` toggle, `CodingAgentQuickstart`, Yes Wall expander) sit on the existing `Section`/`Container`/`Button`/`BrowserFrame`/`TabGroup` primitives and the unlayered `landing.css`/`ui.css` conventions. Server components pre-highlight code with `HighlightedCode`. The hero iframe is the `/hero` route from the companion plan `2026-09-02-hero-demo-route.md`.

**Tech Stack:** Next.js App Router (React, server + client components), Vitest + `@testing-library/react` (no jest-dom, raw DOM assertions, `vi.mock` UI primitives), Playwright (`apps/website/e2e`), shiki, PostHog via `track`/`trackCtaClick`.

**Spec:** `docs/superpowers/specs/2026-09-02-homepage-rebuild-design.md`.

**Branch:** `blove/homepage-rebuild-spec` (from `origin/main`) or a branch from it. `npm ci` once per fresh worktree. If `apps/website/.next` exists from a dev run, `rm -rf apps/website/.next` before a production build.

**Test conventions to copy in every new website spec** (from `Hero.spec.tsx`): `// @vitest-environment jsdom` at the top, `import React from 'react'`, `vi.mock('../../lib/analytics/client', () => ({ track: trackMock, trackCtaClick: trackCtaClickMock }))` with `vi.hoisted` mocks, and `vi.mock` for `../ui/Container`, `../ui/Section`, `../ui/Eyebrow`, `../ui/BrowserFrame`, `../ui/Button` exactly as `Hero.spec.tsx` lines 15–37 do. Assertions use `.textContent`, `.getAttribute()`, `toBeTruthy()`.

---

## File map

| Path | Change | Responsibility |
|---|---|---|
| `apps/website/src/lib/positioning.ts` | modify | hero copy, `INSTALL_OPTIONS`, `COMPONENT_SNIPPET`, parity snippets, `CODING_AGENT_PROMPT`, `HOME_TITLE`, `HOME_DESCRIPTION` |
| `apps/website/src/lib/positioning.spec.ts` | create | drift guards: packages exist, snippets parse, license word matches manifest |
| `apps/website/src/lib/site-metadata.ts` + `.spec.ts` | modify | re-export new constants; update assertions |
| `apps/website/src/lib/analytics/events.ts` | modify | new `CtaId` members |
| `docs/gtm/taxonomy.md` | modify | document new ids |
| `apps/website/src/components/ui/Modal.tsx` + `Modal.spec.tsx` | create | focus trap, Esc, scroll lock, backdrop close (extracted from DemoModal) |
| `apps/website/src/components/landing/DemoModal.tsx` | modify | use `Modal` |
| `apps/website/src/components/landing/InstallDialog.tsx` + spec | create | three-step install dialog |
| `apps/website/src/components/landing/HeroDemo.tsx` + spec | create | poster → iframe state machine, bridge, events |
| `apps/website/src/components/landing/Hero.tsx` + spec | rewrite | stacked hero |
| `apps/website/src/components/landing/LogoRibbon.tsx` + spec | rewrite | three labeled compatibility groups |
| `apps/website/src/components/landing/RuntimeParity.tsx`, `RuntimeParityToggle.tsx` + spec | create | parity section (server) + toggle (client) |
| `apps/website/src/components/landing/ThreeSteps.tsx` | create | three-step mechanism (server) |
| `apps/website/src/components/landing/CodingAgentQuickstart.tsx` + spec | create | prompt + links |
| `apps/website/src/components/landing/YesWall.tsx` + spec | modify | 8 shown, expand in place |
| `apps/website/src/components/landing/ScopeTable.tsx` | create | why-Threadplane table |
| `apps/website/src/components/landing/PilotBlock.tsx` | modify | heading, copy, tracked CTA |
| `apps/website/src/components/landing/HomeFAQ.tsx` | modify | twelve intent questions |
| `apps/website/src/lib/section-media.ts` | modify | `persist` and `test` keys |
| `apps/website/src/app/page.tsx` | modify | order + metadata |
| `apps/website/src/styles/landing.css`, `ui.css` | modify | new rules |
| `apps/website/content/docs/chat/getting-started/try-without-a-backend.mdx` | create | no-backend quickstart |
| `apps/website/src/lib/docs-config.ts` | modify | nav entry |
| `apps/website/e2e/website.spec.ts`, `apps/website/e2e/home-hero.spec.ts` | modify/create | e2e |

---

### Task 1: Positioning constants and drift guards

**Files:**
- Modify: `apps/website/src/lib/positioning.ts`
- Create: `apps/website/src/lib/positioning.spec.ts`
- Modify: `apps/website/src/lib/site-metadata.ts`, `apps/website/src/lib/site-metadata.spec.ts`

- [ ] **Step 1: Write the failing drift spec**

```ts
// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import {
  CODING_AGENT_PROMPT,
  COMPONENT_SNIPPET,
  HERO_EYEBROW,
  HERO_H1,
  HERO_SUBHEAD,
  HERO_TRUST_LINE,
  HOME_DESCRIPTION,
  HOME_TITLE,
  INSTALL_OPTIONS,
  PARITY_SNIPPETS,
} from './positioning';
import { resolveWebsiteDir } from './website-dir';

const repoRoot = path.resolve(resolveWebsiteDir(), '..', '..');
const libsDir = path.join(repoRoot, 'libs');

function readPkg(dir: string): { name: string; license?: string; peerDependencies?: Record<string, string> } {
  return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
}

const workspacePkgs = fs
  .readdirSync(libsDir)
  .filter((d) => fs.existsSync(path.join(libsDir, d, 'package.json')))
  .map((d) => readPkg(path.join(libsDir, d)));

function parses(code: string): boolean {
  const sf = ts.createSourceFile('x.ts', code, ts.ScriptTarget.ES2022, true, ts.ScriptKind.TS);
  return (sf as unknown as { parseDiagnostics: unknown[] }).parseDiagnostics.length === 0;
}

describe('positioning: hero copy', () => {
  it('names the exact category in eyebrow, H1, title and description', () => {
    expect(HERO_EYEBROW).toBe('Open-source · Angular · LangGraph & AG-UI');
    expect(HERO_H1).toBe('The AI agent UI framework for Angular.');
    expect(HERO_SUBHEAD).toBe('Chat, threads, approvals, and generative UI on Signals and DI. Your backend stays where it is.');
    expect(HOME_TITLE).toBe('Threadplane — Angular AI Agent UI Framework');
    expect(HOME_DESCRIPTION).toBe(
      'Open-source Angular AI agent UI framework for LangGraph and AG-UI: chat, durable threads, human approvals, and generative UI with Signals and DI.',
    );
    expect(HOME_DESCRIPTION.length).toBeLessThanOrEqual(160);
  });

  it('trust line license word matches the chat package manifest', () => {
    const chat = workspacePkgs.find((p) => p.name === '@threadplane/chat');
    expect(chat?.license).toBe('MIT');
    expect(HERO_TRUST_LINE).toContain(chat!.license!);
    expect(HERO_TRUST_LINE).toBe('MIT · Angular 20–22 · no account, no cloud');
  });
});

describe('positioning: install options', () => {
  it('has fake, langgraph and ag_ui variants in that order', () => {
    expect(INSTALL_OPTIONS.map((o) => o.key)).toEqual(['fake', 'langgraph', 'ag_ui']);
  });

  it('every @threadplane package in every command exists in libs/*', () => {
    const names = new Set(workspacePkgs.map((p) => p.name));
    for (const opt of INSTALL_OPTIONS) {
      const pkgs = opt.command.replace(/^npm install\s+/, '').split(/\s+/);
      for (const pkg of pkgs.filter((p) => p.startsWith('@threadplane/'))) {
        expect(names.has(pkg), `${opt.key}: ${pkg}`).toBe(true);
      }
    }
  });

  it('every non-Threadplane package in a command is a declared peer of a Threadplane package in it', () => {
    for (const opt of INSTALL_OPTIONS) {
      const pkgs = opt.command.replace(/^npm install\s+/, '').split(/\s+/);
      const ours = pkgs.filter((p) => p.startsWith('@threadplane/'));
      const peers = new Set(
        ours.flatMap((n) => Object.keys(workspacePkgs.find((p) => p.name === n)?.peerDependencies ?? {})),
      );
      for (const pkg of pkgs.filter((p) => !p.startsWith('@threadplane/'))) {
        expect(peers.has(pkg), `${opt.key}: ${pkg} is not a peer of ${ours.join(', ')}`).toBe(true);
      }
    }
  });

  it('snippets parse as TypeScript', () => {
    expect(parses(COMPONENT_SNIPPET)).toBe(true);
    for (const opt of INSTALL_OPTIONS) expect(parses(opt.providerSnippet), opt.key).toBe(true);
    for (const s of Object.values(PARITY_SNIPPETS)) expect(parses(s)).toBe(true);
  });

  it('quickstart hrefs point at docs routes', () => {
    for (const opt of INSTALL_OPTIONS) expect(opt.quickstartHref).toMatch(/^\/docs\//);
  });
});

describe('positioning: coding-agent prompt', () => {
  it('references the public agent context and the fake-agent path', () => {
    expect(CODING_AGENT_PROMPT).toContain('https://threadplane.ai/AGENTS.md');
    expect(CODING_AGENT_PROMPT).toContain('provideFakeAgent()');
    expect(CODING_AGENT_PROMPT).not.toMatch(/api[_ -]?key/i);
  });
});
```

`typescript` is a workspace dev dependency (Next and Angular both need it), so the import resolves. `resolveWebsiteDir` already exists (`site-metadata.spec.ts` imports it).

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website -- src/lib/positioning.spec.ts`
Expected: FAIL, named exports missing.

- [ ] **Step 3: Rewrite `positioning.ts`**

Replace the file's contents with:

```ts
// ── Homepage copy (spec 2026-09-02-homepage-rebuild-design.md §4.1) ──────────
export const HERO_EYEBROW = 'Open-source · Angular · LangGraph & AG-UI';
export const HERO_H1 = 'The AI agent UI framework for Angular.';
export const HERO_SUBHEAD =
  'Chat, threads, approvals, and generative UI on Signals and DI. Your backend stays where it is.';
export const HERO_PRIMARY_LABEL = 'Install Threadplane';
export const HERO_SECONDARY_LABEL = 'See it running in the docs →';
export const HERO_SECONDARY_HREF = '/docs/chat/guides/generative-ui?mode=run'; // cockpit.threadplane.ai is retired (cockpit-retirement.spec.ts)

/** Kept for layout.tsx default title and the OG image alt. */
export const PRIMARY_TAGLINE = 'Threadplane — Angular AI Agent UI Framework';
export const HOME_TITLE = PRIMARY_TAGLINE;
export const HOME_DESCRIPTION =
  'Open-source Angular AI agent UI framework for LangGraph and AG-UI: chat, durable threads, human approvals, and generative UI with Signals and DI.';
/** Longer form used by layout.tsx OG/Twitter defaults and the About page. */
export const LONG_SUBHEAD =
  'Threadplane is the open-source Angular AI agent UI framework: signal-native chat, durable threads, human approvals, tool progress, subagents, and generative UI for LangGraph and AG-UI backends — without replacing your backend or design system.';

// ── Trust line (values verified by positioning.spec.ts + angular-support-copy.spec.ts) ──
import { WEBSITE_SUPPORTED_ANGULAR_MAJORS } from '../components/pricing/angular-support.mjs';

export function formatAngularRange(majors: readonly number[]): string {
  const sorted = [...majors].sort((a, b) => a - b);
  return sorted.length > 1 ? `Angular ${sorted[0]}–${sorted[sorted.length - 1]}` : `Angular ${sorted[0]}`;
}
export const HERO_TRUST_LINE = `MIT · ${formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)} · no account, no cloud`;

// ── Install variants: the ONE place install commands live on the website ─────
export type InstallVariant = 'fake' | 'langgraph' | 'ag_ui';

export interface InstallOption {
  readonly key: InstallVariant;
  readonly label: string;
  readonly description: string;
  readonly command: string;
  readonly peersNote: string;
  readonly providerSnippet: string;
  readonly quickstartHref: string;
}

export const COMPONENT_SNIPPET = `import { Component } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

@Component({
  imports: [ChatComponent],
  template: \`<chat [agent]="agent" />\`,
})
export class SupportAgentComponent {
  protected readonly agent = injectAgent();
}`;

export const INSTALL_OPTIONS: readonly InstallOption[] = [
  {
    key: 'fake',
    label: 'Try without a backend',
    description: 'Runs a fake agent in the browser. Swap in a real adapter when the UI works.',
    command: 'npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked',
    peersNote: 'Angular 20–22 · the LangGraph SDK and marked are peers of the adapter',
    providerSnippet: `import { ApplicationConfig } from '@angular/core';
import { provideFakeAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgent({ tokens: ['Hello', ' from', ' Threadplane'] }),
  ],
};`,
    quickstartHref: '/docs/chat/getting-started/try-without-a-backend',
  },
  {
    key: 'langgraph',
    label: 'LangGraph',
    description: 'Connect a LangGraph Platform or langgraph dev server.',
    command: 'npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked',
    peersNote: 'Angular 20–22 · the LangGraph SDK and marked are peers of the adapter',
    providerSnippet: `import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'agent' }),
  ],
};`,
    quickstartHref: '/docs/langgraph/getting-started/quickstart',
  },
  {
    key: 'ag_ui',
    label: 'AG-UI',
    description: 'Connect any AG-UI-compatible endpoint.',
    command: 'npm install @threadplane/chat @threadplane/ag-ui @ag-ui/client @ag-ui/core marked',
    peersNote: 'Angular 20–22 · the AG-UI client and marked are peers of the adapter',
    providerSnippet: `import { ApplicationConfig } from '@angular/core';
import { provideAgent } from '@threadplane/ag-ui';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({ url: 'http://localhost:8000/agent' }),
  ],
};`,
    quickstartHref: '/docs/ag-ui/getting-started/quickstart',
  },
];

/** Runtime-parity section: only the config pane differs. */
export const PARITY_SNIPPETS = {
  langgraph: INSTALL_OPTIONS[1].providerSnippet,
  ag_ui: INSTALL_OPTIONS[2].providerSnippet,
} as const;

// ── Coding-agent quickstart prompt ───────────────────────────────────────────
export const CODING_AGENT_PROMPT = `Add Threadplane to this Angular application.

1. Read https://threadplane.ai/AGENTS.md and the current Threadplane quickstart.
2. Inspect this repository's Angular version, application configuration, design
   system, test runner, and existing agent/backend code.
3. Begin with Threadplane's provideFakeAgent() path so the UI can be verified
   without a server or LLM.
4. Render the smallest accessible <chat> experience using the app's existing
   layout and styles.
5. Add a focused test for the integration.
6. After the fake path passes, explain the exact configuration needed for
   either LangGraph or AG-UI. Do not invent credentials, endpoint URLs, or
   backend capabilities.
7. Run the repository's relevant lint, test, and build commands and report
   every changed file.`;

// ── OG image + keywords (unchanged) ─────────────────────────────────────────
export interface PositioningProofPoint {
  readonly label: string;
  readonly href: string;
}

export const POSITIONING_PROOF_POINTS: readonly PositioningProofPoint[] = [
  { label: 'LangGraph + AG-UI', href: '/docs/choosing-an-adapter' },
  { label: 'Durable threads', href: '/docs/langgraph/guides/persistence' },
  { label: 'Interrupts', href: '/docs/langgraph/guides/interrupts' },
  { label: 'Subagents', href: '/docs/langgraph/guides/subgraphs' },
  { label: 'Planning + memory', href: '/docs/langgraph/guides/memory' },
  { label: 'json-render + A2UI', href: '/docs/render/concepts/json-render-vs-a2ui' },
] as const;
export const SHORT_POSITIONING_DESCRIPTION = HOME_DESCRIPTION;
export const DEFAULT_META_DESCRIPTION = SHORT_POSITIONING_DESCRIPTION;
```

Then:
- Verify the AG-UI `provideAgent` option name (`url`) against `libs/ag-ui/src/lib/provide-agent.ts` and the AG-UI quickstart MDX; use whatever the real config key is.
- Verify the LangGraph install peers against `libs/langgraph/package.json` `peerDependencies` (the spec test enforces it).
- Delete `HERO_CAPABILITIES` and `HeroCapability` (Task 6 removes their only consumer; do the delete in Task 6 if the build complains before then).
- In `site-metadata.ts`, add the new names to the re-export list: `HERO_EYEBROW, HERO_H1, HERO_SUBHEAD, HERO_TRUST_LINE, HOME_TITLE, HOME_DESCRIPTION, INSTALL_OPTIONS, COMPONENT_SNIPPET, PARITY_SNIPPETS, CODING_AGENT_PROMPT`.
- In `site-metadata.spec.ts`, replace the body of `'exports the approved primary tagline and supporting copy'` with:

```ts
    expect(PRIMARY_TAGLINE).toBe('Threadplane — Angular AI Agent UI Framework');
    expect(LONG_SUBHEAD).toContain('open-source Angular AI agent UI framework');
    expect(LONG_SUBHEAD).toContain('LangGraph and AG-UI');
    expect(HERO_SUBHEAD).toBe('Chat, threads, approvals, and generative UI on Signals and DI. Your backend stays where it is.');
    expect(POSITIONING_PROOF_POINTS.map((p) => p.label)).toEqual([ /* unchanged list */ ]);
    expect(POSITIONING_PROOF_POINTS.map((p) => p.href)).toEqual([ /* unchanged list */ ]);
    expect(DEFAULT_META_DESCRIPTION).toBe(SHORT_POSITIONING_DESCRIPTION);
```

and add a test that asserts the real homepage metadata:

```ts
  it('homepage metadata uses the category title and an un-clamped description', () => {
    const metadata = createPageMetadata({ title: HOME_TITLE, description: HOME_DESCRIPTION, pathname: '/', type: 'website' });
    expect(metadata.title).toBe('Threadplane — Angular AI Agent UI Framework');
    expect(metadata.description).toBe(HOME_DESCRIPTION);
  });
```

Importing `angular-support.mjs` from a `.ts` file: `ProofStrip.tsx` already does this, so the path and module settings work. If Vitest complains under `@vitest-environment node`, drop that pragma line (jsdom is the default).

- [ ] **Step 4: Run the specs**

Run: `npx nx test website -- src/lib/positioning.spec.ts src/lib/site-metadata.spec.ts`
Expected: PASS. If the brand-name spelling scan in `site-metadata.spec.ts` fails, the failing string is in your new copy; fix the spelling it demands.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/positioning.ts apps/website/src/lib/positioning.spec.ts apps/website/src/lib/site-metadata.ts apps/website/src/lib/site-metadata.spec.ts
git commit -m "feat(website): single-source homepage copy, install variants and snippets in positioning.ts"
```

---

### Task 2: Analytics ids and taxonomy

**Files:**
- Modify: `apps/website/src/lib/analytics/events.ts:62-98`
- Modify: `docs/gtm/taxonomy.md` (CTA ids section, "Hero" block)

- [ ] **Step 1: Add the ids to the `CtaId` union**

Replace the `// Hero (Spec 2)` block with:

```ts
  // Hero (spec 2026-09-02 homepage rebuild)
  | 'hero_install'
  | 'hero_install_open'
  | 'hero_quickstart'
  | 'hero_live_demo'
  | 'hero_github'
  | 'hero_demo_takeover'
  | 'hero_demo_replay'
  | 'hero_demo_play'
  | 'hero_demo_fallback_open'
  | 'hero_talk_to_engineers'
  // Homepage sections
  | 'home_runtime_parity_toggle'
  | 'home_adapter_guide'
  | 'home_coding_agent_prompt'
  | 'home_coding_agent_link'
  | 'home_production_readiness_expand'
```

Keep the existing `hero_demo_open_workspace`, `hero_demo_open_workspace_caption`, `hero_proof_pill` members for one release so historical dashboards still type-check; add a comment `// retired 2026-09-02, remove after 90 days`.

- [ ] **Step 2: Add an `adapter` property type**

In `AnalyticsProperties` (around line 108), add:

```ts
  /** Install/parity variant. */
  adapter?: 'fake' | 'langgraph' | 'ag_ui';
```

- [ ] **Step 3: Document in taxonomy.md**

Replace the `**Hero**` bullet list with:

```
**Hero**

- `hero_install_open` — primary button opens the install dialog
- `hero_install` — copy in the dialog; property `adapter: fake | langgraph | ag_ui`
- `hero_quickstart` — dialog footer link and final CTA primary; property `adapter`
- `hero_live_demo` — hero text link → docs run surface; final CTA secondary
- `hero_demo_play` — "Play walkthrough" pressed (mobile / reduced motion)
- `hero_demo_takeover` — visitor took control of the hero demo (frame reported `live`)
- `hero_demo_replay` — visitor restarted the walkthrough
- `hero_demo_fallback_open` — poster fallback link → demo.threadplane.ai
- `hero_talk_to_engineers` — enterprise section CTA (moved from the hero 2026-09-02)
- retired 2026-09-02: `hero_demo_open_workspace`, `hero_demo_open_workspace_caption`, `hero_proof_pill`

**Homepage sections**

- `home_runtime_parity_toggle` — property `adapter`
- `home_adapter_guide` — parity CTA → `/docs/choosing-an-adapter`
- `home_coding_agent_prompt` — prompt copied (prompt text is never sent)
- `home_coding_agent_link` — property `cta_text` names which link
- `home_production_readiness_expand` — Yes Wall expanded
- `home_yes_wall_docs` — Yes Wall footer link
```

- [ ] **Step 4: Type-check**

Run: `npx tsc -p apps/website/tsconfig.json --noEmit`
Expected: no errors (or only pre-existing ones; compare with `git stash`-free baseline by running the same command on a clean checkout if unsure).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/analytics/events.ts docs/gtm/taxonomy.md
git commit -m "feat(website): analytics ids for the homepage rebuild"
```

---

### Task 3: Extract a `Modal` primitive from DemoModal

**Files:**
- Create: `apps/website/src/components/ui/Modal.tsx`
- Create: `apps/website/src/components/ui/Modal.spec.tsx`
- Modify: `apps/website/src/components/landing/DemoModal.tsx`
- Modify: `apps/website/src/styles/ui.css`

- [ ] **Step 1: Write the failing spec**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { Modal } from './Modal';

describe('Modal', () => {
  it('renders nothing when closed', () => {
    const { container } = render(<Modal open={false} onClose={() => {}} label="x"><p>hi</p></Modal>);
    expect(container.querySelector('[role="dialog"]')).toBeNull();
  });

  it('renders a labelled modal dialog with its children and focuses the close button', () => {
    render(<Modal open onClose={() => {}} label="Install Threadplane"><p>hi</p></Modal>);
    const dialog = screen.getByRole('dialog', { name: 'Install Threadplane' });
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(screen.getByText('hi')).toBeTruthy();
    expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Close' }));
  });

  it('closes on Escape and on backdrop mousedown, not on frame mousedown', () => {
    const onClose = vi.fn();
    render(<Modal open onClose={onClose} label="x"><p>hi</p></Modal>);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.mouseDown(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
    fireEvent.mouseDown(screen.getByText('hi'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('locks body scroll while open and restores it', () => {
    const { unmount } = render(<Modal open onClose={() => {}} label="x"><p>hi</p></Modal>);
    expect(document.body.style.overflow).toBe('hidden');
    unmount();
    expect(document.body.style.overflow).toBe('');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website -- src/components/ui/Modal.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `Modal.tsx`**

```tsx
'use client';
import { useEffect, useRef, type ReactNode } from 'react';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  /** Accessible name for the dialog. */
  label: string;
  children: ReactNode;
  /** Optional class for the inner frame (size). */
  frameClassName?: string;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, iframe, [tabindex]:not([tabindex="-1"])';

/**
 * Minimal modal: role=dialog, focus trap, Esc, backdrop click, body scroll
 * lock, focus restore. Extracted from DemoModal (2026-09-02).
 */
export function Modal({ open, onClose, label, children, frameClassName }: ModalProps) {
  const frameRef = useRef<HTMLDivElement>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    const prevFocus = document.activeElement as HTMLElement | null;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    closeBtnRef.current?.focus();

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key !== 'Tab') return;
      const f = frameRef.current?.querySelectorAll<HTMLElement>(FOCUSABLE);
      if (!f || f.length === 0) return;
      const first = f[0];
      const last = f[f.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prevOverflow;
      prevFocus?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={label}
      data-ui="modal"
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div ref={frameRef} data-ui="modal-frame" className={frameClassName}>
        <button ref={closeBtnRef} type="button" onClick={onClose} aria-label="Close" data-ui="modal-close">
          &#215;
        </button>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add styles to `ui.css`** (append; keep the file's data-attribute convention)

```css
[data-ui="modal"] {
  position: fixed;
  inset: 0;
  z-index: 1000;
  display: grid;
  place-items: center;
  padding: 24px;
  background: rgba(0, 0, 0, 0.45);
}
[data-ui="modal-frame"] {
  position: relative;
  width: min(100%, 560px);
  max-height: calc(100vh - 48px);
  overflow: auto;
  border-radius: 12px;
  background: var(--color-surface-white, #fff);
  color: var(--color-text, #111);
  box-shadow: 0 24px 64px rgba(0, 0, 0, 0.35);
}
[data-ui="modal-close"] {
  position: absolute;
  top: 10px;
  right: 10px;
  width: 36px;
  height: 36px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  font-size: 22px;
  line-height: 1;
  cursor: pointer;
  color: var(--color-text-muted);
}
[data-ui="modal-close"]:focus-visible {
  outline: 2px solid var(--color-accent);
  outline-offset: 2px;
}
```

Check the variable names against the top of `ui.css` and `landing.css` (`--color-text-muted`, `--color-accent` are used in `landing.css`; use the same surface variable the `.demo-modal__frame` rule uses for its background).

- [ ] **Step 5: Refactor `DemoModal.tsx` onto `Modal`**

Replace its `useEffect`, the outer `<div role="dialog" …>` and the close button with `<Modal open={open} onClose={onClose} label="Live demo" frameClassName="demo-modal__frame">` around the titlebar/body/footer. Remove the now-unused `closeBtnRef` and the `demo-modal__close` button (the `Modal` close button replaces it); keep `demo-modal__titlebar`, tabs, iframe, footer as they are. In `landing.css`, delete the `.demo-modal` backdrop rule (lines around 781–792) since `[data-ui="modal"]` now provides it, and keep `.demo-modal__frame` for sizing. Run `npx nx test website -- src/components/landing/DemoShowcase.spec.tsx` and `npx nx e2e website -- demo-modal.spec.ts` to confirm nothing regressed (the e2e expects `getByRole('dialog', { name: /live demo/i })` and the launch button to be refocused on Escape; both are preserved).

- [ ] **Step 6: Run the specs**

Run: `npx nx test website -- src/components/ui/Modal.spec.tsx src/components/landing/DemoShowcase.spec.tsx`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/ui/Modal.tsx apps/website/src/components/ui/Modal.spec.tsx apps/website/src/components/landing/DemoModal.tsx apps/website/src/styles/ui.css apps/website/src/styles/landing.css
git commit -m "refactor(website): extract Modal primitive from DemoModal"
```

---

### Task 4: InstallDialog

**Files:**
- Create: `apps/website/src/components/landing/InstallDialog.tsx`
- Create: `apps/website/src/components/landing/InstallDialog.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the failing spec**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
import { INSTALL_OPTIONS } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));
vi.mock('../ui/Button', () => ({
  Button: ({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) =>
    href ? <a href={href} onClick={onClick}>{children}</a> : <button onClick={onClick}>{children}</button>,
}));

beforeEach(() => {
  trackCtaClickMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('InstallDialog', () => {
  it('opens on the fake-agent variant and shows its command and snippet', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={() => {}} />);
    const dialog = screen.getByRole('dialog', { name: 'Install Threadplane' });
    const radios = within(dialog).getAllByRole('radio');
    expect(radios.map((r) => r.getAttribute('aria-checked'))).toEqual(['true', 'false', 'false']);
    expect(within(dialog).getByTestId('install-command').textContent).toBe(INSTALL_OPTIONS[0].command);
    expect(within(dialog).getByTestId('install-snippet').textContent).toContain('provideFakeAgent');
    expect(within(dialog).getByRole('link', { name: /Open the full quickstart/ }).getAttribute('href')).toBe(INSTALL_OPTIONS[0].quickstartHref);
  });

  it('switching to AG-UI swaps command, snippet and quickstart link, and tracks the toggle', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'AG-UI' }));
    expect(screen.getByTestId('install-command').textContent).toBe(INSTALL_OPTIONS[2].command);
    expect(screen.getByTestId('install-snippet').textContent).toContain("@threadplane/ag-ui");
    expect(screen.getByRole('link', { name: /Open the full quickstart/ }).getAttribute('href')).toBe(INSTALL_OPTIONS[2].quickstartHref);
  });

  it('arrow keys move the radio selection', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={() => {}} />);
    const first = screen.getByRole('radio', { name: 'Try without a backend' });
    first.focus();
    fireEvent.keyDown(first, { key: 'ArrowRight' });
    expect(screen.getByRole('radio', { name: 'LangGraph' }).getAttribute('aria-checked')).toBe('true');
  });

  it('copy writes the visible command and fires hero_install with the adapter', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('radio', { name: 'LangGraph' }));
    fireEvent.click(screen.getByRole('button', { name: 'Copy install command' }));
    expect(writeTextMock).toHaveBeenCalledWith(INSTALL_OPTIONS[1].command);
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_install', adapter: 'langgraph', surface: 'home', track: 'developer' }));
    expect(await screen.findByText(/Copied/)).toBeTruthy();
  });

  it('quickstart link fires hero_quickstart with the adapter', async () => {
    const { InstallDialog } = await import('./InstallDialog');
    render(<InstallDialog open onClose={() => {}} />);
    fireEvent.click(screen.getByRole('link', { name: /Open the full quickstart/ }));
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_quickstart', adapter: 'fake' }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website -- src/components/landing/InstallDialog.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `InstallDialog.tsx`**

```tsx
'use client';
import { useCallback, useRef, useState, type KeyboardEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import { COMPONENT_SNIPPET, HERO_TRUST_LINE, INSTALL_OPTIONS, type InstallVariant } from '../../lib/positioning';

interface InstallDialogProps {
  open: boolean;
  onClose: () => void;
}

const COPY_FEEDBACK_MS = 1500;

export function InstallDialog({ open, onClose }: InstallDialogProps) {
  const [variant, setVariant] = useState<InstallVariant>('fake');
  const [copied, setCopied] = useState(false);
  const radioRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const option = INSTALL_OPTIONS.find((o) => o.key === variant) ?? INSTALL_OPTIONS[0];

  const onRadioKey = (e: KeyboardEvent<HTMLButtonElement>, index: number) => {
    const delta = e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 0;
    if (!delta) return;
    e.preventDefault();
    const next = (index + delta + INSTALL_OPTIONS.length) % INSTALL_OPTIONS.length;
    setVariant(INSTALL_OPTIONS[next].key);
    radioRefs.current[next]?.focus();
  };

  const copy = useCallback(async () => {
    trackCtaClick({ cta_id: 'hero_install', adapter: option.key, track: 'developer', surface: 'home' });
    try {
      await navigator.clipboard?.writeText(option.command);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Clipboard blocked: the command is visible, the user can select it.
    }
  }, [option]);

  return (
    <Modal open={open} onClose={onClose} label="Install Threadplane" frameClassName="install-dialog">
      <h2 className="install-dialog-title">Install Threadplane</h2>
      <p className="install-dialog-lede">
        Three steps to a running <code className="home-code">&lt;chat&gt;</code> in your Angular app. No account, no key.
      </p>

      <ol className="install-dialog-steps">
        <li className="install-dialog-step">
          <h3 className="install-dialog-step-title">Pick how you want to start</h3>
          <div role="radiogroup" aria-label="Starting point" className="install-dialog-seg">
            {INSTALL_OPTIONS.map((o, i) => (
              <button
                key={o.key}
                ref={(el) => { radioRefs.current[i] = el; }}
                type="button"
                role="radio"
                aria-checked={o.key === variant}
                tabIndex={o.key === variant ? 0 : -1}
                className="install-dialog-seg-btn"
                onClick={() => setVariant(o.key)}
                onKeyDown={(e) => onRadioKey(e, i)}
              >
                {o.label}
              </button>
            ))}
          </div>
          <p className="install-dialog-step-note">{option.description}</p>
        </li>

        <li className="install-dialog-step">
          <h3 className="install-dialog-step-title">Run this in your Angular project</h3>
          <pre className="install-dialog-code"><code data-testid="install-command">{option.command}</code></pre>
          <p className="install-dialog-step-note">{option.peersNote}</p>
        </li>

        <li className="install-dialog-step">
          <h3 className="install-dialog-step-title">Add the provider and the component</h3>
          <pre className="install-dialog-code"><code data-testid="install-snippet">{option.providerSnippet}</code></pre>
          <pre className="install-dialog-code"><code>{COMPONENT_SNIPPET}</code></pre>
        </li>
      </ol>

      <div className="install-dialog-footer">
        <Button
          variant="ghost"
          size="md"
          href={option.quickstartHref}
          onClick={() => trackCtaClick({ cta_id: 'hero_quickstart', adapter: option.key, track: 'developer', surface: 'home' })}
        >
          Open the full quickstart →
        </Button>
        <Button variant="primary" size="md" onClick={copy}>
          {copied ? 'Copied ✓' : 'Copy install command'}
        </Button>
      </div>
      <p className="install-dialog-trust">{HERO_TRUST_LINE}</p>
    </Modal>
  );
}
```

- [ ] **Step 4: Add `landing.css` rules** (append, flat kebab like the rest of the file)

```css
.install-dialog { padding: 28px 28px 20px; }
.install-dialog-title { margin: 0 32px 4px 0; font-size: 22px; line-height: 1.2; }
.install-dialog-lede { margin: 0 0 16px; color: var(--color-text-muted); font-size: 14px; }
.install-dialog-steps { list-style: none; margin: 0; padding: 0; counter-reset: step; }
.install-dialog-step { position: relative; padding-left: 34px; margin-bottom: 18px; counter-increment: step; }
.install-dialog-step::before {
  content: counter(step); position: absolute; left: 0; top: 0; width: 22px; height: 22px; border-radius: 50%;
  background: var(--color-text); color: var(--color-surface-white, #fff); font-size: 12px; font-weight: 700;
  display: grid; place-items: center;
}
.install-dialog-step-title { margin: 0 0 8px; font-size: 15px; line-height: 22px; }
.install-dialog-step-note { margin: 6px 0 0; font-size: 12.5px; color: var(--color-text-muted); }
.install-dialog-seg { display: inline-flex; flex-wrap: wrap; border: 1px solid var(--color-border); border-radius: 8px; overflow: hidden; }
.install-dialog-seg-btn { padding: 7px 12px; border: 0; background: transparent; font: inherit; font-size: 13px; cursor: pointer; }
.install-dialog-seg-btn[aria-checked="true"] { background: var(--color-text); color: var(--color-surface-white, #fff); }
.install-dialog-seg-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.install-dialog-code {
  margin: 0 0 8px; padding: 10px 12px; border-radius: 8px; overflow-x: auto;
  background: #1c1c1e; color: #e8e8e8; font-family: var(--font-mono, ui-monospace, Menlo, monospace); font-size: 12.5px; line-height: 1.5;
}
.install-dialog-footer { display: flex; justify-content: space-between; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 8px; }
.install-dialog-trust { margin: 12px 0 0; font-size: 12px; color: var(--color-text-muted); }
```

Use the border and mono-font variables that `landing.css` already uses (grep `--color-border` and `--font-` at the top of the file) and adjust the names.

- [ ] **Step 5: Run the spec**

Run: `npx nx test website -- src/components/landing/InstallDialog.spec.tsx`
Expected: PASS (5 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/InstallDialog.tsx apps/website/src/components/landing/InstallDialog.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): InstallDialog with fake/LangGraph/AG-UI variants"
```

---

### Task 5: HeroDemo (poster → iframe state machine)

**Files:**
- Create: `apps/website/src/components/landing/HeroDemo.tsx`
- Create: `apps/website/src/components/landing/HeroDemo.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the failing spec**

```tsx
// @vitest-environment jsdom
import React, { act } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));
vi.mock('../ui/BrowserFrame', () => ({
  BrowserFrame: ({ children }: { children: React.ReactNode }) => <div data-frame>{children}</div>,
}));

type IOCallback = (entries: { isIntersecting: boolean }[]) => void;
let ioCallback: IOCallback | null = null;

function installEnv({ width = 1280, reduced = false }: { width?: number; reduced?: boolean } = {}) {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  window.matchMedia = vi.fn().mockImplementation((q: string) => ({
    matches: q.includes('reduce') ? reduced : false,
    addEventListener: vi.fn(), removeEventListener: vi.fn(), media: q, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  class IO {
    constructor(cb: IOCallback) { ioCallback = cb; }
    observe() {} unobserve() {} disconnect() {}
  }
  (window as unknown as { IntersectionObserver: unknown }).IntersectionObserver = IO;
}

function frameReady(origin = 'https://demo.threadplane.ai') {
  fireEvent(window, new MessageEvent('message', { origin, data: { type: 'tplane-hero', state: 'ready' } }));
}

beforeEach(() => { vi.useFakeTimers(); ioCallback = null; trackCtaClickMock.mockClear(); });
afterEach(() => { vi.useRealTimers(); });

describe('HeroDemo', () => {
  it('server-renders the poster eagerly with explicit dimensions and no iframe', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    const img = container.querySelector('img') as HTMLImageElement;
    expect(img.getAttribute('src')).toBe('/screenshots/hero-walkthrough-poster.webp');
    expect(img.getAttribute('width')).toBe('1200');
    expect(img.getAttribute('height')).toBe('720');
    expect(img.getAttribute('loading')).toBe('eager');
    expect(img.getAttribute('fetchpriority')).toBe('high');
    expect(container.querySelector('iframe')).toBeNull();
  });

  it('mounts the iframe when visible on desktop and reveals it on ready from the demo origin', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => { ioCallback?.([{ isIntersecting: true }]); });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    expect(iframe.getAttribute('src')).toBe('https://demo.threadplane.ai/hero');
    expect(iframe.getAttribute('title')).toBe('Threadplane live demo');
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('mounting');
    act(() => { frameReady(); });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('ready');
  });

  it('ignores ready from a foreign origin and falls back after the timeout', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => { ioCallback?.([{ isIntersecting: true }]); });
    act(() => { frameReady('https://evil.example'); });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('mounting');
    act(() => { vi.advanceTimersByTime(8000); });
    expect(container.querySelector('[data-hero-demo]')?.getAttribute('data-state')).toBe('fallback');
    expect(screen.getByRole('link', { name: /Open the live demo/ }).getAttribute('href')).toBe('https://demo.threadplane.ai');
  });

  it('shows Play walkthrough instead of mounting on narrow viewports, and mounts on click', async () => {
    installEnv({ width: 390 });
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => { ioCallback?.([{ isIntersecting: true }]); });
    expect(container.querySelector('iframe')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Play walkthrough' }));
    expect(container.querySelector('iframe')).toBeTruthy();
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_demo_play' }));
  });

  it('shows Play walkthrough under reduced motion', async () => {
    installEnv({ reduced: true });
    const { HeroDemo } = await import('./HeroDemo');
    render(<HeroDemo />);
    act(() => { ioCallback?.([{ isIntersecting: true }]); });
    expect(screen.getByRole('button', { name: 'Play walkthrough' })).toBeTruthy();
  });

  it('tracks takeover and replay once per frame state message', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    render(<HeroDemo />);
    act(() => { ioCallback?.([{ isIntersecting: true }]); });
    act(() => { frameReady(); });
    act(() => { fireEvent(window, new MessageEvent('message', { origin: 'https://demo.threadplane.ai', data: { type: 'tplane-hero', state: 'live' } })); });
    act(() => { fireEvent(window, new MessageEvent('message', { origin: 'https://demo.threadplane.ai', data: { type: 'tplane-hero', state: 'replay' } })); });
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_demo_takeover' }));
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_demo_replay' }));
  });

  it('forwards visibility to the frame with the demo origin', async () => {
    installEnv();
    const { HeroDemo } = await import('./HeroDemo');
    const { container } = render(<HeroDemo />);
    act(() => { ioCallback?.([{ isIntersecting: true }]); });
    const iframe = container.querySelector('iframe') as HTMLIFrameElement;
    const post = vi.fn();
    Object.defineProperty(iframe, 'contentWindow', { value: { postMessage: post }, configurable: true });
    act(() => { frameReady(); });
    act(() => { ioCallback?.([{ isIntersecting: false }]); });
    expect(post).toHaveBeenCalledWith({ type: 'tplane-hero', visible: false }, 'https://demo.threadplane.ai');
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website -- src/components/landing/HeroDemo.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Write `HeroDemo.tsx`**

```tsx
'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { BrowserFrame } from '../ui/BrowserFrame';
import { trackCtaClick } from '../../lib/analytics/client';

export const HERO_DEMO_ORIGIN = 'https://demo.threadplane.ai';
export const HERO_DEMO_URL = `${HERO_DEMO_ORIGIN}/hero`;
export const HERO_POSTER = '/screenshots/hero-walkthrough-poster.webp';
const POSTER_W = 1200;
const POSTER_H = 720;
const READY_TIMEOUT_MS = 8000;
const MIN_AUTOPLAY_WIDTH = 768;
const MESSAGE_TYPE = 'tplane-hero';

type State = 'poster' | 'playRequested' | 'mounting' | 'ready' | 'fallback';

function autoplayAllowed(): boolean {
  if (typeof window === 'undefined') return false;
  if (window.innerWidth < MIN_AUTOPLAY_WIDTH) return false;
  return !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Hero demo: server-rendered poster (the LCP), iframe mounted after hydration
 * when the hero is visible on a wide, motion-tolerant viewport, crossfaded in
 * when the frame reports ready. See spec §4.2.
 */
export function HeroDemo() {
  const [state, setState] = useState<State>('poster');
  const [visible, setVisible] = useState(false);
  const [needsClick, setNeedsClick] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const lastFrameState = useRef<string | null>(null);

  // Visibility.
  useEffect(() => {
    const el = rootRef.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const io = new IntersectionObserver((entries) => setVisible(entries.some((e) => e.isIntersecting)), { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  // Decide whether to mount.
  useEffect(() => {
    if (!visible) return;
    if (state !== 'poster' && state !== 'playRequested') return;
    if (state === 'playRequested' || autoplayAllowed()) setState('mounting');
    else setNeedsClick(true);
  }, [visible, state]);

  // Ready timeout → fallback.
  useEffect(() => {
    if (state !== 'mounting') return;
    const t = setTimeout(() => setState((s) => (s === 'mounting' ? 'fallback' : s)), READY_TIMEOUT_MS);
    return () => clearTimeout(t);
  }, [state]);

  // Frame → website messages.
  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin !== HERO_DEMO_ORIGIN) return;
      const d = e.data as { type?: string; state?: string } | null;
      if (!d || d.type !== MESSAGE_TYPE || typeof d.state !== 'string') return;
      if (d.state === 'ready') setState((s) => (s === 'mounting' ? 'ready' : s));
      if (d.state === lastFrameState.current) return;
      lastFrameState.current = d.state;
      if (d.state === 'live') trackCtaClick({ cta_id: 'hero_demo_takeover', track: 'developer', surface: 'home' });
      if (d.state === 'replay') trackCtaClick({ cta_id: 'hero_demo_replay', track: 'developer', surface: 'home' });
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, []);

  // Website → frame visibility. Posted while mounting too (on the iframe's
  // load event) so a frame whose referrer was stripped can learn our origin
  // from this message and replay its `ready` state to us.
  useEffect(() => {
    if (state !== 'mounting' && state !== 'ready') return;
    iframeRef.current?.contentWindow?.postMessage({ type: MESSAGE_TYPE, visible }, HERO_DEMO_ORIGIN);
  }, [visible, state]);

  const play = useCallback(() => {
    trackCtaClick({ cta_id: 'hero_demo_play', track: 'developer', surface: 'home' });
    setNeedsClick(false);
    setState('playRequested');
  }, []);

  const mounted = state === 'mounting' || state === 'ready';

  return (
    <div ref={rootRef} className="hero-demo" data-hero-demo data-state={state}>
      <BrowserFrame url="demo.threadplane.ai/hero" elevation="lg" className="hero-demo-frame">
        <div className="hero-demo-stage" style={undefined}>
          <img
            src={HERO_POSTER}
            width={POSTER_W}
            height={POSTER_H}
            alt="Threadplane chat replaying a recorded LangGraph run: a user prompt, a request_approval tool call, and the streamed three-step cleanup plan"
            className="hero-demo-poster"
            loading="eager"
            decoding="async"
            // React lowercases this attribute; the spec asserts the DOM value.
            fetchPriority="high"
          />
          {mounted ? (
            <iframe
              ref={iframeRef}
              src={HERO_DEMO_URL}
              title="Threadplane live demo"
              className="hero-demo-iframe"
              allow="clipboard-write"
              onLoad={() => iframeRef.current?.contentWindow?.postMessage({ type: MESSAGE_TYPE, visible: true }, HERO_DEMO_ORIGIN)}
            />
          ) : null}
          {needsClick && !mounted ? (
            <button type="button" className="hero-demo-play" onClick={play}>
              Play walkthrough
            </button>
          ) : null}
          {state === 'fallback' ? (
            <a
              className="hero-demo-fallback"
              href={HERO_DEMO_ORIGIN}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCtaClick({ cta_id: 'hero_demo_fallback_open', track: 'developer', surface: 'home' })}
            >
              Open the live demo →
            </a>
          ) : null}
        </div>
      </BrowserFrame>
    </div>
  );
}
```

The repo is on React 19, which renders `fetchPriority` as the lowercase `fetchpriority` attribute the spec asserts. Remove the stray `style={undefined}`; it is there only to remind you not to add inline styles.

- [ ] **Step 4: Add `landing.css` rules** (append; replace the old `.hero-demo-*` rules for link/img/caption which Task 6 deletes)

```css
.hero-demo { width: 100%; max-width: 1200px; margin: 40px auto 0; }
.hero-demo-frame { width: 100%; }
.hero-demo-stage { position: relative; aspect-ratio: 1200 / 720; background: #0f1116; }
.hero-demo-poster { display: block; width: 100%; height: 100%; object-fit: cover; }
.hero-demo-iframe {
  position: absolute; inset: 0; width: 100%; height: 100%; border: 0;
  opacity: 0; transition: opacity 300ms ease;
}
.hero-demo[data-state="ready"] .hero-demo-iframe { opacity: 1; }
.hero-demo[data-state="ready"] .hero-demo-poster { visibility: hidden; }
.hero-demo-play, .hero-demo-fallback {
  position: absolute; left: 50%; bottom: 20px; transform: translateX(-50%);
  padding: 10px 16px; border-radius: 999px; border: 0; background: #111; color: #fff;
  font-family: var(--font-inter); font-size: 14px; font-weight: 600; text-decoration: none; cursor: pointer;
  box-shadow: 0 6px 18px rgba(0,0,0,.25);
}
.hero-demo-play:focus-visible, .hero-demo-fallback:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
@media (prefers-reduced-motion: reduce) {
  .hero-demo-iframe { transition: none; }
}
```

- [ ] **Step 5: Run the spec**

Run: `npx nx test website -- src/components/landing/HeroDemo.spec.tsx`
Expected: PASS (7 tests).

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/HeroDemo.tsx apps/website/src/components/landing/HeroDemo.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): HeroDemo poster-to-iframe state machine with demo-origin bridge"
```

---

### Task 6: Rewrite Hero

**Files:**
- Modify: `apps/website/src/components/landing/Hero.tsx`
- Modify: `apps/website/src/components/landing/Hero.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`
- Modify: `apps/website/src/lib/positioning.ts` (remove `HERO_CAPABILITIES`)

- [ ] **Step 1: Rewrite the spec**

Replace `Hero.spec.tsx`'s tests (keep its mock preamble, adding `trackCtaClick` to the analytics mock and a mock for `./HeroDemo` and `./InstallDialog`):

```tsx
vi.mock('./HeroDemo', () => ({ HeroDemo: () => <div data-testid="hero-demo" /> }));
vi.mock('./InstallDialog', () => ({
  InstallDialog: ({ open }: { open: boolean }) => (open ? <div role="dialog" aria-label="Install Threadplane" /> : null),
}));

describe('Hero', () => {
  it('renders the category eyebrow, H1, subhead and trust line from positioning', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent).toBe(HERO_H1);
    expect(screen.getByText(HERO_EYEBROW)).toBeTruthy();
    expect(document.querySelector('.hero-subhead')?.textContent).toBe(HERO_SUBHEAD);
    expect(document.querySelector('.hero-trust')?.textContent).toBe(HERO_TRUST_LINE);
    expect(document.querySelector('.hero-chip-row')).toBeNull();
    expect(screen.queryByText(/six months/)).toBeNull();
    expect(screen.queryByRole('link', { name: /Talk to our engineers/ })).toBeNull();
  });

  it('primary button opens the install dialog and fires hero_install_open', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    fireEvent.click(screen.getByRole('button', { name: 'Install Threadplane' }));
    expect(screen.getByRole('dialog', { name: 'Install Threadplane' })).toBeTruthy();
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_install_open', track: 'developer', surface: 'home' }));
  });

  it('secondary link goes to the docs run surface and fires hero_live_demo', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    const link = screen.getByRole('link', { name: /See it running in the docs/ });
    expect(link.getAttribute('href')).toBe(HERO_SECONDARY_HREF);
    fireEvent.click(link);
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'hero_live_demo' }));
  });

  it('mounts the demo below the copy', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    expect(screen.getByTestId('hero-demo')).toBeTruthy();
  });
});
```

Import `HERO_EYEBROW, HERO_H1, HERO_SUBHEAD, HERO_TRUST_LINE` from `../../lib/positioning` at the top; drop `HERO_CAPABILITIES`.

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website -- src/components/landing/Hero.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `Hero.tsx`**

```tsx
'use client';

import React, { useCallback, useState } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import {
  HERO_EYEBROW,
  HERO_H1,
  HERO_PRIMARY_LABEL,
  HERO_SECONDARY_HREF,
  HERO_SECONDARY_LABEL,
  HERO_SUBHEAD,
  HERO_TRUST_LINE,
} from '../../lib/positioning';
import { HeroDemo } from './HeroDemo';
import { InstallDialog } from './InstallDialog';

export function Hero() {
  const [installOpen, setInstallOpen] = useState(false);
  const openInstall = useCallback(() => {
    trackCtaClick({ cta_id: 'hero_install_open', track: 'developer', surface: 'home' });
    setInstallOpen(true);
  }, []);
  const closeInstall = useCallback(() => setInstallOpen(false), []);

  return (
    <Section surface="canvas" ariaLabelledBy="hero-heading">
      <Container>
        <div className="hero-stack">
          <Eyebrow tone="accent" className="hero-eyebrow">{HERO_EYEBROW}</Eyebrow>
          <h1 id="hero-heading" className="hero-heading">{HERO_H1}</h1>
          <p className="hero-subhead">{HERO_SUBHEAD}</p>
          <div className="hero-cta-row">
            <Button variant="primary" size="lg" onClick={openInstall}>{HERO_PRIMARY_LABEL}</Button>
            <a
              className="hero-text-link"
              href={HERO_SECONDARY_HREF}
              target="_blank"
              rel="noopener noreferrer"
              onClick={() => trackCtaClick({ cta_id: 'hero_live_demo', track: 'developer', surface: 'home', destination_url: HERO_SECONDARY_HREF })}
            >
              {HERO_SECONDARY_LABEL}
            </a>
          </div>
          <HeroDemo />
          <p className="hero-trust">{HERO_TRUST_LINE}</p>
        </div>
      </Container>
      <InstallDialog open={installOpen} onClose={closeInstall} />
    </Section>
  );
}
```

- [ ] **Step 4: CSS**

In `landing.css`: delete `.hero-grid`, `.hero-chip-row`, `.hero-chip`, `.hero-caption`, `.hero-demo-link`, `.hero-demo-img`, `.hero-demo-caption`, `.hero-demo-caption-link` (and their responsive variants; grep each name). Keep `.hero-eyebrow`, `.hero-heading`, `.hero-subhead`, `.hero-cta-row`, `.hero-demo-frame`. Add:

```css
.hero-stack { display: flex; flex-direction: column; align-items: center; text-align: center; }
.hero-stack .hero-subhead { max-width: 40em; }
.hero-stack .hero-cta-row { justify-content: center; }
.hero-text-link {
  color: var(--color-accent); font-weight: 600; text-decoration: none;
  display: inline-block; padding: 8px 4px; margin: -8px -4px;
}
.hero-text-link:hover, .hero-text-link:focus-visible { text-decoration: underline; }
.hero-trust { margin: 12px 0 0; font-family: var(--font-inter); font-size: 13px; color: var(--color-text-muted); }
```

Then run the style contract spec: `npx nx test website -- src/styles/style-contracts.spec.ts` and update any contract that referenced a deleted hero selector.

- [ ] **Step 5: Remove `HERO_CAPABILITIES`** from `positioning.ts` (and `HeroCapability`), then `npx tsc -p apps/website/tsconfig.json --noEmit`.

- [ ] **Step 6: Run the specs**

Run: `npx nx test website -- src/components/landing/Hero.spec.tsx src/styles/style-contracts.spec.ts src/lib/site-metadata.spec.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add -A apps/website/src/components/landing/Hero.tsx apps/website/src/components/landing/Hero.spec.tsx apps/website/src/styles/landing.css apps/website/src/lib/positioning.ts apps/website/src/styles
git commit -m "feat(website): stacked category hero with install dialog and live demo"
```

---

### Task 7: Compatibility boundary (LogoRibbon rewrite)

**Files:**
- Modify: `apps/website/src/components/landing/LogoRibbon.tsx`
- Modify: `apps/website/src/components/landing/LogoRibbon.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Rewrite the spec**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { LogoRibbon, COMPAT_GROUPS } from './LogoRibbon';

describe('LogoRibbon (compatibility boundary)', () => {
  it('renders three labelled groups in order', () => {
    render(<LogoRibbon />);
    expect(COMPAT_GROUPS.map((g) => g.label)).toEqual([
      'Direct Threadplane adapters',
      'Backends reachable through AG-UI',
      'Model providers, behind your backend',
    ]);
    for (const group of COMPAT_GROUPS) {
      expect(screen.getByText(group.label)).toBeTruthy();
      for (const item of group.items) expect(screen.getByText(item.name)).toBeTruthy();
    }
  });

  it('direct adapters are exactly LangGraph and AG-UI', () => {
    expect(COMPAT_GROUPS[0].items.map((i) => i.name)).toEqual(['LangGraph', 'AG-UI']);
  });

  it('is a labelled landmark, logos hidden from assistive tech, no customer wording', () => {
    const { container } = render(<LogoRibbon />);
    expect(container.querySelector('section')?.getAttribute('aria-label')).toBe('Keep your agent stack. Standardize the Angular surface.');
    for (const img of Array.from(container.querySelectorAll('img'))) {
      expect(img.getAttribute('aria-hidden')).toBe('true');
      expect(img.getAttribute('alt')).toBe('');
    }
    expect(container.textContent).not.toMatch(/trusted by|customers/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx nx test website -- src/components/landing/LogoRibbon.spec.tsx`
Expected: FAIL.

- [ ] **Step 3: Rewrite `LogoRibbon.tsx`**

```tsx
import { Container } from '../ui/Container';

interface CompatItem { name: string; logoSrc?: string }
interface CompatGroup { label: string; note: string; items: readonly CompatItem[] }

/**
 * Compatibility boundary (spec §5). Three rows so a provider logo is never
 * read as a direct adapter. The AG-UI row lists only runtimes that have a
 * docs runtime section on main (docs-config.ts) — re-verify when editing.
 */
export const COMPAT_GROUPS: readonly CompatGroup[] = [
  {
    label: 'Direct Threadplane adapters',
    note: '@threadplane/langgraph · @threadplane/ag-ui',
    items: [
      { name: 'LangGraph', logoSrc: '/logos/langgraph.svg' },
      { name: 'AG-UI', logoSrc: '/logos/ag-ui.svg' },
    ],
  },
  {
    label: 'Backends reachable through AG-UI',
    note: 'any AG-UI-compatible endpoint',
    items: [
      { name: 'Mastra', logoSrc: '/logos/runtimes/mastra.svg' },
      { name: 'Microsoft Agent Framework', logoSrc: '/logos/runtimes/microsoft.svg' },
      { name: 'AWS Strands' },
      { name: 'Pydantic AI', logoSrc: '/logos/runtimes/pydantic.svg' },
      { name: 'CrewAI', logoSrc: '/logos/runtimes/crewai.svg' },
    ],
  },
  {
    label: 'Model providers, behind your backend',
    note: 'model choice stays in the backend you operate',
    items: [
      { name: 'OpenAI', logoSrc: '/logos/providers/openai.svg' },
      { name: 'Anthropic', logoSrc: '/logos/providers/anthropic.svg' },
      { name: 'Gemini', logoSrc: '/logos/providers/google.svg' },
      { name: 'Bedrock', logoSrc: '/logos/providers/bedrock.svg' },
      { name: 'Azure OpenAI', logoSrc: '/logos/providers/azure.svg' },
    ],
  },
];

export function LogoRibbon() {
  return (
    <section aria-label="Keep your agent stack. Standardize the Angular surface." className="logo-ribbon">
      <Container>
        <p className="logo-ribbon-heading">Keep your agent stack. Standardize the Angular surface.</p>
        <p className="logo-ribbon-lede">
          Threadplane adapts LangGraph and AG-UI into one signal-shaped Agent contract. Your model provider stays behind the backend you already operate.
        </p>
        <div className="logo-ribbon-groups">
          {COMPAT_GROUPS.map((group) => (
            <div className="logo-ribbon-group" key={group.label}>
              <div className="logo-ribbon-group-head">
                <span className="logo-ribbon-label">{group.label}</span>
                <span className="logo-ribbon-note">{group.note}</span>
              </div>
              <div className="logo-ribbon-line">
                {group.items.map((item) => (
                  <span className="logo-ribbon-item" key={item.name}>
                    {item.logoSrc ? (
                      <img src={item.logoSrc} alt="" aria-hidden="true" loading="lazy" decoding="async" className="logo-ribbon-logo" />
                    ) : null}
                    <span className="logo-ribbon-name">{item.name}</span>
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Container>
    </section>
  );
}
```

Before committing, confirm the AG-UI list against `apps/website/src/lib/docs-config.ts` runtime sections (AWS Strands, Microsoft Agent Framework, Mastra are there) and `HomeFAQ`'s adapter answer (CrewAI, Pydantic AI, AG2). Drop any name with neither a docs section nor a cockpit/example on main. Delete `RIBBON_ITEMS` and `RIBBON_MORE_COUNT` and grep for other importers (`git grep RIBBON_`).

- [ ] **Step 4: CSS**

Add to `landing.css` next to the existing `.logo-ribbon-*` rules:

```css
.logo-ribbon-heading { margin: 0 0 4px; font-size: 18px; font-weight: 600; }
.logo-ribbon-lede { margin: 0 0 20px; max-width: 60em; color: var(--color-text-muted); font-size: 14px; }
.logo-ribbon-groups { display: grid; gap: 14px; }
.logo-ribbon-group { display: grid; grid-template-columns: minmax(0, 260px) minmax(0, 1fr); gap: 12px 24px; align-items: center; }
.logo-ribbon-group-head { display: flex; flex-direction: column; gap: 2px; }
.logo-ribbon-note { font-size: 12px; color: var(--color-text-muted); }
@media (max-width: 767px) { .logo-ribbon-group { grid-template-columns: 1fr; } }
```

Keep `.logo-ribbon-line`, `.logo-ribbon-item`, `.logo-ribbon-logo`, `.logo-ribbon-name`, `.logo-ribbon-label`; delete `.logo-ribbon-more`.

- [ ] **Step 5: Run the spec, commit**

Run: `npx nx test website -- src/components/landing/LogoRibbon.spec.tsx`
Expected: PASS.

```bash
git add apps/website/src/components/landing/LogoRibbon.tsx apps/website/src/components/landing/LogoRibbon.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): compatibility boundary with labelled adapter, AG-UI and provider rows"
```

---

### Task 8: Runtime parity section

**Files:**
- Create: `apps/website/src/components/landing/RuntimeParityToggle.tsx` (client)
- Create: `apps/website/src/components/landing/RuntimeParityToggle.spec.tsx`
- Create: `apps/website/src/components/landing/RuntimeParity.tsx` (server)
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the failing toggle spec**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));

beforeEach(() => trackCtaClickMock.mockClear());

describe('RuntimeParityToggle', () => {
  it('shows the LangGraph config pane by default and the pinned component pane', async () => {
    const { RuntimeParityToggle } = await import('./RuntimeParityToggle');
    render(
      <RuntimeParityToggle
        configPanes={{ langgraph: <pre>LG CONFIG</pre>, ag_ui: <pre>AGUI CONFIG</pre> }}
        componentPane={<pre>COMPONENT</pre>}
      />,
    );
    expect(screen.getByText('LG CONFIG')).toBeTruthy();
    expect(screen.queryByText('AGUI CONFIG')).toBeNull();
    expect(screen.getByText('COMPONENT')).toBeTruthy();
    expect(screen.getByText('same in both')).toBeTruthy();
  });

  it('switches to AG-UI and tracks the toggle with adapter', async () => {
    const { RuntimeParityToggle } = await import('./RuntimeParityToggle');
    render(
      <RuntimeParityToggle
        configPanes={{ langgraph: <pre>LG CONFIG</pre>, ag_ui: <pre>AGUI CONFIG</pre> }}
        componentPane={<pre>COMPONENT</pre>}
      />,
    );
    fireEvent.click(screen.getByRole('radio', { name: 'AG-UI' }));
    expect(screen.getByText('AGUI CONFIG')).toBeTruthy();
    expect(screen.queryByText('LG CONFIG')).toBeNull();
    expect(screen.getByText('COMPONENT')).toBeTruthy();
    expect(trackCtaClickMock).toHaveBeenCalledWith(expect.objectContaining({ cta_id: 'home_runtime_parity_toggle', adapter: 'ag_ui' }));
  });
});
```

- [ ] **Step 2: Run to verify it fails**, then **write the toggle**

```tsx
'use client';
import { useState, type KeyboardEvent, type ReactNode } from 'react';
import { trackCtaClick } from '../../lib/analytics/client';

type Adapter = 'langgraph' | 'ag_ui';
const ADAPTERS: { key: Adapter; label: string }[] = [
  { key: 'langgraph', label: 'LangGraph' },
  { key: 'ag_ui', label: 'AG-UI' },
];

interface Props {
  configPanes: Record<Adapter, ReactNode>;
  componentPane: ReactNode;
}

export function RuntimeParityToggle({ configPanes, componentPane }: Props) {
  const [adapter, setAdapter] = useState<Adapter>('langgraph');
  const select = (key: Adapter) => {
    if (key === adapter) return;
    setAdapter(key);
    trackCtaClick({ cta_id: 'home_runtime_parity_toggle', adapter: key, track: 'developer', surface: 'home' });
  };
  const onKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return;
    e.preventDefault();
    select(adapter === 'langgraph' ? 'ag_ui' : 'langgraph');
  };

  return (
    <div className="parity">
      <div role="radiogroup" aria-label="Runtime adapter" className="parity-toggle">
        {ADAPTERS.map((a) => (
          <button
            key={a.key}
            type="button"
            role="radio"
            aria-checked={a.key === adapter}
            tabIndex={a.key === adapter ? 0 : -1}
            className="parity-toggle-btn"
            onClick={() => select(a.key)}
            onKeyDown={onKey}
          >
            {a.label}
          </button>
        ))}
      </div>
      <div className="parity-panes">
        <div className="parity-pane">
          <p className="parity-pane-label">What changes <span className="parity-pane-file">app.config.ts</span></p>
          {ADAPTERS.map((a) => (
            <div key={a.key} hidden={a.key !== adapter}>{configPanes[a.key]}</div>
          ))}
        </div>
        <div className="parity-pane" data-pinned>
          <p className="parity-pane-label">What does not <span className="parity-pane-badge">same in both</span></p>
          {componentPane}
        </div>
      </div>
    </div>
  );
}
```

Both config panes are rendered and toggled with `hidden`, so the server-highlighted HTML is present at first paint and there is no layout shift. The spec's `queryByText('AGUI CONFIG')` must return null for a hidden pane: `@testing-library` does not exclude `hidden` elements from `getByText` by default, so in the toggle render the inactive pane with `{a.key === adapter ? configPanes[a.key] : null}` instead of `hidden` if the spec fails, and note that both panes are still server-rendered as strings via `HighlightedCode` in the parent (only the inactive one is not mounted).

- [ ] **Step 3: Write the server section**

```tsx
import Link from 'next/link';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { HighlightedCode } from './HighlightedCode';
import { RuntimeParityToggle } from './RuntimeParityToggle';
import { COMPONENT_SNIPPET, PARITY_SNIPPETS } from '../../lib/positioning';

export async function RuntimeParity() {
  const [lg, ag, comp] = await Promise.all([
    HighlightedCode({ code: PARITY_SNIPPETS.langgraph }),
    HighlightedCode({ code: PARITY_SNIPPETS.ag_ui }),
    HighlightedCode({ code: COMPONENT_SNIPPET }),
  ]);
  return (
    <Section surface="white" id="parity" ariaLabelledBy="parity-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="Runtime parity"
          heading="One Angular UI. Two runtime adapters. The same contract."
          headingId="parity-heading"
          aside="@threadplane/chat consumes Agent, not LangGraphAgent or an AG-UI client. Swap the adapter without rewriting the Angular component tree."
        />
        <RuntimeParityToggle configPanes={{ langgraph: lg, ag_ui: ag }} componentPane={comp} />
        <p className="parity-qualifier">
          Not every backend emits every capability. Interrupts, subagents and checkpoints depend on what the runtime sends.{' '}
          <Link href="/docs/choosing-an-adapter" className="parity-cta" data-cta="home_adapter_guide">Choose an adapter →</Link>
        </p>
      </Container>
    </Section>
  );
}
```

`HighlightedCode` is an async server component; calling it as a function returns its JSX, which is how `build-panes.tsx` cannot do it from a client component but a server component can. If Next rejects calling an async component directly, render `<HighlightedCode code={…} />` inline as the pane props instead (server components can pass server-rendered elements to client components as props). The `home_adapter_guide` click is tracked in Task 13 by a tiny client wrapper if needed; a `data-cta` attribute is enough for the e2e.

- [ ] **Step 4: CSS** (append to `landing.css`)

```css
.parity { margin-top: 24px; }
.parity-toggle { display: inline-flex; border: 1px solid var(--color-border); border-radius: 999px; overflow: hidden; margin-bottom: 16px; }
.parity-toggle-btn { padding: 8px 16px; border: 0; background: transparent; font: inherit; font-size: 14px; cursor: pointer; }
.parity-toggle-btn[aria-checked="true"] { background: var(--color-text); color: var(--color-surface-white, #fff); }
.parity-toggle-btn:focus-visible { outline: 2px solid var(--color-accent); outline-offset: -2px; }
.parity-panes { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 20px; }
.parity-pane { min-width: 0; }
.parity-pane .shiki { overflow-x: auto; }
.parity-pane-label { margin: 0 0 8px; font-size: 13px; font-weight: 600; display: flex; align-items: center; gap: 8px; }
.parity-pane-file { font-family: var(--font-mono, ui-monospace, monospace); font-weight: 400; color: var(--color-text-muted); }
.parity-pane-badge { font-size: 11px; padding: 2px 8px; border-radius: 999px; background: #2f6f4f22; color: #2f6f4f; }
.parity-pane[data-pinned] { outline: 2px solid #2f6f4f66; outline-offset: 6px; border-radius: 8px; }
.parity-qualifier { margin: 20px 0 0; font-size: 14px; color: var(--color-text-muted); }
.parity-cta { color: var(--color-accent); font-weight: 600; text-decoration: none; }
@media (max-width: 767px) { .parity-panes { grid-template-columns: 1fr; } }
```

- [ ] **Step 5: Run the spec, commit**

Run: `npx nx test website -- src/components/landing/RuntimeParityToggle.spec.tsx`
Expected: PASS.

```bash
git add apps/website/src/components/landing/RuntimeParity.tsx apps/website/src/components/landing/RuntimeParityToggle.tsx apps/website/src/components/landing/RuntimeParityToggle.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): runtime parity section with adapter toggle and pinned component pane"
```

---

### Task 9: Three-step mechanism

**Files:**
- Create: `apps/website/src/components/landing/ThreeSteps.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the component**

```tsx
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { HighlightedCode } from './HighlightedCode';
import { COMPONENT_SNIPPET, INSTALL_OPTIONS } from '../../lib/positioning';

const RENDER_SNIPPET = `import { provideViews } from '@threadplane/render';
import { KpiCardComponent, DisruptionsTableComponent } from './design-system';

// Registered components are the only thing generated UI can render.
provideViews({
  KpiCard: KpiCardComponent,
  DisruptionsTable: DisruptionsTableComponent,
});`;

const STEPS = [
  {
    title: 'Choose an adapter',
    body: 'Connect LangGraph or an AG-UI endpoint, or start with a fake agent. This is the only file that knows which runtime you run.',
    code: INSTALL_OPTIONS[1].providerSnippet,
  },
  {
    title: 'Inject signal-shaped state',
    body: 'provideAgent() once, injectAgent() where the UI needs messages, status, errors, tool progress and thread actions.',
    code: COMPONENT_SNIPPET,
  },
  {
    title: 'Render the experience you own',
    body: 'Use the chat compositions, the headless primitives, or register your own design-system components for generated UI.',
    code: RENDER_SNIPPET,
  },
] as const;

export async function ThreeSteps() {
  const highlighted = await Promise.all(STEPS.map((s) => HighlightedCode({ code: s.code })));
  return (
    <Section surface="canvas" id="how-it-works" ariaLabelledBy="how-it-works-heading">
      <Container>
        <SectionHeader variant="rail" eyebrow="How it works" heading="From agent endpoint to Angular UI in three steps." headingId="how-it-works-heading" />
        <ol className="three-steps">
          {STEPS.map((s, i) => (
            <li className="three-step" key={s.title}>
              <h3 className="three-step-title">{s.title}</h3>
              <p className="three-step-body">{s.body}</p>
              <div className="three-step-code">{highlighted[i]}</div>
            </li>
          ))}
        </ol>
      </Container>
    </Section>
  );
}
```

`provideViews(registry: ViewRegistry)` is exported from `libs/render/src/lib/provide-views.ts`; check the `ViewRegistry` value shape there (component class vs. `{ component, schema }` entries) and make the snippet match it exactly. Add the render snippet to `positioning.ts` as `RENDER_SNIPPET` and cover it in the parse test if you keep it.

- [ ] **Step 2: CSS**

```css
.three-steps { list-style: none; margin: 24px 0 0; padding: 0; display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 24px; counter-reset: s; }
.three-step { counter-increment: s; min-width: 0; }
.three-step-title::before { content: counter(s) " · "; color: var(--color-accent); }
.three-step-title { margin: 0 0 6px; font-size: 17px; }
.three-step-body { margin: 0 0 12px; font-size: 14px; color: var(--color-text-muted); }
.three-step-code .shiki { overflow-x: auto; font-size: 12.5px; }
@media (max-width: 1023px) { .three-steps { grid-template-columns: 1fr; } }
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/ThreeSteps.tsx apps/website/src/styles/landing.css apps/website/src/lib/positioning.ts apps/website/src/lib/positioning.spec.ts
git commit -m "feat(website): three-step mechanism section"
```

---

### Task 10: Capability proof blocks (Persist, Test) and section media

**Files:**
- Modify: `apps/website/src/lib/section-media.ts` (+ its spec if it enumerates keys)
- Modify: `apps/website/src/app/page.tsx` (in Task 14)

- [ ] **Step 1: Extend `SECTION_MEDIA`**

Add `'persist' | 'test'` to the key union. Add:

```ts
  persist: {
    ...SECTION_MEDIA_SHIP_PANES, // copy the existing `ship` entry's video/code/live values verbatim
  },
  test: {
    code: [
      {
        label: 'Code',
        language: 'typescript',
        source: `import { TestBed } from '@angular/core/testing';
import { provideFakeAgent } from '@threadplane/langgraph';
import { SupportAgentComponent } from './support-agent.component';

it('renders the streamed reply', async () => {
  TestBed.configureTestingModule({
    imports: [SupportAgentComponent],
    providers: [provideFakeAgent({ tokens: ['Hello', ' from', ' Threadplane'], delayMs: 0 })],
  });
  const fixture = TestBed.createComponent(SupportAgentComponent);
  fixture.detectChanges();
  // send a message through the composer, then:
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Hello from Threadplane');
});`,
      },
    ],
  },
```

Write the `persist` entry by literally duplicating the `ship` object (do not reference a spread of a not-yet-declared key); keep `ship` in place because the library pages may still use it. Run `npx nx test website -- src/lib/section-media.spec.ts` and update its key assertions.

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/lib/section-media.ts apps/website/src/lib/section-media.spec.ts
git commit -m "feat(website): section media for Persist and Test capability blocks"
```

---

### Task 11: Coding-agent quickstart

**Files:**
- Create: `apps/website/src/components/landing/CodingAgentQuickstart.tsx`
- Create: `apps/website/src/components/landing/CodingAgentQuickstart.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Write the failing spec**

```tsx
// @vitest-environment jsdom
import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { CODING_AGENT_PROMPT } from '../../lib/positioning';

const trackCtaClickMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock('../../lib/analytics/client', () => ({ trackCtaClick: trackCtaClickMock, track: vi.fn() }));
vi.mock('../ui/Container', () => ({ Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div> }));
vi.mock('../ui/Section', () => ({ Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section> }));
vi.mock('../ui/SectionHeader', () => ({ SectionHeader: ({ heading }: { heading: React.ReactNode }) => <h2>{heading}</h2> }));
vi.mock('../ui/Button', () => ({
  Button: ({ children, href, onClick }: { children: React.ReactNode; href?: string; onClick?: () => void }) =>
    href ? <a href={href} onClick={onClick}>{children}</a> : <button onClick={onClick}>{children}</button>,
}));

beforeEach(() => { trackCtaClickMock.mockClear(); writeTextMock.mockClear(); Object.assign(navigator, { clipboard: { writeText: writeTextMock } }); });

describe('CodingAgentQuickstart', () => {
  it('renders the maintained prompt verbatim and the four links', async () => {
    const { CodingAgentQuickstart } = await import('./CodingAgentQuickstart');
    render(<CodingAgentQuickstart />);
    expect(screen.getByTestId('coding-agent-prompt').textContent).toBe(CODING_AGENT_PROMPT);
    expect(screen.getByRole('link', { name: /Read AGENTS.md/ }).getAttribute('href')).toBe('/AGENTS.md');
    expect(screen.getByRole('link', { name: /full agent reference/ }).getAttribute('href')).toBe('/llms-full.txt');
    expect(screen.getByRole('link', { name: /human quickstart/ }).getAttribute('href')).toBe('/docs/chat/getting-started/try-without-a-backend');
  });

  it('copy writes the prompt and tracks without sending the text', async () => {
    const { CodingAgentQuickstart } = await import('./CodingAgentQuickstart');
    render(<CodingAgentQuickstart />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy setup prompt' }));
    expect(writeTextMock).toHaveBeenCalledWith(CODING_AGENT_PROMPT);
    const call = trackCtaClickMock.mock.calls.find((c) => c[0].cta_id === 'home_coding_agent_prompt')?.[0];
    expect(call).toBeTruthy();
    expect(JSON.stringify(call)).not.toContain('Add Threadplane to this Angular application');
  });
});
```

- [ ] **Step 2: Run to verify it fails, then write the component**

```tsx
'use client';
import { useState } from 'react';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';
import { Button } from '../ui/Button';
import { trackCtaClick } from '../../lib/analytics/client';
import { CODING_AGENT_PROMPT, INSTALL_OPTIONS } from '../../lib/positioning';

const LINKS = [
  { label: 'Read AGENTS.md', href: '/AGENTS.md' },
  { label: 'Open the full agent reference', href: '/llms-full.txt' },
  { label: 'Start the human quickstart', href: INSTALL_OPTIONS[0].quickstartHref },
];

export function CodingAgentQuickstart() {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    trackCtaClick({ cta_id: 'home_coding_agent_prompt', track: 'developer', surface: 'home' });
    try {
      await navigator.clipboard?.writeText(CODING_AGENT_PROMPT);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* prompt is visible; user can select it */ }
  };
  return (
    <Section surface="tinted" id="coding-agent" ariaLabelledBy="coding-agent-heading">
      <Container>
        <SectionHeader
          variant="rail"
          eyebrow="For coding agents"
          heading="Give your coding agent the Angular agent UI playbook."
          headingId="coding-agent-heading"
          aside="Threadplane publishes maintained, machine-readable setup context. Start with a fake agent, verify the Angular surface, then connect LangGraph or AG-UI."
        />
        <pre className="coding-agent-prompt"><code data-testid="coding-agent-prompt">{CODING_AGENT_PROMPT}</code></pre>
        <div className="coding-agent-actions">
          <Button variant="primary" size="md" onClick={copy}>{copied ? 'Copied ✓' : 'Copy setup prompt'}</Button>
          {LINKS.map((l) => (
            <Button
              key={l.href}
              variant="ghost"
              size="md"
              href={l.href}
              onClick={() => trackCtaClick({ cta_id: 'home_coding_agent_link', cta_text: l.label, track: 'developer', surface: 'home' })}
            >
              {l.label}
            </Button>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

CSS:

```css
.coding-agent-prompt { margin: 20px 0 16px; padding: 16px; border-radius: 10px; overflow-x: auto; background: #1c1c1e; color: #e8e8e8; font-family: var(--font-mono, ui-monospace, monospace); font-size: 13px; line-height: 1.55; white-space: pre-wrap; }
.coding-agent-actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
```

- [ ] **Step 3: Run the spec, commit**

```bash
git add apps/website/src/components/landing/CodingAgentQuickstart.tsx apps/website/src/components/landing/CodingAgentQuickstart.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): coding-agent quickstart section"
```

---

### Task 12: Yes Wall compression

**Files:**
- Modify: `apps/website/src/components/landing/YesWall.tsx`
- Modify: `apps/website/src/components/landing/YesWall.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Add tests to the spec**

Keep the four existing tests (they still pass because every row is rendered, the extra ones with `hidden`). Add:

```tsx
  it('shows two rows per group until expanded', () => {
    const { container } = render(<YesWall />);
    const visibleRows = () => Array.from(container.querySelectorAll('.yes-wall-row')).filter((r) => !r.hasAttribute('hidden'));
    expect(visibleRows()).toHaveLength(8);
    const btn = screen.getByRole('button', { name: 'See all 16 production-readiness questions' });
    expect(btn.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(btn);
    expect(visibleRows()).toHaveLength(16);
    expect(screen.getByRole('button', { name: 'Show fewer' }).getAttribute('aria-expanded')).toBe('true');
  });

  it('tracks the expand once', () => {
    render(<YesWall />);
    fireEvent.click(screen.getByRole('button', { name: /See all 16/ }));
    fireEvent.click(screen.getByRole('button', { name: 'Show fewer' }));
    fireEvent.click(screen.getByRole('button', { name: /See all 16/ }));
    const calls = (trackCtaClick as unknown as { mock: { calls: unknown[][] } }).mock.calls.filter((c) => (c[0] as { cta_id: string }).cta_id === 'home_production_readiness_expand');
    expect(calls).toHaveLength(1);
  });

  it('aside count derives from the data', () => {
    render(<YesWall />);
    expect(screen.getByText(/16 questions teams ask before they commit/)).toBeTruthy();
  });
```

Import `fireEvent` and `trackCtaClick` (from the mocked module) at the top.

- [ ] **Step 2: Run to verify it fails**, then **modify `YesWall.tsx`**

Add `'use client';` at the top and `import { useRef, useState } from 'react';`. Replace the `SectionHeader` `aside` with `` aside={`${TOTAL_QUESTIONS} questions teams ask before they commit — each paired with the API that answers it.`} `` and delete the "Sixteen" NOTE comment. Add state:

```tsx
const INITIAL_PER_GROUP = 2;

export function YesWall() {
  const [expanded, setExpanded] = useState(false);
  const trackedExpand = useRef(false);
  const toggle = () => {
    if (!expanded && !trackedExpand.current) {
      trackedExpand.current = true;
      trackCtaClick({ surface: 'home', cta_id: 'home_production_readiness_expand', cta_text: 'See all production-readiness questions', track: 'developer' });
    }
    setExpanded((v) => !v);
  };
```

In the rows map, add `hidden={!expanded && rowIndex >= INITIAL_PER_GROUP}` (use `group.rows.map((row, rowIndex) => …)`). Before the `.yes-wall-footer` div add:

```tsx
              <div className="yes-wall-expand-row">
                <button
                  type="button"
                  className="yes-wall-expand"
                  aria-expanded={expanded}
                  aria-controls="yes-wall-body"
                  onClick={toggle}
                >
                  {expanded ? 'Show fewer' : `See all ${TOTAL_QUESTIONS} production-readiness questions`}
                </button>
              </div>
```

and give the `.yes-wall-body` div `id="yes-wall-body"`.

CSS:

```css
.yes-wall-expand-row { grid-column: 1 / -1; margin: 8px 0 16px; }
.yes-wall-expand { background: transparent; border: 1px solid rgba(255,255,255,.35); color: inherit; border-radius: 999px; padding: 8px 16px; font: inherit; font-size: 14px; cursor: pointer; }
.yes-wall-expand:focus-visible { outline: 2px solid #fff; outline-offset: 2px; }
```

- [ ] **Step 3: Run the spec, commit**

Run: `npx nx test website -- src/components/landing/YesWall.spec.tsx`
Expected: PASS (7 tests).

```bash
git add apps/website/src/components/landing/YesWall.tsx apps/website/src/components/landing/YesWall.spec.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): Yes Wall shows eight questions and expands in place"
```

---

### Task 13: Scope table, enterprise block, FAQ, final CTA copy

**Files:**
- Create: `apps/website/src/components/landing/ScopeTable.tsx`
- Modify: `apps/website/src/components/landing/PilotBlock.tsx`
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: ScopeTable**

```tsx
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { SectionHeader } from '../ui/SectionHeader';

const ROWS = [
  { start: 'Raw SSE or stream SDK', gives: 'Transport and events', adds: 'Angular state model, chat UX, threads, approvals, generated UI, recovery, tests' },
  { start: 'Backend agent framework', gives: 'Agent runtime and orchestration', adds: 'The production Angular application and interaction layer' },
  { start: 'Generative-UI renderer', gives: 'Structured UI rendering', adds: 'Full agent UI, adapters, thread UX, interrupts, testing, and render support' },
  { start: 'React-first agent UI', gives: 'Mature React patterns', adds: 'Native Angular Signals, DI, templates, components, and testing' },
];

export function ScopeTable() {
  return (
    <Section surface="white" id="why" ariaLabelledBy="why-heading">
      <Container>
        <SectionHeader variant="rail" eyebrow="Why Threadplane" heading="What you start with, and what Threadplane adds." headingId="why-heading" />
        <div className="scope-table-wrap">
          <table className="scope-table">
            <thead>
              <tr><th scope="col">Starting point</th><th scope="col">What it gives you</th><th scope="col">What Threadplane adds</th></tr>
            </thead>
            <tbody>
              {ROWS.map((r) => (
                <tr key={r.start}><th scope="row">{r.start}</th><td>{r.gives}</td><td>{r.adds}</td></tr>
              ))}
            </tbody>
          </table>
        </div>
      </Container>
    </Section>
  );
}
```

CSS: `.scope-table-wrap { overflow-x: auto; margin-top: 20px; } .scope-table { width: 100%; min-width: 640px; border-collapse: collapse; font-size: 14px; } .scope-table th, .scope-table td { text-align: left; padding: 12px 14px; border-bottom: 1px solid var(--color-border); vertical-align: top; } .scope-table thead th { font-size: 12px; text-transform: uppercase; letter-spacing: .04em; color: var(--color-text-muted); }`

- [ ] **Step 2: PilotBlock**

Change the heading to `Shipping inside a large Angular platform?`, the subhead to `Bring your backend, security model, and design system. Work directly with Threadplane engineers on architecture, rollout, testing, and production hardening.`, and the CTA row to:

```tsx
            <div className="pilot-cta-row">
              <Button
                variant="primary"
                size="lg"
                href="/contact?source=home_enterprise&track=enterprise"
                onClick={() => trackCtaClick({ cta_id: 'hero_talk_to_engineers', track: 'enterprise', surface: 'home' })}
              >
                Talk to an engineer
              </Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod">See the pilot program</Button>
            </div>
```

Add `'use client';` and the `trackCtaClick` import. Keep `TIMELINE` and `OUTCOMES`. Only keep any "we reply within one business day" wording if `docs/gtm/` or the contact page still promises it (the contact e2e expects "within one business day", so it does).

- [ ] **Step 3: HomeFAQ**

Replace `ITEMS` with the twelve intent questions. Answers are one to three sentences, literal, one docs link each (React nodes with `<a href>`):

1. Is Threadplane a backend agent framework? No. It is the Angular UI layer. Your agent runs in LangGraph, an AG-UI-compatible runtime, or your own service. Link `/docs/choosing-an-adapter`.
2. Does Threadplane require LangGraph? No. `@threadplane/ag-ui` connects any AG-UI-compatible backend; `@threadplane/langgraph` is the direct LangGraph adapter. Link `/ag-ui`.
3. What is the difference between the LangGraph and AG-UI adapters? Both implement the same `Agent` contract. LangGraph adds native threads, checkpoints, history and branch mapping; AG-UI maps the protocol's events and depends on what the backend emits. Link `/docs/choosing-an-adapter`.
4. Where are threads and checkpoints stored? In your backend's persistence layer. Threadplane exposes thread, history and resume behavior in the UI; durability comes from the runtime you operate. Link `/docs/langgraph/guides/persistence`.
5. Can I use my existing Angular component library and design system? Yes. Chat compositions are stylable, the primitives are headless, and generated UI renders components you register. Link `/render`.
6. Does generated UI execute arbitrary code? No. The agent emits constrained structured output validated against a schema; Angular renders registered components, with per-component fallback. Link `/docs/render/concepts/json-render-vs-a2ui`.
7. Can I test the UI without a model or live backend? Yes. `provideFakeAgent()` streams canned tokens in-process; mock transports script tool calls and interrupts. Link `/docs/chat/getting-started/try-without-a-backend`.
8. Which Angular versions are supported? Render `formatAngularRange(WEBSITE_SUPPORTED_ANGULAR_MAJORS)` from positioning. Link `/docs/langgraph/getting-started/installation`.
9. Does Threadplane require a hosted service or account? No. Every package is MIT and runs inside your Angular app against a backend you host. Link `/pricing`.
10. What telemetry is enabled by default? None. Installation is inert; events require an explicit application action through `@threadplane/telemetry`. Link `/docs/telemetry/guides/browser`.
11. How does Threadplane differ from a raw streaming SDK? An SDK gives you events. Threadplane gives you the Angular state model, chat UX, threads, approvals, generated UI, recovery and tests on top. Link `/chat`.
12. How does Threadplane compare with other Angular agent UI libraries? Threadplane is the runtime-neutral Angular UI layer: direct LangGraph and AG-UI adapters, a fake-agent test path, design-system-owned generated UI, and no hosted layer in the loop. A dated, sourced comparison page is planned. Link `/docs/choosing-an-adapter`. Do not name any competitor product anywhere in the file (repo rule, see the `feedback-no-competitor-mentions` memory).

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/ScopeTable.tsx apps/website/src/components/landing/PilotBlock.tsx apps/website/src/components/landing/HomeFAQ.tsx apps/website/src/styles/landing.css
git commit -m "feat(website): scope table, enterprise block copy, intent-driven FAQ"
```

---

### Task 14: Assemble `page.tsx`, metadata, e2e

**Files:**
- Modify: `apps/website/src/app/page.tsx`
- Modify: `apps/website/e2e/website.spec.ts`
- Create: `apps/website/e2e/home-hero.spec.ts`

- [ ] **Step 1: Rewrite `page.tsx`**

```tsx
import { Hero } from '../components/landing/Hero';
import { LogoRibbon } from '../components/landing/LogoRibbon';
import { RuntimeParity } from '../components/landing/RuntimeParity';
import { ThreeSteps } from '../components/landing/ThreeSteps';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { DemoShowcase } from '../components/landing/DemoShowcase';
import { MediumSwitcher } from '../components/landing/MediumSwitcher';
import { CodingAgentQuickstart } from '../components/landing/CodingAgentQuickstart';
import { YesWall } from '../components/landing/YesWall';
import { ScopeTable } from '../components/landing/ScopeTable';
import { SECTION_MEDIA } from '../lib/section-media';
import { buildPanes } from '../lib/build-panes';
import { PilotBlock } from '../components/landing/PilotBlock';
import { ProofStrip } from '../components/landing/ProofStrip';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { Promises } from '../components/landing/Promises';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { RecentArticles } from '../components/landing/RecentArticles';
import { Section } from '../components/ui/Section';
import { Container } from '../components/ui/Container';
import { createPageMetadata, HOME_DESCRIPTION, HOME_TITLE, INSTALL_OPTIONS } from '../lib/site-metadata';

export const metadata = createPageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  pathname: '/',
  type: 'website',
});

export default async function HomePage() {
  const [streamPanes, persistPanes, approvePanes, renderPanes, testPanes] = await Promise.all(
    (['stream', 'persist', 'approve', 'render', 'test'] as const).map((key) =>
      buildPanes(SECTION_MEDIA[key], SECTION_MEDIA[key].video?.url ?? ''),
    ),
  );

  return (
    <>
      <Hero />
      <LogoRibbon />
      <RuntimeParity />
      <ThreeSteps />

      <FeatureBlock
        id="stream"
        eyebrow="Stream"
        headline="The UI stays reactive through tokens, tools, errors, and state changes."
        body={<><code className="home-code">injectAgent()</code> hands back signals: messages(), status(), error(), isLoading(), and tool progress. Nothing to subscribe to, nothing to tear down.</>}
        rows={[
          { claim: 'Signals, not promises', api: 'injectAgent()' },
          { claim: 'Tool progress as it happens', api: 'toolProgress()' },
          { claim: 'Same contract on LangGraph and AG-UI', api: 'Agent' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/langgraph/guides/streaming' }}
        visual={<MediumSwitcher sectionId="stream" panes={streamPanes} />}
      />

      <FeatureBlock
        id="persist"
        eyebrow="Persist"
        headline="A user can leave, return, inspect history, and continue."
        body="Thread selection, history, branch and replay UI in the Angular app. Durability itself comes from the runtime and persistence layer you connect — Threadplane exposes it, it does not fake it."
        rows={[
          { claim: 'Conversations restore across sessions', api: 'threadId + checkpoints' },
          { claim: 'Branch or replay from any point', api: 'branch / replay' },
          { claim: 'error() / status() / reload() on every agent', api: 'boundary signals' },
        ]}
        cta={{ label: 'Persistence patterns', href: '/docs/langgraph/guides/persistence' }}
        visualLeft
        visual={<MediumSwitcher sectionId="persist" panes={persistPanes} />}
      />

      <FeatureBlock
        id="approve"
        eyebrow="Approve"
        headline="Irreversible work pauses for a human decision."
        body={<><code className="home-code">interrupt()</code> freezes the run inside the checkpoint. Your UI renders the proposal; <code className="home-code">submit({'{ resume }'})</code> continues with the decision on the record.</>}
        rows={[
          { claim: 'The pause is a checkpoint, not a modal', api: 'interrupt()' },
          { claim: 'The proposal renders in your UI', api: '<chat-interrupt-panel>' },
          { claim: 'The decision lands beside the action it gated', api: 'submit({ resume })' },
        ]}
        cta={{ label: 'Interrupt patterns', href: '/docs/langgraph/guides/interrupts' }}
        visual={<MediumSwitcher sectionId="approve" panes={approvePanes} />}
      />

      <FeatureBlock
        id="render"
        eyebrow="Render"
        headline="Agent output becomes components from your design system."
        body="The agent emits constrained structured output. Angular renders registered components — json-render and A2UI both speak it — with per-component fallback and a readiness gate. No generated code runs."
        rows={[
          { claim: 'Your design system, not a chat widget', api: '@threadplane/render' },
          { claim: 'Unknown specs degrade per component', api: 'fallback + readiness gate' },
          { claim: 'Schema on the server, trust in the client', api: 'validated specs' },
        ]}
        cta={{ label: 'See @threadplane/render', href: '/render' }}
        visualLeft
        visual={<MediumSwitcher sectionId="render" panes={renderPanes} />}
      />

      <FeatureBlock
        id="test"
        eyebrow="Test"
        headline="Verify UI behavior without a model or backend."
        body={<><code className="home-code">provideFakeAgent()</code> streams canned tokens in-process; mock transports script tool calls and interrupts. Your component specs stay deterministic and fast.</>}
        rows={[
          { claim: 'No key, no server, no network', api: 'provideFakeAgent()' },
          { claim: 'Script tool calls and interrupts', api: 'mockLangGraphAgent()' },
          { claim: 'Same UI code in test and production', api: 'Agent' },
        ]}
        cta={{ label: 'Try without a backend', href: INSTALL_OPTIONS[0].quickstartHref }}
        visual={<MediumSwitcher sectionId="test" panes={testPanes} />}
      />

      <Section surface="canvas">
        <Container>
          <DemoShowcase />
        </Container>
      </Section>

      <CodingAgentQuickstart />
      <YesWall />
      <ScopeTable />
      <ProofStrip />
      <Promises />
      <WhitePaperBlock />
      <PilotBlock />
      <HomeFAQ />
      <FinalCTA
        variant="dark"
        headline="Prove the Angular UI before you connect the backend."
        subtext="Start with a fake agent, render a real Threadplane surface, then swap in LangGraph or AG-UI when the integration is ready."
        primary={{ label: 'Start the quickstart', href: INSTALL_OPTIONS[0].quickstartHref }}
        secondary={{ label: 'Run live examples', href: HERO_SECONDARY_HREF }}
        caption="MIT · no account, no cloud · Talk to an engineer: /contact"
      />
      <RecentArticles />
    </>
  );
}
```

Verify `toolProgress()` and `mockLangGraphAgent()` exist in the adapter's public API (they do per `libs/langgraph/src/lib/agent.types.ts` and `public-api.ts`). Make the caption's "Talk to an engineer" a real link if `FinalCTA` accepts a ReactNode caption; if it only accepts a string, add a `captionLink?: { label; href }` prop to `FinalCTA` and render it after the caption text. Re-export `INSTALL_OPTIONS` from `site-metadata.ts` (Task 1 did).

- [ ] **Step 1b: OG image headline and hero-string drift guards**

`apps/website/src/app/opengraph-image.tsx` hardcodes the visible headline `Build fullstack agentic Angular apps.`; replace it with `HERO_H1` from positioning so the OG card, `<title>` and H1 agree (spec §10). Add to `positioning.spec.ts`: `expect(HERO_PRIMARY_LABEL).toBe('Install Threadplane'); expect(HERO_SECONDARY_LABEL).toBe('See it running in the docs →'); expect(HERO_SECONDARY_HREF).toBe('/docs/chat/guides/generative-ui?mode=run');` and `expect(INSTALL_OPTIONS[0].quickstartHref).toBe('/docs/chat/getting-started/try-without-a-backend');`.

- [ ] **Step 1c: HeroDemo polish from review**

In `landing.css`, make the poster fade rather than vanish: `.hero-demo-poster { transition: opacity 300ms ease; }` and `.hero-demo[data-state="ready"] .hero-demo-poster { opacity: 0; visibility: hidden; transition: opacity 300ms ease, visibility 0s linear 300ms; }` (replace the plain `visibility: hidden` rule). In `HeroDemo.tsx`, let the visibility effect keep posting while `fallback` too (drop the `ready`-only guard: post whenever the iframe is mounted), so a frame that learns the parent origin late can still recover; keep the spec green and add one assertion that a `visible` post happens in `fallback`.

- [ ] **Step 2: Update `website.spec.ts`**

- Feature blocks test: assert `#stream-heading`, `#persist-heading`, `#approve-heading`, `#render-heading`, `#test-heading` and rename the test title.
- The MIT/telemetry test still passes (`Promises` is still mounted).
- The hero test: additionally `await expect(page.locator('#hero-heading')).toHaveText('The AI agent UI framework for Angular.')`.

- [ ] **Step 3: Create `home-hero.spec.ts`**

```ts
import { test, expect } from '@playwright/test';

test.describe('homepage hero', () => {
  test('install dialog opens, is keyboard operable, and copies the visible command', async ({ page, context }) => {
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await page.goto('/');
    await page.getByRole('button', { name: 'Install Threadplane' }).click();
    const dialog = page.getByRole('dialog', { name: 'Install Threadplane' });
    await expect(dialog).toBeVisible();
    await expect(dialog.getByRole('radio', { name: 'Try without a backend' })).toHaveAttribute('aria-checked', 'true');
    await dialog.getByRole('radio', { name: 'Try without a backend' }).focus();
    await page.keyboard.press('ArrowRight');
    await expect(dialog.getByRole('radio', { name: 'LangGraph' })).toHaveAttribute('aria-checked', 'true');
    const visible = await dialog.getByTestId('install-command').textContent();
    await dialog.getByRole('button', { name: 'Copy install command' }).click();
    const copied = await page.evaluate(() => navigator.clipboard.readText());
    expect(copied).toBe(visible);
    await page.keyboard.press('Escape');
    await expect(dialog).toBeHidden();
    await expect(page.getByRole('button', { name: 'Install Threadplane' })).toBeFocused();
  });

  test('poster renders before the frame and the frame mounts on desktop', async ({ page }) => {
    await page.goto('/');
    const demo = page.locator('[data-hero-demo]');
    await expect(demo.locator('img')).toHaveAttribute('src', '/screenshots/hero-walkthrough-poster.webp');
    await expect(demo.locator('iframe')).toHaveAttribute('src', 'https://demo.threadplane.ai/hero');
  });

  test('mobile shows Play walkthrough instead of the frame', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto('/');
    const demo = page.locator('[data-hero-demo]');
    await demo.scrollIntoViewIfNeeded();
    await expect(demo.getByRole('button', { name: 'Play walkthrough' })).toBeVisible();
    await expect(demo.locator('iframe')).toHaveCount(0);
  });

  test('Yes Wall expands in place', async ({ page }) => {
    await page.goto('/');
    const btn = page.getByRole('button', { name: /See all 16 production-readiness questions/ });
    await btn.scrollIntoViewIfNeeded();
    await btn.click();
    await expect(page.getByRole('button', { name: 'Show fewer' })).toHaveAttribute('aria-expanded', 'true');
  });
});
```

- [ ] **Step 4: Run unit, lint, e2e**

```bash
npx nx test website
npx nx lint website
npx nx e2e website -- website.spec.ts home-hero.spec.ts demo-modal.spec.ts
```

Expected: all green. Lint errors (not warnings) must be fixed; strip ANSI before grepping output.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/page.tsx apps/website/e2e/website.spec.ts apps/website/e2e/home-hero.spec.ts apps/website/src/components/landing/FinalCTA.tsx
git commit -m "feat(website): assemble the rebuilt homepage and update e2e coverage"
```

---

### Task 15: "Try without a backend" docs page

**Files:**
- Create: `apps/website/content/docs/chat/getting-started/try-without-a-backend.mdx`
- Modify: `apps/website/src/lib/docs-config.ts` (chat getting-started pages, after Quick Start)
- Modify: `apps/website/content/docs/langgraph/getting-started/quickstart.mdx`, `apps/website/content/docs/ag-ui/getting-started/quickstart.mdx` (one Callout each)

- [ ] **Step 1: Add the nav entry**

In `docs-config.ts` chat `getting-started.pages`, insert after Quick Start:

```ts
          { title: 'Try without a backend', slug: 'try-without-a-backend', section: 'getting-started' },
```

Run `npx nx test website -- src/lib/docs.spec.ts` (it may assert page counts; update).

- [ ] **Step 2: Write the page**

Match the frontmatter/heading style of `quickstart.mdx` (it starts with `# Quick Start`; check whether a frontmatter block with `description:` is expected by `docs.spec.ts` or the meta generator, and include one if other pages do).

```mdx
# Try without a backend

Render a real `<chat>` in your Angular app with no server, no LLM and no account. `provideFakeAgent()` streams a canned reply in-process through the same components you will ship. When the UI looks right, swap the provider for a real adapter.

<Callout type="info" title="What you need">
An Angular 20–22 application. Nothing else.
</Callout>

<Steps>
<Step title="Install">

```bash
npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked
```

`provideFakeAgent()` ships inside the adapter packages, so install the adapter you expect to use later. The LangChain packages are peers of `@threadplane/langgraph`; `marked` renders assistant markdown.

</Step>
<Step title="Provide the fake agent">

```ts
// app.config.ts
import { ApplicationConfig } from '@angular/core';
import { provideFakeAgent } from '@threadplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideFakeAgent({ tokens: ['Hello', ' from', ' Threadplane.'] }),
  ],
};
```

</Step>
<Step title="Render the chat">

```ts
// app.component.ts
import { Component } from '@angular/core';
import { injectAgent } from '@threadplane/langgraph';
import { ChatComponent } from '@threadplane/chat';

@Component({
  selector: 'app-root',
  imports: [ChatComponent],
  template: `<chat [agent]="agent" />`,
})
export class AppComponent {
  protected readonly agent = injectAgent();
}
```

Run `ng serve`, type anything, and watch the reply stream in.

</Step>
<Step title="Test it">

```ts
// app.component.spec.ts
import { TestBed } from '@angular/core/testing';
import { provideFakeAgent } from '@threadplane/langgraph';
import { AppComponent } from './app.component';

it('streams the fake reply', async () => {
  TestBed.configureTestingModule({
    imports: [AppComponent],
    providers: [provideFakeAgent({ tokens: ['Hello', ' from', ' Threadplane.'], delayMs: 0 })],
  });
  const fixture = TestBed.createComponent(AppComponent);
  fixture.detectChanges();
  const textarea = fixture.nativeElement.querySelector('textarea');
  textarea.value = 'hi';
  textarea.dispatchEvent(new Event('input'));
  fixture.nativeElement.querySelector('button[aria-label="Send message"]').click();
  await fixture.whenStable();
  expect(fixture.nativeElement.textContent).toContain('Hello from Threadplane.');
});
```

</Step>
</Steps>

## Connect a real adapter

Replace `provideFakeAgent(...)` with one line and keep every component as it is:

- **LangGraph**: `provideAgent({ apiUrl: 'http://localhost:2024', assistantId: 'agent' })` — [LangGraph quickstart](/docs/langgraph/getting-started/quickstart)
- **AG-UI**: `provideAgent({ url: 'http://localhost:8000/agent' })` from `@threadplane/ag-ui` — [AG-UI quickstart](/docs/ag-ui/getting-started/quickstart)

Not every backend emits every capability; see [Choosing an adapter](/docs/choosing-an-adapter).
```

The MDX install block must equal `INSTALL_OPTIONS[0].command`. Add to `positioning.spec.ts`:

```ts
  it('the try-without-a-backend page uses the fake install command verbatim', () => {
    const mdx = fs.readFileSync(path.join(resolveWebsiteDir(), 'content/docs/chat/getting-started/try-without-a-backend.mdx'), 'utf8');
    expect(mdx).toContain(INSTALL_OPTIONS[0].command);
  });
```

- [ ] **Step 3: Verify from a clean app (release gate)**

In the scratchpad directory (not the repo):

```bash
cd "$SCRATCHPAD" && npx -y @angular/cli@20 new tplane-fake-check --defaults --skip-git --style=css && cd tplane-fake-check
npm install @threadplane/chat @threadplane/langgraph @langchain/core @langchain/langgraph-sdk marked
```

Apply the page's three files verbatim, then run `npx ng build` and `npx ng test --watch=false`. Both must pass. If the build fails on a missing peer or a wrong import, fix the page (and `INSTALL_OPTIONS`) until it passes, then record the package versions printed by `npm ls @threadplane/chat @threadplane/langgraph` in the PR description. If the spec's send button or textarea selectors do not match the published `@threadplane/chat` version, adjust the spec on the page to what the published version renders.

- [ ] **Step 4: Cross-link**

Add to both adapter quickstarts' top Callouts one sentence: `No backend yet? [Try without a backend](/docs/chat/getting-started/try-without-a-backend) renders the same <chat> with a fake agent.` (In the chat quickstart, replace the existing "No backend yet?" callout body with this sentence, keeping the `mockAgent()` section below intact.)

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/docs apps/website/src/lib/docs-config.ts apps/website/src/lib/positioning.spec.ts apps/website/src/lib/docs.spec.ts
git commit -m "docs(website): Try without a backend quickstart with provideFakeAgent"
```

---

### Task 16: Production build, responsive review, performance baseline, claim audit

- [ ] **Step 1: Production build**

```bash
rm -rf apps/website/.next && npx nx build website --configuration=production
```

Expected: succeeds; the bundle-budget gate passes. Note the homepage first-load JS in the PR description.

- [ ] **Step 2: Baseline Lighthouse on production BEFORE deploying** (only if not already captured)

```bash
npx -y lighthouse https://threadplane.ai --preset=desktop --output=json --output-path="$SCRATCHPAD/lh-before-desktop.json" --quiet
npx -y lighthouse https://threadplane.ai --output=json --output-path="$SCRATCHPAD/lh-before-mobile.json" --quiet
```

Record LCP, CLS, TBT and total JS/image bytes from each.

- [ ] **Step 3: Lighthouse on the local production build**

Serve the build (`npx nx run website:serve --configuration=production` or `npx next start apps/website` per project.json) and run the same two commands against `http://localhost:3000`. Compare. Investigate any LCP or CLS regression: the poster must be the LCP element (check `largest-contentful-paint-element` in the audit) and CLS must be under 0.1.

- [ ] **Step 4: Responsive screenshots**

Using the Browser pane against the production build, capture `/` at 1440, 768 and 390 wide: full page. Check the first viewport, code overflow in the parity and three-step panes, the install dialog at 390, the compatibility rows wrapping, the Yes Wall collapsed and expanded, focus rings on the dialog radios and the Yes Wall button, and no horizontal scroll (`document.documentElement.scrollWidth <= clientWidth`). Save screenshots to the scratchpad and attach to the PR; do not commit them.

- [ ] **Step 5: Claim audit**

Write this table into the PR description, each row with a source path:

| Claim | Where on the page | Source |
|---|---|---|
| MIT | trust line, FAQ 9, Promises | `libs/*/package.json` license |
| Angular 20–22 | trust line, FAQ 8 | `libs/chat/package.json` peerDependencies, `angular-support.mjs` |
| Package names in install commands | dialog | `positioning.spec.ts` |
| Direct adapters LangGraph, AG-UI | compatibility rows | `libs/langgraph`, `libs/ag-ui` |
| AG-UI backends listed | compatibility row 2 | `docs-config.ts` runtime sections + cockpit/ag-ui |
| Provider logos behind the backend | row 3 | copy states the boundary |
| Persistence wording | Persist block, FAQ 4 | `docs/langgraph/guides/persistence` |
| No telemetry by default | FAQ 10, Promises | `libs/telemetry` README / `provideThreadplaneTelemetry` opt-in |
| No account / no cloud | trust line, final CTA | pricing page, no hosted runtime in repo |
| Fake agent path | dialog, Test block, docs page | `provideFakeAgent` in both adapters; clean-app run in Task 15 |
| Hero demo honesty | pill copy | `/hero` route status pill |

Remove or qualify any row you cannot source.

- [ ] **Step 6: Full suite**

```bash
npx nx test website && npx nx lint website && npx nx e2e website
```

Expected: green. Free any orphaned dev servers before e2e.

- [ ] **Step 7: Open the PR**

Branch pushed, PR against `main`, description containing: decision record (category, H1, subhead, CTA hierarchy and why), what was preserved/moved/rewritten/removed/added, the claim audit, Lighthouse before/after, screenshots, the clean-app verification with versions, and the deferred list (comparison pages, README/npm alignment, OG image, skill file, content program, baseline reviews). The `/hero` route from the companion plan must be merged and deployed first, or the hero shows the poster fallback until it is.

---

## Self-review against the spec

- §3 order: Task 14 mounts Hero, LogoRibbon, RuntimeParity, ThreeSteps, five FeatureBlocks, DemoShowcase, CodingAgentQuickstart, YesWall, ScopeTable, ProofStrip/Promises/WhitePaperBlock, PilotBlock, HomeFAQ, FinalCTA, RecentArticles. `StackDiagramSection` and `HomeConceptGrid` are unmounted only.
- §4.1 copy and removals: Tasks 1, 6.
- §4.2 HeroDemo states, poster LCP, allowlist, fallback, mobile/reduced motion, analytics: Task 5.
- §4.4 dialog: Task 4 (three steps, radiogroup with arrows, copy feedback, footer links, events with `adapter`).
- §5 compatibility rows with `aria-hidden` logos: Task 7.
- §6 parity, three steps, five capability blocks with qualifications: Tasks 8, 9, 10, 14.
- §7 coding agent, Yes Wall 8→16, scope table, enterprise heading + moved id, twelve FAQ items, final CTA: Tasks 11, 12, 13, 14.
- §8 docs page + clean-app gate: Task 15.
- §9 single source and drift guards: Task 1 (+ Task 15 MDX guard). Trust facts from `angular-support.mjs`.
- §10 metadata title/description: Tasks 1, 14. No FAQ schema added.
- §11 analytics ids and taxonomy: Task 2; ids used in Tasks 4–13.
- §12 performance and accessibility: Tasks 5, 6, 16.
- §13 testing: unit specs per task; e2e in Task 14; manual gates in Task 16.

Type consistency: `INSTALL_OPTIONS[n].{key,label,description,command,peersNote,providerSnippet,quickstartHref}` is used identically in Tasks 1, 4, 9, 11, 14, 15. `trackCtaClick({ cta_id, adapter, track, surface })` matches `AnalyticsProperties` after Task 2. `HeroDemo` message shape `{ type: 'tplane-hero', state | visible }` matches the companion plan's `hero-bridge.ts`.
