# Library Landing Pages & Home Page Refactor Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create 3 bespoke library landing pages, refactor the home page with teaser cards, generate 3 whitepapers, add drip email campaigns, update the footer, and merge mobile docs nav into the header.

**Architecture:** Next.js App Router pages at `/angular`, `/render`, `/chat`. Each page is a sequence of React components following existing glassmorphism + framer-motion patterns. Whitepaper pipeline refactored to support multiple configs. Mobile nav merges DocsMobileNav into Nav.tsx with pathname-aware rendering.

**Tech Stack:** Next.js 13+ (App Router), React, Framer Motion, `@cacheplane/design-tokens`, Anthropic SDK + Puppeteer (whitepaper generation)

---

## Task 1: Home Page — Replace FullStackSection with LibrariesSection

**Files:**
- Create: `apps/website/src/components/landing/LibrariesSection.tsx`
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Create LibrariesSection component**

```tsx
// apps/website/src/components/landing/LibrariesSection.tsx
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
    oneLiner: 'Signal-native streaming for LangGraph agents',
    chips: ['agent()', 'provideAgent()', 'interrupt()', 'MockStreamTransport'],
    href: '/angular',
    ctaLabel: 'Explore Angular',
  },
  {
    id: 'render',
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: '#1a7a40',
    rgb: '26,122,64',
    oneLiner: 'Agents that render UI — without coupling to your frontend',
    chips: ['<render-spec>', 'defineAngularRegistry()', 'signalStateStore()', 'JSON patch'],
    href: '/render',
    ctaLabel: 'Explore Render',
  },
  {
    id: 'chat',
    tag: 'Chat',
    pkg: '@cacheplane/chat',
    color: '#5a00c8',
    rgb: '90,0,200',
    oneLiner: 'Batteries-included agent chat — fully featured from day one',
    chips: ['<chat-messages>', '<chat>', '<chat-debug>', '<chat-generative-ui>'],
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
];

export function LibrariesSection() {
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
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,46px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary, marginBottom: 10,
        }}>
          Three libraries. One architecture.
        </h2>
        <p style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontStyle: 'italic', fontSize: '1.05rem', color: tokens.colors.textSecondary,
          maxWidth: 520, margin: '0 auto',
        }}>
          Everything your Angular team needs to ship AI agents to production.
        </p>
      </motion.div>

      <div style={{
        maxWidth: 1000, margin: '0 auto',
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
        gap: 24,
      }}>
        {LIBRARIES.map((lib, i) => (
          <motion.div
            key={lib.id}
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              background: `rgba(${lib.rgb}, 0.03)`,
              border: `1px solid rgba(${lib.rgb}, 0.15)`,
              borderRadius: 14,
              padding: '24px 24px 20px',
              display: 'flex',
              flexDirection: 'column',
              gap: 12,
            }}
          >
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
              padding: '2px 9px', borderRadius: 5, color: '#fff', background: lib.color,
            }}>
              {lib.tag}
            </span>

            <p style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.76rem', fontWeight: 700, color: lib.color, margin: 0,
            }}>
              {lib.pkg}
            </p>

            <p style={{
              fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
              fontSize: '1.1rem', fontWeight: 700, color: tokens.colors.textPrimary,
              lineHeight: 1.25, margin: 0,
            }}>
              {lib.oneLiner}
            </p>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
              {lib.chips.map(chip => (
                <span key={chip} style={{
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.58rem', padding: '2px 8px', borderRadius: 4,
                  background: `rgba(${lib.rgb},.07)`, color: lib.color,
                  border: `1px solid rgba(${lib.rgb},.15)`,
                }}>
                  {chip}
                </span>
              ))}
            </div>

            <Link
              href={lib.href}
              style={{
                fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                fontSize: '0.72rem', fontWeight: 700, color: lib.color,
                textDecoration: 'none', marginTop: 'auto', paddingTop: 8,
                display: 'inline-flex', alignItems: 'center', gap: 4,
              }}
            >
              {lib.ctaLabel} →
            </Link>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Update home page to use LibrariesSection**

In `apps/website/src/app/page.tsx`, replace the FullStackSection import and usage:

```tsx
// Remove this import:
// import { FullStackSection } from '../components/landing/FullStackSection';

// Add this import:
import { LibrariesSection } from '../components/landing/LibrariesSection';

// In the JSX, replace:
//   {/* 4. Architecture — three-layer stack diagram */}
//   <FullStackSection />
// With:
//   {/* 4. Libraries — three-card teaser grid */}
//   <LibrariesSection />
```

- [ ] **Step 3: Verify the home page renders**

Run: `npx nx serve website`

Expected: Home page loads, LibrariesSection shows 3 cards with correct colors, chips, and links. Clicking "Explore Angular →" navigates to `/angular` (404 expected at this point).

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/LibrariesSection.tsx apps/website/src/app/page.tsx
git commit -m "feat(website): replace FullStackSection with LibrariesSection teaser cards"
```

---

## Task 2: Footer — Add Libraries Column

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] **Step 1: Add Libraries column to Footer**

In `apps/website/src/components/shared/Footer.tsx`, change the grid from 4 to 5 columns and add the Libraries column between Product and Resources:

```tsx
// Change the grid container class:
// FROM: className="grid grid-cols-1 md:grid-cols-4 gap-10 md:gap-8"
// TO:   className="grid grid-cols-1 md:grid-cols-5 gap-10 md:gap-8"

// After the Product column (</div>) and before the Resources column, add:
          {/* Libraries column */}
          <div className="flex flex-col gap-2.5 text-sm">
            <span className="font-mono text-xs uppercase tracking-wider mb-1" style={{ color: tokens.colors.accent }}>Libraries</span>
            <Link href="/angular" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Angular
            </Link>
            <Link href="/render" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Render
            </Link>
            <Link href="/chat" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Chat
            </Link>
          </div>
```

- [ ] **Step 2: Verify footer renders with 5 columns**

Run: `npx nx serve website`

Expected: Footer shows Brand (2 cols), Product, Libraries (Angular/Render/Chat), Resources. Links navigate to `/angular`, `/render`, `/chat`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "feat(website): add Libraries column to footer for SEO/bot discovery"
```

---

## Task 3: Mobile Nav — Merge DocsMobileNav into Header

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`
- Modify: `apps/website/src/app/docs/[[...slug]]/page.tsx`
- Delete: `apps/website/src/components/docs/DocsMobileNav.tsx` (after integration)

- [ ] **Step 1: Make Nav pathname-aware and add docs sections to mobile menu**

