# Product Landing Page Alignment — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the three product landing pages (`/angular`, `/render`, `/chat`) with the home page's narrative funnel — stronger footer CTAs, stack awareness, refreshed whitepaper copy, and mobile responsiveness.

**Architecture:** Evolutionary changes to existing components. Three new StackSiblings components. No shared abstractions — each page keeps its own components with inline data.

**Tech Stack:** Next.js 16 App Router, React 19, framer-motion, `@cacheplane/design-tokens`, Next.js `<Link>`

**Spec:** `docs/superpowers/specs/2026-04-13-landing-page-alignment-design.md`

---

### Task 1: Angular Hero — Stack Breadcrumb + Link Fixes

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularHero.tsx`

- [ ] **Step 1: Add stack breadcrumb and fix internal links**

Replace the full content of `AngularHero.tsx` with:

```tsx
// apps/website/src/components/landing/angular/AngularHero.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const BADGES = ['Angular 20+', 'LangGraph', 'LangChain', 'DeepAgent'];

export function AngularHero() {
  return (
    <section className="angular-hero" aria-labelledby="angular-hero-heading" style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-hero { padding: 0 1.25rem !important; }
        }
      `}</style>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="py-24 md:py-32">
        {/* Stack breadcrumb */}
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            <span style={{ color: tokens.colors.accent, fontWeight: 700 }}>Agent</span>
            <span style={{ color: tokens.colors.textMuted, margin: '0 6px' }}>→</span>
            <Link href="/render" style={{ color: tokens.colors.textMuted, fontWeight: 500, textDecoration: 'none' }}>Render</Link>
            <span style={{ color: tokens.colors.textMuted, margin: '0 6px' }}>→</span>
            <Link href="/chat" style={{ color: tokens.colors.textMuted, fontWeight: 500, textDecoration: 'none' }}>Chat</Link>
          </div>
        </motion.div>

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
          <Link href="/docs"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: tokens.colors.accent, fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', border: `1px solid ${tokens.colors.accentBorder}`, minHeight: 44,
            }}>
            View Docs
          </Link>
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

- [ ] **Step 2: Verify the dev server compiles**

Run: `cd /Users/blove/repos/stream-resource && npx nx dev website`
Expected: No compilation errors for `/angular` route.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularHero.tsx
git commit -m "feat(website): add stack breadcrumb and fix Link usage in AngularHero"
```

---

### Task 2: Render Hero — Stack Breadcrumb + Link Fixes

**Files:**
- Modify: `apps/website/src/components/landing/render/RenderHero.tsx`

- [ ] **Step 1: Add stack breadcrumb and fix internal links**

Replace the full content of `RenderHero.tsx` with:

```tsx
// apps/website/src/components/landing/render/RenderHero.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const BADGES = ['Angular 20+', 'Vercel json-render', 'Google A2UI', 'JSON Patch streaming'];

export function RenderHero() {
  return (
    <section className="render-hero" aria-labelledby="render-hero-heading" style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
      <style>{`
        @media (max-width: 767px) {
          .render-hero { padding: 0 1.25rem !important; }
        }
      `}</style>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="py-24 md:py-32">
        {/* Stack breadcrumb */}
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            <Link href="/angular" style={{ color: tokens.colors.textMuted, fontWeight: 500, textDecoration: 'none' }}>Agent</Link>
            <span style={{ color: tokens.colors.textMuted, margin: '0 6px' }}>→</span>
            <span style={{ color: tokens.colors.renderGreen, fontWeight: 700 }}>Render</span>
            <span style={{ color: tokens.colors.textMuted, margin: '0 6px' }}>→</span>
            <Link href="/chat" style={{ color: tokens.colors.textMuted, fontWeight: 500, textDecoration: 'none' }}>Chat</Link>
          </div>
        </motion.div>

        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
            color: tokens.colors.accent, textTransform: 'uppercase', display: 'inline-block', marginBottom: '1.5rem',
          }}>
            @cacheplane/render
          </span>
        </motion.div>

        <motion.h1 id="render-hero-heading" initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: "'EB Garamond', serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700,
            lineHeight: 1.1, color: tokens.colors.textPrimary, margin: 0, marginBottom: '1.25rem',
          }}>
          Agents that render UI — without coupling to your frontend
        </motion.h1>

        <motion.p initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 18, color: tokens.colors.textSecondary,
            maxWidth: '52ch', margin: '0 auto', lineHeight: 1.6, marginBottom: '2rem',
          }}>
          Built on Vercel's json-render spec and Google's A2UI protocol — open standards you already trust. @cacheplane/render brings both to Angular with streaming JSON patches, component registries, and signal-native state.
        </motion.p>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="/whitepapers/render.pdf" download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.colors.renderGreen, color: '#fff', fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', boxShadow: tokens.glow.button, minHeight: 44,
            }}>
            Download the Guide
          </a>
          <Link href="/docs"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: tokens.colors.accent, fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', border: `1px solid ${tokens.colors.accentBorder}`, minHeight: 44,
            }}>
            View Docs
          </Link>
        </motion.div>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {BADGES.map(badge => (
            <span key={badge} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.06em',
              color: tokens.colors.textMuted, textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 4,
              background: 'rgba(26,122,64,0.04)', border: '1px solid rgba(26,122,64,0.1)',
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

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/render/RenderHero.tsx
git commit -m "feat(website): add stack breadcrumb and fix Link usage in RenderHero"
```

---

### Task 3: Chat Hero — Stack Breadcrumb + Link Fixes

**Files:**
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingHero.tsx`

- [ ] **Step 1: Add stack breadcrumb and fix internal links**

Replace the full content of `ChatLandingHero.tsx` with:

```tsx
// apps/website/src/components/landing/chat-landing/ChatLandingHero.tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const BADGES = ['Angular 20+', 'Vercel json-render', 'Google A2UI', 'WCAG accessible'];

export function ChatLandingHero() {
  return (
    <section className="chat-hero" aria-labelledby="chat-hero-heading" style={{ position: 'relative', overflow: 'hidden', padding: '0 2rem' }}>
      <style>{`
        @media (max-width: 767px) {
          .chat-hero { padding: 0 1.25rem !important; }
        }
      `}</style>
      <div style={{ maxWidth: '56rem', margin: '0 auto', textAlign: 'center', position: 'relative', zIndex: 1 }} className="py-24 md:py-32">
        {/* Stack breadcrumb */}
        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 0,
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.08em',
            textTransform: 'uppercase', marginBottom: '0.75rem',
          }}>
            <Link href="/angular" style={{ color: tokens.colors.textMuted, fontWeight: 500, textDecoration: 'none' }}>Agent</Link>
            <span style={{ color: tokens.colors.textMuted, margin: '0 6px' }}>→</span>
            <Link href="/render" style={{ color: tokens.colors.textMuted, fontWeight: 500, textDecoration: 'none' }}>Render</Link>
            <span style={{ color: tokens.colors.textMuted, margin: '0 6px' }}>→</span>
            <span style={{ color: tokens.colors.chatPurple, fontWeight: 700 }}>Chat</span>
          </div>
        </motion.div>

        <motion.div initial={{ y: 16 }} animate={{ y: 0 }} transition={{ duration: 0.5 }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, letterSpacing: '0.08em',
            color: tokens.colors.chatPurple, textTransform: 'uppercase', display: 'inline-block', marginBottom: '1.5rem',
          }}>
            @cacheplane/chat
          </span>
        </motion.div>

        <motion.h1 id="chat-hero-heading" initial={{ y: 20 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.05 }}
          style={{
            fontFamily: "'EB Garamond', serif", fontSize: 'clamp(36px, 5vw, 56px)', fontWeight: 700,
            lineHeight: 1.1, color: tokens.colors.textPrimary, margin: 0, marginBottom: '1.25rem',
          }}>
          Production agent chat UI in days, not sprints
        </motion.h1>

        <motion.p initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.1 }}
          style={{
            fontFamily: 'Inter, sans-serif', fontSize: 18, color: tokens.colors.textSecondary,
            maxWidth: '52ch', margin: '0 auto', lineHeight: 1.6, marginBottom: '2rem',
          }}>
          The batteries-included Angular chat library. Built on the agent framework, Vercel's json-render spec, and Google's A2UI spec. Every feature included — debug, theming, generative UI, streaming — from day one.
        </motion.p>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.15 }}
          style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
          <a href="/whitepapers/chat.pdf" download
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.colors.chatPurple, color: '#fff', fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', boxShadow: tokens.glow.button, minHeight: 44,
            }}>
            Download the Guide
          </a>
          <Link href="/docs"
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              background: tokens.glass.bg, backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
              color: tokens.colors.chatPurple, fontFamily: 'Inter, sans-serif',
              fontSize: 15, fontWeight: 600, padding: '0.875rem 1.75rem', borderRadius: 8,
              textDecoration: 'none', border: '1px solid rgba(90,0,200,0.2)', minHeight: 44,
            }}>
            View Docs
          </Link>
        </motion.div>

        <motion.div initial={{ y: 14 }} animate={{ y: 0 }} transition={{ duration: 0.6, delay: 0.2 }}
          style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          {BADGES.map(badge => (
            <span key={badge} style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 10, letterSpacing: '0.06em',
              color: tokens.colors.textMuted, textTransform: 'uppercase',
              padding: '3px 10px', borderRadius: 4,
              background: 'rgba(90,0,200,0.04)', border: '1px solid rgba(90,0,200,0.1)',
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

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/chat-landing/ChatLandingHero.tsx
git commit -m "feat(website): add stack breadcrumb and fix Link usage in ChatLandingHero"
```

---

### Task 4: Angular Footer CTA — Dark Design Upgrade

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularFooterCTA.tsx`

- [ ] **Step 1: Replace with dark design**

Replace the full content of `AngularFooterCTA.tsx` with:

```tsx
// apps/website/src/components/landing/angular/AngularFooterCTA.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

export function AngularFooterCTA() {
  return (
    <section
      aria-labelledby="angular-footer-cta-heading"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)',
        padding: '0 2rem',
      }}
    >
      <style>{`
        .angular-footer-secondary-btn:hover { border-color: rgba(255,255,255,0.6) !important; }
        @media (max-width: 767px) {
          .angular-footer-inner { padding-top: 4rem !important; padding-bottom: 4rem !important; }
          .angular-footer-heading { font-size: clamp(28px, 6vw, 42px) !important; }
        }
      `}</style>
      <motion.div
        className="angular-footer-inner"
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
        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: '1rem',
        }}>
          Ready when you are
        </p>

        <h2
          id="angular-footer-cta-heading"
          className="angular-footer-heading"
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: '42px', fontWeight: 400, lineHeight: 1.15,
            color: '#ffffff', marginBottom: '1.25rem',
          }}
        >
          Ready to ship your LangGraph agent?
        </h2>

        <p style={{
          fontFamily: 'var(--font-inter, Inter, sans-serif)',
          fontSize: '17px', lineHeight: 1.6,
          color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2.5rem',
        }}>
          The Angular Agent Framework closes the last-mile gap. Start with a conversation.
        </p>

        <div style={{
          display: 'flex', gap: '1rem', justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: '1.5rem',
        }}>
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: '#ffffff', color: tokens.colors.accent,
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              borderRadius: '6px', transition: 'box-shadow 0.2s ease',
            }}
          >
            Start Your Pilot →
          </Link>

          <a
            href="/whitepapers/angular.pdf"
            download
            className="angular-footer-secondary-btn"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: 'transparent', color: '#ffffff',
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.3)',
              transition: 'border-color 0.2s ease',
            }}
          >
            Download the Guide
          </a>
        </div>

        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px', letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          App deployment license · $20,000 · 3-month co-pilot engagement
        </p>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularFooterCTA.tsx
git commit -m "feat(website): upgrade AngularFooterCTA to dark design with pilot primary CTA"
```

---

### Task 5: Render Footer CTA — Dark Design Upgrade

**Files:**
- Modify: `apps/website/src/components/landing/render/RenderFooterCTA.tsx`

- [ ] **Step 1: Replace with dark design**

Replace the full content of `RenderFooterCTA.tsx` with:

```tsx
// apps/website/src/components/landing/render/RenderFooterCTA.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

export function RenderFooterCTA() {
  return (
    <section
      aria-labelledby="render-footer-cta-heading"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)',
        padding: '0 2rem',
      }}
    >
      <style>{`
        .render-footer-secondary-btn:hover { border-color: rgba(255,255,255,0.6) !important; }
        @media (max-width: 767px) {
          .render-footer-inner { padding-top: 4rem !important; padding-bottom: 4rem !important; }
          .render-footer-heading { font-size: clamp(28px, 6vw, 42px) !important; }
        }
      `}</style>
      <motion.div
        className="render-footer-inner"
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
        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: '1rem',
        }}>
          Ready when you are
        </p>

        <h2
          id="render-footer-cta-heading"
          className="render-footer-heading"
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: '42px', fontWeight: 400, lineHeight: 1.15,
            color: '#ffffff', marginBottom: '1.25rem',
          }}
        >
          Ready to ship your generative UI?
        </h2>

        <p style={{
          fontFamily: 'var(--font-inter, Inter, sans-serif)',
          fontSize: '17px', lineHeight: 1.6,
          color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2.5rem',
        }}>
          Decouple your agent&apos;s UI layer with open standards. Start with a conversation.
        </p>

        <div style={{
          display: 'flex', gap: '1rem', justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: '1.5rem',
        }}>
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: '#ffffff', color: tokens.colors.accent,
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              borderRadius: '6px', transition: 'box-shadow 0.2s ease',
            }}
          >
            Start Your Pilot →
          </Link>

          <a
            href="/whitepapers/render.pdf"
            download
            className="render-footer-secondary-btn"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: 'transparent', color: '#ffffff',
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.3)',
              transition: 'border-color 0.2s ease',
            }}
          >
            Download the Guide
          </a>
        </div>

        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px', letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          App deployment license · $20,000 · 3-month co-pilot engagement
        </p>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/render/RenderFooterCTA.tsx
git commit -m "feat(website): upgrade RenderFooterCTA to dark design with pilot primary CTA"
```

---

### Task 6: Chat Footer CTA — Dark Design Upgrade

**Files:**
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingFooterCTA.tsx`

- [ ] **Step 1: Replace with dark design**

Replace the full content of `ChatLandingFooterCTA.tsx` with:

```tsx
// apps/website/src/components/landing/chat-landing/ChatLandingFooterCTA.tsx
'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

export function ChatLandingFooterCTA() {
  return (
    <section
      aria-labelledby="chat-footer-cta-heading"
      style={{
        background: 'linear-gradient(135deg, #1a1a2e 0%, #0d1b3e 100%)',
        padding: '0 2rem',
      }}
    >
      <style>{`
        .chat-footer-secondary-btn:hover { border-color: rgba(255,255,255,0.6) !important; }
        @media (max-width: 767px) {
          .chat-footer-inner { padding-top: 4rem !important; padding-bottom: 4rem !important; }
          .chat-footer-heading { font-size: clamp(28px, 6vw, 42px) !important; }
        }
      `}</style>
      <motion.div
        className="chat-footer-inner"
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
        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '11px', fontWeight: 500, letterSpacing: '0.12em',
          textTransform: 'uppercase', color: 'rgba(255, 255, 255, 0.5)',
          marginBottom: '1rem',
        }}>
          Ready when you are
        </p>

        <h2
          id="chat-footer-cta-heading"
          className="chat-footer-heading"
          style={{
            fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
            fontSize: '42px', fontWeight: 400, lineHeight: 1.15,
            color: '#ffffff', marginBottom: '1.25rem',
          }}
        >
          Ready to ship your agent chat?
        </h2>

        <p style={{
          fontFamily: 'var(--font-inter, Inter, sans-serif)',
          fontSize: '17px', lineHeight: 1.6,
          color: 'rgba(255, 255, 255, 0.7)', marginBottom: '2.5rem',
        }}>
          Production chat UI in days, not sprints. Start with a conversation.
        </p>

        <div style={{
          display: 'flex', gap: '1rem', justifyContent: 'center',
          flexWrap: 'wrap', marginBottom: '1.5rem',
        }}>
          <Link
            href="/pilot-to-prod"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: '#ffffff', color: tokens.colors.accent,
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              borderRadius: '6px', transition: 'box-shadow 0.2s ease',
            }}
          >
            Start Your Pilot →
          </Link>

          <a
            href="/whitepapers/chat.pdf"
            download
            className="chat-footer-secondary-btn"
            style={{
              display: 'inline-block', padding: '0.875rem 2rem',
              background: 'transparent', color: '#ffffff',
              fontFamily: 'var(--font-inter, Inter, sans-serif)',
              fontSize: '15px', fontWeight: 600, textDecoration: 'none',
              borderRadius: '6px', border: '1px solid rgba(255, 255, 255, 0.3)',
              transition: 'border-color 0.2s ease',
            }}
          >
            Download the Guide
          </a>
        </div>

        <p style={{
          fontFamily: 'var(--font-mono, monospace)',
          fontSize: '10px', letterSpacing: '0.08em',
          color: 'rgba(255, 255, 255, 0.4)',
        }}>
          App deployment license · $20,000 · 3-month co-pilot engagement
        </p>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/chat-landing/ChatLandingFooterCTA.tsx
git commit -m "feat(website): upgrade ChatLandingFooterCTA to dark design with pilot primary CTA"
```

---

### Task 7: WhitePaperGate Copy Refresh — All Three Pages

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx`
- Modify: `apps/website/src/components/landing/render/RenderWhitePaperGate.tsx`
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx`

- [ ] **Step 1: Update AngularWhitePaperGate copy**

In `apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx`:

Change the eyebrow text from `Free Download` to `Agent Guide` (line 61).

Change the subtitle (lines 73-74) from:
```
Six chapters covering the last-mile problem, the agent() API, thread persistence, interrupts, full LangGraph feature coverage, and deterministic testing.
```
to:
```
Six chapters covering the last-mile gap, the agent() API, thread persistence, interrupts, time-travel, and deterministic testing with MockAgentTransport.
```

Add after the closing `</p>` of the subtitle (after line 75), before the download link:
```tsx
            <p style={{
              fontFamily: 'Inter, sans-serif', fontSize: '0.8rem',
              color: tokens.colors.textMuted, marginBottom: 20,
            }}>
              Part of the Cacheplane Angular Agent Framework.
            </p>
```

Also add `className="angular-wp-gate"` to the `<section>` and a mobile media query:
```tsx
    <section id="angular-whitepaper-gate" className="angular-wp-gate" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-wp-gate { padding: 60px 20px !important; }
        }
      `}</style>
```

