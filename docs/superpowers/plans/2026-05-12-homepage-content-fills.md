# Homepage content fills Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Editorial pass on three Phase-4 landing components — fill the gaps identified in the analysis: missing ProofStrip claim line, redundant adapter signal, undersold npm signal, two overlapping Promises (now consolidated), two new Promises (telemetry, model lock-in), softened FAQ Q1/Q7, and three new FAQ entries (migration, SSR, testing).

**Architecture:** Pure content edits to three React Server Component files. No new components, no new dependencies, no schema changes. ProofStrip gains one new `<p>` element above the existing grid; Promises and HomeFAQ are data-array swaps. Verification is visual (preview server) plus TypeScript build.

**Tech Stack:** TypeScript, Next.js 16 RSC, `@ngaf/design-tokens`, existing UI primitives (`Section`, `Container`, `Eyebrow`, `Card`, `FAQ`).

**Spec:** `docs/superpowers/specs/2026-05-12-homepage-content-fills-design.md`

---

## File Structure

Three files modified, no files created:

- `apps/website/src/components/landing/ProofStrip.tsx` — add claim line `<p>`, edit two entries in `SIGNALS`
- `apps/website/src/components/landing/Promises.tsx` — full `PROMISES` array replacement
- `apps/website/src/components/landing/HomeFAQ.tsx` — full `ITEMS` array replacement (8 → 11 entries, Q1 and Q7 reworded, Q9/Q10/Q11 appended)

Each task is one file = one commit. After all three commits, one verification pass against the preview server and the TypeScript build.

---

## Task 1: ProofStrip — claim line + signal #3 + signal #5

**Files:**
- Modify: `apps/website/src/components/landing/ProofStrip.tsx`

- [ ] **Step 1: Open the file and locate the `SIGNALS` array (lines 13–19)**

Replace the third entry. Current:

```ts
{ label: 'LangGraph + AG-UI', value: 'Two adapters', href: null },
```

Replace with:

```ts
{ label: 'Adapter contract', value: 'LangGraph + AG-UI + your own', href: null },
```

- [ ] **Step 2: Replace the fifth entry in `SIGNALS`**

Current:

```ts
{ label: 'On npm', value: '@ngaf/chat', href: 'https://www.npmjs.com/package/@ngaf/chat' },
```

Replace with:

```ts
{ label: 'On npm', value: '@ngaf/* — 7 packages', href: 'https://www.npmjs.com/search?q=%40ngaf' },
```

- [ ] **Step 3: Add the claim line in the JSX**

Locate the `Eyebrow` block (currently around line 54). Immediately after the closing `</Eyebrow>` tag and before the signals grid `<div>`, insert a centered `<p>` element. The full replacement region (from `<Eyebrow ...>` through the opening of the signals grid `<div>`) should look like:

```tsx
        <Eyebrow style={{ textAlign: 'center', marginBottom: 12 }}>
          Built in the open
        </Eyebrow>
        <p
          style={{
            fontFamily: tokens.typography.bodyLg.family,
            fontSize: tokens.typography.bodyLg.size,
            lineHeight: tokens.typography.bodyLg.line,
            fontWeight: 600,
            color: tokens.colors.textPrimary,
            textAlign: 'center',
            margin: 0,
            marginBottom: 20,
          }}
        >
          Open code, open packages, a live reference app.
        </p>
        <div
          style={{
            display: 'grid',
```

Note two changes from the prior layout:
1. `Eyebrow`'s `marginBottom` drops from `20` → `12` (the claim line now carries the gap below it).
2. The new `<p>` has `marginBottom: 20` so the total visual gap above the grid is unchanged.

- [ ] **Step 4: Verify the diff is clean**

Run:

```bash
git diff apps/website/src/components/landing/ProofStrip.tsx
```

Expected: changes to lines in `SIGNALS` entries 3 and 5, the `Eyebrow` `marginBottom` value, and a new `<p>` element. No other lines changed.

- [ ] **Step 5: TypeScript check**

Run:

```bash
npx nx run website:lint --no-cloud 2>&1 | tail -20
```

