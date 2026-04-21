# Solutions Landing Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build 4 new pages — `/solutions` (index), `/solutions/compliance`, `/solutions/analytics`, `/solutions/customer-support` — as enterprise GTM-focused landing pages showing how all 3 Cacheplane libraries work together for specific use cases.

**Architecture:** A shared data layer (`SolutionConfig` type) drives parameterized React components. Individual solution pages use a Next.js dynamic `[slug]` route with `generateStaticParams()`. All components follow the existing glassmorphism design system using `@cacheplane/design-tokens`. Each solution has a unique accent color (Amber, Teal, Blue-violet) while maintaining the site's visual language.

**Tech Stack:** Next.js 15 (App Router, static export), React 19, Framer Motion, `@cacheplane/design-tokens`

---

## File Structure

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `apps/website/src/lib/solutions-data.ts` | `SolutionConfig` type + 3 solution data objects |
| Create | `apps/website/src/components/landing/solutions/SolutionHero.tsx` | Hero section with eyebrow, headline, subtitle, CTA |
| Create | `apps/website/src/components/landing/solutions/SolutionProblem.tsx` | Pain-point cards section |
| Create | `apps/website/src/components/landing/solutions/SolutionArchitecture.tsx` | 3-library architecture visual |
| Create | `apps/website/src/components/landing/solutions/SolutionProofPoints.tsx` | Proof point metric cards |
| Create | `apps/website/src/components/landing/solutions/SolutionFooterCTA.tsx` | Dark footer CTA (mirrors PilotFooterCTA pattern) |
| Create | `apps/website/src/components/landing/solutions/SolutionsGrid.tsx` | Card grid for `/solutions` index page |
| Create | `apps/website/src/app/solutions/page.tsx` | Index page at `/solutions` |
| Create | `apps/website/src/app/solutions/[slug]/page.tsx` | Dynamic route for individual solution pages |
| Modify | `apps/website/src/components/shared/Nav.tsx:8-14` | Add "Solutions" link to nav |
| Modify | `apps/website/src/components/shared/Footer.tsx:136-166` | Add Solutions column to footer |

---

### Task 1: Solutions Data Layer

**Files:**
- Create: `apps/website/src/lib/solutions-data.ts`

- [ ] **Step 1: Create the solutions data file with types and all 3 configs**