- [ ] **Step 2: Update RenderWhitePaperGate copy**

In `apps/website/src/components/landing/render/RenderWhitePaperGate.tsx`:

Change the eyebrow text from `Free Download` to `Render Guide`.

Change the subtitle from:
```
Five chapters covering the coupling problem, declarative UI specs with Vercel's json-render standard, the component registry, streaming JSON patches, and state management.
```
to:
```
Five chapters covering the coupling problem, declarative UI specs with Vercel's json-render standard and Google's A2UI protocol, the component registry, streaming JSON patches, and signal-native state management.
```

Add the same "Part of the Cacheplane Angular Agent Framework." paragraph after the subtitle.

Add `className="render-wp-gate"` and mobile media query matching the Angular pattern.

- [ ] **Step 3: Update ChatLandingWhitePaperGate copy**

In `apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx`:

Change the eyebrow text from `Free Download` to `Chat Guide`.

Change the subtitle from:
```
Five chapters covering the sprint tax, batteries-included components, theming and design system integration, generative UI in chat, and debug tooling.
```
to:
```
Five chapters covering the sprint tax, batteries-included components, theming and design system integration, generative UI with Vercel json-render, Google A2UI support, and debug tooling.
```

Add the same "Part of the Cacheplane Angular Agent Framework." paragraph after the subtitle.