Expected: no new lint errors introduced by this change.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/ProofStrip.tsx
git commit -m "feat(website): polish ProofStrip — claim line, adapter signal, npm scope"
```

---

## Task 2: Promises — 5-card refresh

**Files:**
- Modify: `apps/website/src/components/landing/Promises.tsx`

- [ ] **Step 1: Replace the `PROMISES` array (lines 7–13)**

Current:

```ts
const PROMISES = [
  { title: 'No vendor lock-in', body: 'MIT today, MIT tomorrow. Use without us.' },
  { title: 'No paid Angular tier', body: 'The libraries stay open. Pilot-to-Prod is the only paid offering.' },
  { title: 'No abandoned majors', body: 'We follow Angular’s LTS. When Angular ships, we ship.' },
  { title: 'No closed primitives', body: 'Headless primitives stay in the open repo.' },
  { title: 'No required cloud', body: 'Self-host LangGraph + your Angular app. No phone-home.' },
];
```

Replace with:

```ts
const PROMISES = [
  {
    title: 'No closed core',
    body: 'MIT today, MIT tomorrow. Primitives and compositions both stay in the open repo. Pilot-to-Prod is the only paid thing.',
  },
  {
    title: 'No abandoned majors',
    body: 'We follow Angular’s LTS. When Angular ships, we ship.',
  },
  {
    title: 'No required cloud',
    body: 'Self-host LangGraph + your Angular app. Run it all in your VPC.',
  },
  {
    title: 'No telemetry',
    body: 'We don’t collect anything from your app. Not at install, not at runtime.',
  },
  {
    title: 'No model lock-in',
    body: 'Adapters work with any LLM your runtime supports. Swap providers without changing Angular code.',
  },
];
```

Note: the apostrophes in `Angular's`, `don't`, and `you're` use the curly Unicode character (`’`), matching the existing file's style (e.g. `Angular's` on line 11 already uses `’`).

- [ ] **Step 2: Verify the diff is clean**

Run:

```bash
git diff apps/website/src/components/landing/Promises.tsx
```

Expected: only the `PROMISES` array content changed. JSX and styling untouched.

- [ ] **Step 3: TypeScript check**

Run:

```bash
npx nx run website:lint --no-cloud 2>&1 | tail -20
```

Expected: no new lint errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/Promises.tsx
git commit -m "feat(website): refresh Promises — consolidate openness beats, add telemetry + model lock-in"
```

---

## Task 3: HomeFAQ — Q1/Q7 reword + Q9/Q10/Q11 append

**Files:**
- Modify: `apps/website/src/components/landing/HomeFAQ.tsx`

- [ ] **Step 1: Replace the `ITEMS` array (lines 7–40)**

Full replacement of the `const ITEMS: FAQItem[] = [...]` block. Replace with:

```ts
const ITEMS: FAQItem[] = [
  {
    q: 'How is this different from CopilotKit or AG-UI directly?',
    a: 'CopilotKit has an Angular SDK; we made different choices (signals, DI, zoneless-first). AG-UI is a protocol, not a UI library — you still build the Angular side. Angular Agent Framework gives you signal-native primitives plus adapters that hide the protocol, so you can swap LangGraph for AG-UI without rewriting your UI.',
  },
  {
    q: 'Does it work with my existing Angular app?',
    a: 'Yes. Drop provideAgent (or provideAgUiAgent) into your app.config.ts. The headless primitives don’t impose any UI; the chat compositions are opt-in.',
  },
  {
    q: 'Is it zoneless-compatible?',
    a: 'Yes. All signal flows are zoneless-safe. We test against zoneless apps.',
  },
  {
    q: 'Can I use this without LangGraph?',
    a: 'Yes. Use the @ngaf/ag-ui adapter for any AG-UI compliant backend, or implement the agent contract yourself. The Angular side doesn’t know which runtime is behind it.',
  },
  {
    q: 'Is the Pilot-to-Prod program required?',
    a: 'No. The libraries are MIT-licensed and complete on their own. Pilot-to-Prod is for teams who want concierge delivery, not a paywall.',
  },
  {
    q: 'What does it cost?',
    a: 'Libraries: free, MIT. Pilot-to-Prod: scoped per engagement — see the pricing page.',
  },
  {
    q: 'Is this production-ready today?',
    a: 'It runs the full stack in our reference deployment (cockpit.cacheplane.ai), and breaking changes are called out in release notes. We track current and previous Angular majors.',
  },
  {
    q: 'Where do I report issues?',
    a: 'GitHub Issues. Pilot customers also get a private channel.',
  },
  {
    q: 'I’m using CopilotKit today — how hard is the migration?',
    a: 'Component-by-component. useChat-style hooks map to the agent() signal API; actions map to LangGraph/AG-UI tool calls. Thread state lives in a service (not the component tree), so plan a session to port that. There isn’t a one-shot codemod.',
  },
  {
    q: 'Does it work with Angular Universal / SSR?',
    a: 'Streaming is client-side by design — agents are stateful and signal-based. If your shell is SSR’d, the chat compositions render with a loading state on the server and hydrate; the agent-talking parts stay client-only.',
  },
  {
    q: 'How do I test agent-driven components?',
    a: 'The agent is provided through Angular DI, so test doubles work the way you’re used to — supply a stub agent in your test module, drive it with signals, assert on the rendered output. See /docs/agent/guides/testing.',
  },
];
```

Notes on what's different vs the existing array:
- Q1 body is reworded (the "CopilotKit ports React patterns" claim is softened).
- Q2 through Q6 are byte-identical to the current file.
- Q7 body is reworded (drops the unqualified "Yes —", lets the evidence carry).
- Q8 is byte-identical to the current file.
- Q9, Q10, Q11 are new.

Apostrophes use the curly Unicode `’` to match the existing file (e.g. `Angular’s` on line 34 of the current file).

In the FAQ answer copy, `useChat`, `agent()`, `provideAgent`, `provideAgUiAgent`, `@ngaf/ag-ui` are written as plain text (not backtick-fenced inline code) because the existing answers (Q2, Q4) follow that convention. The `FAQ` primitive isn't rich-text; the strings render as plain text.

- [ ] **Step 2: Verify the diff is clean**

Run:

```bash
git diff apps/website/src/components/landing/HomeFAQ.tsx
```

Expected: only the `ITEMS` array changed. Component JSX and `Section`/`Container`/`Eyebrow` markup untouched. Line count grows (~33 lines).

- [ ] **Step 3: TypeScript check**

Run:

```bash
npx nx run website:lint --no-cloud 2>&1 | tail -20
```

Expected: no new lint errors. Strings with apostrophes (`don’t`, `isn’t`, `you’re`, `Angular’s`) shouldn't trip `react/no-unescaped-entities` because the existing file already uses the curly form.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/HomeFAQ.tsx
git commit -m "feat(website): expand HomeFAQ — soften CopilotKit + production claims, add migration/SSR/testing"
```

