# Glassy & Gradient Website Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor the Angular Agent Framework website from dark navy to a light frosted-glass aesthetic with dual-brand Angular/LangGraph ambient gradients.

**Architecture:** Token-first approach — update `design-tokens.ts` and `global.css` first, then sweep all components to consume the new tokens. The warm→cool gradient flow (Angular red top-left → LangGraph blue bottom-right) serves as the continuous page backdrop, with balanced glass panels (14-16px blur, 40-50% white opacity) floating on top.

**Tech Stack:** Next.js 16, React 19, Tailwind CSS v4, Framer Motion, Shiki (code highlighting)

**Spec:** `docs/superpowers/specs/2026-04-03-glassy-gradient-redesign.md`

---

### Task 1: Update Design Tokens

**Files:**
- Modify: `apps/website/lib/design-tokens.ts`

- [ ] **Step 1: Replace design-tokens.ts with new palette, glass, gradient, and glow tokens**

```typescript
/** Single source of truth for all brand design tokens.
 *  CSS custom properties in globals.css must match these values exactly.
 */
export const tokens = {
  colors: {
    bg: '#f8f9fc',
    accent: '#004090',
    accentLight: '#64C3FD',
    accentGlow: 'rgba(0, 64, 144, 0.2)',
    accentBorder: 'rgba(0, 64, 144, 0.15)',
    accentBorderHover: 'rgba(0, 64, 144, 0.3)',
    accentSurface: 'rgba(0, 64, 144, 0.06)',
    textPrimary: '#1a1a2e',
    textSecondary: '#555770',
    textMuted: '#8b8fa3',
    sidebarBg: 'rgba(255, 255, 255, 0.45)',
    angularRed: '#DD0031',
  },
  glass: {
    bg: 'rgba(255, 255, 255, 0.45)',
    bgHover: 'rgba(255, 255, 255, 0.55)',
    blur: '16px',
    border: 'rgba(255, 255, 255, 0.6)',
    shadow: '0 4px 24px rgba(0, 0, 0, 0.06)',
  },
  gradient: {
    warm: 'radial-gradient(circle, rgba(221, 0, 49, 0.18), transparent 70%)',
    cool: 'radial-gradient(circle, rgba(0, 64, 144, 0.18), transparent 70%)',
    coolLight: 'radial-gradient(circle, rgba(100, 195, 253, 0.15), transparent 70%)',
    bgFlow: 'linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%)',
  },
  glow: {
    hero: '0 0 60px rgba(0, 64, 144, 0.15)',
    demo: '0 0 30px rgba(0, 64, 144, 0.1)',
    card: '0 0 24px rgba(0, 64, 144, 0.1)',
    border: '0 0 12px rgba(0, 64, 144, 0.08)',
    button: '0 0 16px rgba(0, 64, 144, 0.15)',
  },
} as const;
```

- [ ] **Step 2: Verify the file compiles**

Run: `cd apps/website && npx tsc --noEmit lib/design-tokens.ts`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
git add apps/website/lib/design-tokens.ts
git commit -m "feat(website): update design tokens for glassy gradient redesign"
```

---

### Task 2: Update Global CSS

**Files:**
- Modify: `apps/website/src/app/global.css`

- [ ] **Step 1: Replace global.css with new theme variables and glass utilities**

```css
@import "tailwindcss";

@theme {
  --color-bg: #f8f9fc;
  --color-accent: #004090;
  --color-accent-light: #64C3FD;
  --color-accent-glow: rgba(0, 64, 144, 0.2);
  --color-accent-border: rgba(0, 64, 144, 0.15);
  --color-accent-border-hover: rgba(0, 64, 144, 0.3);
  --color-accent-surface: rgba(0, 64, 144, 0.06);
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #555770;
  --color-text-muted: #8b8fa3;
  --color-sidebar-bg: rgba(255, 255, 255, 0.45);
  --color-angular-red: #DD0031;

  --font-garamond: "EB Garamond", Georgia, serif;
  --font-inter: Inter, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", monospace;
}

:root {
  --color-bg: #f8f9fc;
  --color-accent: #004090;
  --color-accent-light: #64C3FD;
  --color-accent-glow: rgba(0, 64, 144, 0.2);
  --color-accent-border: rgba(0, 64, 144, 0.15);
  --color-accent-border-hover: rgba(0, 64, 144, 0.3);
  --color-accent-surface: rgba(0, 64, 144, 0.06);
  --color-text-primary: #1a1a2e;
  --color-text-secondary: #555770;
  --color-text-muted: #8b8fa3;
  --color-sidebar-bg: rgba(255, 255, 255, 0.45);
  --color-angular-red: #DD0031;

  --glass-bg: rgba(255, 255, 255, 0.45);
  --glass-bg-hover: rgba(255, 255, 255, 0.55);
  --glass-blur: 16px;
  --glass-border: rgba(255, 255, 255, 0.6);
  --glass-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);

  --gradient-bg-flow: linear-gradient(135deg, #fef0f3 0%, #f4f0ff 45%, #eaf3ff 70%, #e6f4ff 100%);
}

* {
  box-sizing: border-box;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text-primary);
  font-family: var(--font-inter);
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Shiki code blocks — tokyo-night theme */
.shiki {
  padding: 1.5rem;
  background: #1a1b26 !important;
  overflow-x: auto;
}
.shiki code {
  font-family: var(--font-mono), monospace;
  font-size: 0.75rem;
  line-height: 1.7;
}
```

- [ ] **Step 2: Verify the site builds**

Run: `npx nx build website --skip-nx-cache 2>&1 | tail -5`
Expected: Build completes without CSS errors

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/global.css
git commit -m "feat(website): update global CSS for light glassy theme"
```

---

### Task 3: Update Nav

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`

- [ ] **Step 1: Replace Nav.tsx with glass treatment**

```tsx
'use client';
import Link from 'next/link';
import { tokens } from '../../../lib/design-tokens';

const links = [
  { label: 'Docs', href: '/docs' },
  { label: 'API', href: '/api-reference' },
  { label: 'Pricing', href: '/pricing' },
];