Add `className="chat-wp-gate"` and mobile media query matching the Angular pattern.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularWhitePaperGate.tsx \
  apps/website/src/components/landing/render/RenderWhitePaperGate.tsx \
  apps/website/src/components/landing/chat-landing/ChatLandingWhitePaperGate.tsx
git commit -m "feat(website): refresh WhitePaperGate copy and add mobile breakpoints"
```

---

### Task 8: Stack Siblings — Angular

**Files:**
- Create: `apps/website/src/components/landing/angular/AngularStackSiblings.tsx`
- Modify: `apps/website/src/app/angular/page.tsx`

- [ ] **Step 1: Create AngularStackSiblings component**

Create `apps/website/src/components/landing/angular/AngularStackSiblings.tsx`:

```tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const SIBLINGS = [
  {
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: tokens.colors.renderGreen,
    rgb: '26,122,64',
    headline: 'Agents that render UI — on open standards',
    href: '/render',
    ctaLabel: 'Explore Render',
  },
  {
    tag: 'Chat',
    pkg: '@cacheplane/chat',
    color: tokens.colors.chatPurple,
    rgb: '90,0,200',
    headline: 'Production chat UI in days, not sprints',
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
];

export function AngularStackSiblings() {
  return (
    <section className="angular-stack-siblings" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-stack-siblings { padding: 60px 20px !important; }
          .angular-stack-siblings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 36 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic', fontSize: '1.05rem',
          color: tokens.colors.textSecondary, maxWidth: 520, margin: '0 auto',
        }}>
          This library is part of a cohesive three-layer architecture.
        </p>
      </motion.div>

      <div
        className="angular-stack-siblings-grid"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16, maxWidth: 860, margin: '0 auto',
        }}
      >
        {SIBLINGS.map((lib, i) => (
          <motion.div
            key={lib.pkg}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              padding: '24px 20px',
              borderRadius: 14,
              background: `rgba(${lib.rgb}, 0.03)`,
              border: `1px solid rgba(${lib.rgb}, 0.15)`,
              borderLeft: `3px solid ${lib.color}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', padding: '2px 9px', borderRadius: 5,
              color: '#fff', background: lib.color,
            }}>
              {lib.tag}
            </span>

            <p style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.76rem', fontWeight: 700, color: lib.color, margin: 0,
            }}>
              {lib.pkg}
            </p>

            <h3 style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: '1.15rem', fontWeight: 700,
              color: tokens.colors.textPrimary, lineHeight: 1.25, margin: 0,
            }}>
              {lib.headline}
            </h3>

            <Link
              href={lib.href}
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.72rem', fontWeight: 700, color: lib.color,
                textDecoration: 'none', marginTop: 4,
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

- [ ] **Step 2: Add AngularStackSiblings to page layout**

In `apps/website/src/app/angular/page.tsx`, add the import and insert between WhitePaperGate and FooterCTA:

Add import:
```tsx
import { AngularStackSiblings } from '../../components/landing/angular/AngularStackSiblings';
```

Insert `<AngularStackSiblings />` between `<AngularWhitePaperGate />` and `<AngularFooterCTA />`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularStackSiblings.tsx \
  apps/website/src/app/angular/page.tsx
git commit -m "feat(website): add AngularStackSiblings section to /angular page"
```

---

### Task 9: Stack Siblings — Render

**Files:**
- Create: `apps/website/src/components/landing/render/RenderStackSiblings.tsx`
- Modify: `apps/website/src/app/render/page.tsx`

- [ ] **Step 1: Create RenderStackSiblings component**

Create `apps/website/src/components/landing/render/RenderStackSiblings.tsx`:

```tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const SIBLINGS = [
  {
    tag: 'Agent',
    pkg: '@cacheplane/angular',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'The reactive bridge to LangGraph',
    href: '/angular',
    ctaLabel: 'Explore Agent',
  },
  {
    tag: 'Chat',
    pkg: '@cacheplane/chat',
    color: tokens.colors.chatPurple,
    rgb: '90,0,200',
    headline: 'Production chat UI in days, not sprints',
    href: '/chat',
    ctaLabel: 'Explore Chat',
  },
];

export function RenderStackSiblings() {
  return (
    <section className="render-stack-siblings" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .render-stack-siblings { padding: 60px 20px !important; }
          .render-stack-siblings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 36 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic', fontSize: '1.05rem',
          color: tokens.colors.textSecondary, maxWidth: 520, margin: '0 auto',
        }}>
          This library is part of a cohesive three-layer architecture.
        </p>
      </motion.div>

      <div
        className="render-stack-siblings-grid"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16, maxWidth: 860, margin: '0 auto',
        }}
      >
        {SIBLINGS.map((lib, i) => (
          <motion.div
            key={lib.pkg}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              padding: '24px 20px',
              borderRadius: 14,
              background: `rgba(${lib.rgb}, 0.03)`,
              border: `1px solid rgba(${lib.rgb}, 0.15)`,
              borderLeft: `3px solid ${lib.color}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', padding: '2px 9px', borderRadius: 5,
              color: '#fff', background: lib.color,
            }}>
              {lib.tag}
            </span>

            <p style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.76rem', fontWeight: 700, color: lib.color, margin: 0,
            }}>
              {lib.pkg}
            </p>

            <h3 style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: '1.15rem', fontWeight: 700,
              color: tokens.colors.textPrimary, lineHeight: 1.25, margin: 0,
            }}>
              {lib.headline}
            </h3>

            <Link
              href={lib.href}
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.72rem', fontWeight: 700, color: lib.color,
                textDecoration: 'none', marginTop: 4,
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