```typescript
// apps/website/src/lib/solutions-data.ts

export interface SolutionPainPoint {
  title: string;
  description: string;
}

export interface ArchitectureLayer {
  library: string;
  pkg: string;
  role: string;
}

export interface ProofPoint {
  metric: string;
  label: string;
}

export interface SolutionConfig {
  slug: string;
  color: string;
  rgb: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  painPoints: SolutionPainPoint[];
  architectureIntro: string;
  architectureLayers: ArchitectureLayer[];
  proofPoints: ProofPoint[];
  ctaHeadline: string;
  ctaSubtext: string;
  metaTitle: string;
  metaDescription: string;
}

export const SOLUTIONS: SolutionConfig[] = [
  {
    slug: 'compliance',
    color: '#D4850F',
    rgb: '212,133,15',
    eyebrow: 'Compliance & Audit',
    title: 'AI agents your compliance\nteam will actually approve',
    subtitle: 'Human-in-the-loop approvals, immutable audit trails, and deterministic testing — built into the framework, not bolted on.',
    painPoints: [
      {
        title: 'Black-box AI decisions',
        description: 'Regulators require explainability. Most agent frameworks stream opaque outputs with no audit trail.',
      },
      {
        title: 'No human gate before action',
        description: 'SOX, HIPAA, and GDPR demand human approval before consequential actions. Retrofitting interrupts is a rewrite.',
      },
      {
        title: 'Untestable agent behavior',
        description: 'Compliance needs reproducible test evidence. Non-deterministic LLM calls make that nearly impossible without the right tooling.',
      },
    ],
    architectureIntro: 'Three libraries give your compliance team what they need — without slowing your engineering team down.',
    architectureLayers: [
      {
        library: 'Agent',
        pkg: '@cacheplane/langgraph',
        role: 'Signal-native streaming with first-class interrupt support. Every agent action can require human approval before execution. Thread persistence gives you a complete, immutable history of every decision.',
      },
      {
        library: 'Render',
        pkg: '@cacheplane/render',
        role: 'Approval workflows rendered as structured UI — not chat messages. The agent proposes an action, renders a confirmation card, and waits for the human gate before proceeding.',
      },
      {
        library: 'Chat',
        pkg: '@cacheplane/chat',
        role: 'Debug overlay shows every tool call, interrupt, and state transition. Your compliance team can review exactly what happened, when, and why — in a UI they can understand.',
      },
    ],
    proofPoints: [
      { metric: '100%', label: 'Audit trail coverage — every agent action logged' },
      { metric: '0', label: 'Unapproved actions — interrupt gates block execution' },
      { metric: '<5 min', label: 'Time to reproduce any agent decision for auditors' },
    ],
    ctaHeadline: 'Ship compliant AI agents — without the compliance tax',
    ctaSubtext: 'Download the guide or start a pilot. Your compliance team will thank you.',
    metaTitle: 'Compliance & Audit — Angular Agent Framework Solutions',
    metaDescription: 'Ship AI agents with human-in-the-loop approvals, audit trails, and deterministic testing. Built for SOX, HIPAA, and GDPR.',
  },
  {
    slug: 'analytics',
    color: '#0F7B8D',
    rgb: '15,123,141',
    eyebrow: 'Analytics & BI',
    title: 'Natural language queries.\nReal-time dashboards.',
    subtitle: 'Your users ask questions in plain English. The agent queries, visualizes, and streams results — all inside your Angular app.',
    painPoints: [
      {
        title: 'BI tools users won\'t adopt',
        description: 'Complex dashboards with steep learning curves. Business users want answers, not another tool to learn.',
      },
      {
        title: 'Static reports, stale data',
        description: 'Pre-built dashboards can\'t answer ad-hoc questions. By the time a report is built, the question has changed.',
      },
      {
        title: 'Chat-only AI interfaces',
        description: 'Text answers aren\'t enough for data. Users need charts, tables, and interactive visualizations — streamed in real time.',
      },
    ],
    architectureIntro: 'Three libraries turn your LangGraph agent into a conversational BI tool your business users will actually use.',
    architectureLayers: [
      {
        library: 'Agent',
        pkg: '@cacheplane/langgraph',
        role: 'Streams query results token-by-token as the LangGraph agent reasons over your data. Thread persistence means users can refine questions without re-running expensive queries.',
      },
      {
        library: 'Render',
        pkg: '@cacheplane/render',
        role: 'The agent emits chart specs, data tables, and KPI cards as structured render specs. Your Angular components render them with streaming JSON patches — live-updating visualizations as data arrives.',
      },
      {
        library: 'Chat',
        pkg: '@cacheplane/chat',
        role: 'Pre-built generative UI panel renders charts and tables inline with the conversation. Users ask follow-up questions and see updated visualizations without leaving the chat.',
      },
    ],
    proofPoints: [
      { metric: '10x', label: 'Faster time-to-insight vs. traditional BI dashboards' },
      { metric: '0', label: 'SQL required — business users query in plain English' },
      { metric: '<2s', label: 'First visual streamed — no waiting for full query completion' },
    ],
    ctaHeadline: 'Turn your data into conversations',
    ctaSubtext: 'Download the guide or start a pilot. Ship a conversational BI experience in weeks, not quarters.',
    metaTitle: 'Analytics & BI — Angular Agent Framework Solutions',
    metaDescription: 'Build conversational BI with natural language queries, real-time streaming charts, and generative UI — all in Angular.',
  },
  {
    slug: 'customer-support',
    color: '#5B4FCF',
    rgb: '91,79,207',
    eyebrow: 'Customer Support',
    title: 'AI agents that know when\nto escalate to a human',
    subtitle: 'Resolve tickets autonomously, surface context instantly, and hand off to humans seamlessly — with full conversation history.',
    painPoints: [
      {
        title: 'Chatbots that frustrate customers',
        description: 'Scripted chatbots can\'t handle nuance. Customers get stuck in loops, abandon the chat, and call the support line anyway.',
      },
      {
        title: 'Agents without guardrails',
        description: 'Autonomous agents that can\'t escalate are a liability. One wrong refund, one leaked detail, and trust is gone.',
      },
      {
        title: 'Context lost on handoff',
        description: 'When a bot hands off to a human, the conversation history disappears. The customer repeats everything. CSAT drops.',
      },
    ],
    architectureIntro: 'Three libraries give your support agents superpowers — and your customers a seamless experience.',
    architectureLayers: [
      {
        library: 'Agent',
        pkg: '@cacheplane/langgraph',
        role: 'LangGraph interrupts let the agent pause before sensitive actions — refunds, account changes, escalations. Thread persistence preserves the full conversation across bot-to-human handoffs.',
      },
      {
        library: 'Render',
        pkg: '@cacheplane/render',
        role: 'The agent renders structured UI — order summaries, refund confirmations, knowledge base cards — instead of dumping text. Customers see clean, actionable information.',
      },
      {
        library: 'Chat',
        pkg: '@cacheplane/chat',
        role: 'Production-ready chat UI with streaming messages, tool call visibility, and interrupt panels. When the agent escalates, the human agent sees the full debug overlay with every step the AI took.',
      },
    ],
    proofPoints: [
      { metric: '70%', label: 'Tickets resolved autonomously — without human intervention' },
      { metric: '0', label: 'Context lost on handoff — full thread history preserved' },
      { metric: '3x', label: 'Faster resolution for escalated tickets with AI-prepared context' },
    ],
    ctaHeadline: 'Support agents that make your team better',
    ctaSubtext: 'Download the guide or start a pilot. Resolve more tickets, escalate smarter, and keep your customers happy.',
    metaTitle: 'Customer Support — Angular Agent Framework Solutions',
    metaDescription: 'Build AI support agents with human escalation, full context handoff, and production-ready chat UI in Angular.',
  },
];

export function getSolutionBySlug(slug: string): SolutionConfig | undefined {
  return SOLUTIONS.find(s => s.slug === slug);
}

export function getAllSolutionSlugs(): string[] {
  return SOLUTIONS.map(s => s.slug);
}
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/website && npx tsc --noEmit src/lib/solutions-data.ts 2>&1 | head -20`
Expected: No errors (or use `npx next build` later for full check)

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/solutions-data.ts
git commit -m "feat(website): add solutions data layer with SolutionConfig type and 3 configs"
```

---

### Task 2: SolutionHero Component

**Files:**
- Create: `apps/website/src/components/landing/solutions/SolutionHero.tsx`

- [ ] **Step 1: Create the SolutionHero component**

This component follows the `AngularHero` pattern — centered text with eyebrow, headline, subtitle, and dual CTAs. It accepts a `SolutionConfig` and uses the solution's accent color.

```tsx
// apps/website/src/components/landing/solutions/SolutionHero.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import type { SolutionConfig } from '../../../lib/solutions-data';

