# Home Positioning Strip Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace `StatsStrip` (the section directly below the hero on `/`) with a four-card differentiator-focused `PositioningStrip`.

**Architecture:** New presentational Angular-website React component that renders a 4-cell glass-card grid (RUNTIME / STREAMING / GENERATIVE UI / LICENSE) using existing `tokens.glass` styles and `framer-motion` staggered fade-in. Page-level swap in `apps/website/src/app/page.tsx`. Delete the old `StatsStrip` component. No new design tokens, no new dependencies.

**Tech Stack:** Next.js (apps/website), React, TypeScript, framer-motion, `@ngaf/design-tokens` (`tokens.glass`, `tokens.colors`).

**Spec:** `docs/superpowers/specs/2026-05-01-home-stats-strip-redesign.md`

---

## File Structure

- **Create:** `apps/website/src/components/landing/PositioningStrip.tsx` — new component, single responsibility: render the 4 differentiator cards.
- **Delete:** `apps/website/src/components/landing/StatsStrip.tsx` — replaced wholesale.
- **Modify:** `apps/website/src/app/page.tsx` — swap import and JSX usage; update inline comment on the relevant line.

No tests are added: this is a purely presentational component matching the same convention used by sibling components in `apps/website/src/components/landing/` (e.g. `ProblemSection.tsx`, `TheStack.tsx` — none ship unit tests). Verification is done in-browser via the preview tools per repo convention.

---

## Task 1: Create PositioningStrip component

**Files:**
- Create: `apps/website/src/components/landing/PositioningStrip.tsx`

- [ ] **Step 1: Create the component file**

Write the file with the exact contents below. The four cards are defined in a `CARDS` array so the JSX is a single map. Inline `<code>` spans use `var(--font-mono)` to match the rest of the site.

```tsx
'use client';
import { motion } from 'framer-motion';
import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';

interface Card {
  eyebrow: string;
  headline: string;
  body: ReactNode;
}

const CARDS: Card[] = [
  {
    eyebrow: 'Runtime',
    headline: 'One Angular UI. Any agent runtime.',
    body: 'Same primitives drive LangGraph, AG-UI, CrewAI, Mastra, Pydantic AI, AWS Strands, and your own backend.',
  },
  {
    eyebrow: 'Streaming',
    headline: 'Full-parity LangGraph streaming.',
    body: (
      <>
        <code style={{ fontFamily: 'var(--font-mono)' }}>agent()</code> ships everything React&apos;s{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>useStream()</code> does — interrupt, subagents, branch and history, tool progress — plus{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>error()</code>,{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>status()</code>, and{' '}
        <code style={{ fontFamily: 'var(--font-mono)' }}>reload()</code>.
      </>
    ),
  },
  {
    eyebrow: 'Generative UI',
    headline: 'Generative UI, built in.',
    body: (
      <>
        Render Vercel <code style={{ fontFamily: 'var(--font-mono)' }}>json-render</code> and Google A2UI specs into Angular components. No second framework to bolt on.
      </>
    ),
  },
  {
    eyebrow: 'License',
    headline: 'MIT. Headless primitives, drop-in compositions.',
    body: 'No tier gates on Angular. Use the unstyled primitives, or the opinionated chat shell — your call.',
  },
];

export function PositioningStrip() {
  return (
    <section
      aria-labelledby="positioning-heading"
      style={{ maxWidth: 1040, margin: '0 auto', padding: '64px 32px' }}
    >
      <h2
        id="positioning-heading"
        style={{
          position: 'absolute',
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: 'hidden',
          clip: 'rect(0,0,0,0)',
          whiteSpace: 'nowrap',
          border: 0,
        }}
      >
        What makes the Angular Agent Framework different
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}
      >
        {CARDS.map((card, i) => (
          <motion.article
            key={card.eyebrow}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.4 }}
            style={{
              padding: '24px 22px',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '0.7rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: tokens.colors.accent,
                margin: 0,
              }}
            >
              {card.eyebrow}
            </p>
            <h3
              style={{
                fontFamily: 'var(--font-garamond)',
                fontSize: 'clamp(18px, 1.6vw, 22px)',
                fontWeight: 700,
                lineHeight: 1.2,
                color: tokens.colors.textPrimary,
                margin: 0,
              }}
            >
              {card.headline}
            </h3>
            <p
              style={{
                fontSize: '0.9rem',
                lineHeight: 1.55,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}
            >
              {card.body}
            </p>
          </motion.article>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify the file compiles in isolation**

Run: `npx tsc --noEmit -p apps/website/tsconfig.json`
Expected: no new TypeScript errors referencing `PositioningStrip.tsx`. (Pre-existing errors elsewhere are out of scope; only fail on errors in the new file.)

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/PositioningStrip.tsx
git commit -m "feat(website): add PositioningStrip component"
```

