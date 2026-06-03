# Docs Landing Page Polish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Polish the `/docs` landing into direction B (branded & iconic): vendor logo chips on the four fork cards, in-house glyphs for our own libraries, numbered step badges, a copy-able install snippet, hover lift, and dividers — plus the headline and blurb copy updates.

**Architecture:** The page (`apps/website/src/app/docs/page.tsx`) stays a Next.js **server component**. One new **client component** (`CopyButton`) handles clipboard interaction. Marks reuse the existing `/logos/*.svg` assets and the `EcosystemStrip` image treatment; the copy button reuses `CodeBlock`'s icons + the existing `docs:copy_code_click` analytics event. No new dependencies or asset files.

**Tech Stack:** Next.js (App Router), React server + client components, TypeScript, `@threadplane/design-tokens`, Vitest + Testing Library, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-06-03-docs-landing-polish-design.md`

---

## File Structure

- **Create:** `apps/website/src/components/docs/CopyButton.tsx` — client component: an icon copy button that writes a passed string to the clipboard, shows a 2s "copied" state, and fires `docs:copy_code_click`. One responsibility.
- **Create:** `apps/website/src/components/docs/CopyButton.spec.tsx` — unit test (vitest + jsdom).
- **Modify:** `apps/website/src/app/docs/page.tsx` — full rewrite: new headline/blurbs, logo+glyph chips, numbered badges, snippet row with `CopyButton`, dividers, scoped hover `<style>`.
- **Modify:** `apps/website/e2e/docs.spec.ts` — update the "Docs landing page" block: new h1 text, vendor-logo `<img>` assertions, copy-button assertion.

`docsConfig`, routing, the sidebar, and the funnel order are unchanged.

---

## Task 1: CopyButton client component (TDD)

**Files:**
- Create: `apps/website/src/components/docs/CopyButton.spec.tsx`
- Create: `apps/website/src/components/docs/CopyButton.tsx`

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/components/docs/CopyButton.spec.tsx`:

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/analytics/client', () => ({
  track: trackMock,
}));