In `apps/website/src/components/shared/Nav.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';
import { docsConfig } from '../../lib/docs-config';

// ... (existing links, icons unchanged)

export function Nav() {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const isDocsPage = pathname.startsWith('/docs');

  // Extract active section/slug from pathname for highlighting
  const pathParts = pathname.split('/').filter(Boolean); // ['docs', 'guides', 'streaming']
  const activeSection = isDocsPage && pathParts.length >= 2 ? pathParts[1] : '';
  const activeSlug = isDocsPage && pathParts.length >= 3 ? pathParts[2] : '';

  // Collapsible docs section state
  const [openSections, setOpenSections] = useState<Set<string>>(() => new Set(activeSection ? [activeSection] : []));

  const toggleSection = (id: string) => {
    setOpenSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  return (
    <nav className="fixed top-0 left-0 right-0 z-50" style={{ /* ... existing styles ... */ }}>
      {/* Top bar — unchanged */}
      {/* Desktop links — unchanged */}
      {/* Mobile hamburger — unchanged */}

      {/* Mobile menu */}
      {open && (
        <div className="md:hidden px-6 pb-5 flex flex-col gap-4"
          style={{ borderTop: `1px solid ${tokens.glass.border}`, maxHeight: '80vh', overflowY: 'auto' }}>
          {/* Existing site links */}
          {links.map((l) => l.external ? (
            <a key={l.href} href={l.href} target="_blank" rel="noopener noreferrer"
              onClick={() => setOpen(false)} className="text-sm font-mono py-1"
              style={{ color: tokens.colors.textSecondary }}>
              {l.label}
            </a>
          ) : (
            <Link key={l.href} href={l.href} onClick={() => setOpen(false)}
              className="text-sm font-mono py-1"
              style={{ color: tokens.colors.textSecondary }}>
              {l.label}
            </Link>
          ))}

          {/* GitHub + CTA */}
          <div className="flex items-center gap-4 pt-2">
            <a href="https://github.com/cacheplane/stream-resource" target="_blank" rel="noopener noreferrer"
              style={{ color: tokens.colors.textSecondary }} aria-label="GitHub repository">
              <GitHubIcon />
            </a>
            <Link href="/pilot-to-prod#whitepaper-gate" onClick={() => setOpen(false)}
              className="px-4 py-2 text-sm font-mono rounded"
              style={{ background: tokens.colors.accent, color: '#fff' }}>
              Get Started
            </Link>
          </div>

          {/* Docs sections — only shown on docs pages */}
          {isDocsPage && (
            <>
              <div style={{ borderTop: `1px solid ${tokens.glass.border}`, margin: '8px 0 4px' }} />
              <span className="font-mono text-xs uppercase tracking-wider"
                style={{ color: tokens.colors.accent, fontWeight: 600 }}>
                Documentation
              </span>
              {docsConfig.map((section) => (
                <div key={section.id}>
                  <button
                    onClick={() => toggleSection(section.id)}
                    className="flex items-center gap-2 w-full text-left font-mono text-xs uppercase tracking-wider py-1"
                    style={{
                      color: section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent,
                      fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer',
                    }}
                  >
                    <span style={{
                      display: 'inline-block', transition: 'transform 0.2s',
                      transform: openSections.has(section.id) ? 'rotate(90deg)' : 'rotate(0deg)',
                      fontSize: '0.6rem',
                    }}>
                      ▶
                    </span>
                    {section.title}
                  </button>
                  {openSections.has(section.id) && section.pages.map((page) => {
                    const isActive = page.section === activeSection && page.slug === activeSlug;
                    return (
                      <Link
                        key={`${page.section}/${page.slug}`}
                        href={`/docs/${page.section}/${page.slug}`}
                        onClick={() => setOpen(false)}
                        className="block pl-6 py-1 text-sm"
                        style={{
                          color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                          background: isActive ? tokens.colors.accentSurface : 'transparent',
                          borderRadius: 4,
                        }}
                      >
                        {page.title}
                      </Link>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </nav>
  );
}
```

- [ ] **Step 2: Remove DocsMobileNav from docs page layout**

In `apps/website/src/app/docs/[[...slug]]/page.tsx`:

```tsx
// Remove this import:
// import { DocsMobileNav } from '../../../components/docs/DocsMobileNav';

// Remove this JSX block:
//   <div className="px-4 pt-4 sm:hidden">
//     <DocsMobileNav activeSection={section} activeSlug={slug} />
//   </div>
```

- [ ] **Step 3: Delete DocsMobileNav component**

```bash
rm apps/website/src/components/docs/DocsMobileNav.tsx
```

- [ ] **Step 4: Verify mobile nav on docs pages**

Run: `npx nx serve website`

Open Chrome DevTools, toggle mobile viewport. Navigate to `/docs/getting-started/introduction`.

Expected: Single hamburger menu shows site links + divider + Documentation sections. Clicking a docs section expands it. Active page is highlighted. No separate docs menu button in the content area.

- [ ] **Step 5: Verify mobile nav on non-docs pages**

Navigate to `/` in mobile viewport.

Expected: Hamburger menu shows only site links + GitHub + Get Started. No Documentation section.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx apps/website/src/app/docs/\[\[...slug\]\]/page.tsx
git rm apps/website/src/components/docs/DocsMobileNav.tsx
git commit -m "feat(website): merge DocsMobileNav into header for unified mobile navigation"
```

---

## Task 4: Angular Landing Page (`/angular`)

**Files:**
- Create: `apps/website/src/app/angular/page.tsx`
- Create: `apps/website/src/components/landing/angular/AngularHero.tsx`
- Create: `apps/website/src/components/landing/angular/AngularProblemSolution.tsx`
- Create: `apps/website/src/components/landing/angular/AngularFeaturesGrid.tsx`
- Create: `apps/website/src/components/landing/angular/AngularCodeShowcase.tsx`
- Create: `apps/website/src/components/landing/angular/AngularComparison.tsx`
- Create: `apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx`
- Create: `apps/website/src/components/landing/angular/AngularFooterCTA.tsx`

Note: Components are organized in a subdirectory `angular/` to keep the landing directory manageable with 3 libraries x 7 components each.

- [ ] **Step 1: Create the page route**

```tsx
// apps/website/src/app/angular/page.tsx
import { AngularHero } from '../../components/landing/angular/AngularHero';
import { AngularProblemSolution } from '../../components/landing/angular/AngularProblemSolution';
import { AngularFeaturesGrid } from '../../components/landing/angular/AngularFeaturesGrid';
import { AngularCodeShowcase } from '../../components/landing/angular/AngularCodeShowcase';
import { AngularComparison } from '../../components/landing/angular/AngularComparison';
import { AngularWhitePaperGate } from '../../components/landing/angular/AngularWhitePaperGate';
import { AngularFooterCTA } from '../../components/landing/angular/AngularFooterCTA';
import { tokens } from '@cacheplane/design-tokens';