interface SolutionHeroProps {
  solution: SolutionConfig;
}

export function SolutionHero({ solution }: SolutionHeroProps) {
  return (
    <section
      aria-labelledby="solution-hero-heading"
      style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}
    >
      <div
        style={{
          maxWidth: '56rem',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
          zIndex: 1,
        }}
        className="py-24 md:py-32"
      >
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <span
            style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: solution.color,
              textTransform: 'uppercase',
              display: 'inline-block',
              marginBottom: '1.5rem',
            }}
          >
            {solution.eyebrow}
          </span>
        </motion.div>

        <motion.h1
          id="solution-hero-heading"
          initial={{ y: 20 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(36px, 5vw, 56px)',
            fontWeight: 700,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            margin: 0,
            marginBottom: '1.25rem',
            whiteSpace: 'pre-line',
          }}
        >
          {solution.title}
        </motion.h1>

        <motion.p
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif',
            fontSize: 18,
            color: tokens.colors.textSecondary,
            maxWidth: '52ch',
            margin: '0 auto',
            lineHeight: 1.6,
            marginBottom: '2rem',
          }}
        >
          {solution.subtitle}
        </motion.p>

        <motion.div
          initial={{ y: 14 }}
          animate={{ y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{
            display: 'flex',
            gap: '0.75rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
          }}
        >
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: solution.color,
              color: '#fff',
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              padding: '0.875rem 1.75rem',
              borderRadius: 8,
              textDecoration: 'none',
              minHeight: 44,
            }}
          >
            Start a Pilot
          </Link>
          <a
            href="/whitepaper.pdf"
            download
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: solution.color,
              fontFamily: 'Inter, sans-serif',
              fontSize: 15,
              fontWeight: 600,
              padding: '0.875rem 1.75rem',
              borderRadius: 8,
              textDecoration: 'none',
              border: `1px solid rgba(${solution.rgb}, 0.25)`,
              minHeight: 44,
            }}
          >
            Download the Guide
          </a>
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/solutions/SolutionHero.tsx
git commit -m "feat(website): add SolutionHero component"
```

---

### Task 3: SolutionProblem Component

**Files:**
- Create: `apps/website/src/components/landing/solutions/SolutionProblem.tsx`

- [ ] **Step 1: Create the SolutionProblem component**

Displays 3 pain-point cards in a responsive grid. Follows the `ProblemSection` stat-card pattern (glass cards) but uses the solution's accent color.

```tsx
// apps/website/src/components/landing/solutions/SolutionProblem.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';
import type { SolutionPainPoint } from '../../../lib/solutions-data';