---

## Task 2: Wire PositioningStrip into the home page and remove StatsStrip

**Files:**
- Modify: `apps/website/src/app/page.tsx`
- Delete: `apps/website/src/components/landing/StatsStrip.tsx`

- [ ] **Step 1: Replace the import in `page.tsx`**

In `apps/website/src/app/page.tsx`, change line 2 from:

```tsx
import { StatsStrip } from '../components/landing/StatsStrip';
```

to:

```tsx
import { PositioningStrip } from '../components/landing/PositioningStrip';
```

- [ ] **Step 2: Replace the JSX usage and update its comment**

In the same file, change the block currently at lines 21–22:

```tsx
      {/* 2. Trust — quick credibility stats */}
      <StatsStrip />
```

to:

```tsx
      {/* 2. Differentiation — positioning vs other agent UIs */}
      <PositioningStrip />
```

Leave the rest of the file unchanged.

- [ ] **Step 3: Delete the old component file**

Run: `git rm apps/website/src/components/landing/StatsStrip.tsx`
Expected: file removed; no other files reference `StatsStrip` (verify with `git grep StatsStrip` — should return nothing).

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit -p apps/website/tsconfig.json`
Expected: no errors mentioning `StatsStrip` or `PositioningStrip`.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat(website): swap StatsStrip for PositioningStrip on home"
```

---

## Task 3: Visual verification in the dev server

**Files:** none (verification only)

- [ ] **Step 1: Start the dev server**

Use `preview_start` for the website app (working directory: repo root, command per the website package — typically `npm run dev -w apps/website` or the equivalent Nx target `nx serve website`). Confirm the server is up.

- [ ] **Step 2: Navigate to `/` and capture desktop snapshot**

Use `preview_snapshot` at default viewport. Verify:
- Hero renders unchanged.
- Below the hero: 4 cards in a row (or 2×2 if viewport is below ~1040 + padding).
- Each card shows: uppercase eyebrow (RUNTIME / STREAMING / GENERATIVE UI / LICENSE), serif headline, secondary body text.
- Inline code in the STREAMING and GENERATIVE UI cards renders in monospace.

- [ ] **Step 3: Check console and network for regressions**

Use `preview_console_logs` and `preview_network`. Expected: no new errors compared to a baseline `/` load. Framer-motion's `whileInView` should not warn.

- [ ] **Step 4: Test responsive layout**

Use `preview_resize` to 1280px (desktop, 4-up), 900px (tablet, expect 2-up since `minmax(240px, 1fr)` allows 3 only above ~1000px of available track), and 480px (mobile, 1-up). Take a snapshot at each. Verify no horizontal scroll, no overflow, and headlines do not truncate awkwardly.

- [ ] **Step 5: Capture screenshot proof**

Use `preview_screenshot` at the default desktop viewport, scoped to the positioning section. Save evidence for the PR description.

- [ ] **Step 6: Stop the dev server**

Use `preview_stop`.

---

## Self-review notes

- **Spec coverage:** All four cards in the spec's "Copy (exact text)" section are present verbatim in `CARDS`. Order matches spec: RUNTIME → STREAMING → GENERATIVE UI → LICENSE. Visual treatment (glass tokens, 18px radius, staggered motion, `auto-fit minmax(240px, 1fr)` grid, `max-width: 1040px`, `padding: 64px 32px`) matches the spec's "Visual treatment" section. Accessibility: `aria-labelledby` plus visually-hidden `<h2>`, `<article>` per card, `<h3>` headline, mono `<code>` for identifiers — matches spec.
- **Placeholder scan:** No TBD/TODO. All code blocks are complete.
- **Type consistency:** `Card` interface used once locally; `CARDS` is the only consumer. No cross-task type drift.
- **Out of scope per spec:** ProblemSection, hero, lower sections — unchanged.
