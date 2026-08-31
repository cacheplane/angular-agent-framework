# Homepage Punch List Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Merge the hero's two noun rows into one linked capability row, de-litany the first FAQ answer, and migrate all five non-home pages to `FeatureBlock` rows so the legacy bullets+cards path can be deleted — per `docs/superpowers/specs/2026-08-31-homepage-punch-list-design.md`.

**Architecture:** Next.js 16 / React 19; UNLAYERED CSS in `apps/website/src/styles/landing.css` (no inline styles, no `@layer`). `POSITIONING_PROOF_POINTS` survives (OG image + site-metadata consume it); only Hero's usage is removed. After Task 3 no consumer passes `bullets`/`supportingCards`, so Task 4 deletes that path and makes `rows` required.

**Test command:** `cd apps/website && npx vitest run --config vite.config.mts`
**Branch:** `blove/homepage-punch-list` (spec committed). Expected starting HEAD: `0243298d` or descendant — verify before starting.

---

### Task 1: Hero — one linked capability row

**Files:**
- Modify: `apps/website/src/lib/positioning.ts`
- Modify: `apps/website/src/components/landing/Hero.tsx`
- Modify: `apps/website/src/components/landing/Hero.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Update Hero.spec.tsx FIRST (failing)**

Replace the locked-copy test's chip and proof-point loops (and their imports)
with one assertion block; keep the H1/subhead/`HERO_SUBHEAD` assertions and
the CTA/analytics tests untouched:

```tsx
    const row = screen.getByRole('list', { name: 'Capabilities' });
    for (const cap of HERO_CAPABILITIES) {
      const link = within(row).getByRole('link', { name: cap.label });
      expect(link.getAttribute('href')).toBe(cap.href);
    }
    expect(document.querySelector('.hero-proof-row')).toBeNull();
```

Import `HERO_CAPABILITIES` from `../../lib/positioning`; drop the
`HERO_CHIPS` and `POSITIONING_PROOF_POINTS` spec imports if now unused.

- [ ] **Step 2: Run to verify FAIL**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/Hero.spec.tsx`
Expected: FAIL — `HERO_CAPABILITIES` not exported.

- [ ] **Step 3: positioning.ts**

Delete the `HERO_CHIPS` export. Keep `POSITIONING_PROOF_POINTS` and its
interface untouched. Add:

```ts
export interface HeroCapability {
  readonly label: string;
  readonly href: string;
}

/**
 * The hero's single capability row (spec 2026-08-31): chip casing, proof-pill
 * hrefs, rendered as links. POSITIONING_PROOF_POINTS still feeds the OG image
 * and metadata keywords — do not fold these together.
 */
export const HERO_CAPABILITIES: readonly HeroCapability[] = [
  { label: 'durable threads', href: '/docs/langgraph/guides/persistence' },
  { label: 'interrupts', href: '/docs/langgraph/guides/interrupts' },
  { label: 'subagents', href: '/docs/langgraph/guides/subgraphs' },
  { label: 'planning + memory', href: '/docs/langgraph/guides/memory' },
  { label: 'generative UI', href: '/docs/render/concepts/json-render-vs-a2ui' },
  { label: 'LangGraph + AG-UI', href: '/docs/choosing-an-adapter' },
];
```

- [ ] **Step 4: Hero.tsx**

Change the positioning import to `{ HERO_CAPABILITIES }` (keep other imports
as used; remove the `Pill` import if now unused — check). Replace the
`hero-chip-row` `<ul>` with:

```tsx
            <ul className="hero-chip-row" role="list" aria-label="Capabilities">
              {HERO_CAPABILITIES.map((cap) => (
                <li key={cap.label}>
                  <a
                    className="hero-chip"
                    href={cap.href}
                    onClick={() =>
                      track(analyticsEvents.marketingCtaClick, {
                        cta_id: 'hero_proof_pill',
                        track: 'developer',
                        surface: 'home',
                      })
                    }
                  >
                    {cap.label}
                  </a>
                </li>
              ))}
            </ul>
```

Delete the whole `hero-proof-row` div (the `POSITIONING_PROOF_POINTS.map`
block). Keep `hero-caption` and everything else.

- [ ] **Step 5: landing.css**

- `.hero-chip` becomes a link: add `text-decoration: none; display: inline-block;`
  and a hover/focus state:

```css
.hero-chip:hover,
.hero-chip:focus-visible {
  border-color: var(--color-accent-border-hover);
  color: var(--color-text-primary);
}
```

- Delete the `@media (max-width: 640px) { .hero-chip-row { display: none; } }`
  block (and its comment) — the row now shows on mobile.
- Delete `.hero-proof-row`, `.hero-proof-link` (including its tap-target
  padding block), and every `.hero-proof-pill` rule (grep
  `hero-proof` in landing.css — remove all hits).