interface SolutionProblemProps {
  color: string;
  rgb: string;
  painPoints: SolutionPainPoint[];
}

export function SolutionProblem({ color, rgb, painPoints }: SolutionProblemProps) {
  return (
    <section className="solution-problem" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solution-problem { padding: 60px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            color,
            marginBottom: 14,
          }}
        >
          The Problem
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            marginBottom: 10,
          }}
        >
          Why teams stall
        </h2>
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(260px, 100%), 1fr))',
          gap: 20,
          maxWidth: 900,
          margin: '0 auto',
        }}
      >
        {painPoints.map((point, i) => (
          <motion.div
            key={point.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '28px 24px',
              borderRadius: 16,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <h3
              style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '1.15rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                marginBottom: 10,
                lineHeight: 1.25,
              }}
            >
              {point.title}
            </h3>
            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.88rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {point.description}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/solutions/SolutionProblem.tsx
git commit -m "feat(website): add SolutionProblem component"
```

---

### Task 4: SolutionArchitecture Component

**Files:**
- Create: `apps/website/src/components/landing/solutions/SolutionArchitecture.tsx`

- [ ] **Step 1: Create the SolutionArchitecture component**

Shows how the 3 libraries work together for this use case. Follows the `TheStack` vertical card + connector pattern, but with solution-specific colors and descriptions.

```tsx
// apps/website/src/components/landing/solutions/SolutionArchitecture.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import type { ArchitectureLayer } from '../../../lib/solutions-data';

const LIBRARY_META: Record<string, { color: string; rgb: string; href: string }> = {
  Agent: { color: tokens.colors.accent, rgb: '0,64,144', href: '/angular' },
  Render: { color: tokens.colors.renderGreen, rgb: '26,122,64', href: '/render' },
  Chat: { color: tokens.colors.chatPurple, rgb: '90,0,200', href: '/chat' },
};

interface SolutionArchitectureProps {
  color: string;
  intro: string;
  layers: ArchitectureLayer[];
}

function Connector({ fromRgb, toRgb }: { fromRgb: string; toRgb: string }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '2px 0' }}>
      <div
        style={{
          width: 2,
          height: 28,
          background: `linear-gradient(to bottom, rgba(${fromRgb}, 0.3), rgba(${toRgb}, 0.3))`,
          borderRadius: 1,
        }}
      />
    </div>
  );
}

