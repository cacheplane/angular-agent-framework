# Homepage Narrative Funnel Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the home page into a 7-section narrative funnel (Hero → Stats → Problem → PilotSolution → TheStack → WhitePaper → StopStallingCTA).

**Architecture:** Two new client components (PilotSolution, TheStack) using the existing glassmorphism design system and framer-motion scroll animations. Reuse PilotFooterCTA for the closing CTA. Simplify page.tsx by removing 7 section imports and reducing ambient blobs.

**Tech Stack:** Next.js 16 (App Router), React 19, framer-motion, `@cacheplane/design-tokens`

**Spec:** `docs/superpowers/specs/2026-04-10-homepage-narrative-funnel-design.md`

---

### Task 1: Create PilotSolution component

**Files:**
- Create: `apps/website/src/components/landing/PilotSolution.tsx`

- [ ] **Step 1: Create PilotSolution.tsx**

```tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const STEPS = [
  {
    num: 1,
    title: 'Pilot',
    description: 'We assess your LangGraph agent and Angular codebase. You get a concrete production plan.',
  },
  {
    num: 2,
    title: 'Build',
    description: 'We work alongside your team to integrate the framework. Streaming, generative UI, testing — done right.',
  },
  {
    num: 3,
    title: 'Ship',
    description: 'Your agent goes to production with your team owning every line. No vendor lock-in, no black boxes.',
  },
];

export function PilotSolution() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.accent,
          marginBottom: 14,
        }}>
          The Solution
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontSize: 'clamp(26px, 3.5vw, 46px)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: tokens.colors.textPrimary,
          marginBottom: 10,
        }}>
          From proof of concept to production in 90 days
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          color: tokens.colors.textSecondary,
          maxWidth: 560,
          margin: '0 auto',
        }}>
          The structured pilot engagement that closes the last-mile gap.
        </p>
      </motion.div>

      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
        gap: 16,
        maxWidth: 840,
        margin: '0 auto 36px',
      }}>
        {STEPS.map((step, i) => (
          <motion.div
            key={step.num}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '28px 20px',
              textAlign: 'center',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <div style={{
              width: 32,
              height: 32,
              borderRadius: '50%',
              background: tokens.colors.accent,
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.75rem',
              fontWeight: 700,
              margin: '0 auto 14px',
            }}>
              {step.num}
            </div>
            <h3 style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '1rem',
              fontWeight: 600,
              color: tokens.colors.textPrimary,
              marginBottom: 8,
            }}>
              {step.title}
            </h3>
            <p style={{
              fontSize: '0.82rem',
              color: tokens.colors.textSecondary,
              lineHeight: 1.5,
            }}>
              {step.description}
            </p>
          </motion.div>
        ))}
      </div>

      <div style={{ textAlign: 'center' }}>
        <Link
          href="/pilot-to-prod"
          style={{
            display: 'inline-block',
            padding: '0.875rem 2rem',
            background: tokens.colors.accent,
            color: '#fff',
            fontFamily: 'Inter, sans-serif',
            fontSize: 15,
            fontWeight: 600,
            textDecoration: 'none',
            borderRadius: 6,
          }}
        >
          Explore the Pilot Program →
        </Link>
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.62rem',
          color: tokens.colors.textMuted,
          marginTop: 12,
          letterSpacing: '0.06em',
        }}>
          Included with every app deployment license
        </p>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd apps/website && npx next build 2>&1 | head -30`