- The `<li>` wrappers are new: add `.hero-chip-row li { display: inline-flex; }`
  so the flex layout is unchanged. (NOT `display: contents` — that strips the
  list-item boxes and can break list semantics in AT, the same trap the
  `list-style: none` role fix guards against.)

- [ ] **Step 6: Run hero spec, then whole suite**

Run: `cd apps/website && npx vitest run --config vite.config.mts src/components/landing/Hero.spec.tsx`
Expected: PASS. Then the full suite — `site-metadata.spec.ts` still asserts
`POSITIONING_PROOF_POINTS` (unchanged export) and must stay green.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src
git commit -m "feat(website): hero capability row — chips become the links"
```

---

### Task 2: FAQ first answer

**Files:**
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`

- [ ] **Step 1: Replace the first item's `a` string with EXACTLY:**

```
AG-UI is a protocol rather than a complete Angular UI layer. Threadplane is the production surface built on the runtimes that speak it — the chat, threads, interrupts, and generative UI your Angular app actually ships.
```

- [ ] **Step 2: Verify nothing asserts the old string**

Run: `grep -rn 'production surface around compatible runtimes' apps/website/src apps/website/e2e`
Expected: no matches after the edit.

- [ ] **Step 3: Suite, then commit**

Run: `cd apps/website && npx vitest run --config vite.config.mts` → PASS.

```bash
git add apps/website/src/components/landing/HomeFAQ.tsx
git commit -m "copy(website): de-litany the first FAQ answer"
```

---

### Task 3: Migrate the five pages to rows

**Files:**
- Modify: `apps/website/src/app/langgraph/page.tsx`
- Modify: `apps/website/src/app/chat/page.tsx`
- Modify: `apps/website/src/app/ag-ui/page.tsx`
- Modify: `apps/website/src/app/render/page.tsx`
- Modify: `apps/website/src/app/pilot-to-prod/page.tsx`

- [ ] **Step 1: Convert each block**

For every `<FeatureBlock>` on the five pages: DELETE its `bullets={[...]}` and
`supportingCards={[...]}` props and ADD the `rows` prop below. Headlines,
bodies, eyebrows, ctas, visuals, ids, comments all stay untouched. Rows
verbatim from the spec:

`/langgraph` block 1 (eyebrow "Providers"):
```tsx
        rows={[
          { claim: 'Wire it once in app.config.ts', api: 'provideAgent' },
          { claim: 'A typed, signal-based handle, no args', api: 'injectAgent()' },
          { claim: 'Deterministic tests without a backend', api: 'MockAgentTransport' },
        ]}
```

`/langgraph` block 2 (eyebrow "Signals"):
```tsx
        rows={[
          { claim: 'messages(), status(), error() — live signals', api: 'signal-native handle' },
          { claim: 'Human-in-the-loop gates', api: 'interrupt()' },
          { claim: 'Branch, history, time-travel built in', api: 'checkpoints' },
        ]}
```

`/chat` block 1 (eyebrow "Compositions"):
```tsx
        rows={[
          { claim: 'A drop-in production conversation surface', api: 'chat-timeline' },
          { claim: 'Devtools beside it, ship-ready', api: 'chat-debug' },
          { claim: 'Thread navigation and history search', api: 'sidenav + palette' },
        ]}
```

`/chat` block 2 (eyebrow "Headless"):
```tsx
        rows={[
          { claim: 'Unstyled primitives, your design tokens', api: 'message + tool primitives' },
          { claim: 'The approval gate as a component', api: 'interrupt primitive' },
          { claim: 'Composes against the streaming contract', api: 'Agent contract' },
        ]}
```

`/ag-ui` block 1 (eyebrow "Runtime choice"):
```tsx
        rows={[
          { claim: 'Stream from Python, .NET, or TypeScript', api: 'AG-UI protocol' },
          { claim: 'Tool calls, state deltas, citations — standardized', api: 'protocol events' },
          { claim: 'New AG-UI runtimes work day one', api: 'no adapter needed' },
        ]}
```

`/ag-ui` block 2 (eyebrow "Same primitives"):
```tsx
        rows={[
          { claim: 'Same names across adapters', api: 'provideAgent + injectAgent' },
          { claim: 'Same components, themes, citations', api: '@threadplane/chat' },
          { claim: 'Same deterministic testing', api: 'MockAgentTransport' },
        ]}
```

`/render` block 1 (eyebrow "Schemas"):
```tsx
        rows={[
          { claim: 'One spec, rendered by components you own', api: 'component registry' },
          { claim: 'Both protocols spoken', api: 'json-render + A2UI' },
          { claim: 'Schema on the server, validation in the client', api: 'validated specs' },
        ]}
```