export function SolutionArchitecture({ color, intro, layers }: SolutionArchitectureProps) {
  return (
    <section className="solution-arch" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solution-arch { padding: 60px 20px !important; }
          .solution-arch-card { padding: 24px 20px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            color,
            marginBottom: 14,
          }}
        >
          The Architecture
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            marginBottom: 10,
          }}
        >
          Three libraries. One solution.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: tokens.colors.textSecondary,
            maxWidth: 560,
            margin: '0 auto',
          }}
        >
          {intro}
        </p>
      </motion.div>

      <div style={{ maxWidth: 860, margin: '0 auto', display: 'flex', flexDirection: 'column' }}>
        {layers.map((layer, i) => {
          const meta = LIBRARY_META[layer.library];
          const prevMeta = i > 0 ? LIBRARY_META[layers[i - 1].library] : null;
          return (
            <div key={layer.library}>
              {i > 0 && prevMeta && (
                <Connector fromRgb={prevMeta.rgb} toRgb={meta.rgb} />
              )}
              <motion.div
                className="solution-arch-card"
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: i * 0.1 }}
                style={{
                  background: `rgba(${meta.rgb}, 0.03)`,
                  border: `1px solid rgba(${meta.rgb}, 0.15)`,
                  borderRadius: 14,
                  padding: '28px 28px 24px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 10,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                      fontSize: '0.58rem',
                      fontWeight: 700,
                      textTransform: 'uppercase',
                      letterSpacing: '0.07em',
                      padding: '2px 9px',
                      borderRadius: 5,
                      color: '#fff',
                      background: meta.color,
                    }}
                  >
                    {layer.library}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                      fontSize: '0.76rem',
                      fontWeight: 700,
                      color: meta.color,
                    }}
                  >
                    {layer.pkg}
                  </span>
                </div>

                <p
                  style={{
                    fontFamily: 'Inter, sans-serif',
                    fontSize: '0.88rem',
                    color: tokens.colors.textSecondary,
                    lineHeight: 1.6,
                    margin: 0,
                  }}
                >
                  {layer.role}
                </p>

                <Link
                  href={meta.href}
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '0.72rem',
                    fontWeight: 700,
                    color: meta.color,
                    textDecoration: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                  }}
                >
                  Explore {layer.library} →
                </Link>
              </motion.div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/solutions/SolutionArchitecture.tsx
git commit -m "feat(website): add SolutionArchitecture component"
```

---

### Task 5: SolutionProofPoints Component

**Files:**
- Create: `apps/website/src/components/landing/solutions/SolutionProofPoints.tsx`

- [ ] **Step 1: Create the SolutionProofPoints component**

Displays 3 metric cards in a grid. Uses the solution's accent color for the large metric numbers.

```tsx
// apps/website/src/components/landing/solutions/SolutionProofPoints.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';
import type { ProofPoint } from '../../../lib/solutions-data';

interface SolutionProofPointsProps {
  color: string;
  rgb: string;
  proofPoints: ProofPoint[];
}

export function SolutionProofPoints({ color, rgb, proofPoints }: SolutionProofPointsProps) {
  return (
    <section className="solution-proof" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solution-proof { padding: 60px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            color,
            marginBottom: 14,
          }}
        >
          The Results
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
          }}
        >
          What you can expect
        </h2>
      </motion.div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 20,
          maxWidth: 840,
          margin: '0 auto',
        }}
      >
        {proofPoints.map((point, i) => (
          <motion.div
            key={point.metric}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1, duration: 0.5 }}
            style={{
              padding: '32px 24px',
              textAlign: 'center',
              borderRadius: 18,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              border: `1px solid ${tokens.glass.border}`,
              boxShadow: tokens.glass.shadow,
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '3rem',
                fontWeight: 800,
                lineHeight: 1,
                color,
                marginBottom: 10,
              }}
            >
              {point.metric}
            </div>
            <p
              style={{
                fontSize: '0.85rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              {point.label}
            </p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/solutions/SolutionProofPoints.tsx
git commit -m "feat(website): add SolutionProofPoints component"
```

---

### Task 6: SolutionFooterCTA + WhitePaper Gate

**Files:**
- Create: `apps/website/src/components/landing/solutions/SolutionFooterCTA.tsx`

- [ ] **Step 1: Create the SolutionFooterCTA component**

Dark-background CTA section matching the `PilotFooterCTA` pattern. Includes both a whitepaper download and pilot CTA.

```tsx
// apps/website/src/components/landing/solutions/SolutionFooterCTA.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';

interface SolutionFooterCTAProps {
  color: string;
  headline: string;
  subtext: string;
}

export function SolutionFooterCTA({ color, headline, subtext }: SolutionFooterCTAProps) {
  return (
    <section
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)',
        padding: '0 2rem',
      }}
    >
      <style>{`
        .solution-footer-secondary:hover { border-color: rgba(255,255,255,0.6) !important; }
        @media (max-width: 767px) {
          .solution-footer-inner { padding-top: 4rem !important; padding-bottom: 4rem !important; }
        }
      `}</style>
      <motion.div
        className="solution-footer-inner"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: '48rem',
          margin: '0 auto',
          paddingTop: '6rem',
          paddingBottom: '6rem',
          textAlign: 'center',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '11px',
            fontWeight: 500,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(255, 255, 255, 0.5)',
            marginBottom: '1rem',
          }}
        >
          Ready when you are
        </p>

        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(28px, 4vw, 42px)',
            fontWeight: 400,
            lineHeight: 1.15,
            color: '#ffffff',
            marginBottom: '1.25rem',
          }}
        >
          {headline}
        </h2>

        <p
          style={{
            fontFamily: 'var(--font-inter, Inter, sans-serif)',
            fontSize: '17px',
            lineHeight: 1.6,
            color: 'rgba(255, 255, 255, 0.7)',
            marginBottom: '2.5rem',
          }}
        >
          {subtext}
        </p>

        <div
          style={{
            display: 'flex',
            gap: '1rem',
            justifyContent: 'center',
            flexWrap: 'wrap',
            marginBottom: '1.5rem',
          }}
        >
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-block',
              padding: '0.875rem 2rem',
              background: '#ffffff',
              color,
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
            }}
          >
            Start Your Pilot →
          </Link>
          <a
            href="/whitepaper.pdf"
            download
            className="solution-footer-secondary"
            style={{
              display: 'inline-block',
              padding: '0.875rem 2rem',
              background: 'transparent',
              color: '#ffffff',
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px',
              fontWeight: 600,
              textDecoration: 'none',
              borderRadius: '6px',
              border: '1px solid rgba(255, 255, 255, 0.3)',
              transition: 'border-color 0.2s ease',
            }}
          >
            Download the Guide
          </a>
        </div>

        <p
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: '10px',
            letterSpacing: '0.08em',
            color: 'rgba(255, 255, 255, 0.4)',
          }}
        >
          App deployment license · $20,000 · 3-month co-pilot engagement
        </p>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/solutions/SolutionFooterCTA.tsx