- [ ] **Step 2: Add RenderStackSiblings to page layout**

In `apps/website/src/app/render/page.tsx`, add the import and insert between WhitePaperGate and FooterCTA:

Add import:
```tsx
import { RenderStackSiblings } from '../../components/landing/render/RenderStackSiblings';
```

Insert `<RenderStackSiblings />` between `<RenderWhitePaperGate />` and `<RenderFooterCTA />`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/render/RenderStackSiblings.tsx \
  apps/website/src/app/render/page.tsx
git commit -m "feat(website): add RenderStackSiblings section to /render page"
```

---

### Task 10: Stack Siblings — Chat

**Files:**
- Create: `apps/website/src/components/landing/chat-landing/ChatLandingStackSiblings.tsx`
- Modify: `apps/website/src/app/chat/page.tsx`

- [ ] **Step 1: Create ChatLandingStackSiblings component**

Create `apps/website/src/components/landing/chat-landing/ChatLandingStackSiblings.tsx`:

```tsx
'use client';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { tokens } from '@cacheplane/design-tokens';

const SIBLINGS = [
  {
    tag: 'Agent',
    pkg: '@cacheplane/angular',
    color: tokens.colors.accent,
    rgb: '0,64,144',
    headline: 'The reactive bridge to LangGraph',
    href: '/angular',
    ctaLabel: 'Explore Agent',
  },
  {
    tag: 'Gen UI',
    pkg: '@cacheplane/render',
    color: tokens.colors.renderGreen,
    rgb: '26,122,64',
    headline: 'Agents that render UI — on open standards',
    href: '/render',
    ctaLabel: 'Explore Render',
  },
];