If there are type errors, fix them. The component should compile without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/PilotSolution.tsx
git commit -m "feat(website): add PilotSolution component for home page"
```

---

### Task 2: Create TheStack component

**Files:**
- Create: `apps/website/src/components/landing/TheStack.tsx`

- [ ] **Step 1: Create TheStack.tsx**

```tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const LIBRARIES = [
  {
    id: 'angular',
    tag: 'Agent',
    pkg: '@cacheplane/angular',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'The reactive bridge to LangGraph',
    description: 'Signal-native streaming connects your Angular templates directly to LangGraph agent state. Interrupts, persistence, time-travel, and branch history — every LangGraph feature has a first-class Angular API. Test deterministically with MockAgentTransport.',
    pills: ['Angular Signals', 'LangGraph Cloud', 'MockAgentTransport'],
    href: '/angular',
    ctaLabel: 'Explore Agent',
  },
  {
    id: 'render',
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: tokens.colors.renderGreen,
    rgb: '26,122,64',
    headline: 'Agents that render UI — on open standards',
    description: "Built on Vercel\u2019s json-render spec and Google\u2019s A2UI protocol. Your agent emits a render spec, your Angular components render it — with streaming JSON patches, component registries, and signal-native state. No coupling between agent logic and frontend.",
    pills: ['Vercel json-render', 'Google A2UI', 'JSON Patch streaming'],
    href: '/render',
    ctaLabel: 'Explore Render',
  },
  {
    id: 'chat',
    tag: 'Chat',
    pkg: '@cacheplane/chat',
    color: tokens.colors.chatPurple,
    rgb: '90,0,200',
    headline: 'Production chat UI in days, not sprints',
    description: 'Every component you need — streaming messages, tool call cards, interrupt panels, generative UI, debug overlay, theming — pre-built, composable, and WCAG accessible. Built on the Agent and Render libraries so everything works together from day one.',
    pills: ['<chat-messages>', '<chat-debug>', 'WCAG accessible'],
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
];

function Connector({ fromRgb, toRgb }: { fromRgb: string; toRgb: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div style={{
        width: 2,
        height: 28,
        background: `linear-gradient(to bottom, rgba(${fromRgb}, 0.3), rgba(${toRgb}, 0.3))`,
        borderRadius: 1,
      }} />
    </div>
  );
}

export function TheStack() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem',
          textTransform: 'uppercase',
          letterSpacing: '0.12em',
          fontWeight: 700,
          color: tokens.colors.accent,
          marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontSize: 'clamp(26px, 3.5vw, 46px)',
          fontWeight: 800,
          lineHeight: 1.1,
          color: tokens.colors.textPrimary,
          marginBottom: 10,
        }}>
          Three libraries. One architecture.<br />
          Every layer you need.
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic',
          fontSize: '1.05rem',
          color: tokens.colors.textSecondary,
          maxWidth: 520,
          margin: '0 auto',
        }}>
          Your LangGraph agent already works. These three libraries ship it.
        </p>
      </motion.div>

      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        {LIBRARIES.map((lib, i) => (
          <div key={lib.id}>
            {i > 0 && (
              <Connector
                fromRgb={LIBRARIES[i - 1].rgb}
                toRgb={lib.rgb}
              />
            )}
            <motion.div
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              style={{
                background: `rgba(${lib.rgb}, 0.03)`,
                border: `1px solid rgba(${lib.rgb}, 0.15)`,
                borderRadius: 14,
                padding: '28px 28px 24px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
              }}
            >
              <span style={{
                display: 'inline-block',
                alignSelf: 'flex-start',
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.58rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                padding: '2px 9px',
                borderRadius: 5,
                color: '#fff',
                background: lib.color,
              }}>
                {lib.tag}
              </span>

              <p style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.76rem',
                fontWeight: 700,
                color: lib.color,
                margin: 0,
              }}>
                {lib.pkg}
              </p>

              <h3 style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '1.3rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                lineHeight: 1.25,
                margin: 0,
              }}>
                {lib.headline}
              </h3>

              <p style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.88rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.6,
                margin: 0,
              }}>
                {lib.description}
              </p>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
                {lib.pills.map(pill => (
                  <span key={pill} style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '0.58rem',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `rgba(${lib.rgb}, 0.07)`,
                    color: lib.color,
                    border: `1px solid rgba(${lib.rgb}, 0.15)`,
                  }}>
                    {pill}
                  </span>
                ))}
              </div>

              <Link
                href={lib.href}
                style={{
                  fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                  fontSize: '0.72rem',
                  fontWeight: 700,
                  color: lib.color,
                  textDecoration: 'none',
                  marginTop: 4,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                {lib.ctaLabel} →
              </Link>
            </motion.div>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify the component compiles**

Run: `cd apps/website && npx next build 2>&1 | head -30`

If there are type errors, fix them. The component should compile without errors.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/TheStack.tsx
git commit -m "feat(website): add TheStack component for home page"
```

---

### Task 3: Update PilotFooterCTA primary CTA href

**Files:**
- Modify: `apps/website/src/components/landing/PilotFooterCTA.tsx:91-93`

- [ ] **Step 1: Change the primary CTA href from `#whitepaper-gate` to `/pilot-to-prod`**

In `apps/website/src/components/landing/PilotFooterCTA.tsx`, find:

```tsx
            href="#whitepaper-gate"
```

Replace with:

```tsx
            href="/pilot-to-prod"
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/PilotFooterCTA.tsx
git commit -m "fix(website): update PilotFooterCTA primary CTA to link to pilot page"
```

---

### Task 4: Rewrite page.tsx with new flow

**Files:**
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Replace page.tsx with the new narrative funnel flow**

Replace the entire contents of `apps/website/src/app/page.tsx` with:

```tsx
import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { StatsStrip } from '../components/landing/StatsStrip';
import { ProblemSection } from '../components/landing/ProblemSection';
import { PilotSolution } from '../components/landing/PilotSolution';
import { TheStack } from '../components/landing/TheStack';
import { WhitePaperSection } from '../components/landing/WhitePaperSection';
import { PilotFooterCTA } from '../components/landing/PilotFooterCTA';
import { tokens } from '../../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: tokens.gradient.warm, top: 2200, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: 3800, right: '20%', filter: 'blur(70px)', pointerEvents: 'none' }} aria-hidden="true" />

      {/* 1. Hook — headline, animation, CTA */}
      <HeroTwoCol />
      {/* 2. Trust — quick credibility stats */}
      <StatsStrip />
      {/* 3. Problem — last-mile gap narrative */}
      <ProblemSection />
      {/* 4. Solution — pilot-to-prod program */}
      <PilotSolution />
      {/* 5. Product — the three-library stack */}
      <TheStack />
      {/* 6. Lead gen — whitepaper download */}
      <WhitePaperSection />
      {/* 7. Final CTA — "Ready to stop stalling?" */}
      <PilotFooterCTA />
    </div>
  );
}
```

- [ ] **Step 2: Build and verify**

Run: `cd apps/website && npx next build 2>&1 | tail -20`

Expected: Build succeeds. No type errors. No missing imports.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat(website): rewrite home page with narrative funnel flow

Replaces 11-section layout with 7-section funnel:
Hero → Stats → Problem → PilotSolution → TheStack → WhitePaper → StopStallingCTA

Removes: LibrariesSection, ChatFeaturesSection, ValueProps,
LangGraphShowcase, DeepAgentsShowcase, HomePilotCTA, ArchDiagram"
```

---

### Task 5: Visual verification and final build

- [ ] **Step 1: Full build check**

Run: `cd apps/website && npx next build`

Expected: Build succeeds with no errors and no warnings related to the changed files.

- [ ] **Step 2: Run dev server and verify page loads**

Run: `cd apps/website && npx next dev -p 3100 &`

Then run: `curl -s http://localhost:3100 | head -50`

Expected: HTML response containing the new section content. Kill the dev server after.

- [ ] **Step 3: Verify no unused import warnings**

Run: `cd apps/website && npx next lint 2>&1 | grep -i "page\|PilotSolution\|TheStack\|PilotFooterCTA" || echo "No lint issues"`

Expected: No lint errors on the changed files.