git commit -m "feat(website): add SolutionFooterCTA component"
```

---

### Task 7: Dynamic Solution Page Route

**Files:**
- Create: `apps/website/src/app/solutions/[slug]/page.tsx`

- [ ] **Step 1: Create the dynamic route page**

Uses `generateStaticParams()` to statically generate all 3 solution pages. Composes all solution section components. Follows the `angular/page.tsx` pattern with ambient gradient blobs.

```tsx
// apps/website/src/app/solutions/[slug]/page.tsx
import { notFound } from 'next/navigation';
import { tokens } from '@cacheplane/design-tokens';
import { getSolutionBySlug, getAllSolutionSlugs } from '../../../lib/solutions-data';
import { SolutionHero } from '../../../components/landing/solutions/SolutionHero';
import { SolutionProblem } from '../../../components/landing/solutions/SolutionProblem';
import { SolutionArchitecture } from '../../../components/landing/solutions/SolutionArchitecture';
import { SolutionProofPoints } from '../../../components/landing/solutions/SolutionProofPoints';
import { SolutionFooterCTA } from '../../../components/landing/solutions/SolutionFooterCTA';
import { WhitePaperSection } from '../../../components/landing/WhitePaperSection';

interface PageProps {
  params: Promise<{ slug: string }>;
}

export function generateStaticParams() {
  return getAllSolutionSlugs().map(slug => ({ slug }));
}

export async function generateMetadata({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);
  if (!solution) return {};
  return {
    title: solution.metaTitle,
    description: solution.metaDescription,
  };
}

export default async function SolutionPage({ params }: PageProps) {
  const { slug } = await params;
  const solution = getSolutionBySlug(slug);
  if (!solution) notFound();

  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${solution.rgb}, 0.12) 0%, transparent 70%)`,
          top: -200,
          left: -150,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: tokens.gradient.cool,
          top: 800,
          right: -100,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute',
          width: 400,
          height: 400,
          borderRadius: '50%',
          background: `radial-gradient(circle, rgba(${solution.rgb}, 0.08) 0%, transparent 70%)`,
          top: 2200,
          left: -100,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      <SolutionHero solution={solution} />
      <SolutionProblem
        color={solution.color}
        rgb={solution.rgb}
        painPoints={solution.painPoints}
      />
      <SolutionArchitecture
        color={solution.color}
        intro={solution.architectureIntro}
        layers={solution.architectureLayers}
      />
      <SolutionProofPoints
        color={solution.color}
        rgb={solution.rgb}
        proofPoints={solution.proofPoints}
      />
      <WhitePaperSection />
      <SolutionFooterCTA
        color={solution.color}
        headline={solution.ctaHeadline}
        subtext={solution.ctaSubtext}
      />
    </div>
  );
}
```