export function ChatLandingStackSiblings() {
  return (
    <section className="chat-stack-siblings" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .chat-stack-siblings { padding: 60px 20px !important; }
          .chat-stack-siblings-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        style={{ textAlign: 'center', marginBottom: 36 }}
      >
        <p style={{
          fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
          fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.12em',
          fontWeight: 700, color: tokens.colors.accent, marginBottom: 14,
        }}>
          The Cacheplane Stack
        </p>
        <p style={{
          fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
          fontStyle: 'italic', fontSize: '1.05rem',
          color: tokens.colors.textSecondary, maxWidth: 520, margin: '0 auto',
        }}>
          This library is part of a cohesive three-layer architecture.
        </p>
      </motion.div>

      <div
        className="chat-stack-siblings-grid"
        style={{
          display: 'grid', gridTemplateColumns: '1fr 1fr',
          gap: 16, maxWidth: 860, margin: '0 auto',
        }}
      >
        {SIBLINGS.map((lib, i) => (
          <motion.div
            key={lib.pkg}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: i * 0.1 }}
            style={{
              padding: '24px 20px',
              borderRadius: 14,
              background: `rgba(${lib.rgb}, 0.03)`,
              border: `1px solid rgba(${lib.rgb}, 0.15)`,
              borderLeft: `3px solid ${lib.color}`,
              display: 'flex', flexDirection: 'column', gap: 10,
            }}
          >
            <span style={{
              display: 'inline-block', alignSelf: 'flex-start',
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.58rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.07em', padding: '2px 9px', borderRadius: 5,
              color: '#fff', background: lib.color,
            }}>
              {lib.tag}
            </span>

            <p style={{
              fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
              fontSize: '0.76rem', fontWeight: 700, color: lib.color, margin: 0,
            }}>
              {lib.pkg}
            </p>

            <h3 style={{
              fontFamily: 'var(--font-garamond, "EB Garamond", Georgia, serif)',
              fontSize: '1.15rem', fontWeight: 700,
              color: tokens.colors.textPrimary, lineHeight: 1.25, margin: 0,
            }}>
              {lib.headline}
            </h3>

            <Link
              href={lib.href}
              style={{
                fontFamily: 'var(--font-mono, "JetBrains Mono", monospace)',
                fontSize: '0.72rem', fontWeight: 700, color: lib.color,
                textDecoration: 'none', marginTop: 4,
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

- [ ] **Step 2: Add ChatLandingStackSiblings to page layout**

In `apps/website/src/app/chat/page.tsx`, add the import and insert between WhitePaperGate and FooterCTA:

Add import:
```tsx
import { ChatLandingStackSiblings } from '../../components/landing/chat-landing/ChatLandingStackSiblings';
```

Insert `<ChatLandingStackSiblings />` between `<ChatLandingWhitePaperGate />` and `<ChatLandingFooterCTA />`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/chat-landing/ChatLandingStackSiblings.tsx \
  apps/website/src/app/chat/page.tsx
git commit -m "feat(website): add ChatLandingStackSiblings section to /chat page"
```

---

### Task 11: Mobile Breakpoints — ProblemSolution (All Three)

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularProblemSolution.tsx`
- Modify: `apps/website/src/components/landing/render/RenderProblemSolution.tsx`
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingProblemSolution.tsx`

- [ ] **Step 1: Add mobile breakpoint to AngularProblemSolution**

In `AngularProblemSolution.tsx`, add `className="angular-problem"` to the `<section>` tag and add a `<style>` tag inside the section:

```tsx
    <section className="angular-problem" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-problem { padding: 60px 20px !important; }
        }
      `}</style>
```

- [ ] **Step 2: Add mobile breakpoint to RenderProblemSolution**

Same pattern with `className="render-problem"`.

- [ ] **Step 3: Add mobile breakpoint to ChatLandingProblemSolution**

Same pattern with `className="chat-problem"`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularProblemSolution.tsx \
  apps/website/src/components/landing/render/RenderProblemSolution.tsx \
  apps/website/src/components/landing/chat-landing/ChatLandingProblemSolution.tsx
git commit -m "feat(website): add mobile breakpoints to ProblemSolution sections"
```

---

### Task 12: Mobile Breakpoints — FeaturesGrid (All Three)

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularFeaturesGrid.tsx`
- Modify: `apps/website/src/components/landing/render/RenderFeaturesGrid.tsx`
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingFeaturesGrid.tsx`

- [ ] **Step 1: Add mobile breakpoint to AngularFeaturesGrid**

Add `className="angular-features"` to the `<section>` tag and add a `<style>` tag:

```tsx
    <section className="angular-features" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-features { padding: 60px 20px !important; }
        }
      `}</style>
```

- [ ] **Step 2: Add mobile breakpoint to RenderFeaturesGrid**

Same pattern with `className="render-features"`.

- [ ] **Step 3: Add mobile breakpoint to ChatLandingFeaturesGrid**

Same pattern with `className="chat-features"`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularFeaturesGrid.tsx \
  apps/website/src/components/landing/render/RenderFeaturesGrid.tsx \
  apps/website/src/components/landing/chat-landing/ChatLandingFeaturesGrid.tsx
git commit -m "feat(website): add mobile breakpoints to FeaturesGrid sections"
```

---

### Task 13: Mobile Breakpoints — CodeShowcase (All Three)

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularCodeShowcase.tsx`
- Modify: `apps/website/src/components/landing/render/RenderCodeShowcase.tsx`
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx`

**Note:** These are `async` server components (no `'use client'`). We cannot use inline `<style>` tags the same way since they are server-rendered. Instead, wrap the style tag in a fragment — server components can render `<style>` tags directly.

- [ ] **Step 1: Add mobile breakpoint to AngularCodeShowcase**

Add `className="angular-code"` to the `<section>` tag and add a `<style>` tag:

```tsx
    <section className="angular-code" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-code { padding: 60px 20px !important; }
        }
      `}</style>
```

- [ ] **Step 2: Add mobile breakpoint to RenderCodeShowcase**

Same pattern with `className="render-code"`.

- [ ] **Step 3: Add mobile breakpoint to ChatLandingCodeShowcase**

Same pattern with `className="chat-code"`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularCodeShowcase.tsx \
  apps/website/src/components/landing/render/RenderCodeShowcase.tsx \
  apps/website/src/components/landing/chat-landing/ChatLandingCodeShowcase.tsx
git commit -m "feat(website): add mobile breakpoints to CodeShowcase sections"
```

---

### Task 14: Mobile Breakpoints — Comparison (All Three)

**Files:**
- Modify: `apps/website/src/components/landing/angular/AngularComparison.tsx`
- Modify: `apps/website/src/components/landing/render/RenderComparison.tsx`
- Modify: `apps/website/src/components/landing/chat-landing/ChatLandingComparison.tsx`

- [ ] **Step 1: Add mobile breakpoint to AngularComparison**

Add `className="angular-comparison"` to the `<section>` tag and add a `<style>` tag with reduced cell padding:

```tsx
    <section className="angular-comparison" style={{ padding: '80px 32px' }}>
      <style>{`
        @media (max-width: 767px) {
          .angular-comparison { padding: 60px 20px !important; }
          .angular-comparison .comparison-cell { padding: 10px 12px !important; }
        }
      `}</style>
```

Also add `className="comparison-cell"` to the grid row divs (both the header and each row's container).

- [ ] **Step 2: Add mobile breakpoint to RenderComparison**

Same pattern with `className="render-comparison"`.

- [ ] **Step 3: Add mobile breakpoint to ChatLandingComparison**

Same pattern with `className="chat-comparison"`.

- [ ] **Step 4: Verify the Comparison content is still accurate**

Check if A2UI component count in RenderComparison and ChatLandingComparison is still "18". Grep the codebase:

Run: `grep -r "A2UI" apps/website/src/components/landing/ --include="*.tsx" | grep -i "component"`

Update the count if it has changed.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/angular/AngularComparison.tsx \
  apps/website/src/components/landing/render/RenderComparison.tsx \
  apps/website/src/components/landing/chat-landing/ChatLandingComparison.tsx
git commit -m "feat(website): add mobile breakpoints to Comparison sections"
```

---

### Task 15: Build Verification and Final Review

**Files:**
- None modified — verification only

- [ ] **Step 1: Run the build**

Run: `cd /Users/blove/repos/stream-resource && npx nx build website`
Expected: Build succeeds with no errors.

- [ ] **Step 2: Verify all three pages render**

Run the dev server and check:
- `/angular` — stack breadcrumb visible, dark footer CTA, stack siblings section, mobile breakpoints
- `/render` — same pattern with green accents
- `/chat` — same pattern with purple accents

- [ ] **Step 3: Verify mobile responsiveness**

Check each page at 375px viewport width. All sections should have reduced padding and comparison tables should scroll horizontally.