export function Nav() {
  return (
    <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-5"
      style={{
        borderBottom: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        boxShadow: tokens.glass.shadow,
      }}>
      <Link href="/" className="font-garamond text-xl font-bold" style={{ color: tokens.colors.textPrimary }}>
        Angular Agent Framework
      </Link>
      <div className="flex items-center gap-8">
        {links.map((l) => (
          <Link key={l.href} href={l.href}
            className="text-sm font-mono transition-colors"
            style={{ color: tokens.colors.textSecondary }}
            onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
            {l.label}
          </Link>
        ))}
        <Link href="/pricing"
          className="px-4 py-2 text-sm font-mono rounded transition-all"
          style={{ background: tokens.colors.accent, color: '#fff' }}
          onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
          onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
          Get Started
        </Link>
      </div>
    </nav>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000 and confirm nav is frosted glass with dark text on light background.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx
git commit -m "feat(website): apply glass treatment to Nav"
```

---

### Task 4: Update Footer

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] **Step 1: Replace Footer.tsx with glass treatment**

```tsx
import Link from 'next/link';
import { tokens } from '../../../lib/design-tokens';

export function Footer() {
  return (
    <footer className="px-8 py-12 mt-24"
      style={{
        borderTop: `1px solid ${tokens.glass.border}`,
        background: 'rgba(255, 255, 255, 0.55)',
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}>
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-start justify-between gap-8">
        <div>
          <p className="font-garamond text-lg font-bold" style={{ color: tokens.colors.textPrimary }}>Angular Agent Framework</p>
          <p className="text-sm mt-1" style={{ color: tokens.colors.textMuted }}>The Enterprise Streaming Resource for LangChain and Angular</p>
        </div>
        <div className="flex gap-12 text-sm">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-xs uppercase" style={{ color: tokens.colors.accent }}>Product</span>
            <Link href="/docs" className="transition-colors" style={{ color: tokens.colors.textSecondary }}>Docs</Link>
            <Link href="/api-reference" className="transition-colors" style={{ color: tokens.colors.textSecondary }}>API Reference</Link>
            <Link href="/pricing" className="transition-colors" style={{ color: tokens.colors.textSecondary }}>Pricing</Link>
          </div>
        </div>
      </div>
      <div className="max-w-6xl mx-auto mt-8 pt-8 flex items-center justify-between text-xs"
        style={{ borderTop: `1px solid ${tokens.glass.border}`, color: tokens.colors.textMuted }}>
        <span>&copy; {new Date().getFullYear()} Angular Agent Framework. All rights reserved.</span>
        <span>PolyForm Noncommercial 1.0.0 &middot; <Link href="/pricing" className="transition-colors">Commercial License</Link></span>
      </div>
    </footer>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "feat(website): apply glass treatment to Footer"
```

---

### Task 5: Update InstallStrip

**Files:**
- Modify: `apps/website/src/components/shared/InstallStrip.tsx`

- [ ] **Step 1: Replace InstallStrip.tsx with glass treatment**

```tsx
'use client';
import { useState } from 'react';
import { tokens } from '../../../lib/design-tokens';

const CMD = 'npm install @cacheplane/langgraph';

export function InstallStrip() {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    await navigator.clipboard.writeText(CMD);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="inline-flex items-center gap-4 px-6 py-3 rounded-lg transition-all cursor-pointer"
      style={{
        border: `1px solid ${tokens.colors.accentBorder}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
      }}
      onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.border)}
      onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}
      onClick={copy}>
      <code className="font-mono text-sm" style={{ color: tokens.colors.textSecondary }}>{CMD}</code>
      <button className="font-mono text-xs uppercase shrink-0 transition-colors"
        style={{ color: copied ? tokens.colors.accent : tokens.colors.textMuted }}>
        {copied ? 'Copied!' : 'Copy'}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/shared/InstallStrip.tsx
git commit -m "feat(website): apply glass treatment to InstallStrip"
```

---

### Task 6: Update CopyPromptButton

**Files:**
- Modify: `apps/website/src/components/docs/CopyPromptButton.tsx`

- [ ] **Step 1: Replace CopyPromptButton.tsx with new accent colors**

```tsx
'use client';
import { useState } from 'react';
import { tokens } from '../../../lib/design-tokens';

interface Props {
  prompt: string;
  variant?: 'hero' | 'docs';
}

export function CopyPromptButton({ prompt, variant = 'docs' }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(prompt);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — silently ignore
    }
  };

  const isHero = variant === 'hero';

  return (
    <button
      onClick={handleClick}
      aria-label={copied ? 'Prompt copied' : 'Copy prompt'}
      style={{
        background: isHero ? tokens.colors.accent : 'transparent',
        border: isHero ? 'none' : `1px solid ${tokens.colors.accentBorderHover}`,
        color: isHero ? '#fff' : tokens.colors.accent,
        fontFamily: 'var(--font-mono)',
        fontSize: isHero ? '13px' : '12px',
        padding: isHero ? '12px 24px' : '8px 16px',
        borderRadius: isHero ? '8px' : '6px',
        cursor: 'pointer',
        transition: 'box-shadow 0.2s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.boxShadow = isHero
          ? tokens.glow.button
          : tokens.glow.border;
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.boxShadow = 'none';
      }}>
      <span aria-hidden="true">{copied ? '\u2713' : '\u26A1'}</span>{' '}
      {copied ? 'Copied!' : 'Copy prompt'}
    </button>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/CopyPromptButton.tsx
git commit -m "feat(website): update CopyPromptButton to new accent colors"
```

---

### Task 7: Update HeroTwoCol

**Files:**
- Modify: `apps/website/src/components/landing/HeroTwoCol.tsx`

- [ ] **Step 1: Replace HeroTwoCol.tsx with gradient background and glass treatment**

```tsx
import { GenerativeUIFrame } from './GenerativeUIFrame';
import { CopyPromptButton } from '../docs/CopyPromptButton';
import { getPromptBySlug } from '../../lib/docs';
import { tokens } from '../../lib/design-tokens';

function LangChainBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(0, 64, 144, 0.08)',
      border: '1px solid rgba(0, 64, 144, 0.2)',
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textPrimary,
    }}>
      <span style={{
        width: 14, height: 14, borderRadius: 3,
        background: 'rgba(0, 64, 144, 0.15)',
        border: '1px solid rgba(0, 64, 144, 0.3)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 7, fontWeight: 700, color: tokens.colors.accent, lineHeight: 1,
      }}>LC</span>
      LangChain
    </span>
  );
}

function AngularBadge() {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      background: 'rgba(221, 0, 49, 0.06)',
      border: '1px solid rgba(221, 0, 49, 0.15)',
      borderRadius: 20, padding: '4px 10px 4px 8px',
      fontFamily: 'var(--font-mono)', fontSize: 11, color: tokens.colors.textPrimary,
    }}>
      <svg width="14" height="14" viewBox="0 0 250 250" aria-hidden={true}>
        <path fill="#DD0031" d="M125 30L31.9 63.2l14.2 123.1L125 230l78.9-43.7 14.2-123.1z"/>
        <path fill="#C3002F" d="M125 30v22.2l-61.7 162.4 37.8 15.4z"/>
        <path fill="#fff" d="M125 52.1L66.8 182.6h21.7l11.7-29.2h49.4l11.7 29.2H183L125 52.1zm17 83.3h-34l17-40.9z"/>
      </svg>
      Angular
    </span>
  );
}

export async function HeroTwoCol() {
  const prompt = getPromptBySlug(['getting-started']) ?? '';

  return (
    <section className="hero-two-col" aria-labelledby="hero-heading" style={{ position: 'relative', overflow: 'hidden' }}>
      <style>{`
        .hero-two-col {
          display: flex;
          align-items: center;
          padding: 96px 40px 60px;
          gap: 48px;
          min-height: 100vh;
          background: ${tokens.gradient.bgFlow};
        }
        .hero-left { flex: 0 0 55%; max-width: 55%; position: relative; z-index: 1; }
        .hero-right { flex: 0 0 45%; max-width: 45%; display: flex; justify-content: center; position: relative; z-index: 1; }
        @media (max-width: 767px) {
          .hero-two-col { flex-direction: column; padding: 80px 24px 40px; }
          .hero-left { flex: none; max-width: 100%; width: 100%; }
          .hero-right { flex: none; max-width: 100%; width: 100%; max-height: 300px; overflow: hidden; }
        }
      `}</style>

      {/* Ambient gradient blobs */}
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.warm, top: -150, left: -100, filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 450, height: 450, borderRadius: '50%', background: tokens.gradient.cool, bottom: -100, right: -50, filter: 'blur(60px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 350, height: 350, borderRadius: '50%', background: tokens.gradient.coolLight, top: '30%', right: '20%', filter: 'blur(50px)', pointerEvents: 'none' }} />

      {/* Left column — 55% */}
      <div className="hero-left">
        <div style={{ display: 'flex', gap: 8, marginBottom: 28, flexWrap: 'wrap' }}>
          <LangChainBadge />
          <AngularBadge />
        </div>

        <h1 id="hero-heading" style={{
          fontFamily: 'var(--font-garamond)',
          fontSize: 'clamp(36px, 4.5vw, 72px)',
          fontWeight: 800,
          lineHeight: 1.05,
          color: tokens.colors.textPrimary,
          margin: 0,
          marginBottom: 20,
        }}>
          The Enterprise Streaming Resource for LangChain and{' '}
          <span style={{ color: tokens.colors.angularRed }}>Angular</span>
        </h1>

        <p style={{
          fontFamily: 'var(--font-garamond)',
          fontStyle: 'italic',
          fontSize: 'clamp(16px, 1.8vw, 20px)',
          color: tokens.colors.textSecondary,
          maxWidth: '44ch',
          lineHeight: 1.5,
          margin: 0,
          marginBottom: 32,
        }}>
          Full parity with React{' '}
          <code style={{
            fontStyle: 'normal',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.8em',
            background: tokens.colors.accentSurface,
            color: tokens.colors.accent,
            padding: '2px 6px',
            borderRadius: 4,
          }}>useStream()</code>
          {' '}&mdash; built natively for Angular 20+.
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 12 }}>
          <CopyPromptButton prompt={prompt} variant="hero" />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 12,
            color: tokens.colors.textMuted,
          }}>
            npm install @cacheplane/langgraph
          </span>
        </div>
      </div>

      {/* Right column — 45% */}
      <div className="hero-right">
        <GenerativeUIFrame />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000 and confirm hero has warm→cool gradient with floating blobs and dark text.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/HeroTwoCol.tsx
git commit -m "feat(website): apply gradient background and glass to Hero"
```

---

### Task 8: Update ArchDiagram

**Files:**
- Modify: `apps/website/src/components/landing/ArchDiagram.tsx`

- [ ] **Step 1: Replace ArchDiagram.tsx with light-theme SVG treatment**

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../lib/design-tokens';

const NODES = [
  { id: 'angular', label: 'Angular App', x: 60, y: 100 },
  { id: 'sr', label: 'agent()', x: 260, y: 100 },
  { id: 'transport', label: 'FetchStreamTransport', x: 480, y: 100 },
  { id: 'langgraph', label: 'LangGraph Server', x: 700, y: 100 },
];

const EDGES = [
  { from: 'angular', to: 'sr', d: 'M 140 100 L 260 100' },
  { from: 'sr', to: 'transport', d: 'M 390 100 L 480 100' },
  { from: 'transport', to: 'langgraph', d: 'M 620 100 L 700 100' },
];

export function ArchDiagram() {
  return (
    <section className="px-8 py-16 flex flex-col items-center">
      <p className="font-mono text-xs uppercase tracking-widest mb-8"
        style={{ color: tokens.colors.accent }}>Architecture</p>
      <motion.div
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}>
        <svg role="img" viewBox="0 0 820 200" width="100%" style={{ maxWidth: 820 }} aria-label="Architecture diagram showing Angular App connecting through agent and FetchStreamTransport to LangGraph Server">
          <defs>
            <radialGradient id="nodeGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="rgba(0,64,144,0.15)" />
              <stop offset="100%" stopColor="rgba(0,64,144,0)" />
            </radialGradient>
          </defs>
          {EDGES.map((edge) => (
            <g key={edge.from}>
              <path d={edge.d} stroke={tokens.colors.accent} strokeWidth="1.5" fill="none" opacity="0.4" />
              <circle r="3" fill={tokens.colors.accent}>
                <animateMotion dur="2s" repeatCount="indefinite" path={edge.d} />
              </circle>
            </g>
          ))}
          {NODES.map((node) => (
            <g key={node.id}>
              <ellipse cx={node.x + 10} cy={node.y} rx={50} ry={30} fill="url(#nodeGlow)" />
              <rect
                x={node.x - 60} y={node.y - 24}
                width="140" height="48"
                rx="6"
                fill="rgba(255,255,255,0.5)"
                stroke={tokens.colors.accentBorder}
                strokeWidth="1"
              />
              <text
                x={node.x + 10} y={node.y + 5}
                textAnchor="middle"
                fill={tokens.colors.textSecondary}
                fontSize="11"
                fontFamily="var(--font-mono)">
                {node.label}
              </text>
            </g>
          ))}
        </svg>
      </motion.div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/ArchDiagram.tsx
git commit -m "feat(website): update ArchDiagram for light glassy theme"
```

---

### Task 9: Update FeatureStrip

**Files:**
- Modify: `apps/website/src/components/landing/FeatureStrip.tsx`

- [ ] **Step 1: Replace FeatureStrip.tsx with glass card treatment**

```tsx
'use client';
import { motion } from 'framer-motion';
import { tokens } from '../../lib/design-tokens';

const FEATURES = [
  { icon: '\u26A1', title: 'Token-by-token streaming', desc: 'Real-time SSE streaming via FetchStreamTransport. Messages update as each token arrives.' },
  { icon: '\uD83D\uDD17', title: 'Thread persistence', desc: 'MemorySaver-backed threads survive page refreshes via threadId signal and onThreadId callback.' },
  { icon: '\uD83D\uDCD0', title: 'Angular Signals', desc: 'Every state slice is an Angular Signal. Works with OnPush, async pipe, and computed().' },
  { icon: '\uD83E\uDDEA', title: 'MockAgentTransport', desc: 'Deterministic unit testing. Script event sequences and step through them in your specs.' },
  { icon: '\uD83D\uDD27', title: 'Full useStream() parity', desc: 'Interrupts, tool calls, subagents, branch history, joinStream \u2014 everything the React SDK exposes.' },
  { icon: '\uD83C\uDFE2', title: 'Source-available licensing', desc: 'Free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial license at $500/seat/year or $2,000/app deployment.' },
];

export function FeatureStrip() {
  return (
    <section className="px-8 py-16 max-w-6xl mx-auto">
      <h2 className="font-mono text-xs uppercase tracking-widest mb-12 text-center"
        style={{ color: tokens.colors.accent, fontWeight: 'normal' }}>Features</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {FEATURES.map((f, i) => (
          <motion.div
            key={f.title}
            className="p-6 rounded-lg cursor-default"
            style={{
              border: `1px solid ${tokens.glass.border}`,
              background: tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            }}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08, duration: 0.4 }}
            whileHover={{
              borderColor: tokens.colors.accentBorderHover,
              boxShadow: tokens.glow.card,
              background: tokens.glass.bgHover,
            }}>
            <div className="mb-3" style={{ fontSize: '1.5rem', color: tokens.colors.accent }} aria-hidden="true">{f.icon}</div>
            <h3 style={{ fontFamily: 'var(--font-garamond)', fontWeight: 700, fontSize: '1.125rem', color: tokens.colors.textPrimary, marginBottom: 8 }}>{f.title}</h3>
            <p style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>{f.desc}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/FeatureStrip.tsx
git commit -m "feat(website): apply glass cards to FeatureStrip"
```

---

### Task 10: Update CodeBlock

**Files:**
- Modify: `apps/website/src/components/landing/CodeBlock.tsx`

- [ ] **Step 1: Replace CodeBlock.tsx with glass-bordered container**

```tsx
import { codeToHtml } from 'shiki';
import { tokens } from '../../lib/design-tokens';

const EXAMPLE = `// app.config.ts
provideAgent({ apiUrl: 'http://localhost:2024' })

// chat.component.ts
const chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'chat_agent',
  threadId: signal(this.threadId),
  onThreadId: (id) => localStorage.setItem('threadId', id),
});`;

const TEMPLATE_EXAMPLE = `<!-- chat.component.html -->
@for (msg of chat.messages(); track $index) {
  <p>{{ msg.content }}</p>
}
<button (click)="chat.submit({ messages: [input] })">Send</button>`;

export async function CodeBlock() {
  const tsHtml = await codeToHtml(EXAMPLE, {
    lang: 'typescript',
    theme: 'tokyo-night',
  });

  const templateHtml = await codeToHtml(TEMPLATE_EXAMPLE, {
    lang: 'html',
    theme: 'tokyo-night',
  });

  return (
    <section className="px-8 py-16 max-w-4xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest mb-8 text-center"
        style={{ color: tokens.colors.accent }}>30-second example</p>
      <div style={{
        borderRadius: 12,
        border: `1px solid ${tokens.glass.border}`,
        boxShadow: tokens.glass.shadow,
        overflow: 'hidden',
      }}>
        <div
          className="overflow-hidden text-sm leading-relaxed"
          dangerouslySetInnerHTML={{ __html: tsHtml }}
        />
        <div
          className="overflow-hidden text-sm leading-relaxed"
          style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}
          dangerouslySetInnerHTML={{ __html: templateHtml }}
        />
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/CodeBlock.tsx
git commit -m "feat(website): apply glass border to CodeBlock"
```

---

### Task 11: Update GenerativeUIFrame

**Files:**
- Modify: `apps/website/src/components/landing/GenerativeUIFrame.tsx`

- [ ] **Step 1: Replace GenerativeUIFrame.tsx — keep dark browser chrome, add glass outer frame**

```tsx
'use client';
import { useEffect, useRef } from 'react';
import { tokens } from '../../lib/design-tokens';

export function GenerativeUIFrame() {
  const frameRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const frame = frameRef.current;
    if (!frame) return;

    const handleMouseMove = (e: MouseEvent) => {
      const rect = frame.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      const distance = Math.hypot(e.clientX - cx, e.clientY - cy);
      const intensity = 0.08 + 0.2 * Math.max(0, 1 - distance / 400);
      const blur = 10 + intensity * 40;
      frame.style.boxShadow = `0 0 ${blur}px rgba(0,64,144,${intensity.toFixed(2)})`;
    };

    document.addEventListener('mousemove', handleMouseMove);
    return () => document.removeEventListener('mousemove', handleMouseMove);
  }, []);

  return (
    <div
      ref={frameRef}
      role="img"
      aria-label="Animated demo of angular rendering a generative UI"
      className="rounded-xl overflow-hidden"
      style={{
        border: `1px solid ${tokens.glass.border}`,
        background: '#080B14',
        boxShadow: tokens.glow.demo,
        transition: 'box-shadow 0.1s ease-out',
        width: '100%',
        maxWidth: 520,
      }}>
      {/* Browser chrome */}
      <div style={{
        padding: '10px 14px',
        borderBottom: '1px solid rgba(255,255,255,0.08)',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <div style={{ display: 'flex', gap: 6 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FF5F57' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#FEBC2E' }} />
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#28C840' }} />
        </div>
        <div style={{
          flex: 1, background: 'rgba(255,255,255,0.06)',
          borderRadius: 4, padding: '3px 10px',
          fontFamily: 'var(--font-mono)', fontSize: 11,
          color: '#4A527A', textAlign: 'center',
        }}>
          localhost:4200
        </div>
      </div>

      {/* Animated content area */}
      <div style={{ padding: 20, minHeight: 260, position: 'relative', overflow: 'hidden' }}>
        <style>{`
          @keyframes fadeWord {
            from { opacity: 0; transform: translateY(4px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes cardIn {
            from { opacity: 0; transform: translateY(8px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes rowIn {
            from { opacity: 0; }
            to   { opacity: 1; }
          }
          @keyframes loopFade {
            0%, 75% { opacity: 1; }
            97%, 100% { opacity: 0; }
          }
          .gen-ui-loop { animation: loopFade 6s linear infinite; }
          .w1  { animation: fadeWord 0.25s ease-out 0.1s both; }
          .w2  { animation: fadeWord 0.25s ease-out 0.3s both; }
          .w3  { animation: fadeWord 0.25s ease-out 0.5s both; }
          .w4  { animation: fadeWord 0.25s ease-out 0.7s both; }
          .w5  { animation: fadeWord 0.25s ease-out 0.9s both; }
          .w6  { animation: fadeWord 0.25s ease-out 1.1s both; }
          .card-title { animation: cardIn 0.3s ease-out 1.5s both; }
          .card-body  { animation: cardIn 0.3s ease-out 1.9s both; }
          .card-btn   { animation: cardIn 0.3s ease-out 2.3s both; }
          .row1 { animation: rowIn 0.25s ease-out 3.0s both; }
          .row2 { animation: rowIn 0.25s ease-out 3.4s both; }
          .row3 { animation: rowIn 0.25s ease-out 3.8s both; }
        `}</style>

        <div className="gen-ui-loop">
          {/* Phase 1: streaming chat reply */}
          <div style={{ marginBottom: 16, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
            <div style={{
              width: 24, height: 24, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(108,142,255,0.2)', border: '1px solid rgba(108,142,255,0.4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#6C8EFF',
            }}>AI</div>
            <div style={{
              background: 'rgba(108,142,255,0.08)', borderRadius: 8,
              padding: '8px 12px', fontSize: 13, color: '#EEF1FF', lineHeight: 1.5,
            }}>
              <span className="w1">Here </span>
              <span className="w2">is </span>
              <span className="w3">your </span>
              <span className="w4">quarterly </span>
              <span className="w5">report </span>
              <span className="w6">summary.</span>
            </div>
          </div>

          {/* Phase 2: generative card */}
          <div style={{
            border: '1px solid rgba(108,142,255,0.2)', borderRadius: 8,
            padding: '12px 14px', marginBottom: 12,
          }}>
            <div className="card-title" style={{
              fontFamily: 'var(--font-garamond)', fontSize: 15, fontWeight: 700,
              color: '#EEF1FF', marginBottom: 6,
            }}>Q1 2026 Revenue</div>
            <div className="card-body" style={{
              fontSize: 12, color: '#8B96C8', lineHeight: 1.5, marginBottom: 10,
            }}>Revenue up 24% YoY. Strongest quarter on record across all segments.</div>
            <div className="card-btn" style={{
              display: 'inline-block', padding: '5px 12px', borderRadius: 5,
              background: 'rgba(108,142,255,0.15)',
              border: '1px solid rgba(108,142,255,0.3)',
              fontFamily: 'var(--font-mono)', fontSize: 11, color: '#6C8EFF',
            }}>View details &rarr;</div>
          </div>

          {/* Phase 3: streaming table */}
          <div style={{ border: '1px solid rgba(108,142,255,0.15)', borderRadius: 8, overflow: 'hidden' }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
              padding: '6px 12px', background: 'rgba(108,142,255,0.06)',
              fontFamily: 'var(--font-mono)', fontSize: 10,
              color: '#4A527A', textTransform: 'uppercase', letterSpacing: '0.08em',
            }}>
              <span>Segment</span><span>Revenue</span><span>Growth</span>
            </div>
            {[
              { seg: 'Enterprise', rev: '$4.2M', growth: '+31%', cls: 'row1' },
              { seg: 'SMB', rev: '$2.1M', growth: '+18%', cls: 'row2' },
              { seg: 'Developer', rev: '$0.8M', growth: '+42%', cls: 'row3' },
            ].map((r) => (
              <div key={r.seg} className={r.cls} style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                padding: '6px 12px',
                borderTop: '1px solid rgba(108,142,255,0.08)',
                fontSize: 12, color: '#8B96C8',
              }}>
                <span>{r.seg}</span>
                <span style={{ color: '#EEF1FF' }}>{r.rev}</span>
                <span style={{ color: '#6C8EFF' }}>{r.growth}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/landing/GenerativeUIFrame.tsx
git commit -m "feat(website): update GenerativeUIFrame outer frame for glass theme"
```

---

### Task 12: Update Landing Page (page.tsx)

**Files:**
- Modify: `apps/website/src/app/page.tsx`

- [ ] **Step 1: Update page.tsx — apply gradient background and update live demo section colors**

```tsx
import Script from 'next/script';
import { HeroTwoCol } from '../components/landing/HeroTwoCol';
import { ArchDiagram } from '../components/landing/ArchDiagram';
import { FeatureStrip } from '../components/landing/FeatureStrip';
import { CodeBlock } from '../components/landing/CodeBlock';
import { tokens } from '../lib/design-tokens';

export default async function HomePage() {
  return (
    <div style={{ background: tokens.gradient.bgFlow, position: 'relative', overflow: 'hidden' }}>
      {/* Ambient gradient blobs that extend beyond the hero */}
      <div style={{ position: 'absolute', width: 600, height: 600, borderRadius: '50%', background: tokens.gradient.warm, top: -200, left: -150, filter: 'blur(80px)', pointerEvents: 'none' }} />
      <div style={{ position: 'absolute', width: 500, height: 500, borderRadius: '50%', background: tokens.gradient.cool, bottom: 200, right: -100, filter: 'blur(80px)', pointerEvents: 'none' }} />

      <HeroTwoCol />
      <ArchDiagram />
      <FeatureStrip />
      <CodeBlock />

      {/* Angular Elements live demo */}
      <section className="px-8 py-16 max-w-3xl mx-auto" style={{ position: 'relative', zIndex: 1 }}>
        <p className="font-mono text-xs uppercase tracking-widest mb-8 text-center"
          style={{ color: tokens.colors.accent }}>Live Demo</p>
        <div className="rounded-xl overflow-hidden"
          style={{ border: `1px solid ${tokens.glass.border}`, boxShadow: tokens.glow.demo }}>
          {/* @ts-expect-error — custom element registered by Angular Elements bundle */}
          <stream-chat-demo
            api-url={process.env['NEXT_PUBLIC_LANGGRAPH_URL'] ?? 'http://localhost:2024'}
            assistant-id="chat_agent"
          />
        </div>
        <Script src="/demo/main.js" strategy="lazyOnload" />
      </section>
    </div>
  );
}
```

- [ ] **Step 2: Verify full landing page in browser**

Open http://localhost:3000 and scroll through the full landing page. Confirm gradient background, glass cards, and dark code blocks all render correctly.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/page.tsx
git commit -m "feat(website): apply gradient background to landing page"
```

---

### Task 13: Update DocsSidebar

**Files:**
- Modify: `apps/website/src/components/docs/DocsSidebar.tsx`

- [ ] **Step 1: Replace DocsSidebar.tsx with glass treatment**

```tsx
import Link from 'next/link';
import { getAllDocsMeta } from '../../lib/docs';
import { tokens } from '../../lib/design-tokens';

export function DocsSidebar({ activeSlug }: { activeSlug: string }) {
  const docs = getAllDocsMeta();
  return (
    <aside
      className="w-56 shrink-0 py-8"
      style={{
        borderRight: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        minHeight: 'calc(100vh - 4rem)',
        position: 'sticky',
        top: '4rem',
      }}>
      <p
        className="font-mono text-xs uppercase tracking-widest mb-6 px-4"
        style={{ color: tokens.colors.textMuted }}>
        Documentation
      </p>
      <nav className="flex flex-col">
        {docs.map((doc) => {
          const slug = doc.slug.join('/');
          const isActive = slug === activeSlug;
          return (
            <Link
              key={slug}
              href={`/docs/${slug}`}
              className="px-4 py-2 text-sm mx-2 rounded-md transition-all"
              style={{
                color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                background: isActive ? tokens.colors.accentSurface : 'transparent',
              }}>
              {doc.title}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/DocsSidebar.tsx
git commit -m "feat(website): apply glass treatment to DocsSidebar"
```

---

### Task 14: Update MdxRenderer

**Files:**
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`

- [ ] **Step 1: Replace MdxRenderer.tsx — switch from prose-invert to light prose**

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import { CopyPromptButton } from './CopyPromptButton';
import { tokens } from '../../lib/design-tokens';

interface Props {
  source: string;
  prompt?: string;
}

export function MdxRenderer({ source, prompt }: Props) {
  return (
    <article className="prose max-w-none py-8 px-8 flex-1"
      style={{
        '--tw-prose-body': tokens.colors.textSecondary,
        '--tw-prose-headings': tokens.colors.textPrimary,
        '--tw-prose-code': tokens.colors.accent,
        background: 'rgba(255, 255, 255, 0.8)',
      } as React.CSSProperties}>
      {prompt && (
        <div style={{ marginBottom: 24 }}>
          <CopyPromptButton prompt={prompt} variant="docs" />
        </div>
      )}
      <MDXRemote source={source} />
    </article>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/MdxRenderer.tsx
git commit -m "feat(website): switch MdxRenderer to light prose theme"
```

---

### Task 15: Update Docs Page Layout

**Files:**
- Modify: `apps/website/src/app/docs/[[...slug]]/page.tsx`

- [ ] **Step 1: Add gradient background to docs layout**

```tsx
import { notFound } from 'next/navigation';
import { DocsSidebar } from '../../../components/docs/DocsSidebar';
import { MdxRenderer } from '../../../components/docs/MdxRenderer';
import { OpenInCockpit } from '../../../components/docs/open-in-cockpit';
import { getDocBySlug, getAllDocSlugs, getPromptBySlug } from '../../../lib/docs';

export function generateStaticParams() {
  return getAllDocSlugs().map((slug) => ({ slug }));
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: rawSlug } = await params;
  const slug = rawSlug ?? ['deep-agents', 'getting-started', 'overview', 'overview', 'python'];
  const doc = getDocBySlug(slug);
  if (!doc) notFound();
  const prompt = getPromptBySlug(slug) ?? undefined;

  return (
    <div className="flex min-h-screen pt-16"
      style={{ background: 'var(--gradient-bg-flow)' }}>
      <DocsSidebar activeSlug={slug.join('/')} />
      <div className="flex-1">
        <div className="px-8 pt-8">
          <OpenInCockpit bundle={doc.bundle} />
        </div>
        <MdxRenderer source={doc.content} prompt={prompt} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/app/docs/[[...slug]]/page.tsx
git commit -m "feat(website): add gradient background to docs page"
```

---

### Task 16: Update PricingGrid

**Files:**
- Modify: `apps/website/src/components/pricing/PricingGrid.tsx`

- [ ] **Step 1: Replace PricingGrid.tsx with glass card treatment**

```tsx
'use client';
import { tokens } from '../../lib/design-tokens';

const PLANS = [
  {
    name: 'Community',
    price: 'Free',
    period: 'noncommercial use',
    features: ['PolyForm Noncommercial 1.0.0', 'Personal projects', 'Academic & research', 'Non-profit internal use'],
    highlight: false,
    cta: 'Get Started',
    ctaHref: 'https://www.npmjs.com/package/@cacheplane/langgraph',
  },
  {
    name: 'Developer Seat',
    price: '$500',
    period: '/seat/year',
    features: ['Commercial use', '12-month release lock', 'Email support', 'All features'],
    highlight: false,
    cta: 'Buy License',
    ctaHref: '#lead-form',
  },
  {
    name: 'App Deployment',
    price: '$2,000',
    period: '/app one-time',
    features: ['Per-application license', 'All environments covered', 'No seat limits', 'Perpetual for version'],
    highlight: false,
    cta: 'Buy License',
    ctaHref: '#lead-form',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'volume licensing',
    features: ['Volume licensing', 'Priority support', 'Custom contract'],
    highlight: true,
    cta: 'Contact Us',
    ctaHref: '#lead-form',
  },
];

export function PricingGrid() {
  return (
    <section className="px-8 py-16 max-w-6xl mx-auto">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {PLANS.map((plan) => (
          <div
            key={plan.name}
            className="p-8 rounded-xl flex flex-col"
            style={{
              border: `1px solid ${plan.highlight ? tokens.colors.accent : tokens.glass.border}`,
              boxShadow: plan.highlight ? tokens.glow.card : tokens.glass.shadow,
              background: plan.highlight ? 'rgba(255, 255, 255, 0.55)' : tokens.glass.bg,
              backdropFilter: `blur(${tokens.glass.blur})`,
              WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            }}>
            <p
              className="font-mono text-xs uppercase tracking-widest mb-4"
              style={{ color: tokens.colors.accent }}>
              {plan.name}
            </p>
            <p
              style={{
                fontFamily: 'var(--font-garamond)',
                fontWeight: 700,
                fontSize: 48,
                color: tokens.colors.textPrimary,
                lineHeight: 1,
                marginBottom: 4,
              }}>
              {plan.price}
            </p>
            <p className="text-sm mb-8" style={{ color: tokens.colors.textMuted }}>{plan.period}</p>
            <ul className="flex flex-col gap-2 mb-8 flex-1">
              {plan.features.map((f) => (
                <li key={f} className="text-sm flex items-center gap-2" style={{ color: tokens.colors.textSecondary }}>
                  <span style={{ color: tokens.colors.accent }}>&check;</span> {f}
                </li>
              ))}
            </ul>
            <a
              href={plan.ctaHref}
              className="text-center py-3 px-6 rounded font-mono text-sm transition-all"
              style={{
                background: plan.highlight ? tokens.colors.accent : 'transparent',
                color: plan.highlight ? '#fff' : tokens.colors.accent,
                border: `1px solid ${tokens.colors.accent}`,
                textDecoration: 'none',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.boxShadow = tokens.glow.button)}
              onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
              {plan.cta}
            </a>
          </div>
        ))}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/pricing/PricingGrid.tsx
git commit -m "feat(website): apply glass cards to PricingGrid"
```

---

### Task 17: Update CompareTable

**Files:**
- Modify: `apps/website/src/components/pricing/CompareTable.tsx`

- [ ] **Step 1: Replace CompareTable.tsx with glass container and new colors**

```tsx
'use client';
import { tokens } from '../../lib/design-tokens';

const ROWS = [
  { feature: 'npm install', oss: true, seat: true, app: true, enterprise: true },
  { feature: 'Commercial use', oss: false, seat: true, app: true, enterprise: true },
  { feature: 'All Angular versions', oss: true, seat: true, app: true, enterprise: true },
  { feature: 'Email support', oss: false, seat: true, app: true, enterprise: true },
  { feature: 'Source access', oss: true, seat: true, app: true, enterprise: true },
  { feature: 'Per-app deployment', oss: false, seat: false, app: true, enterprise: true },
  { feature: 'Volume licensing', oss: false, seat: false, app: false, enterprise: true },
  { feature: 'Priority support', oss: false, seat: false, app: false, enterprise: true },
];

const Check = () => <span style={{ color: tokens.colors.accent }}>&check;</span>;
const X = () => <span style={{ color: tokens.colors.textMuted }}>&mdash;</span>;

export function CompareTable() {
  return (
    <section className="px-8 py-8 max-w-6xl mx-auto overflow-x-auto">
      <div style={{
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        border: `1px solid ${tokens.glass.border}`,
        borderRadius: 12,
        overflow: 'hidden',
      }}>
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}`, background: 'rgba(255,255,255,0.55)' }}>
              <th className="text-left py-3 px-4 font-mono text-xs uppercase" style={{ color: tokens.colors.textMuted }}>Feature</th>
              {['Community', 'Developer Seat', 'App Deployment', 'Enterprise'].map((h) => (
                <th key={h} className="text-center py-3 px-4 font-mono text-xs uppercase" style={{ color: tokens.colors.accent }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.accentSurface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}>
                <td className="py-3 px-4" style={{ color: tokens.colors.textSecondary }}>{row.feature}</td>
                <td className="py-3 px-4 text-center">{row.oss ? <Check /> : <X />}</td>
                <td className="py-3 px-4 text-center">{row.seat ? <Check /> : <X />}</td>
                <td className="py-3 px-4 text-center">{row.app ? <Check /> : <X />}</td>
                <td className="py-3 px-4 text-center">{row.enterprise ? <Check /> : <X />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/pricing/CompareTable.tsx
git commit -m "feat(website): apply glass container to CompareTable"
```

---

### Task 18: Update LeadForm

**Files:**
- Modify: `apps/website/src/components/pricing/LeadForm.tsx`

- [ ] **Step 1: Replace LeadForm.tsx with glass container and new colors**

```tsx
'use client';
import { useState } from 'react';
import { tokens } from '../../lib/design-tokens';

export function LeadForm() {
  const [status, setStatus] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setStatus('sending');
    const form = e.currentTarget;
    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      setStatus(res.ok ? 'sent' : 'error');
    } catch {
      setStatus('error');
    }
  };

  const inputStyle: React.CSSProperties = {
    background: 'rgba(255, 255, 255, 0.6)',
    border: `1px solid ${tokens.glass.border}`,
    color: tokens.colors.textPrimary,
    borderRadius: '6px',
    padding: '10px 14px',
    width: '100%',
    fontFamily: 'var(--font-inter)',
    fontSize: '14px',
    outline: 'none',
  };

  return (
    <section id="lead-form" className="px-8 py-16 max-w-xl mx-auto">
      <p className="font-mono text-xs uppercase tracking-widest mb-8 text-center" style={{ color: tokens.colors.accent }}>Enterprise</p>
      <h2
        style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 700,
          fontSize: 'clamp(24px, 3vw, 36px)',
          color: tokens.colors.textPrimary,
          textAlign: 'center',
          marginBottom: 32,
        }}>
        Need volume seats or a custom contract?
      </h2>
      {status === 'sent' ? (
        <p className="text-center" style={{ color: tokens.colors.textSecondary }}>Thanks &mdash; we&apos;ll be in touch within one business day.</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4"
          style={{
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            border: `1px solid ${tokens.glass.border}`,
            borderRadius: 12,
            padding: 24,
          }}>
          <input
            name="name"
            placeholder="Name"
            required
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <input
            name="email"
            type="email"
            placeholder="Work email"
            required
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <input
            name="company"
            placeholder="Company"
            style={inputStyle}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <textarea
            name="message"
            placeholder="Tell us about your use case"
            rows={4}
            style={{ ...inputStyle, resize: 'vertical' }}
            onFocus={(e) => { e.target.style.borderColor = tokens.colors.accent; e.target.style.outline = `2px solid ${tokens.colors.accentGlow}`; e.target.style.outlineOffset = '2px'; }}
            onBlur={(e) => { e.target.style.borderColor = tokens.glass.border; e.target.style.outline = 'none'; }}
          />
          <button
            type="submit"
            disabled={status === 'sending'}
            style={{
              background: tokens.colors.accent,
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              padding: '12px 24px',
              fontFamily: 'var(--font-mono)',
              fontSize: '14px',
              cursor: status === 'sending' ? 'not-allowed' : 'pointer',
              opacity: status === 'sending' ? 0.6 : 1,
              transition: 'box-shadow 0.2s',
            }}
            onMouseEnter={(e) => { if (status !== 'sending') e.currentTarget.style.boxShadow = tokens.glow.button; }}
            onMouseLeave={(e) => (e.currentTarget.style.boxShadow = 'none')}>
            {status === 'sending' ? 'Sending\u2026' : 'Get in touch'}
          </button>
          {status === 'error' && (
            <p className="text-sm text-center" style={{ color: '#FF6B6B' }}>
              Something went wrong &mdash; try again or email us directly.
            </p>
          )}
        </form>
      )}
    </section>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/pricing/LeadForm.tsx
git commit -m "feat(website): apply glass treatment to LeadForm"
```

---

### Task 19: Update Pricing Page Layout

**Files:**
- Modify: `apps/website/src/app/pricing/page.tsx`

- [ ] **Step 1: Add gradient background and update text colors**

```tsx
import { PricingGrid } from '../../components/pricing/PricingGrid';
import { CompareTable } from '../../components/pricing/CompareTable';
import { LeadForm } from '../../components/pricing/LeadForm';

export default function PricingPage() {
  return (
    <div className="pt-24" style={{ background: 'var(--gradient-bg-flow)', minHeight: '100vh' }}>
      <div className="text-center px-8 py-16">
        <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--color-accent)' }}>Pricing</p>
        <h1
          style={{
            fontFamily: 'var(--font-garamond)',
            fontWeight: 800,
            fontSize: 'clamp(40px, 6vw, 80px)',
            color: 'var(--color-text-primary)',
          }}>
          Simple, transparent pricing
        </h1>
      </div>
      <PricingGrid />
      <CompareTable />
      <LeadForm />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/app/pricing/page.tsx
git commit -m "feat(website): add gradient background to pricing page"
```

---

### Task 20: Update ApiRefTable

**Files:**
- Modify: `apps/website/src/components/docs/ApiRefTable.tsx`

- [ ] **Step 1: Replace ApiRefTable.tsx with glass container and new colors**

```tsx
import { tokens } from '../../lib/design-tokens';

export interface ApiEntry {
  name: string;
  type: string;
  description: string;
  params?: { name: string; type: string; desc: string }[];
}

export function ApiRefTable({ entries }: { entries: ApiEntry[] }) {
  return (
    <div className="flex flex-col gap-8">
      {entries.map((entry) => (
        <div
          key={entry.name}
          className="p-6 rounded-lg"
          style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
            backdropFilter: `blur(${tokens.glass.blur})`,
            WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
            boxShadow: tokens.glass.shadow,
          }}>
          <div className="flex items-baseline gap-3 mb-2">
            <code
              className="font-mono font-bold text-base"
              style={{ color: tokens.colors.accent }}>
              {entry.name}
            </code>
            <code
              className="font-mono text-xs"
              style={{ color: tokens.colors.textSecondary }}>
              {entry.type}
            </code>
          </div>
          <p className="text-sm mb-4" style={{ color: tokens.colors.textSecondary }}>{entry.description}</p>
          {entry.params && entry.params.length > 0 && (
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}>
                  {['Parameter', 'Type', 'Description'].map((h) => (
                    <th
                      key={h}
                      className="text-left py-2 font-mono uppercase"
                      style={{ color: tokens.colors.textMuted }}>
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {entry.params.map((p) => (
                  <tr key={p.name} style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}>
                    <td className="py-2 font-mono" style={{ color: tokens.colors.accent }}>{p.name}</td>
                    <td className="py-2 font-mono" style={{ color: tokens.colors.textSecondary }}>{p.type}</td>
                    <td className="py-2" style={{ color: tokens.colors.textSecondary }}>{p.desc}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/ApiRefTable.tsx
git commit -m "feat(website): apply glass treatment to ApiRefTable"
```

---

### Task 21: Update API Reference Page Layout

**Files:**
- Modify: `apps/website/src/app/api-reference/page.tsx`

- [ ] **Step 1: Add gradient background and update text colors**

```tsx
import { ApiRefTable, type ApiEntry } from '../../components/docs/ApiRefTable';

// Placeholder entries — replaced by generated api-docs.json in Task W9
const ENTRIES: ApiEntry[] = [
  {
    name: 'agent()',
    type: 'function',
    description: 'Creates a streaming resource connected to a LangGraph agent. Must be called within an Angular injection context.',
    params: [
      { name: 'assistantId', type: 'string', desc: 'Agent or graph identifier.' },
      { name: 'apiUrl', type: 'string', desc: 'LangGraph Platform base URL.' },
      { name: 'threadId', type: 'Signal<string | null> | string | null', desc: 'Thread to connect to. Pass a signal for reactive updates.' },
      { name: 'onThreadId', type: '(id: string) => void', desc: 'Called when a new thread is auto-created.' },
    ],
  },
  {
    name: 'provideAgent()',
    type: 'function',
    description: 'Angular provider factory. Registers global defaults for apiUrl and transport.',
    params: [
      { name: 'config', type: 'AgentConfig', desc: 'Global config merged with per-call options.' },
    ],
  },
];

export default function ApiReferencePage() {
  return (
    <div className="pt-24 px-8 py-16 max-w-4xl mx-auto" style={{ background: 'var(--gradient-bg-flow)', minHeight: '100vh' }}>
      <p className="font-mono text-xs uppercase tracking-widest mb-4" style={{ color: 'var(--color-accent)' }}>API Reference</p>
      <h1
        style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 800,
          fontSize: 'clamp(32px, 4vw, 56px)',
          color: 'var(--color-text-primary)',
          marginBottom: 48,
        }}>
        API Reference
      </h1>
      <ApiRefTable entries={ENTRIES} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/app/api-reference/page.tsx
git commit -m "feat(website): add gradient background to API reference page"
```

---

### Task 22: Final Build Verification

- [ ] **Step 1: Run full build**

Run: `npx nx build website --skip-nx-cache 2>&1 | tail -20`
Expected: Build succeeds with no errors

- [ ] **Step 2: Visual review of all pages**

Open each page in browser and verify:
- http://localhost:3000 — landing page with gradient, glass nav, glass cards
- http://localhost:3000/docs — glass sidebar, readable content area
- http://localhost:3000/pricing — glass pricing cards, glass form
- http://localhost:3000/api-reference — glass API tables

- [ ] **Step 3: Commit any final fixes if needed**