---

## Task 4: Verification (preview + build)

**Files:** none (verification only)

- [ ] **Step 1: Start the preview server**

If a preview is not already running, start it:

```bash
# Use the preview_start MCP tool (do not start via Bash):
#   preview_start with command "npx nx run website:dev"
```

Expected: server boots, homepage at `/` renders.

- [ ] **Step 2: Visually verify ProofStrip**

Navigate to `/`. Scroll to the section directly below the hero (`Built in the open`).

Confirm:
- The `Built in the open` eyebrow is followed by the new claim line `Open code, open packages, a live reference app.` (centered, weight 600, textPrimary).
- The third signal card now reads `Adapter contract` / `LangGraph + AG-UI + your own`.
- The fifth signal card now reads `On npm` / `@ngaf/* — 7 packages`, and clicking it opens `https://www.npmjs.com/search?q=%40ngaf` in a new tab with results.

Capture a screenshot of the ProofStrip section for the PR description.

- [ ] **Step 3: Visually verify Promises**

Scroll to the `What we won't do.` section.

Confirm five cards in this order:
1. No closed core
2. No abandoned majors
3. No required cloud
4. No telemetry
5. No model lock-in

Each body reads as drafted in Task 2. No old cards (`No vendor lock-in`, `No paid Angular tier`, `No closed primitives`) remain.

- [ ] **Step 4: Visually verify HomeFAQ**

Scroll to `Frequently asked questions.`

Confirm 11 entries total, in this order:
1. How is this different from CopilotKit or AG-UI directly?
2. Does it work with my existing Angular app?
3. Is it zoneless-compatible?
4. Can I use this without LangGraph?
5. Is the Pilot-to-Prod program required?
6. What does it cost?
7. Is this production-ready today?
8. Where do I report issues?
9. I'm using CopilotKit today — how hard is the migration?
10. Does it work with Angular Universal / SSR?
11. How do I test agent-driven components?

Expand Q1 — verify it reads as the new softened text (no "ports React patterns").
Expand Q7 — verify it does NOT start with "Yes —" and references release notes.
Expand Q11 — verify the `/docs/agent/guides/testing` reference is present.

- [ ] **Step 5: Verify the testing-doc link resolves**

In the same preview server, navigate to `/docs/agent/guides/testing`.

Expected: the testing guide page renders (it's at `apps/website/content/docs/agent/guides/testing.mdx`).

- [ ] **Step 6: Verify the pricing-page link from Q6 resolves**

Navigate to `/pricing`. Expected: pricing page renders (file exists at `apps/website/src/app/pricing/page.tsx`).

- [ ] **Step 7: Run the full TypeScript build**

```bash
npx nx run website:build --no-cloud 2>&1 | tail -30
```

Expected: build succeeds with no new TS errors.

- [ ] **Step 8: Stop the preview server**

Use the `preview_stop` MCP tool.

---

## Self-review notes

**Spec coverage check:**
- ProofStrip claim line → Task 1, Step 3 ✓
- ProofStrip signal #3 → Task 1, Step 1 ✓
- ProofStrip signal #5 → Task 1, Step 2 ✓
- Promises 5-card refresh (collapse + 2 new) → Task 2 ✓
- HomeFAQ Q1 reword → Task 3, Step 1 ✓
- HomeFAQ Q7 reword → Task 3, Step 1 ✓
- HomeFAQ Q9/Q10/Q11 adds → Task 3, Step 1 ✓
- Pricing-page link verification (spec verification §2) → Task 4, Step 6 ✓
- Testing-doc link verification → Task 4, Step 5 ✓
- TS build → Task 4, Step 7 ✓

**Out-of-scope items flagged in spec, not in plan:**
- Broken `/docs/agent/guides/production` link in the Ship FeatureBlock — left for a separate fix.