`/render` block 2 (eyebrow "Fallbacks"):
```tsx
        rows={[
          { claim: 'Unknown components degrade, not crash', api: 'fallback API' },
          { claim: 'Renders hold until the surface is real', api: 'readiness gate' },
          { claim: 'Partial renders while streaming', api: 'streaming specs' },
        ]}
```

`/pilot-to-prod` block 1 (eyebrow "Week 1–2 · Discover"):
```tsx
        rows={[
          { claim: 'Audit your surfaces and agent-eligible workflows', api: 'stack audit' },
          { claim: 'Pick the one or two agents that earn their keep', api: 'roadmap' },
          { claim: 'Auth, residency, observability locked early', api: 'workshops' },
        ]}
```

`/pilot-to-prod` block 2 (eyebrow "Week 3–5 · Build"):
```tsx
        rows={[
          { claim: 'A working agent on your real data', api: 'your repo, your engineers' },
          { claim: 'Streaming surface from the chat compositions', api: '@threadplane/chat' },
          { claim: 'Weekly demos to stakeholders', api: 'open progress' },
        ]}
```

`/pilot-to-prod` block 3 (eyebrow "Week 6–7 · Harden"):
```tsx
        rows={[
          { claim: 'Tracing, metrics, error budgets', api: 'OpenTelemetry hooks' },
          { claim: 'Fallbacks across every agent surface', api: 'readiness + fallback' },
          { claim: 'Load tested, on-call ready', api: 'runbook, yours' },
        ]}
```

- [ ] **Step 2: Verify zero legacy usages remain**

Run: `grep -rn 'bullets=\|supportingCards=' apps/website/src`
Expected: no matches anywhere.

- [ ] **Step 3: Suite, then commit**

Run: `cd apps/website && npx vitest run --config vite.config.mts` → PASS (no
page spec asserts the removed bullet strings — verified at plan time; if one
fails, update ONLY the stale assertion and report it).

```bash
git add apps/website/src/app
git commit -m "feat(website): migrate five pages to FeatureBlock rows"
```

---

### Task 4: Delete the legacy path — `rows` becomes required

**Files:**
- Modify: `apps/website/src/components/landing/FeatureBlock.tsx`
- Modify: `apps/website/src/components/landing/FeatureBlock.spec.tsx`
- Modify: `apps/website/src/styles/landing.css`

- [ ] **Step 1: Update the spec FIRST**

In `FeatureBlock.spec.tsx`: delete the `'bullets variant …'` test entirely.
In the rows test, drop the now-meaningless
`expect(container.querySelector('.feature-block-bullets')).toBeNull();`
assertion (the class won't exist) but KEEP the card-row-null and rail-present
assertions. Add to the rows test:

```tsx
    expect(container.querySelectorAll('.feature-block-row')).toHaveLength(2);
```

- [ ] **Step 2: FeatureBlock.tsx**

- Interface: `rows: FeatureRow[];` (required); DELETE `bullets` and
  `supportingCards` and their doc comments; update the `rows` doc comment to
  drop "Mutually exclusive…".
- Destructuring: remove `bullets`, `supportingCards`.
- JSX: the `rows ?` ternaries collapse — the rail eyebrow and the
  `.feature-block-rows` block render unconditionally; the bullets `<ul>`,
  the card row, and the `<>` fragment are deleted.
- Remove the now-unused `Card` import.

- [ ] **Step 3: landing.css**

Delete `.feature-block-bullets`, `.feature-block-bullet`,
`.feature-block-bullet-check`, `.feature-block-card-row`,
`.feature-block-card-title`, `.feature-block-card-desc` rules (grep
`feature-block-bullet\|feature-block-card` — remove all hits; nothing else).

- [ ] **Step 4: Type-check the whole app compiles (the five pages must satisfy required `rows`)**

Run: `cd apps/website && npx vitest run --config vite.config.mts` → PASS.
Then from repo root: `npx nx build website --configuration=production` → success.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src
git commit -m "refactor(website): delete FeatureBlock legacy bullets+cards path"
```

---

### Task 5: Verification gate

- [ ] **Step 1:** Full suite → paste summary. Prod build → exit 0.
- [ ] **Step 2:** Visual pass (Browser pane, `website-dev`): homepage hero at
  1440px and 375px — ONE capability row, links hover, visible on mobile, no
  horizontal scroll (measure via DOM at emulated width; hidden-pane
  screenshots lie). `/langgraph` and `/pilot-to-prod` at 1440px — rows render,
  no empty bullet/card scaffolding, rail kickers present.
- [ ] **Step 3:** Click-through sanity: the six hero links resolve (fetch each
  href against the dev server, expect 200).
- [ ] **Step 4:** Commit any fixes; stop. No push/PR — separate decision.

## Deviations that require stopping

- Any consumer of `HERO_CHIPS` outside Hero + spec (grep first).
- Any page spec failing on removed bullet strings in a way that isn't a
  one-line assertion update.
- A hero capability href 404ing against the dev server.