export const metadata = {
  title: '@cacheplane/angular — Agent Streaming for Angular',
  description: 'Ship LangGraph agents in Angular. Signal-native streaming, thread persistence, interrupts, and deterministic testing.',
};

export default function AngularPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,64,144,0.08) 0%, transparent 70%)', top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(0,64,144,0.06) 0%, transparent 70%)', top: 2400, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <AngularHero />
      <AngularProblemSolution />
      <AngularFeaturesGrid />
      <AngularCodeShowcase />
      <AngularComparison />
      <AngularWhitePaperGate />
      <AngularFooterCTA />
    </div>
  );
}
```

- [ ] **Step 2: Create AngularHero**

```tsx
// apps/website/src/components/landing/angular/AngularHero.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const BADGES = ['Angular 20+', 'LangGraph', 'LangChain', 'DeepAgent'];

export function AngularHero() {
  return (
    <section aria-labelledby="angular-hero-heading" style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="py-24 md:py-32">
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
            color: tokens.colors.accent, textTransform: 'uppercase', display: 'inline-block', marginBottom: '1.5rem',
          }}>
            @cacheplane/angular
          </span>
        </motion.div>

        <motion.h1 id="angular-hero-heading" initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: "'EB Garamond', serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700,
            lineHeight: 1.1, color: tokens.colors.textPrimary, margin: 0, marginBottom: '1.25rem',
          }}>
          Ship LangGraph agents in Angular — without building the plumbing
        </motion.h1>

        <motion.p initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 18, color: tokens.colors.textSecondary,
            maxWidth: '52ch', margin: '0 auto', lineHeight: 1.6, marginBottom: '2rem',
          }}>
          Signal-native streaming, thread persistence, interrupts, and deterministic testing. The complete agent primitive layer for Angular 20+.
        </motion.p>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="/whitepapers/angular.pdf" download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.colors.accent, color: '#fff', fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', boxShadow: tokens.glow.button, minHeight: 44,
            }}>
            Download the Guide
          </a>
          <a href="/docs"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: tokens.colors.accent, fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', border: `1px solid ${tokens.colors.accentBorder}`, minHeight: 44,
            }}>
            View Docs
          </a>
        </motion.div>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {BADGES.map(badge => (
            <span key={badge} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.06em',
              color: tokens.colors.textMuted, textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 4,
              background: 'rgba(0,64,144,0.04)', border: '1px solid rgba(0,64,144,0.1)',
            }}>
              {badge}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Create AngularProblemSolution**

```tsx
// apps/website/src/components/landing/angular/AngularProblemSolution.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const PAIN_POINTS = [
  'Zone.js interference with SSE event streams',
  'Manual subscription management and cleanup',
  'Custom SSE wiring that breaks under load',
  'Incompatibility with OnPush change detection',
  'No deterministic test story for streaming',
];

const SOLUTIONS = [
  'Signals-native API — no zone patching needed',
  'Automatic subscription lifecycle management',
  'OnPush compatible from day one',
  'Built-in thread persistence and restore',
  'interrupt() signal for human approval flows',
  'MockStreamTransport for offline, deterministic tests',
];

export function AngularProblemSolution() {
  return (
    <section style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ maxWidth: 900, margin: '0 auto', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}
        className="grid-cols-1 md:grid-cols-2"
      >
        {/* Without */}
        <div style={{
          padding: 28, borderRadius: 14,
          background: 'rgba(183,28,28,0.03)', border: '1px solid rgba(183,28,28,0.15)',
        }}>
          <span style={{
            display: 'inline-block', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            padding: '2px 9px', borderRadius: 5, color: '#fff', background: '#b71c1c', marginBottom: 16,
          }}>
            Without @cacheplane/angular
          </span>
          <h3 style={{
            fontFamily: "'EB Garamond', serif", fontSize: '1.3rem', fontWeight: 700,
            color: tokens.colors.textPrimary, lineHeight: 1.25, marginBottom: 16,
          }}>
            Your LangGraph agent works. Your Angular frontend doesn't stream it.
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {PAIN_POINTS.map(p => (
              <li key={p} style={{ display: 'flex', gap: 8, fontSize: '0.85rem', color: '#555', lineHeight: 1.5 }}>
                <span style={{ color: '#b71c1c', flexShrink: 0 }}>✗</span> {p}
              </li>
            ))}
          </ul>
        </div>

        {/* With */}
        <div style={{
          padding: 28, borderRadius: 14,
          background: 'rgba(26,122,64,0.03)', border: '1px solid rgba(26,122,64,0.15)',
        }}>
          <span style={{
            display: 'inline-block', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em',
            padding: '2px 9px', borderRadius: 5, color: '#fff', background: '#1a7a40', marginBottom: 16,
          }}>
            With @cacheplane/angular
          </span>
          <h3 style={{
            fontFamily: "'EB Garamond', serif", fontSize: '1.3rem', fontWeight: 700,
            color: tokens.colors.textPrimary, lineHeight: 1.25, marginBottom: 16,
          }}>
            agent() gives you production-ready streaming on day one.
          </h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
            {SOLUTIONS.map(s => (
              <li key={s} style={{ display: 'flex', gap: 8, fontSize: '0.85rem', color: '#333', lineHeight: 1.5 }}>
                <span style={{ color: '#1a7a40', flexShrink: 0 }}>✓</span> {s}
              </li>
            ))}
          </ul>
        </div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 4: Create AngularFeaturesGrid**

```tsx
// apps/website/src/components/landing/angular/AngularFeaturesGrid.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const FEATURES = [
  { title: 'agent() API', desc: 'Signal-native streaming with automatic state management. One function to connect your Angular app to LangGraph.', iframePath: 'langgraph/streaming' },
  { title: 'Thread Persistence', desc: 'Conversations survive page refreshes. Built-in threadId signal with localStorage restore and thread list UI.', iframePath: 'langgraph/persistence' },
  { title: 'Interrupt Handling', desc: 'Human-in-the-loop approval flows. interrupt() signal maps directly to approve, edit, or cancel actions.', iframePath: 'langgraph/interrupts' },
  { title: 'Tool Call Support', desc: 'Structured tool execution state. Progressive disclosure — live steps, completion, collapsible history.', iframePath: 'langgraph/tool-calls' },
  { title: 'Time Travel', desc: 'Navigate agent state history. Replay, inspect, and debug any point in a conversation timeline.', iframePath: 'langgraph/time-travel' },
  { title: 'DeepAgent Support', desc: 'Multi-agent orchestration with full streaming support. Subgraphs, delegation, parallel execution.', iframePath: 'deep-agents/subgraphs' },
];

