# Website refactor — Phase 4: Homepage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans.

**Goal:** Rebuild the homepage (`/`) against the 12-section IA defined in the design spec, using Phase 1 primitives and Phase 2 chrome. Remove the gradient blobs and ambient washes from `page.tsx`. Replace 7 ad-hoc landing sections with 11 focused ones.

**Architecture:**
- Each section is its own component in `apps/website/src/components/landing/` (new names; old names stay in place — they're still referenced by other routes, deleted in Phase 6).
- The `FeatureBlock` is a reusable two-column layout used by sections 5, 6, and 7 (`Stream`, `Render`, `Ship`).
- Hero collage uses Phase 1 `BrowserFrame` with placeholder content. Real screenshots come later (Phase 3 deferred).
- One signature live demo (section 7) embeds the live `cockpit.cacheplane.ai` iframe via Intersection Observer for lazy load.
- Page wrapper drops all `gradient.bgFlow`, blob `<div>`s, and the ambient-blob background.

**Tech Stack:** TypeScript, Next.js 16 (RSC for server components, `'use client'` only for the live iframe loader).

**Out of scope:**
- Other marketing routes (Phase 5)
- Real product screenshots (deferred until cockpit screenshot capture is possible)
- Deleting unused old landing components — Phase 6
- Footer/Nav changes — Phase 2 done

---

## File Structure

**Created:**
```
apps/website/src/components/landing/
├── Hero.tsx                  (server)
├── ProofStrip.tsx            (server)
├── Differentiator.tsx        (server)
├── FeatureBlock.tsx          (server — reused by Stream/Render/Ship sections)
├── PilotBlock.tsx            (server)
├── WhitePaperBlock.tsx       (client — has email-gate form)
├── Promises.tsx              (server)
├── HomeFAQ.tsx               (server — wraps the FAQ primitive with homepage content)
└── FinalCTA.tsx              (server)

apps/website/src/components/landing/
└── LiveCockpitFrame.tsx      (client — IntersectionObserver lazy iframe)
```

**Modified:**
```
apps/website/src/app/page.tsx (rewrite — drop blobs, assemble new sections)
```

**Not touched in this phase:**
```
apps/website/src/components/landing/
├── HeroTwoCol.tsx            (still used by other routes? check; if so leave alone)
├── PositioningStrip.tsx      (leave alone — referenced in spec to fold into Differentiator)
├── ProblemSection.tsx        (leave alone — folded into Differentiator's editorial copy)
├── PilotSolution.tsx         (leave alone — replaced by PilotBlock; old still referenced by /pilot-to-prod)
├── TheStack.tsx              (leave alone)
├── WhitePaperSection.tsx     (leave alone — replaced by WhitePaperBlock; old may be reused on other routes)
├── PilotFooterCTA.tsx        (leave alone — replaced by FinalCTA)
└── SocialProof.tsx           (leave alone — replaced by ProofStrip; deleted in Phase 6)
```

---

## Task 1: `Hero` section

**Files:**
- Create: `apps/website/src/components/landing/Hero.tsx`

A new dev-first hero. Left column: eyebrow + h1 + subhead + CTA pair + trust line. Right column: layered `BrowserFrame` collage with three stacked placeholder cards.

- [ ] **Step 1: Create `Hero.tsx`**

```tsx
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Pill } from '../ui/Pill';

export function Hero() {
  return (
    <Section surface="canvas" ariaLabelledBy="hero-heading">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
          className="hero-grid"
        >
          {/* Left column */}
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Angular Agent Framework · MIT
            </Eyebrow>
            <h1
              id="hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              Ship agentic Angular apps without rewriting your frontend.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                marginBottom: 32,
                maxWidth: '52ch',
              }}
            >
              Signal-native streaming for LangGraph and AG-UI. Headless primitives plus opinionated compositions, built for Angular 20+ teams shipping to production.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <Button variant="primary" size="lg" href="/docs">
                Get started
              </Button>
              <Button variant="ghost" size="lg" href="https://cockpit.cacheplane.ai" target="_blank" rel="noopener noreferrer">
                See it live →
              </Button>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
              <Pill variant="accent">MIT licensed</Pill>
              <Pill variant="neutral">Works with LangGraph + AG-UI</Pill>
              <Pill variant="angular">Angular 20+</Pill>
            </div>
          </div>

          {/* Right column — layered collage */}
          <div style={{ position: 'relative', minHeight: 420 }} aria-hidden="true">
            <BrowserFrame
              url="cockpit.cacheplane.ai/chat"
              rotate={-3}
              elevation="lg"
              style={{ position: 'absolute', top: 0, left: 0, width: '92%' }}
            >
              <div style={{
                padding: 32,
                background: 'linear-gradient(180deg, #fff 0%, #f4f6fb 100%)',
                minHeight: 220,
              }}>
                <div style={{ fontFamily: tokens.typography.fontMono, fontSize: 12, color: tokens.colors.textMuted, marginBottom: 8 }}>
                  AI · streaming
                </div>
                <div style={{ fontFamily: tokens.typography.fontSans, fontSize: 14, color: tokens.colors.textPrimary, lineHeight: 1.5 }}>
                  Generating production-ready Angular components from your schema…
                  <span style={{ display: 'inline-block', width: 6, height: 14, background: tokens.colors.accent, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s steps(2) infinite' }} />
                </div>
              </div>
            </BrowserFrame>
            <BrowserFrame
              url="agent.signal()"
              rotate={4}
              elevation="md"
              style={{
                position: 'absolute',
                top: 160,
                right: 0,
                width: '70%',
                maxWidth: 320,
              }}
            >
              <pre style={{
                margin: 0,
                padding: '16px 18px',
                background: '#1a1b26',
                color: '#a9b1d6',
                fontFamily: tokens.typography.fontMono,
                fontSize: 12,
                lineHeight: 1.6,
                overflow: 'hidden',
              }}>
{`provideAgent({
  apiUrl: '/agent',
});

const a = agent();
a.messages();
a.status();`}
              </pre>
            </BrowserFrame>
          </div>
        </div>

        <style>{`
          @keyframes blink { to { visibility: hidden; } }
          @media (max-width: 900px) {
            .hero-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx
git commit -m "feat(website): add new Hero section for homepage refactor"
```

---

## Task 2: `ProofStrip` section

**Files:**
- Create: `apps/website/src/components/landing/ProofStrip.tsx`

Honest proof signals — no borrowed customer logos. Five badge-like cards in a centered row.

- [ ] **Step 1: Create the file**

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

const SIGNALS = [
  { label: 'MIT licensed', value: 'Open source', href: 'https://github.com/cacheplane/angular-agent-framework/blob/main/LICENSE' },
  { label: 'Built for Angular 20+', value: 'Zoneless ready', href: null },
  { label: 'LangGraph + AG-UI', value: 'Two adapters', href: null },
  { label: 'Reference app', value: 'cockpit.cacheplane.ai', href: 'https://cockpit.cacheplane.ai' },
  { label: 'On npm', value: '@ngaf/chat', href: 'https://www.npmjs.com/package/@ngaf/chat' },
];

export function ProofStrip() {
  return (
    <Section surface="canvas" tight>
      <Container>
        <Eyebrow style={{ textAlign: 'center', marginBottom: 20 }}>
          Built in the open
        </Eyebrow>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
            gap: 12,
            maxWidth: 1000,
            margin: '0 auto',
          }}
        >
          {SIGNALS.map((s) => {
            const inner = (
              <Card padding="md" style={{ textAlign: 'center', height: '100%' }}>
                <div style={{
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                  color: tokens.colors.textMuted,
                  marginBottom: 6,
                }}>
                  {s.label}
                </div>
                <div style={{
                  fontFamily: tokens.typography.fontSans,
                  fontSize: 15,
                  fontWeight: 600,
                  color: tokens.colors.textPrimary,
                }}>
                  {s.value}
                </div>
              </Card>
            );
            return s.href ? (
              <a key={s.label} href={s.href} target="_blank" rel="noopener noreferrer" style={{ textDecoration: 'none' }}>
                {inner}
              </a>
            ) : (
              <div key={s.label}>{inner}</div>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/ProofStrip.tsx
git commit -m "feat(website): add ProofStrip with honest proof signals"
```

---

## Task 3: `Differentiator` section

**Files:**
- Create: `apps/website/src/components/landing/Differentiator.tsx`

Editorial point-of-view + 4-card sub-grid. The 4 cards reuse the copy from the existing `PositioningStrip` (Runtime / Streaming / Generative UI / License).

- [ ] **Step 1: Create the file**

```tsx
import type { ReactNode } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

interface PositionCard {
  eyebrow: string;
  headline: string;
  body: ReactNode;
}

const CARDS: PositionCard[] = [
  {
    eyebrow: 'Runtime',
    headline: 'One Angular UI. Any agent runtime.',
    body: 'Same primitives drive LangGraph, AG-UI, CrewAI, Mastra, Pydantic AI, AWS Strands, and your own backend.',
  },
  {
    eyebrow: 'Streaming',
    headline: 'LangGraph streaming for Angular.',
    body: (
      <>
        <code style={{ fontFamily: tokens.typography.fontMono }}>agent()</code> ships LangGraph streaming for interrupts, branch and history, tool progress, and tool results — plus{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>error()</code>,{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>status()</code>, and{' '}
        <code style={{ fontFamily: tokens.typography.fontMono }}>reload()</code>.
      </>
    ),
  },
  {
    eyebrow: 'Generative UI',
    headline: 'Generative UI, built in.',
    body: (
      <>
        Render Vercel <code style={{ fontFamily: tokens.typography.fontMono }}>json-render</code> and Google A2UI specs into Angular components. No second framework to bolt on.
      </>
    ),
  },
  {
    eyebrow: 'License',
    headline: 'MIT. Headless primitives, drop-in compositions.',
    body: 'No tier gates on Angular. Use the unstyled primitives, or the opinionated chat shell — your call.',
  },
];

export function Differentiator() {
  return (
    <Section surface="canvas" ariaLabelledBy="differentiator-heading">
      <Container>
        {/* Editorial top */}
        <div style={{ maxWidth: 720, margin: '0 auto 56px', textAlign: 'center' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Why this exists</Eyebrow>
          <h2
            id="differentiator-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 24,
              letterSpacing: '-0.015em',
            }}
          >
            Built for Angular, not retrofitted.
          </h2>
          <p style={{
            fontFamily: tokens.typography.bodyLg.family,
            fontSize: tokens.typography.bodyLg.size,
            lineHeight: tokens.typography.bodyLg.line,
            color: tokens.colors.textSecondary,
            margin: 0,
            marginBottom: 16,
          }}>
            Most agent UI work assumes React or a vanilla web component. Angular teams glue together ad-hoc streaming, lose interrupts, and re-implement thread state — every project, every time.
          </p>
          <p style={{
            fontFamily: tokens.typography.bodyLg.family,
            fontSize: tokens.typography.bodyLg.size,
            lineHeight: tokens.typography.bodyLg.line,
            color: tokens.colors.textSecondary,
            margin: 0,
          }}>
            Signals and DI are <em>better</em> substrates for agent UI than hooks — when they're used directly, not behind a port. So we built it that way.
          </p>
        </div>

        {/* 4-card sub-grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
            gap: 16,
          }}
        >
          {CARDS.map((c) => (
            <Card key={c.eyebrow} padding="lg" hoverable>
              <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{c.eyebrow}</Eyebrow>
              <h3 style={{
                fontFamily: tokens.typography.h3.family,
                fontSize: 20,
                lineHeight: 1.3,
                fontWeight: tokens.typography.h3.weight,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 8,
              }}>
                {c.headline}
              </h3>
              <p style={{
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}>
                {c.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/Differentiator.tsx
git commit -m "feat(website): add Differentiator section with editorial POV + 4-card grid"
```

---

## Task 4: `FeatureBlock` primitive (reused by Stream/Render/Ship)

**Files:**
- Create: `apps/website/src/components/landing/FeatureBlock.tsx`

A reusable two-column section. Left/right text, opposite-side visual. Each FeatureBlock receives a `visual: ReactNode` to render in the visual slot.

- [ ] **Step 1: Create the file**

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

export interface FeatureBlockProps {
  eyebrow: string;
  headline: string;
  body: ReactNode;
  bullets: string[];
  supportingCards: { title: string; description: string }[];
  cta: { label: string; href: string };
  visual: ReactNode;
  /** If true, visual on the left; text on the right. Used to alternate sections. */
  visualLeft?: boolean;
  /** Section surface — defaults to canvas. */
  surface?: 'canvas' | 'tinted' | 'white';
  /** Anchor id + aria-labelledby target. */
  id?: string;
}

export function FeatureBlock({
  eyebrow,
  headline,
  body,
  bullets,
  supportingCards,
  cta,
  visual,
  visualLeft = false,
  surface = 'canvas',
  id,
}: FeatureBlockProps) {
  const headingId = id ? `${id}-heading` : undefined;
  return (
    <Section surface={surface} id={id} ariaLabelledBy={headingId}>
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
          className="feature-block-grid"
        >
          {/* Text column */}
          <div style={{ order: visualLeft ? 2 : 1 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>{eyebrow}</Eyebrow>
            <h2
              id={headingId}
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.015em',
              }}
            >
              {headline}
            </h2>
            <p style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              marginBottom: 24,
            }}>
              {body}
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
              {bullets.map((b) => (
                <li key={b} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontFamily: tokens.typography.body.family,
                  fontSize: tokens.typography.body.size,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textPrimary,
                }}>
                  <span aria-hidden="true" style={{
                    flex: '0 0 18px',
                    height: 18,
                    marginTop: 4,
                    borderRadius: tokens.radius.full,
                    background: tokens.colors.accentSurface,
                    border: `1px solid ${tokens.colors.accentBorder}`,
                    color: tokens.colors.accent,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}>✓</span>
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {/* Supporting card row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8, marginBottom: 24 }}>
              {supportingCards.map((sc) => (
                <Card key={sc.title} padding="md" surface="tinted">
                  <div style={{
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 12,
                    fontWeight: 700,
                    color: tokens.colors.accent,
                    marginBottom: 4,
                  }}>
                    {sc.title}
                  </div>
                  <div style={{
                    fontFamily: tokens.typography.caption.family,
                    fontSize: tokens.typography.caption.size,
                    lineHeight: tokens.typography.caption.line,
                    color: tokens.colors.textSecondary,
                  }}>
                    {sc.description}
                  </div>
                </Card>
              ))}
            </div>

            <Link
              href={cta.href}
              style={{
                fontFamily: tokens.typography.fontSans,
                fontSize: 15,
                fontWeight: 600,
                color: tokens.colors.accent,
                textDecoration: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
              }}
            >
              {cta.label} →
            </Link>
          </div>

          {/* Visual column */}
          <div style={{ order: visualLeft ? 1 : 2 }}>
            {visual}
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .feature-block-grid {
              grid-template-columns: 1fr !important;
              gap: 32px !important;
            }
            .feature-block-grid > div {
              order: unset !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/FeatureBlock.tsx
git commit -m "feat(website): add reusable FeatureBlock primitive for Stream/Render/Ship sections"
```

---

## Task 5: `LiveCockpitFrame` client component

**Files:**
- Create: `apps/website/src/components/landing/LiveCockpitFrame.tsx`

Wraps an `<iframe>` pointing at `cockpit.cacheplane.ai`, lazily loading it only when the section scrolls into view.

- [ ] **Step 1: Create the file**

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { BrowserFrame } from '../ui/BrowserFrame';

export function LiveCockpitFrame() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!ref.current || shouldLoad) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={ref}>
      <BrowserFrame url="cockpit.cacheplane.ai" elevation="lg">
        {shouldLoad ? (
          <iframe
            src="https://cockpit.cacheplane.ai"
            title="Cockpit — Angular Agent Framework reference app"
            loading="lazy"
            style={{
              width: '100%',
              height: 480,
              border: 'none',
              display: 'block',
            }}
          />
        ) : (
          <div style={{
            height: 480,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: tokens.surfaces.surfaceTinted,
            color: tokens.colors.textMuted,
            fontFamily: tokens.typography.fontMono,
            fontSize: 13,
          }}>
            Loading live demo…
          </div>
        )}
      </BrowserFrame>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/LiveCockpitFrame.tsx
git commit -m "feat(website): add LiveCockpitFrame for lazy-loaded signature demo"
```

---

## Task 6: `PilotBlock` section

**Files:**
- Create: `apps/website/src/components/landing/PilotBlock.tsx`

Tinted section. Pilot-to-Prod program block.

- [ ] **Step 1: Create the file**

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { Card } from '../ui/Card';

const TIMELINE = [
  { phase: '1', title: 'Discover', body: 'Map your stack, surfaces, and the agentic work that earns its keep.' },
  { phase: '2', title: 'Build', body: 'Ship a working demo on your real data, in your real Angular app.' },
  { phase: '3', title: 'Harden', body: 'Observability, error boundaries, deploy paths, on-call patterns.' },
  { phase: '4', title: 'Train', body: 'Your team owns the stack. We leave you with a runbook, not a black box.' },
];

const OUTCOMES = [
  'Working agent demo on your domain',
  'Hardened production patterns (error/fallback/observability)',
  'Deploy-ready integration with your CI/CD',
  'Team trained on the framework + LangGraph',
];

export function PilotBlock() {
  return (
    <Section surface="tinted" ariaLabelledBy="pilot-heading">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
          className="pilot-block-grid"
        >
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>For teams</Eyebrow>
            <h2
              id="pilot-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.015em',
              }}
            >
              Ship your first Angular agent in 8 weeks.
            </h2>
            <p style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              marginBottom: 24,
            }}>
              Pilot-to-Prod is a concierge delivery — concrete outcomes, your engineers in the driver's seat, no lock-in.
            </p>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 32px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {OUTCOMES.map((o) => (
                <li key={o} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontFamily: tokens.typography.body.family,
                  fontSize: tokens.typography.body.size,
                  lineHeight: tokens.typography.body.line,
                  color: tokens.colors.textPrimary,
                }}>
                  <span aria-hidden="true" style={{
                    flex: '0 0 18px',
                    height: 18,
                    marginTop: 4,
                    borderRadius: tokens.radius.full,
                    background: tokens.colors.accent,
                    color: tokens.colors.textInverted,
                    fontSize: 11,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    lineHeight: 1,
                  }}>✓</span>
                  <span>{o}</span>
                </li>
              ))}
            </ul>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <Button variant="primary" size="lg" href="/pilot-to-prod">See the program</Button>
              <Button variant="secondary" size="lg" href="/pilot-to-prod#contact">Book a call</Button>
            </div>
          </div>

          {/* Timeline */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {TIMELINE.map((t) => (
              <Card key={t.phase} padding="md">
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                  <div style={{
                    flex: '0 0 36px',
                    height: 36,
                    borderRadius: tokens.radius.full,
                    background: tokens.colors.accent,
                    color: tokens.colors.textInverted,
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 14,
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    {t.phase}
                  </div>
                  <div>
                    <div style={{
                      fontFamily: tokens.typography.fontSans,
                      fontSize: 17,
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                      marginBottom: 4,
                    }}>
                      {t.title}
                    </div>
                    <div style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                    }}>
                      {t.body}
                    </div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .pilot-block-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/PilotBlock.tsx
git commit -m "feat(website): add PilotBlock with 8-week program timeline"
```

---

## Task 7: `WhitePaperBlock` section

**Files:**
- Create: `apps/website/src/components/landing/WhitePaperBlock.tsx`

Whitepaper download with email gate. Two-column: copy left, tilted whitepaper cover right.

The existing `WhitePaperSection.tsx` has a working email-capture client form. Copy its email-capture logic into the new block.

- [ ] **Step 1: Read existing WhitePaperSection.tsx** to understand the email-capture API call

Run: `cat apps/website/src/components/landing/WhitePaperSection.tsx | head -100`

Note: the form posts to `/api/whitepaper-signup` with `{email}`, tracks via `analyticsEvents.marketingWhitepaperSignupSubmit/Success/Fail`, and grants a PDF download on success.

- [ ] **Step 2: Create `WhitePaperBlock.tsx`** (client component because of the form)

```tsx
'use client';
import { useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { analyticsEvents } from '../../lib/analytics/events';
import { track, trackWhitepaperDownloadClick } from '../../lib/analytics/client';

const BULLETS = [
  'Six production-readiness dimensions for Angular AI',
  'Concrete patterns — error boundaries, fallbacks, observability, deploy',
  'No vendor pitch. Just what we learned shipping it.',
];

export function WhitePaperBlock() {
  const [email, setEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setState('submitting');
    track(analyticsEvents.marketingWhitepaperSignupSubmit, {
      surface: 'home_whitepaper',
      source_section: 'whitepaper-block',
      paper: 'overview',
    });
    try {
      await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      track(analyticsEvents.marketingWhitepaperSignupSuccess, {
        surface: 'home_whitepaper',
        source_section: 'whitepaper-block',
        paper: 'overview',
      });
      setState('done');
    } catch {
      track(analyticsEvents.marketingWhitepaperSignupFail, {
        surface: 'home_whitepaper',
        source_section: 'whitepaper-block',
        paper: 'overview',
        error_reason: 'api_error',
      });
      setState('error');
    }
  };

  return (
    <Section surface="white" id="whitepaper-block" ariaLabelledBy="wp-heading">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
          className="wp-grid"
        >
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Field report</Eyebrow>
            <h2
              id="wp-heading"
              style={{
                fontFamily: tokens.typography.h2.family,
                fontSize: tokens.typography.h2.size,
                lineHeight: tokens.typography.h2.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 20,
                letterSpacing: '-0.015em',
              }}
            >
              The last-mile gap in Angular AI.
            </h2>
            <ul style={{ listStyle: 'none', padding: 0, margin: '0 0 24px 0', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {BULLETS.map((b) => (
                <li key={b} style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  gap: 10,
                  fontFamily: tokens.typography.bodyLg.family,
                  fontSize: tokens.typography.bodyLg.size,
                  lineHeight: tokens.typography.bodyLg.line,
                  color: tokens.colors.textSecondary,
                }}>
                  <span aria-hidden="true" style={{
                    flex: '0 0 6px',
                    height: 6,
                    marginTop: 12,
                    borderRadius: tokens.radius.full,
                    background: tokens.colors.accent,
                  }} />
                  <span>{b}</span>
                </li>
              ))}
            </ul>

            {state === 'done' ? (
              <div style={{
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                color: '#1a7a40',
                marginBottom: 16,
              }}>
                ✓ Check your inbox — the guide is on its way.{' '}
                <a
                  href="/whitepaper.pdf"
                  download="angular-agent-readiness-guide.pdf"
                  onClick={() => trackWhitepaperDownloadClick('overview', {
                    surface: 'home_whitepaper',
                    source_section: 'whitepaper-block',
                    cta_id: 'home_whitepaper_direct',
                  })}
                  style={{ color: tokens.colors.accent }}
                >
                  Or download directly.
                </a>
              </div>
            ) : (
              <form onSubmit={submit} style={{ display: 'flex', gap: 8, flexWrap: 'wrap', maxWidth: 480 }}>
                <label htmlFor="wp-email" className="sr-only">Email address</label>
                <input
                  id="wp-email"
                  type="email"
                  placeholder="you@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  disabled={state === 'submitting'}
                  style={{
                    flex: '1 1 240px',
                    background: tokens.surfaces.surface,
                    border: `1px solid ${tokens.surfaces.border}`,
                    borderRadius: tokens.radius.md,
                    padding: '12px 14px',
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    color: tokens.colors.textPrimary,
                    outline: 'none',
                  }}
                />
                <Button type="submit" variant="primary" size="lg" disabled={state === 'submitting' || !email}>
                  {state === 'submitting' ? 'Sending…' : 'Download (free)'}
                </Button>
              </form>
            )}
            {state === 'error' && (
              <p style={{ marginTop: 12, color: tokens.colors.angularRed, fontSize: 14 }}>
                Something went wrong — please try again or{' '}
                <a href="/whitepaper.pdf" download style={{ color: tokens.colors.accent }}>download directly</a>.
              </p>
            )}
          </div>

          {/* Tilted whitepaper cover */}
          <div style={{ display: 'flex', justifyContent: 'center' }}>
            <BrowserFrame
              url="angular-agent-readiness-guide.pdf"
              rotate={-2}
              elevation="lg"
              maxWidth={420}
            >
              <div style={{
                aspectRatio: '8.5 / 11',
                background: 'linear-gradient(135deg, #fafbfc 0%, #eaf3ff 100%)',
                padding: '48px 36px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 11,
                    textTransform: 'uppercase',
                    letterSpacing: '0.15em',
                    color: tokens.colors.accent,
                    marginBottom: 14,
                  }}>
                    Field report · 18 pages
                  </div>
                  <div style={{
                    fontFamily: tokens.typography.fontSerif,
                    fontSize: 28,
                    lineHeight: 1.15,
                    fontWeight: 700,
                    color: tokens.colors.textPrimary,
                    marginBottom: 12,
                    fontStyle: 'italic',
                  }}>
                    From Prototype to Production
                  </div>
                  <div style={{
                    fontFamily: tokens.typography.fontSans,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: tokens.colors.textSecondary,
                  }}>
                    Six production-readiness dimensions for Angular AI teams.
                  </div>
                </div>
                <div style={{
                  fontFamily: tokens.typography.fontMono,
                  fontSize: 11,
                  color: tokens.colors.textMuted,
                  textTransform: 'uppercase',
                  letterSpacing: '0.1em',
                }}>
                  Angular Agent Framework
                </div>
              </div>
            </BrowserFrame>
          </div>
        </div>

        <style>{`
          @media (max-width: 900px) {
            .wp-grid {
              grid-template-columns: 1fr !important;
              gap: 40px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/WhitePaperBlock.tsx
git commit -m "feat(website): add WhitePaperBlock with email gate + tilted PDF cover"
```

---

## Task 8: `Promises` section

**Files:**
- Create: `apps/website/src/components/landing/Promises.tsx`

5-card "what we won't do" grid.

- [ ] **Step 1: Create the file**

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Card } from '../ui/Card';

const PROMISES = [
  { title: 'No vendor lock-in', body: 'MIT today, MIT tomorrow. Use without us.' },
  { title: 'No paid Angular tier', body: 'The libraries stay open. Pilot-to-Prod is the only paid offering.' },
  { title: 'No abandoned majors', body: 'We follow Angular’s LTS. When Angular ships, we ship.' },
  { title: 'No closed primitives', body: 'Headless primitives stay in the open repo.' },
  { title: 'No required cloud', body: 'Self-host LangGraph + your Angular app. No phone-home.' },
];

export function Promises() {
  return (
    <Section surface="canvas" ariaLabelledBy="promises-heading">
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 56 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Built on principles</Eyebrow>
          <h2
            id="promises-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 12,
              letterSpacing: '-0.015em',
            }}
          >
            What we won&apos;t do.
          </h2>
          <p style={{
            fontFamily: tokens.typography.bodyLg.family,
            fontSize: tokens.typography.bodyLg.size,
            lineHeight: tokens.typography.bodyLg.line,
            color: tokens.colors.textSecondary,
            margin: 0,
          }}>
            Honest commitments, not aspirations.
          </p>
        </div>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: 16,
            maxWidth: 1100,
            margin: '0 auto',
          }}
        >
          {PROMISES.map((p) => (
            <Card key={p.title} padding="lg">
              <h3 style={{
                fontFamily: tokens.typography.h3.family,
                fontSize: 17,
                lineHeight: 1.3,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 8,
              }}>
                {p.title}
              </h3>
              <p style={{
                fontFamily: tokens.typography.body.family,
                fontSize: 14,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}>
                {p.body}
              </p>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/Promises.tsx
git commit -m "feat(website): add Promises section with 5 honest commitments"
```

---

## Task 9: `HomeFAQ` section

**Files:**
- Create: `apps/website/src/components/landing/HomeFAQ.tsx`

Wraps the `FAQ` primitive with homepage content.

- [ ] **Step 1: Create the file**

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { FAQ, type FAQItem } from '../ui/FAQ';

const ITEMS: FAQItem[] = [
  {
    q: 'How is this different from CopilotKit or AG-UI directly?',
    a: 'CopilotKit ports React patterns to Angular. AG-UI is a protocol — you still build the Angular side. Angular Agent Framework is Angular-native: signals, DI, zoneless support, and adapters that hide the protocol so you can swap LangGraph for AG-UI without rewriting your UI.',
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
    a: 'Yes — the Cockpit reference app runs the full stack. We track Angular’s release cadence and ship against current and one previous major.',
  },
  {
    q: 'Where do I report issues?',
    a: 'GitHub Issues. Pilot customers also get a private channel.',
  },
];

export function HomeFAQ() {
  return (
    <Section surface="white" ariaLabelledBy="faq-heading">
      <Container>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Questions</Eyebrow>
          <h2
            id="faq-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              letterSpacing: '-0.015em',
            }}
          >
            Frequently asked questions.
          </h2>
        </div>
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <FAQ items={ITEMS} />
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/HomeFAQ.tsx
git commit -m "feat(website): add HomeFAQ section with 8 honest answers (drafts)"
```

---

## Task 10: `FinalCTA` section

**Files:**
- Create: `apps/website/src/components/landing/FinalCTA.tsx`

Tinted closing band.

- [ ] **Step 1: Create the file**

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Button } from '../ui/Button';

export function FinalCTA() {
  return (
    <Section surface="tinted" ariaLabelledBy="final-cta-heading">
      <Container>
        <div style={{ maxWidth: 720, margin: '0 auto', textAlign: 'center' }}>
          <h2
            id="final-cta-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 16,
              letterSpacing: '-0.015em',
              fontStyle: 'italic',
            }}
          >
            Stop stalling on agentic Angular.
          </h2>
          <p style={{
            fontFamily: tokens.typography.bodyLg.family,
            fontSize: tokens.typography.bodyLg.size,
            lineHeight: tokens.typography.bodyLg.line,
            color: tokens.colors.textSecondary,
            margin: 0,
            marginBottom: 32,
          }}>
            Install the framework, read the docs, and have a streaming chat in your app this afternoon.
          </p>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
            <Button variant="primary" size="lg" href="/docs">Get started</Button>
            <Button variant="ghost" size="lg" href="https://cockpit.cacheplane.ai" target="_blank" rel="noopener noreferrer">
              See it live →
            </Button>
          </div>
          <p style={{
            fontFamily: tokens.typography.caption.family,
            fontSize: tokens.typography.caption.size,
            color: tokens.colors.textMuted,
            margin: 0,
          }}>
            MIT · No signup required · No telemetry
          </p>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/FinalCTA.tsx
git commit -m "feat(website): add FinalCTA section"
```

---

## Task 11: Wire the new homepage in `page.tsx`

**Files:**
- Modify: `apps/website/src/app/page.tsx`

Drop the gradient blobs, the `tokens.gradient.bgFlow` background, and the 7 old sections. Assemble the 11 new sections.

- [ ] **Step 1: Rewrite `apps/website/src/app/page.tsx`**

```tsx
import { Hero } from '../components/landing/Hero';
import { ProofStrip } from '../components/landing/ProofStrip';
import { Differentiator } from '../components/landing/Differentiator';
import { FeatureBlock } from '../components/landing/FeatureBlock';
import { BrowserFrame } from '../components/ui/BrowserFrame';
import { LiveCockpitFrame } from '../components/landing/LiveCockpitFrame';
import { PilotBlock } from '../components/landing/PilotBlock';
import { WhitePaperBlock } from '../components/landing/WhitePaperBlock';
import { Promises } from '../components/landing/Promises';
import { HomeFAQ } from '../components/landing/HomeFAQ';
import { FinalCTA } from '../components/landing/FinalCTA';
import { tokens } from '@ngaf/design-tokens';

export default async function HomePage() {
  return (
    <>
      <Hero />
      <ProofStrip />
      <Differentiator />

      {/* Stream */}
      <FeatureBlock
        id="stream"
        eyebrow="Stream"
        headline="Stream tokens to Angular signals — no glue code."
        body={
          <>
            <code style={{ fontFamily: tokens.typography.fontMono }}>provideAgent</code> + <code style={{ fontFamily: tokens.typography.fontMono }}>agent()</code> give you signals for messages, status, errors, and interrupts. LangGraph and AG-UI adapters share the contract — swap runtimes without rewriting the UI.
          </>
        }
        bullets={[
          'Token-level streaming straight into Angular signals',
          'Thread state, interrupts, tool progress, branch/history',
          'Adapters: LangGraph (@ngaf/langgraph), AG-UI (@ngaf/ag-ui)',
          'One contract, swappable runtimes',
        ]}
        supportingCards={[
          { title: 'provideAgent', description: 'Wire the agent into your app.config.ts.' },
          { title: 'AgUiAdapter', description: 'Any AG-UI compliant backend.' },
          { title: 'LangGraphAdapter', description: 'Native LangGraph streaming.' },
        ]}
        cta={{ label: 'Read the streaming guide', href: '/docs/agent/api/agent' }}
        visual={
          <BrowserFrame url="cockpit.cacheplane.ai/chat" elevation="md">
            <div style={{
              padding: 28,
              background: 'linear-gradient(180deg, #fff 0%, #f8fafc 100%)',
              minHeight: 320,
            }}>
              <div style={{ fontFamily: tokens.typography.fontMono, fontSize: 11, color: tokens.colors.textMuted, marginBottom: 12 }}>
                ASSISTANT · streaming
              </div>
              <div style={{ fontFamily: tokens.typography.fontSans, fontSize: 14, color: tokens.colors.textPrimary, lineHeight: 1.6 }}>
                Building the Angular chat surface from your existing component library. Tool call results render as Angular components, not raw JSON.
                <span style={{ display: 'inline-block', width: 6, height: 14, background: tokens.colors.accent, marginLeft: 2, verticalAlign: 'middle', animation: 'blink 1s steps(2) infinite' }} />
              </div>
              <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${tokens.surfaces.border}`, fontFamily: tokens.typography.fontMono, fontSize: 11, color: tokens.colors.textSecondary }}>
                tools: render_card · search_docs · stream complete
              </div>
            </div>
          </BrowserFrame>
        }
      />

      {/* Render */}
      <FeatureBlock
        id="render"
        eyebrow="Render"
        headline="Generative UI that renders into your design system."
        body="Server-emitted JSON specs become Angular components you already own. Vercel json-render and Google A2UI both supported, with per-component fallback and a readiness gate."
        bullets={[
          'Per-component fallback API + readiness gate',
          'A2UI v1 protocol + Vercel json-render adapter',
          'Renders into your existing component library',
          'Server-side schema, client-side trust',
        ]}
        supportingCards={[
          { title: 'chat-timeline', description: 'Drop-in conversation surface.' },
          { title: 'chat-debug', description: 'Live devtools for tool calls.' },
          { title: 'GenUI surfaces', description: 'Schema-driven UI from agent output.' },
        ]}
        cta={{ label: 'See @ngaf/render', href: '/render' }}
        visualLeft
        visual={
          <BrowserFrame url="cockpit.cacheplane.ai/render" elevation="md">
            <div style={{
              padding: 28,
              background: tokens.surfaces.surface,
              minHeight: 320,
            }}>
              <div style={{
                background: tokens.surfaces.surfaceTinted,
                border: `1px solid ${tokens.surfaces.border}`,
                borderRadius: tokens.radius.md,
                padding: 16,
                marginBottom: 12,
              }}>
                <div style={{ fontFamily: tokens.typography.fontMono, fontSize: 11, color: tokens.colors.accent, marginBottom: 8 }}>
                  AI-rendered · Angular component
                </div>
                <div style={{ fontFamily: tokens.typography.fontSerif, fontSize: 18, fontWeight: 700, color: tokens.colors.textPrimary, marginBottom: 6 }}>
                  Q3 revenue: $4.2M
                </div>
                <div style={{ fontFamily: tokens.typography.fontSans, fontSize: 13, color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
                  +18% vs Q2. Driven by enterprise upsells in the EU.
                </div>
              </div>
              <div style={{
                background: tokens.colors.accentSurface,
                border: `1px dashed ${tokens.colors.accentBorder}`,
                borderRadius: tokens.radius.sm,
                padding: '8px 12px',
                fontFamily: tokens.typography.fontMono,
                fontSize: 11,
                color: tokens.colors.accent,
              }}>
                fallback ready · readiness gate ✓
              </div>
            </div>
          </BrowserFrame>
        }
      />

      {/* Ship — the live demo */}
      <FeatureBlock
        id="ship"
        eyebrow="Ship"
        headline="Patterns built for production, not demos."
        body="Error boundaries, observability hooks, fallback strategies — the stuff that turns a demo into a real app. MIT-licensed, so the code is yours forever."
        bullets={[
          'error() / status() / reload() signals',
          'Readiness gate + per-component fallback',
          'Thread persistence patterns',
          'MIT licensed — own it forever',
        ]}
        supportingCards={[
          { title: 'error/status/reload', description: 'Boundary signals for every agent.' },
          { title: 'readiness gate', description: 'Hold renders until the surface is real.' },
          { title: 'thread persistence', description: 'Restore conversations across sessions.' },
        ]}
        cta={{ label: 'Production patterns', href: '/docs/agent/guides/production' }}
        visual={<LiveCockpitFrame />}
      />

      <PilotBlock />
      <WhitePaperBlock />
      <Promises />
      <HomeFAQ />
      <FinalCTA />
    </>
  );
}
```

- [ ] **Step 2: Run e2e to confirm no regressions**

Run: `pnpm nx e2e website`
Expected: most tests pass. The existing `website.spec.ts` tests for "landing page renders architecture section" and "landing page renders libraries section" WILL fail — those assertions reference the OLD homepage content (`Architecture` and `Four libraries. One architecture.`) which we just removed. Acceptable: update or remove those obsolete assertions in Step 3.

- [ ] **Step 3: Update the existing landing-page e2e assertions**

The existing tests target the old IA. Update them to match the new homepage:

In `apps/website/e2e/website.spec.ts`, replace lines 3-18 (the three `landing page renders …` tests):

```typescript
test('landing page renders hero headline', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#hero-heading')).toBeVisible();
  const headline = await page.locator('#hero-heading').textContent();
  expect(headline?.toLowerCase()).toContain('angular');
});

test('landing page renders differentiator section', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByText('Built for Angular, not retrofitted.').first()).toBeVisible();
});

test('landing page renders feature blocks (Stream/Render/Ship)', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('#stream-heading')).toBeVisible();
  await expect(page.locator('#render-heading')).toBeVisible();
  await expect(page.locator('#ship-heading')).toBeVisible();
});
```

- [ ] **Step 4: Re-run e2e**

Run: `pnpm nx e2e website`
Expected: all 24 tests pass (10 primitives + 14 updated site tests — one more added to cover feature blocks).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/page.tsx apps/website/e2e/website.spec.ts
git commit -m "feat(website): rebuild homepage against new IA — 11 sections"
```

---

## Task 12: Final verification

**Files:** none

- [ ] **Step 1: Visual smoke**

Start dev server. Scroll through `/`. Confirm:
- Hero loads with collage
- Proof strip looks tight, no hover regressions
- Differentiator + 4 cards visible
- Three feature blocks alternate left/right
- Live cockpit iframe loads when scrolled to
- Pilot block visible
- Whitepaper form works (don't actually submit)
- Promises 5-up grid
- FAQ items expand/collapse
- Final CTA appears

- [ ] **Step 2: Confirm full e2e passes**

Run: `pnpm nx e2e website`
Expected: all tests green.

- [ ] **Step 3: Grep for any stray references to deleted-from-homepage components**

Run: `grep -n "HeroTwoCol\|PositioningStrip\|ProblemSection\|PilotSolution\|TheStack\|PilotFooterCTA\|WhitePaperSection" apps/website/src/app/page.tsx`
Expected: zero matches.

---

## Summary

After this plan executes:
- 10 new section components in `apps/website/src/components/landing/`
- 1 new client component (`LiveCockpitFrame`)
- `page.tsx` rewritten with new IA, no gradient blobs
- E2E tests updated to match new content
- Old landing components NOT deleted (still referenced by other routes; Phase 6 deletes orphans)

Next phase (separate plan): Phase 5 — migrate `/pilot-to-prod`, `/angular`, `/chat`, `/render`, `/solutions`, `/pricing` to the new primitives.