- [ ] **Step 2: Verify the page builds**

Run: `cd apps/website && npx next build 2>&1 | tail -30`
Expected: Build succeeds. Routes `/solutions/compliance`, `/solutions/analytics`, `/solutions/customer-support` appear in the output.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/solutions/[slug]/page.tsx
git commit -m "feat(website): add dynamic solution page route with generateStaticParams"
```

---

### Task 8: Solutions Index Page + SolutionsGrid

**Files:**
- Create: `apps/website/src/components/landing/solutions/SolutionsGrid.tsx`
- Create: `apps/website/src/app/solutions/page.tsx`

- [ ] **Step 1: Create the SolutionsGrid component**

Card grid showing all 3 solutions with colored accents. Each card links to its detail page.

```tsx
// apps/website/src/components/landing/solutions/SolutionsGrid.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { SOLUTIONS } from '../../../lib/solutions-data';

export function SolutionsGrid() {
  return (
    <section className="solutions-grid" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .solutions-grid { padding: 60px 20px !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 48 }}
      >
        <p
          style={{
            fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
            fontSize: '0.7rem',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            fontWeight: 700,
            color: tokens.colors.accent,
            marginBottom: 14,
          }}
        >
          By Use Case
        </p>
        <h2
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: 'clamp(26px, 3.5vw, 46px)',
            fontWeight: 800,
            lineHeight: 1.1,
            color: tokens.colors.textPrimary,
            marginBottom: 10,
          }}
        >
          Enterprise solutions
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontStyle: 'italic',
            fontSize: '1.05rem',
            color: tokens.colors.textSecondary,
            maxWidth: 520,
            margin: '0 auto',
          }}
        >
          See how Angular Agent Framework solves real enterprise problems — from compliance to customer support.
        </p>
      </motion.div>

      <div
        style={{
          maxWidth: 1000,
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(min(280px, 100%), 1fr))',
          gap: 24,
        }}
      >
        {SOLUTIONS.map((sol, i) => (
          <motion.div
            key={sol.slug}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              background: `rgba(${sol.rgb}, 0.03)`,
              border: `1px solid rgba(${sol.rgb}, 0.15)`,
              borderRadius: 14,
              padding: '28px 24px 24px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span
              style={{
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
                background: sol.color,
              }}
            >
              {sol.eyebrow}
            </span>

            <h3
              style={{
                fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
                fontSize: '1.2rem',
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                lineHeight: 1.25,
                margin: 0,
                whiteSpace: 'pre-line',
              }}
            >
              {sol.title}
            </h3>

            <p
              style={{
                fontFamily: 'Inter, sans-serif',
                fontSize: '0.88rem',
                color: tokens.colors.textSecondary,
                lineHeight: 1.6,
                margin: 0,
              }}
            >
              {sol.subtitle}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginTop: 4 }}>
              {sol.proofPoints.map(pp => (
                <span
                  key={pp.metric}
                  style={{
                    fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                    fontSize: '0.58rem',
                    padding: '2px 8px',
                    borderRadius: 4,
                    background: `rgba(${sol.rgb}, 0.07)`,
                    color: sol.color,
                    border: `1px solid rgba(${sol.rgb}, 0.15)`,
                  }}
                >
                  {pp.metric} {pp.label.split(' — ')[0]}
                </span>
              ))}
            </div>

            <Link
              href={`/solutions/${sol.slug}`}
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.72rem',
                fontWeight: 700,
                color: sol.color,
                textDecoration: 'none',
                marginTop: 'auto',
                paddingTop: 8,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 4,
              }}
            >
              Learn more →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Create the solutions index page**