export function AngularFeaturesGrid() {
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
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          Features
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Every LangGraph capability, production-ready
        </h2>
      </motion.div>

      <div style={{
        maxWidth: 1000, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(440px, 1fr))', gap: 24,
      }}>
        {FEATURES.map((feat, i) => (
          <motion.div
            key={feat.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.08 }}
            style={{
              background: tokens.glass.bg, border: `1px solid ${tokens.glass.border}`,
              backdropFilter: `blur(${tokens.glass.blur})`, WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              borderRadius: 14, overflow: 'hidden', boxShadow: tokens.glass.shadow,
            }}
          >
            <div style={{ padding: '20px 24px 16px' }}>
              <h3 style={{
                fontFamily: 'Inter, sans-serif', fontSize: 16, fontWeight: 600,
                color: tokens.colors.textPrimary, margin: 0, marginBottom: 6,
              }}>
                {feat.title}
              </h3>
              <p style={{
                fontFamily: 'Inter, sans-serif', fontSize: 14, color: tokens.colors.textSecondary,
                lineHeight: 1.6, margin: 0,
              }}>
                {feat.desc}
              </p>
            </div>
            <div style={{ borderTop: `1px solid ${tokens.glass.border}`, background: 'rgba(0,0,0,0.02)' }}>
              <iframe
                src={`https://cockpit.cacheplane.ai/${feat.iframePath}`}
                title={feat.title}
                style={{ width: '100%', height: 320, border: 'none', display: 'block' }}
                loading="lazy"
              />
            </div>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 5: Create AngularCodeShowcase**

```tsx
// apps/website/src/components/landing/angular/AngularCodeShowcase.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const SNIPPET_1 = `import { agent } from '@cacheplane/angular';

const chat = agent({
  graphId: 'my-agent',
  url: 'https://my-langgraph.cloud/api',
});

// Reactive signals — OnPush compatible
chat.messages();    // Signal<AIMessage[]>
chat.isStreaming(); // Signal<boolean>
chat.interrupt();   // Signal<Interrupt | null>`;

const SNIPPET_2 = `import { provideAgent } from '@cacheplane/angular';

provideAgent({
  graphId: 'my-agent',
  url: environment.langgraphUrl,
  threadId: savedThreadId,
  onThreadId: (id) => localStorage.setItem('threadId', id),
  transport: isTest
    ? new MockStreamTransport(fixtures)
    : new FetchStreamTransport(),
});`;

export function AngularCodeShowcase() {
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
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          Developer Experience
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          Production streaming in a few lines
        </h2>
      </motion.div>

      <div style={{
        maxWidth: 900, margin: '0 auto',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(380px, 1fr))', gap: 24,
      }}>
        {[{ title: 'Minimal Setup', code: SNIPPET_1 }, { title: 'Full Configuration', code: SNIPPET_2 }].map((s, i) => (
          <motion.div
            key={s.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.45, delay: i * 0.1 }}
            style={{ borderRadius: 14, overflow: 'hidden', border: `1px solid ${tokens.glass.border}` }}
          >
            <div style={{
              padding: '10px 20px', background: 'rgba(0,64,144,0.04)',
              borderBottom: `1px solid ${tokens.glass.border}`,
            }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem',
                fontWeight: 700, color: tokens.colors.accent,
              }}>
                {s.title}
              </span>
            </div>
            <pre style={{
              background: '#1a1b26', color: '#c8ccee', padding: '20px 24px',
              fontSize: '0.78rem', lineHeight: 1.65, margin: 0, overflowX: 'auto',
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              <code>{s.code}</code>
            </pre>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 6: Create AngularComparison**

```tsx
// apps/website/src/components/landing/angular/AngularComparison.tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

const ROWS = [
  { capability: 'SSE streaming', theirs: 'Manual wiring', ours: 'Signal-native via agent()' },
  { capability: 'State management', theirs: 'Custom signals', ours: 'Built-in reactive state' },
  { capability: 'Thread persistence', theirs: 'DIY localStorage', ours: 'Built-in threadId signal + restore' },
  { capability: 'Interrupt handling', theirs: 'Manual Command.RESUME', ours: 'interrupt() signal + approve/edit/cancel' },
  { capability: 'Tool call rendering', theirs: 'Raw events', ours: 'Structured tool call state' },
  { capability: 'Time travel', theirs: 'Not included', ours: 'Built-in state history' },
  { capability: 'Testing', theirs: 'Against live API', ours: 'MockStreamTransport, offline, <100ms' },
  { capability: 'OnPush compatibility', theirs: 'Requires workarounds', ours: 'Native signal support' },
  { capability: 'DeepAgent support', theirs: 'Not included', ours: 'Full multi-agent orchestration' },
];

export function AngularComparison() {
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
          fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          Head to Head
        </p>
        <h2 style={{
          fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
          fontSize: 'clamp(26px,3.5vw,42px)', fontWeight: 800, lineHeight: 1.1,
          color: tokens.colors.textPrimary,
        }}>
          LangGraph Angular SDK vs @cacheplane/angular
        </h2>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, delay: 0.15 }}
        style={{
          maxWidth: 860, margin: '0 auto', borderRadius: 20,
          background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glass.shadow, overflow: 'hidden',
        }}
      >
        <div style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
          background: 'rgba(255,255,255,.3)', borderBottom: `1px solid ${tokens.glass.border}`, padding: '14px 24px',
        }}>
          {['Capability', 'LangGraph Angular SDK', '@cacheplane/angular'].map((h, i) => (
            <div key={h} style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              color: i === 2 ? tokens.colors.accent : tokens.colors.textMuted,
            }}>
              {h}
            </div>
          ))}
        </div>
        {ROWS.map((row, i) => (
          <motion.div
            key={row.capability}
            initial={{ opacity: 0, x: -8 }}
            whileInView={{ opacity: 1, x: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.05, duration: 0.35 }}
            style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', padding: '14px 24px',
              borderBottom: i < ROWS.length - 1 ? '1px solid rgba(0,0,0,.05)' : 'none', alignItems: 'center',
            }}
          >
            <div style={{
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.72rem', fontWeight: 700, color: tokens.colors.textPrimary,
            }}>
              {row.capability}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.textMuted, paddingRight: 16, lineHeight: 1.5 }}>
              {row.theirs}
            </div>
            <div style={{ fontSize: '0.8rem', color: tokens.colors.accent, fontWeight: 500, lineHeight: 1.5, display: 'flex', alignItems: 'flex-start', gap: 6 }}>
              <span style={{ color: '#1a7a40', marginTop: 2, flexShrink: 0 }}>✓</span>
              <span>{row.ours}</span>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 7: Create AngularWhitePaperGate**

```tsx
// apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx
'use client';
import { useState } from 'react';
import { motion } from 'framer-motion';
import { tokens } from '@cacheplane/design-tokens';

type FormState = 'idle' | 'submitting' | 'done' | 'error';

export function AngularWhitePaperGate() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [formState, setFormState] = useState<FormState>('idle');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setFormState('submitting');
    try {
      const res = await fetch('/api/whitepaper-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, paper: 'angular' }),
      });
      if (!res.ok) throw new Error('Server error');
      setFormState('done');
    } catch {
      setFormState('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.7)',
    border: `1px solid ${tokens.glass.border}`, borderRadius: 10,
    padding: '10px 14px', fontSize: '0.88rem', color: tokens.colors.textPrimary,
    fontFamily: 'Inter, sans-serif', outline: 'none', marginBottom: 10,
    backdropFilter: `blur(${tokens.glass.blur})`,
  };

  return (
    <section id="whitepaper-gate" style={{ padding: '80px 32px' }}>
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{
          maxWidth: 860, margin: '0 auto', borderRadius: 20,
          background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glass.shadow,
          padding: '48px 56px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 56, alignItems: 'center',
        }}
      >
        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.68rem', textTransform: 'uppercase', letterSpacing: '0.12em',
            fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
          }}>
            Free Download
          </p>
          <h2 style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontSize: 'clamp(22px,2.5vw,36px)', fontWeight: 800, lineHeight: 1.15,
            color: tokens.colors.textPrimary, marginBottom: 14,
          }}>
            The Enterprise Guide to Agent Streaming in Angular
          </h2>
          <p style={{
            fontFamily: 'var(--font-garamond,"EB Garamond",Georgia,serif)',
            fontStyle: 'italic', fontSize: '1rem', color: tokens.colors.textSecondary,
            lineHeight: 1.55, marginBottom: 28,
          }}>
            Six chapters covering the last-mile problem, the agent() API, thread persistence, interrupts, full LangGraph feature coverage, and deterministic testing.
          </p>
          <a href="/whitepapers/angular.pdf" download="cacheplane-angular-enterprise-guide.pdf"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8,
              background: tokens.colors.accent, color: '#fff',
              padding: '12px 28px', borderRadius: 10,
              fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
              fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
              textDecoration: 'none', boxShadow: '0 4px 16px rgba(0,64,144,.28)',
            }}>
            ↓ Download PDF
          </a>
        </div>

        <div>
          <p style={{
            fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
            fontSize: '0.62rem', textTransform: 'uppercase', letterSpacing: '0.1em',
            fontWeight: 700, color: tokens.colors.textMuted, marginBottom: 16,
          }}>
            Optional — Get notified of updates
          </p>
          {formState === 'done' ? (
            <div style={{
              padding: '20px 24px', borderRadius: 12,
              background: 'rgba(26,122,64,.07)', border: '1px solid rgba(26,122,64,.2)',
              fontSize: '0.88rem', color: '#1a7a40', lineHeight: 1.55,
            }}>
              ✓ Thanks! We'll reach out when the guide is updated.
            </div>
          ) : (
            <form onSubmit={handleSubmit}>
              <label htmlFor="angular-wp-name" className="sr-only">Name (optional)</label>
              <input id="angular-wp-name" style={inputStyle} type="text" placeholder="Name (optional)"
                value={name} onChange={e => setName(e.target.value)} disabled={formState === 'submitting'} />
              <label htmlFor="angular-wp-email" className="sr-only">Email address</label>
              <input id="angular-wp-email" style={{ ...inputStyle, marginBottom: 16 }} type="email"
                placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)}
                required disabled={formState === 'submitting'} />
              {formState === 'error' && (
                <p style={{ fontSize: '0.8rem', color: tokens.colors.angularRed, marginBottom: 10 }}>
                  Something went wrong — please try again.
                </p>
              )}
              <button type="submit" disabled={formState === 'submitting' || !email}
                style={{
                  padding: '10px 24px', borderRadius: 9,
                  background: email ? 'rgba(0,64,144,.08)' : 'rgba(0,0,0,.04)',
                  border: `1px solid ${email ? 'rgba(0,64,144,.22)' : 'rgba(0,0,0,.08)'}`,
                  color: email ? tokens.colors.accent : tokens.colors.textMuted,
                  fontFamily: 'var(--font-mono,"JetBrains Mono",monospace)',
                  fontSize: '0.72rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em',
                  cursor: email ? 'pointer' : 'not-allowed',
                }}>
                {formState === 'submitting' ? 'Sending…' : 'Notify me'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 8: Create AngularFooterCTA**

```tsx
// apps/website/src/components/landing/angular/AngularFooterCTA.tsx
'use client';
import { tokens } from '@cacheplane/design-tokens';

export function AngularFooterCTA() {
  return (
    <section style={{ padding: '5rem 2rem' }}>
      <div style={{
        maxWidth: '42rem', margin: '0 auto', textAlign: 'center',
        background: tokens.glass.bg, border: `1px solid ${tokens.colors.accentBorder}`,
        borderRadius: 16, padding: 48,
        backdropFilter: `blur(${tokens.glass.blur})`,
      }}>
        <h2 style={{
          fontFamily: "'EB Garamond', serif", fontSize: 'clamp(24px, 4vw, 32px)',
          fontWeight: 700, color: tokens.colors.textPrimary, marginBottom: 16,
        }}>
          Ready to ship your LangGraph agent?
        </h2>
        <p style={{
          fontFamily: 'Inter, sans-serif', fontSize: 16, lineHeight: 1.7,
          color: tokens.colors.textSecondary, marginBottom: 32,
        }}>
          Download the enterprise guide, explore the docs, or start the pilot program.
        </p>
        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <a href="/whitepapers/angular.pdf" download
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: tokens.colors.accent, color: '#fff',
              fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', borderRadius: 6,
            }}>
            Download the Guide
          </a>
          <a href="/pilot-to-prod"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: tokens.glass.bg, color: tokens.colors.accent,
              fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', borderRadius: 6,
              border: `1px solid ${tokens.colors.accentBorder}`,
            }}>
            Pilot Program →
          </a>
          <a href="/docs"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: 'transparent', color: tokens.colors.textSecondary,
              fontFamily: 'Inter, sans-serif', fontSize: 15, fontWeight: 600,
              textDecoration: 'none', borderRadius: 6,
              border: `1px solid ${tokens.glass.border}`,
            }}>
            View Docs
          </a>
        </div>
      </div>
    </section>
  );
}
```

- [ ] **Step 9: Verify Angular landing page**

Run: `npx nx serve website`, navigate to `/angular`.

Expected: Full conversion funnel page with Hero → Problem/Solution → Features Grid (iframes may show loading/error if cockpit URLs don't match exactly — that's fine, the structure is correct) → Code Showcase → Comparison Table → Whitepaper Gate → Footer CTA.

- [ ] **Step 10: Commit**

```bash
git add apps/website/src/app/angular/ apps/website/src/components/landing/angular/
git commit -m "feat(website): add /angular landing page with full conversion funnel"
```

---

## Task 5: Render Landing Page (`/render`)

**Files:**
- Create: `apps/website/src/app/render/page.tsx`
- Create: `apps/website/src/components/landing/render/RenderHero.tsx`
- Create: `apps/website/src/components/landing/render/RenderProblemSolution.tsx`
- Create: `apps/website/src/components/landing/render/RenderFeaturesGrid.tsx`
- Create: `apps/website/src/components/landing/render/RenderCodeShowcase.tsx`
- Create: `apps/website/src/components/landing/render/RenderComparison.tsx`
- Create: `apps/website/src/components/landing/render/RenderWhitePaperGate.tsx`
- Create: `apps/website/src/components/landing/render/RenderFooterCTA.tsx`

Follow the same pattern as Task 4 with render-specific content. Key differences:

- [ ] **Step 1: Create render page route**

```tsx
// apps/website/src/app/render/page.tsx
import { RenderHero } from '../../components/landing/render/RenderHero';
import { RenderProblemSolution } from '../../components/landing/render/RenderProblemSolution';
import { RenderFeaturesGrid } from '../../components/landing/render/RenderFeaturesGrid';
import { RenderCodeShowcase } from '../../components/landing/render/RenderCodeShowcase';
import { RenderComparison } from '../../components/landing/render/RenderComparison';
import { RenderWhitePaperGate } from '../../components/landing/render/RenderWhitePaperGate';
import { RenderFooterCTA } from '../../components/landing/render/RenderFooterCTA';
import { tokens } from '@cacheplane/design-tokens';

export const metadata = {
  title: '@cacheplane/render — Generative UI for Angular',
  description: 'Agents that render UI without coupling to your frontend. Built on Vercel json-render spec.',
};

export default function RenderPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,122,64,0.08) 0%, transparent 70%)', top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(26,122,64,0.06) 0%, transparent 70%)', top: 2400, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <RenderHero />
      <RenderProblemSolution />
      <RenderFeaturesGrid />
      <RenderCodeShowcase />
      <RenderComparison />
      <RenderWhitePaperGate />
      <RenderFooterCTA />
    </div>
  );
}
```

- [ ] **Step 2: Create all 7 render components**

Each follows the exact same structural pattern as the Angular components but with render-specific content:

- **RenderHero:** Eyebrow "@cacheplane/render", green (#1a7a40) color, headline "Agents that render UI — without coupling to your frontend", badges: Angular 20+, Vercel json-render, JSON Patch streaming. CTA → `/whitepapers/render.pdf`.
- **RenderProblemSolution:** Without: "Every new agent output means a new frontend deploy." With: "The agent emits a spec. Your registry renders it."
- **RenderFeaturesGrid:** 6 features mapping to cockpit render examples: spec-rendering, element-rendering, state-management, registry, repeat-loops, computed-functions. Iframe src: `https://cockpit.cacheplane.ai/render/{capability}`.
- **RenderCodeShowcase:** Snippet 1: `defineAngularRegistry()` setup. Snippet 2: `<render-spec>` template binding.
- **RenderComparison:** "Hardcoded agent UI vs @cacheplane/render" — 7 rows as specified in the design spec.
- **RenderWhitePaperGate:** "The Enterprise Guide to Generative UI in Angular", paper: 'render'.
- **RenderFooterCTA:** Same pattern as AngularFooterCTA with render-specific links.

Each component file follows the identical structure to its Angular counterpart — same imports, same motion patterns, same glassmorphism tokens — only the data/content changes. Copy the Angular component, replace all content constants, and update the color from `tokens.colors.accent` (#004090) to `#1a7a40` where library-specific color is used.

- [ ] **Step 3: Verify render landing page**

Run: `npx nx serve website`, navigate to `/render`.

Expected: Full page with green color accents, Vercel json-render prominent in hero badges and subheadline, 6 feature cards with cockpit iframes.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/render/ apps/website/src/components/landing/render/
git commit -m "feat(website): add /render landing page — Vercel json-render generative UI"
```

---

## Task 6: Chat Landing Page (`/chat`)

**Files:**
- Create: `apps/website/src/app/chat/page.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingHero.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingProblemSolution.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingFeaturesGrid.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingComparison.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx`
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingFooterCTA.tsx`

Note: Directory is `chat-landing/` to avoid conflict with existing `ChatFeaturesSection` in the landing directory.

- [ ] **Step 1: Create chat page route**

```tsx
// apps/website/src/app/chat/page.tsx
import { ChatLandingHero } from '../../components/landing/chat-landing/ChatLandingHero';
import { ChatLandingProblemSolution } from '../../components/landing/chat-landing/ChatLandingProblemSolution';
import { ChatLandingFeaturesGrid } from '../../components/landing/chat-landing/ChatLandingFeaturesGrid';
import { ChatLandingCodeShowcase } from '../../components/landing/chat-landing/ChatLandingCodeShowcase';
import { ChatLandingComparison } from '../../components/landing/chat-landing/ChatLandingComparison';
import { ChatLandingWhitePaperGate } from '../../components/landing/chat-landing/ChatLandingWhitePaperGate';
import { ChatLandingFooterCTA } from '../../components/landing/chat-landing/ChatLandingFooterCTA';
import { tokens } from '@cacheplane/design-tokens';

export const metadata = {
  title: '@cacheplane/chat — Batteries-Included Agent Chat for Angular',
  description: 'Production agent chat UI in days, not sprints. Built on Vercel json-render and Google A2UI specs.',
};

export default function ChatPage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,0,200,0.08) 0%, transparent 70%)', top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, top: 800, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <div style={{ position: 'absolute', width: 400, height: 400, borderRadius: '50%', background: 'radial-gradient(circle, rgba(90,0,200,0.06) 0%, transparent 70%)', top: 2400, left: -100, filter: 'blur(80px)', pointerEvents: 'none' }} aria-hidden="true" />
      <ChatLandingHero />
      <ChatLandingProblemSolution />
      <ChatLandingFeaturesGrid />
      <ChatLandingCodeShowcase />
      <ChatLandingComparison />
      <ChatLandingWhitePaperGate />
      <ChatLandingFooterCTA />
    </div>
  );
}
```

- [ ] **Step 2: Create all 7 chat landing components**

Same structural pattern as Angular and Render. Key content differences:

- **ChatLandingHero:** Purple (#5a00c8), headline "Production agent chat UI in days, not sprints", subheadline about batteries-included + json-render + A2UI, badges: Angular 20+, Vercel json-render, Google A2UI, WCAG accessible. CTA → `/whitepapers/chat.pdf`.
- **ChatLandingProblemSolution:** Without: "Every team rebuilds the same chat UI. 4-6 weeks." With: "Fully featured from day one. No feature backlog."
- **ChatLandingFeaturesGrid:** 5 features: messages, input, generative-ui, theming, debug. Iframe src: `https://cockpit.cacheplane.ai/chat/{capability}`.
- **ChatLandingCodeShowcase:** Snippet 1: `<chat>` prebuilt (6-8 lines). Snippet 2: CSS custom properties theming (8-10 lines).
- **ChatLandingComparison:** "Incrementally building chat vs @cacheplane/chat" — sprint-based timeline rows as in design spec.
- **ChatLandingWhitePaperGate:** "The Enterprise Guide to Agent Chat Interfaces in Angular", paper: 'chat'.
- **ChatLandingFooterCTA:** Same CTA pattern with chat-specific copy.

- [ ] **Step 3: Verify chat landing page**

Run: `npx nx serve website`, navigate to `/chat`.

Expected: Full page with purple accents, batteries-included messaging, json-render + A2UI badges, 5 feature cards, sprint-based comparison table.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/chat/ apps/website/src/components/landing/chat-landing/
git commit -m "feat(website): add /chat landing page — batteries-included agent chat UI"
```

---

## Task 7: Whitepaper Pipeline — Multi-Config Refactor

**Files:**
- Modify: `apps/website/scripts/generate-whitepaper.ts`

- [ ] **Step 1: Refactor script to support multiple whitepapers**

Replace the single `CHAPTERS` array and hardcoded output paths with a `WHITEPAPERS` config map. Add `--paper` CLI argument support via `process.argv`. See the design spec section 3 for the full chapter definitions for each whitepaper (angular: 6 chapters, render: 5 chapters, chat: 5 chapters).

Key changes:
- Define `WhitepaperConfig` type with `title`, `subtitle`, `eyebrow`, `coverGradient`, `outputPdf`, `outputHtml`, `chapters[]`
- `WHITEPAPERS` record with keys: `overview` (existing), `angular`, `render`, `chat`
- `buildHTML()` takes the config for cover customization (gradient color, title, subtitle)
- Parse `--paper <name>` from `process.argv` to generate one or all
- Output paths: existing `public/whitepaper.pdf` for overview, `public/whitepapers/{name}.pdf` for library-specific

- [ ] **Step 2: Test generation of a single whitepaper**

Run: `npm run generate-whitepaper -- --paper angular`

Expected: `public/whitepapers/angular.pdf` generated with blue cover gradient and 6 chapters.

- [ ] **Step 3: Commit**

```bash
git add apps/website/scripts/generate-whitepaper.ts
git commit -m "feat(website): refactor whitepaper pipeline for multi-config generation"
```

- [ ] **Step 4: Generate all 3 library whitepapers**

Run: `npm run generate-whitepaper -- --paper angular && npm run generate-whitepaper -- --paper render && npm run generate-whitepaper -- --paper chat`

Expected: 3 PDFs in `public/whitepapers/`.

- [ ] **Step 5: Commit generated PDFs**

```bash
git add apps/website/public/whitepapers/
git commit -m "docs: generate library-specific whitepapers (angular, render, chat)"
```

---

## Task 8: API Route — Accept `paper` Field

**Files:**
- Modify: `apps/website/src/app/api/whitepaper-signup/route.ts`

- [ ] **Step 1: Update route to accept paper field**

```tsx
// apps/website/src/app/api/whitepaper-signup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

const SIGNUPS_FILE = path.join(process.cwd(), 'data', 'whitepaper-signups.ndjson');

export async function POST(req: NextRequest) {
  let body: { name?: string; email?: string; paper?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { name = '', email = '', paper = 'overview' } = body;
  if (!email || !email.includes('@')) {
    return NextResponse.json({ error: 'Valid email required' }, { status: 400 });
  }

  const entry = JSON.stringify({
    name: name.trim(),
    email: email.trim(),
    paper: paper.trim(),
    ts: new Date().toISOString(),
  }) + '\n';
  try {
    fs.mkdirSync(path.dirname(SIGNUPS_FILE), { recursive: true });
    fs.appendFileSync(SIGNUPS_FILE, entry, 'utf8');
  } catch (err) {
    console.error('Failed to write signup:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/app/api/whitepaper-signup/route.ts
git commit -m "feat(website): whitepaper signup API accepts paper field for library-specific tracking"
```

---

## Task 9: Drip Email Campaigns

**Files:**
- Create: `apps/website/emails/angular-download.ts`
- Create: `apps/website/emails/render-download.ts`
- Create: `apps/website/emails/chat-download.ts`
- Create: `apps/website/emails/drip-angular-followup.ts`
- Create: `apps/website/emails/drip-render-followup.ts`
- Create: `apps/website/emails/drip-chat-followup.ts`

- [ ] **Step 1: Create Angular download confirmation email**

```tsx
// apps/website/emails/angular-download.ts
import { wrapEmail, esc } from './email-wrapper';

const DOWNLOAD_URL = 'https://cacheplane.ai/whitepapers/angular.pdf';

export function angularDownloadHtml(name?: string): string {
  return wrapEmail({
    body: `
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px;line-height:1.3">Your Enterprise Guide to Agent Streaming</p>
      <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">${name ? `Hi ${esc(name)}, t` : 'T'}he guide covers six chapters: the last-mile problem, the agent() API, thread persistence, interrupt flows, full LangGraph feature coverage, and deterministic testing.</p>
      <div style="text-align:center;margin:0 0 4px">
        <a href="${DOWNLOAD_URL}" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Download the Guide</a>
      </div>
    `,
  });
}
```

- [ ] **Step 2: Create Render download confirmation email**

```tsx
// apps/website/emails/render-download.ts
import { wrapEmail, esc } from './email-wrapper';

const DOWNLOAD_URL = 'https://cacheplane.ai/whitepapers/render.pdf';

export function renderDownloadHtml(name?: string): string {
  return wrapEmail({
    body: `
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px;line-height:1.3">Your Enterprise Guide to Generative UI</p>
      <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">${name ? `Hi ${esc(name)}, t` : 'T'}he guide covers five chapters: the coupling problem, declarative UI specs with Vercel's json-render standard, the component registry, streaming JSON patches, and state management.</p>
      <div style="text-align:center;margin:0 0 4px">
        <a href="${DOWNLOAD_URL}" style="display:inline-block;background-color:#1a7a40;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Download the Guide</a>
      </div>
    `,
  });
}
```

- [ ] **Step 3: Create Chat download confirmation email**

```tsx
// apps/website/emails/chat-download.ts
import { wrapEmail, esc } from './email-wrapper';

const DOWNLOAD_URL = 'https://cacheplane.ai/whitepapers/chat.pdf';

export function chatDownloadHtml(name?: string): string {
  return wrapEmail({
    body: `
      <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 8px;line-height:1.3">Your Enterprise Guide to Agent Chat Interfaces</p>
      <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">${name ? `Hi ${esc(name)}, t` : 'T'}he guide covers five chapters: the sprint tax, batteries-included components, theming and design system integration, generative UI in chat, and debug tooling.</p>
      <div style="text-align:center;margin:0 0 4px">
        <a href="${DOWNLOAD_URL}" style="display:inline-block;background-color:#5a00c8;color:#fff;padding:12px 32px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Download the Guide</a>
      </div>
    `,
  });
}
```

- [ ] **Step 4: Create Angular drip campaign**

```tsx
// apps/website/emails/drip-angular-followup.ts
import { wrapEmail } from './email-wrapper';

export function dripAngularFollowupHtml(day: number): { subject: string; html: string } {
  if (day === 2) {
    return {
      subject: 'Did you read Chapter 2 on the agent() API?',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Guide Follow-up</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Did you read Chapter 2 on the agent() API?</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">Chapter 2 covers the <strong>agent() API</strong> — signal-native streaming, provideAgent(), and reactive state management. It's the fastest way to understand what @cacheplane/angular does differently.</p>
          <a href="https://cacheplane.ai/docs" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Explore the Docs →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 5) {
    return {
      subject: 'LangGraph Angular SDK vs @cacheplane/angular',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Comparison</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">LangGraph Angular SDK vs @cacheplane/angular</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">The official LangGraph Angular SDK gives you basic SSE wiring. @cacheplane/angular gives you signal-native streaming, thread persistence, interrupt handling, time travel, DeepAgent support, and deterministic testing — production patterns your team can own.</p>
          <a href="https://cacheplane.ai/angular" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">See the Full Comparison →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  if (day === 10) {
    return {
      subject: 'The pilot program includes hands-on integration',
      html: wrapEmail({
        body: `
          <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Pilot Program</p>
          <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">The pilot program includes hands-on integration</p>
          <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 14px">Every app deployment license includes a <strong>3-month co-pilot engagement</strong> — we work alongside your Angular team to ship your first LangGraph agent to production.</p>
          <div style="background:#f8f9fc;border-radius:8px;padding:16px 18px;margin:0 0 24px;border:1px solid rgba(0,64,144,0.08)">
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#004090">Week 1</strong> · Integration &amp; first stream</p>
            <p style="font-size:13px;color:#555770;margin:0 0 4px;line-height:1.6"><strong style="color:#004090">Month 1</strong> · First agent in staging</p>
            <p style="font-size:13px;color:#555770;margin:0;line-height:1.6"><strong style="color:#004090">Month 3</strong> · Production deployment</p>
          </div>
          <a href="https://cacheplane.ai/pilot-to-prod" style="display:inline-block;background-color:#004090;color:#fff;padding:12px 28px;border-radius:8px;font-size:14px;font-weight:700;text-decoration:none">Learn About the Pilot →</a>
        `,
        showUnsubscribe: true,
      }),
    };
  }

  // day === 20
  return {
    subject: "Ready to ship your LangGraph agent? Let's talk.",
    html: wrapEmail({
      body: `
        <p style="font-size:11px;font-family:monospace;text-transform:uppercase;letter-spacing:0.08em;color:#004090;font-weight:700;margin:0 0 8px">Let's Connect</p>
        <p style="font-size:20px;font-weight:700;color:#1a1a2e;margin:0 0 14px;line-height:1.3">Ready to ship your LangGraph agent? Let's talk.</p>
        <p style="font-size:14px;color:#555770;line-height:1.7;margin:0 0 24px">If your team is evaluating how to take an Angular + LangGraph agent to production, I'd love to hear what you're building. Reply to this email or <a href="mailto:hello@cacheplane.io" style="color:#004090;text-decoration:underline">schedule a conversation</a> — no pitch, just a technical discussion about your use case.</p>
      `,
      showUnsubscribe: true,
    }),
  };
}
```

- [ ] **Step 5: Create Render drip campaign**

Same structure as Angular drip. Day 2: "Did you read Chapter 2 on declarative UI specs?" Day 5: "Why tight coupling between agents and UI kills iteration speed" linking to `/render`. Day 10: pilot program. Day 20: "Ready to decouple your agent UI? Let's talk." Use `#1a7a40` for CTA button color.

- [ ] **Step 6: Create Chat drip campaign**

Same structure. Day 2: "Did you read Chapter 2 on batteries-included components?" Day 5: "The sprint tax: why every team rebuilds chat from scratch" linking to `/chat`. Day 10: pilot program. Day 20: "Ready to ship your agent chat? Let's talk." Use `#5a00c8` for CTA button color.

- [ ] **Step 7: Commit all email templates**

```bash
git add apps/website/emails/
git commit -m "feat(website): add library-specific download confirmation and drip email campaigns"
```

---

## Task 10: Delete FullStackSection

**Files:**
- Delete: `apps/website/src/components/landing/FullStackSection.tsx`

- [ ] **Step 1: Verify no remaining imports of FullStackSection**

Run: `grep -r "FullStackSection" apps/website/src/`

Expected: No results (the import was already replaced in Task 1).

- [ ] **Step 2: Delete the file**

```bash
git rm apps/website/src/components/landing/FullStackSection.tsx
git commit -m "chore(website): remove FullStackSection — replaced by LibrariesSection"
```

---

## Task 11: Final Verification

- [ ] **Step 1: Build the website**

Run: `npx nx build website`

Expected: Build succeeds with no errors.

- [ ] **Step 2: Smoke test all pages**

Serve the production build and navigate to:
- `/` — Home page with LibrariesSection cards
- `/angular` — Full Angular landing page
- `/render` — Full Render landing page
- `/chat` — Full Chat landing page
- `/docs/getting-started/introduction` on mobile — Single hamburger menu with docs sections
- Footer on any page — Libraries column with 3 links

- [ ] **Step 3: Commit any fixes**

If any issues are found, fix and commit.