beforeEach(() => {
  trackMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('CopyButton', () => {
  it('renders an accessible copy button by default', async () => {
    const { CopyButton } = await import('./CopyButton');
    render(<CopyButton text="npm i @threadplane/langgraph" />);
    expect(screen.getByRole('button', { name: /copy install command/i })).toBeTruthy();
  });

  it('copies the text, shows copied state, and fires docs:copy_code_click with cta_id=copy_install', async () => {
    const { CopyButton } = await import('./CopyButton');
    render(<CopyButton text="npm i @threadplane/langgraph" />);
    fireEvent.click(screen.getByRole('button', { name: /copy install command/i }));
    expect(writeTextMock).toHaveBeenCalledWith('npm i @threadplane/langgraph');
    // After click the accessible name flips to "Copied"
    await screen.findByRole('button', { name: /copied/i });
    expect(trackMock).toHaveBeenCalledWith(
      'docs:copy_code_click',
      expect.objectContaining({ surface: 'docs', cta_id: 'copy_install' }),
    );
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/website && npx vitest run src/components/docs/CopyButton.spec.tsx
```
Expected: FAIL — cannot resolve `./CopyButton` (module does not exist yet).

- [ ] **Step 3: Write the implementation**

Create `apps/website/src/components/docs/CopyButton.tsx`:

```tsx
'use client';
import { useState } from 'react';
import { tokens } from '@threadplane/design-tokens';
import { analyticsEvents } from '../../lib/analytics/events';
import { track } from '../../lib/analytics/client';

function CopyIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="5" y="5" width="9" height="9" rx="1.5" />
      <path d="M11 5V3.5A1.5 1.5 0 009.5 2h-6A1.5 1.5 0 002 3.5v6A1.5 1.5 0 003.5 11H5" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

interface Props {
  /** The exact string copied to the clipboard. */
  text: string;
}

export function CopyButton({ text }: Props) {
  const [copied, setCopied] = useState(false);

  const handleClick = async () => {
    try {
      await navigator.clipboard.writeText(text);
      track(analyticsEvents.docsCopyCodeClick, {
        surface: 'docs',
        cta_id: 'copy_install',
      });
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard access denied — silently ignore
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? 'Copied' : 'Copy install command'}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 28,
        height: 28,
        flex: '0 0 auto',
        padding: 0,
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: tokens.radius.sm,
        background: tokens.surfaces.surface,
        color: copied ? tokens.colors.accent : tokens.colors.textMuted,
        cursor: 'pointer',
        transition: 'color 0.15s, border-color 0.15s, background 0.15s',
      }}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run:
```bash
cd apps/website && npx vitest run src/components/docs/CopyButton.spec.tsx
```
Expected: PASS (2 passed).

- [ ] **Step 5: Lint the new files**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework && npx eslint apps/website/src/components/docs/CopyButton.tsx apps/website/src/components/docs/CopyButton.spec.tsx
```
Expected: exit 0, no output. (Lint the files directly — `nx lint website` fails locally on the git-ignored, untracked `apps/website/public/demo/main.js`, which is not in the repo and not part of this change.)

- [ ] **Step 6: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/src/components/docs/CopyButton.tsx apps/website/src/components/docs/CopyButton.spec.tsx
git commit -m "feat(website): add CopyButton client component for docs install snippets"
```

---

## Task 2: Update the e2e test for the polished page (failing first)

**Files:**
- Modify: `apps/website/e2e/docs.spec.ts` (the first `test.describe('Docs landing page', ...)` block only)

- [ ] **Step 1: Replace the landing-page test block**

In `apps/website/e2e/docs.spec.ts`, replace the entire first describe block (`test.describe('Docs landing page', () => { ... })`) with:

```ts
test.describe('Docs landing page', () => {
  test('renders the start-here funnel + search prompt', async ({ page }) => {
    await page.goto('/docs');

    // Hero
    await expect(page.locator('#docs-heading')).toBeVisible();
    await expect(page.locator('#docs-heading')).toContainText('Start building with Threadplane');

    // Step headings (plain substring avoids the badge/middle-dot chars)
    await expect(page.getByText('Pick your backend').first()).toBeVisible();
    await expect(page.getByText('Generative UI').first()).toBeVisible();
    await expect(page.getByText('Chat UI').first()).toBeVisible();

    // Step 1 — backend quickstart links
    await expect(page.locator('main a[href="/docs/langgraph/getting-started/quickstart"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/ag-ui/getting-started/quickstart"]').first()).toBeVisible();

    // Vendor logo marks on the fork cards
    await expect(page.locator('main img[src="/logos/langgraph.svg"]').first()).toBeVisible();
    await expect(page.locator('main img[src="/logos/runtimes/copilotkit.svg"]').first()).toBeVisible();
    await expect(page.locator('main img[src="/logos/providers/google.svg"]').first()).toBeVisible();
    await expect(page.locator('main img[src="/logos/surface/vercel.svg"]').first()).toBeVisible();

    // Install snippet copy buttons
    await expect(page.locator('main button[aria-label="Copy install command"]').first()).toBeVisible();

    // Step 2 — generative UI links
    await expect(page.locator('main a[href="/docs/a2ui/getting-started/introduction"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/render/getting-started/introduction"]').first()).toBeVisible();

    // Step 3 — chat
    await expect(page.locator('main a[href="/docs/chat/getting-started/introduction"]').first()).toBeVisible();

    // Helper links
    await expect(page.locator('main a[href="/docs/choosing-an-adapter"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/render/concepts/json-render-vs-a2ui"]').first()).toBeVisible();

    // Supporting libraries
    await expect(page.locator('main a[href="/docs/licensing/getting-started/introduction"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/telemetry/getting-started/introduction"]').first()).toBeVisible();

    // Search prompt
    await expect(page.getByText('Looking for something specific?').first()).toBeVisible();
  });
});
```

Leave the `Docs slug page` and `Docs search` describe blocks unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts -g "start-here funnel"
```
Expected: FAIL — the live page still reads "Build AI agent UIs in Angular" and has no logo `<img>` or copy button, so the new assertions fail.

---

## Task 3: Rewrite the page component

**Files:**
- Modify: `apps/website/src/app/docs/page.tsx` (full rewrite — replace entire file contents)

- [ ] **Step 1: Replace the file with the new implementation**

Replace the entire contents of `apps/website/src/app/docs/page.tsx` with:

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { CopyButton } from '../../components/docs/CopyButton';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Documentation — Threadplane',
  description:
    'Build AI agent UIs in Angular. Library guides, API reference, and production patterns for Threadplane.',
  pathname: '/docs',
  type: 'website',
});

interface Backend {
  title: string;
  blurb: string;
  install: string;
  href: string;
  logoSrc: string;
  attribution: string;
}

const BACKENDS: Backend[] = [
  {
    title: 'LangGraph',
    blurb: 'For LangChain & LangGraph backends.',
    install: 'npm i @threadplane/langgraph',
    href: '/docs/langgraph/getting-started/quickstart',
    logoSrc: '/logos/langgraph.svg',
    attribution: 'LangChain',
  },
  {
    title: 'AG-UI',
    blurb: 'For CrewAI, Mastra, Pydantic AI, Strands, and more.',
    install: 'npm i @threadplane/ag-ui',
    href: '/docs/ag-ui/getting-started/quickstart',
    logoSrc: '/logos/runtimes/copilotkit.svg',
    attribution: 'AG-UI · CopilotKit',
  },
];

interface GenerativeUi {
  title: string;
  blurb: string;
  href: string;
  logoSrc: string;
  attribution: string;
}

const GENERATIVE_UI: GenerativeUi[] = [
  {
    title: 'A2UI',
    blurb:
      'Agent-to-UI protocol — the agent streams and updates surfaces over the conversation.',
    href: '/docs/a2ui/getting-started/introduction',
    logoSrc: '/logos/providers/google.svg',
    attribution: 'Google',
  },
  {
    title: 'json-render',
    blurb:
      'Render a fixed JSON spec into your own Angular components. You own the schema.',
    href: '/docs/render/getting-started/introduction',
    logoSrc: '/logos/surface/vercel.svg',
    attribution: 'Vercel',
  },
];

interface SupportingLib {
  title: string;
  blurb: string;
  href: string;
  glyph: 'key' | 'pulse';
}

const SUPPORTING: SupportingLib[] = [
  {
    title: 'Licensing',
    blurb: 'Token verification',
    href: '/docs/licensing/getting-started/introduction',
    glyph: 'key',
  },
  {
    title: 'Telemetry',
    blurb: 'Browser & Node events',
    href: '/docs/telemetry/getting-started/introduction',
    glyph: 'pulse',
  },
];

function ChatGlyph() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 5h16v11H8l-4 4V5Z" />
    </svg>
  );
}

function KeyGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="8" cy="12" r="3" />
      <path d="M11 12h9M17 12v4" />
    </svg>
  );
}

function PulseGlyph() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 13h4l3-8 4 16 3-8h4" />
    </svg>
  );
}

const GLYPHS = { key: KeyGlyph, pulse: PulseGlyph } as const;

const stepLabelStyle = {
  fontFamily: tokens.typography.eyebrow.family,
  fontSize: tokens.typography.eyebrow.size,
  fontWeight: tokens.typography.eyebrow.weight,
  letterSpacing: tokens.typography.eyebrow.letterSpacing,
  textTransform: tokens.typography.eyebrow.transform,
  lineHeight: tokens.typography.eyebrow.line,
  color: tokens.colors.textMuted,
  margin: 0,
  marginBottom: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
} as const;

const stepBadgeStyle = {
  width: 20,
  height: 20,
  borderRadius: tokens.radius.full,
  background: tokens.colors.accent,
  color: '#fff',
  fontSize: 12,
  fontWeight: 700,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

function StepLabel({ id, step, children }: { id: string; step?: number; children: ReactNode }) {
  return (
    <h2 id={id} style={stepLabelStyle}>
      {step != null ? (
        <span aria-hidden="true" style={stepBadgeStyle}>{step}</span>
      ) : null}
      {children}
    </h2>
  );
}

const logoChipStyle = {
  width: 30,
  height: 30,
  borderRadius: tokens.radius.md,
  background: tokens.surfaces.surface,
  border: `1px solid ${tokens.surfaces.border}`,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

const glyphChipStyle = {
  borderRadius: tokens.radius.md,
  background: tokens.colors.accentSurface,
  border: `1px solid ${tokens.colors.accentBorder}`,
  color: tokens.colors.accent,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  flex: '0 0 auto',
} as const;

function LogoChip({ src }: { src: string }) {
  return (
    <span style={logoChipStyle}>
      <img
        src={src}
        alt=""
        aria-hidden="true"
        loading="lazy"
        decoding="async"
        style={{ width: 18, height: 18, objectFit: 'contain' }}
      />
    </span>
  );
}

function GlyphChip({ size, children }: { size: number; children: ReactNode }) {
  return <span style={{ ...glyphChipStyle, width: size, height: size }}>{children}</span>;
}

const cardHeaderStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  marginBottom: 12,
} as const;

const cardTitleStyle = {
  fontFamily: tokens.typography.h3.family,
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 600,
  color: tokens.colors.textPrimary,
  margin: 0,
} as const;

const attributionStyle = {
  fontFamily: tokens.typography.fontMono,
  fontSize: 10,
  lineHeight: 1.4,
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
  color: tokens.colors.textMuted,
  marginTop: 2,
} as const;

const cardBlurbStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: tokens.typography.body.size,
  lineHeight: tokens.typography.body.line,
  color: tokens.colors.textSecondary,
  margin: 0,
} as const;

const ctaStyle = {
  fontFamily: tokens.typography.fontSans,
  fontSize: 14,
  fontWeight: 600,
  color: tokens.colors.accent,
} as const;

const snippetRowStyle = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 8,
  background: tokens.surfaces.surface,
  border: `1px solid ${tokens.surfaces.border}`,
  borderRadius: tokens.radius.md,
  padding: '5px 6px 5px 12px',
  margin: '14px 0 16px',
} as const;

const snippetCodeStyle = {
  fontFamily: tokens.typography.fontMono,
  fontSize: 13,
  color: tokens.colors.textSecondary,
  overflow: 'hidden',
  textOverflow: 'ellipsis',
  whiteSpace: 'nowrap',
} as const;

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
  gap: 16,
} as const;

const helperStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: 14,
  color: tokens.colors.textSecondary,
  margin: 0,
  marginTop: 16,
  textAlign: 'center',
} as const;

const helperLinkStyle = {
  color: tokens.colors.accent,
  fontWeight: 600,
} as const;

const accentCardStyle = {
  height: '100%',
  background: tokens.colors.accentSurface,
  border: `1px solid ${tokens.colors.accentBorder}`,
} as const;

const plainCardStyle = {
  height: '100%',
} as const;

const dividerStyle = {
  height: 1,
  background: tokens.surfaces.border,
  border: 'none',
  margin: '0 0 40px',
} as const;

export default function DocsLandingPage() {
  return (
    <>
      <style>{`
        [data-ui="docs-card"] { transition: border-color 160ms ease, box-shadow 160ms ease, transform 160ms ease; }
        [data-ui="docs-card"]:hover { border-color: ${tokens.colors.accentBorderHover}; box-shadow: ${tokens.shadows.md}; transform: translateY(-1px); }
        @media (prefers-reduced-motion: reduce) { [data-ui="docs-card"]:hover { transform: none; } }
      `}</style>

      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="docs-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Documentation
            </Eyebrow>
            <h1
              id="docs-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}
            >
              Start building with Threadplane
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                maxWidth: '52ch',
              }}
            >
              A suite of MIT-licensed libraries for streaming agent interfaces.
              Pick your backend to get started.
            </p>
          </div>
        </Container>
      </Section>

      {/* Step 1 — backend */}
      <Section surface="canvas" tight ariaLabelledBy="backend-heading">
        <Container>
          <StepLabel id="backend-heading" step={1}>Pick your backend</StepLabel>
          <div style={gridStyle}>
            {BACKENDS.map((b) => (
              <Link key={b.href} href={b.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" data-ui="docs-card" style={accentCardStyle}>
                  <div style={cardHeaderStyle}>
                    <LogoChip src={b.logoSrc} />
                    <div>
                      <h3 style={cardTitleStyle}>{b.title}</h3>
                      <div style={attributionStyle}>{b.attribution}</div>
                    </div>
                  </div>
                  <p style={cardBlurbStyle}>{b.blurb}</p>
                  <div style={snippetRowStyle}>
                    <code style={snippetCodeStyle}>{b.install}</code>
                    <CopyButton text={b.install} />
                  </div>
                  <span style={ctaStyle}>Quickstart →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Not sure which to use?{' '}
            <Link href="/docs/choosing-an-adapter" style={helperLinkStyle}>
              Choosing an adapter →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 2 — generative UI */}
      <Section surface="canvas" tight ariaLabelledBy="genui-heading">
        <Container>
          <div style={dividerStyle} />
          <StepLabel id="genui-heading" step={2}>Generative UI</StepLabel>
          <div style={gridStyle}>
            {GENERATIVE_UI.map((g) => (
              <Link key={g.href} href={g.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" data-ui="docs-card" style={accentCardStyle}>
                  <div style={cardHeaderStyle}>
                    <LogoChip src={g.logoSrc} />
                    <div>
                      <h3 style={cardTitleStyle}>{g.title}</h3>
                      <div style={attributionStyle}>{g.attribution}</div>
                    </div>
                  </div>
                  <p style={cardBlurbStyle}>{g.blurb}</p>
                  <span style={{ ...ctaStyle, display: 'inline-block', marginTop: 14 }}>Get started →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Which fits my use case?{' '}
            <Link href="/docs/render/concepts/json-render-vs-a2ui" style={helperLinkStyle}>
              json-render vs A2UI →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 3 — chat */}
      <Section surface="canvas" tight ariaLabelledBy="chat-heading">
        <Container>
          <div style={dividerStyle} />
          <StepLabel id="chat-heading" step={3}>Chat UI</StepLabel>
          <Link href="/docs/chat/getting-started/introduction" style={{ textDecoration: 'none' }}>
            <Card padding="lg" data-ui="docs-card" style={plainCardStyle}>
              <div style={cardHeaderStyle}>
                <GlyphChip size={30}><ChatGlyph /></GlyphChip>
                <div>
                  <h3 style={cardTitleStyle}>Chat</h3>
                  <div style={attributionStyle}>Threadplane</div>
                </div>
              </div>
              <p style={cardBlurbStyle}>
                Drop-in chat components — message list, input, streaming, tool
                calls, interrupts, subagents. Renders A2UI & json-render surfaces
                inline.
              </p>
            </Card>
          </Link>
        </Container>
      </Section>

      {/* Supporting libraries */}
      <Section surface="canvas" tight ariaLabelledBy="supporting-heading">
        <Container>
          <div style={dividerStyle} />
          <StepLabel id="supporting-heading">Supporting libraries</StepLabel>
          <div style={gridStyle}>
            {SUPPORTING.map((s) => {
              const Glyph = GLYPHS[s.glyph];
              return (
                <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
                  <Card padding="lg" data-ui="docs-card" style={plainCardStyle}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <GlyphChip size={26}><Glyph /></GlyphChip>
                      <div>
                        <h3 style={{ ...cardTitleStyle, fontSize: 16 }}>{s.title}</h3>
                        <p style={{ ...cardBlurbStyle, fontSize: 13, marginTop: 2 }}>{s.blurb}</p>
                      </div>
                    </div>
                  </Card>
                </Link>
              );
            })}
          </div>
        </Container>
      </Section>

      {/* Search prompt */}
      <Section surface="tinted" tight ariaLabelledBy="search-prompt-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <h2
              id="search-prompt-heading"
              style={{
                fontFamily: tokens.typography.h3.family,
                fontSize: 22,
                lineHeight: 1.3,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Looking for something specific?
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Press <Pill variant="neutral">⌘K</Pill> to search the docs.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
```

- [ ] **Step 2: Lint the changed files**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework && npx eslint apps/website/src/app/docs/page.tsx
```
Expected: exit 0, no output. (Direct-file lint avoids the unrelated git-ignored `public/demo/main.js` failure.)

- [ ] **Step 3: Typecheck the website**

Run:
```bash
cd /Users/blove/repos/angular-agent-framework && npx tsc --noEmit -p apps/website/tsconfig.json 2>&1 | grep -E "docs/page.tsx|components/docs/CopyButton" || echo "no new type errors in changed files"
```
Expected: `no new type errors in changed files`. (The project has pre-existing `TS6305` stale-build-info baseline errors unrelated to this change; this command filters to only the files we touched.)

---

## Task 4: Verify end-to-end and commit

**Files:** none (verification + commit)

- [ ] **Step 1: Run the landing-page e2e test**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts -g "start-here funnel"
```
Expected: PASS. The dev server auto-starts via `apps/website/playwright.config.ts`.

- [ ] **Step 2: Run the full docs e2e file to confirm no regressions**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts
```
Expected: PASS for all blocks (landing page, slug page, search).

- [ ] **Step 3: Commit**

```bash
cd /Users/blove/repos/angular-agent-framework
git add apps/website/src/app/docs/page.tsx apps/website/e2e/docs.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): polish docs landing (direction B — branded & iconic)

Vendor logo chips on the four fork cards, in-house glyphs for our own
libraries, numbered step badges, copy-able install snippet, hover lift,
and dividers. Headline -> "Start building with Threadplane"; tightened
backend blurbs.

Co-Authored-By: Claude Opus 4.8 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Manual verification (browser)

After the e2e passes, confirm visually:

- [ ] Open `/docs` on the dev server (port 3000).
- [ ] Hero reads "Start building with Threadplane".
- [ ] Step labels show numbered badges 1 / 2 / 3; "Supporting libraries" has no badge.
- [ ] Each fork card shows its vendor mark in a white chip + uppercase attribution (LangChain, AG-UI · CopilotKit, Google, Vercel).
- [ ] Chat / Licensing / Telemetry show accent-tinted glyph chips.
- [ ] The backend install snippets have a working copy button (click → checkmark, command on clipboard).
- [ ] Hairline dividers separate steps 1/2/3/supporting; hover lifts each card.
- [ ] Resize to mobile — grids collapse to one column; no console errors.

---

## Self-Review (completed during planning)

- **Spec coverage:** Numbered badges ✓ (Task 3 `StepBadge`/`StepLabel`). Vendor logo chips with the four exact `src`s + attributions ✓. In-house glyphs for Chat/Licensing/Telemetry ✓. Hover lift via `data-ui="docs-card"` + scoped style + reduced-motion guard ✓. h1 "Start building with Threadplane" ✓. Tightened backend blurbs ✓. A2UI link unchanged (`/docs/a2ui/getting-started/introduction`) ✓. CopyButton client component reusing CodeBlock icons + `docs:copy_code_click` + `cta_id: copy_install` ✓ (Task 1). Snippet row ✓. Dividers ✓. e2e + unit tests ✓ (Tasks 1, 2). No spec requirement left unimplemented.
- **Placeholder scan:** No TBD/TODO; every code step shows complete code; no hand-waved error handling.
- **Type consistency:** Interface names (`Backend`, `GenerativeUi`, `SupportingLib`) and array names (`BACKENDS`, `GENERATIVE_UI`, `SUPPORTING`) consistent between definition and use. `CopyButton` takes `{ text }` in both the component and every call site. `GLYPHS` keys (`key`, `pulse`) match the `glyph` union in `SupportingLib`. `LogoChip`/`GlyphChip`/`StepLabel` signatures match their call sites. e2e `src`/`aria-label` assertions match the values rendered by `page.tsx`.
```