```tsx
// apps/website/src/app/solutions/page.tsx
import { tokens } from '@cacheplane/design-tokens';
import { SolutionsGrid } from '../../components/landing/solutions/SolutionsGrid';
import { WhitePaperSection } from '../../components/landing/WhitePaperSection';
import { PilotFooterCTA } from '../../components/landing/PilotFooterCTA';

export const metadata = {
  title: 'Solutions — Angular Agent Framework',
  description: 'See how Angular Agent Framework solves enterprise challenges — compliance, analytics, and customer support.',
};

export default function SolutionsIndexPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs */}
      <div
        style={{
          position: 'absolute',
          width: 600,
          height: 600,
          borderRadius: '50%',
          background: tokens.gradient.warm,
          top: -200,
          left: -150,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />
      <div
        style={{
          position: 'absolute',
          width: 500,
          height: 500,
          borderRadius: '50%',
          background: tokens.gradient.cool,
          top: 800,
          right: -100,
          filter: 'blur(80px)',
          pointerEvents: 'none',
        }}
        aria-hidden="true"
      />

      {/* Hero */}
      <section style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
        <div
          style={{
            maxWidth: '56rem',
            margin: '0 auto',
            textAlign: 'center',
            position: 'relative',
            zIndex: 1,
          }}
          className="py-24 md:py-32"
        >
          <p
            style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: 11,
              letterSpacing: '0.08em',
              color: tokens.colors.accent,
              textTransform: 'uppercase',
              marginBottom: '1.5rem',
            }}
          >
            Solutions
          </p>
          <h1
            style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: 'clamp(36px, 5vw, 56px)',
              fontWeight: 700,
              lineHeight: 1.1,
              color: tokens.colors.textPrimary,
              marginBottom: '1.25rem',
            }}
          >
            AI agents built for how enterprises actually work
          </h1>
          <p
            style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 18,
              color: tokens.colors.textSecondary,
              maxWidth: '52ch',
              margin: '0 auto',
              lineHeight: 1.6,
            }}
          >
            Angular Agent Framework gives your team the streaming, generative UI, and human-in-the-loop patterns that enterprise use cases demand.
          </p>
        </div>
      </section>

      <SolutionsGrid />
      <WhitePaperSection />
      <PilotFooterCTA />
    </div>
  );
}
```

- [ ] **Step 3: Verify both pages build**

Run: `cd apps/website && npx next build 2>&1 | tail -30`
Expected: Build succeeds. Route `/solutions` appears in the output alongside the individual solution routes.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/solutions/SolutionsGrid.tsx apps/website/src/app/solutions/page.tsx
git commit -m "feat(website): add solutions index page with SolutionsGrid"
```

---

### Task 9: Nav and Footer Updates

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx:8-14`
- Modify: `apps/website/src/components/shared/Footer.tsx:136-166`

- [ ] **Step 1: Add "Solutions" link to the Nav**

In `apps/website/src/components/shared/Nav.tsx`, add a "Solutions" entry to the `links` array between "Docs" and "API":

Replace:
```typescript
const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'API', href: '/docs/agent/api/agent', external: false },
  { label: 'Examples', href: 'https://cockpit.cacheplane.ai', external: true },
  { label: 'Pricing', href: '/pricing', external: false },
];
```

With:
```typescript
const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Solutions', href: '/solutions', external: false },
  { label: 'API', href: '/docs/agent/api/agent', external: false },
  { label: 'Examples', href: 'https://cockpit.cacheplane.ai', external: true },
  { label: 'Pricing', href: '/pricing', external: false },
];
```

- [ ] **Step 2: Add Solutions column to the Footer**

In `apps/website/src/components/shared/Footer.tsx`, add a new "Solutions" column between the "Libraries" column and the "Resources" column. Find the `{/* Resources column */}` comment and insert before it:

```tsx
          {/* Solutions column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: tokens.colors.accent }}>Solutions</span>
            <Link href="/solutions/compliance" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Compliance
            </Link>
            <Link href="/solutions/analytics" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Analytics
            </Link>
            <Link href="/solutions/customer-support" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Customer Support
            </Link>
          </div>
```

Also update the grid from `md:grid-cols-5` to `md:grid-cols-6` since there's now an extra column. In the same file, change:
```html
<div className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-8">
```
to:
```html
<div className="grid grid-cols-1 md:grid-cols-6 gap-10 md:gap-8">
```

- [ ] **Step 3: Verify the build**

Run: `cd apps/website && npx next build 2>&1 | tail -30`
Expected: Build succeeds without errors.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx apps/website/src/components/shared/Footer.tsx
git commit -m "feat(website): add Solutions to nav and footer"
```
