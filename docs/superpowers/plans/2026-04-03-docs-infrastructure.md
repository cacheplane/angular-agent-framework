# Docs Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the Mintlify-inspired docs framework — new routing, collapsible sidebar, 5 custom MDX components, Cmd+K search, breadcrumbs, prev/next navigation — with 3 placeholder content pages to verify everything works.

**Architecture:** Replace the cockpit-manifest-driven 5-segment routing with a simple 2-segment `/docs/[section]/[slug]` system. New `docs-config.ts` defines the sidebar tree. New `docs-new.ts` loads MDX from `content/docs-v2/`. Custom MDX components (Callout, Steps, Tabs, CodeGroup, Card) are registered in MdxRenderer. Client-side Cmd+K search uses a build-time JSON index.

**Tech Stack:** Next.js 16, React 19, next-mdx-remote/rsc, Tailwind CSS v4, Framer Motion, design tokens

**Spec:** `docs/superpowers/specs/2026-04-03-docs-refresh-design.md`

**Note:** This plan covers the docs framework/infrastructure only. Content authoring (all 19 pages) is a follow-up plan that builds on this.

---

### Task 1: Create Docs Config — Sidebar Navigation Tree

**Files:**
- Create: `apps/website/src/lib/docs-config.ts`

This file defines the sidebar navigation structure — sections, pages, and their order. It's the single source of truth for docs navigation.

- [ ] **Step 1: Create docs-config.ts**

```typescript
export interface DocsPage {
  title: string;
  slug: string;
  section: string;
}

export interface DocsSection {
  title: string;
  id: string;
  color: 'blue' | 'red';
  pages: DocsPage[];
}

export const docsConfig: DocsSection[] = [
  {
    title: 'Getting Started',
    id: 'getting-started',
    color: 'blue',
    pages: [
      { title: 'Introduction', slug: 'introduction', section: 'getting-started' },
      { title: 'Quick Start', slug: 'quickstart', section: 'getting-started' },
      { title: 'Installation', slug: 'installation', section: 'getting-started' },
    ],
  },
  {
    title: 'Guides',
    id: 'guides',
    color: 'blue',
    pages: [
      { title: 'Streaming', slug: 'streaming', section: 'guides' },
      { title: 'Persistence', slug: 'persistence', section: 'guides' },
      { title: 'Interrupts', slug: 'interrupts', section: 'guides' },
      { title: 'Memory', slug: 'memory', section: 'guides' },
      { title: 'Time Travel', slug: 'time-travel', section: 'guides' },
      { title: 'Subgraphs', slug: 'subgraphs', section: 'guides' },
      { title: 'Testing', slug: 'testing', section: 'guides' },
      { title: 'Deployment', slug: 'deployment', section: 'guides' },
    ],
  },
  {
    title: 'Concepts',
    id: 'concepts',
    color: 'red',
    pages: [
      { title: 'Angular Signals', slug: 'angular-signals', section: 'concepts' },
      { title: 'LangGraph Basics', slug: 'langgraph-basics', section: 'concepts' },
      { title: 'Agent Architecture', slug: 'agent-architecture', section: 'concepts' },
      { title: 'State Management', slug: 'state-management', section: 'concepts' },
    ],
  },
  {
    title: 'API Reference',
    id: 'api',
    color: 'blue',
    pages: [
      { title: 'agent()', slug: 'angular', section: 'api' },
      { title: 'provideAgent()', slug: 'provide-angular', section: 'api' },
      { title: 'FetchStreamTransport', slug: 'fetch-stream-transport', section: 'api' },
      { title: 'MockAgentTransport', slug: 'mock-stream-transport', section: 'api' },
    ],
  },
];

/** Flat list of all pages in sidebar order */
export const allDocsPages: DocsPage[] = docsConfig.flatMap((s) => s.pages);

/** Find a page by section + slug */
export function findDocsPage(section: string, slug: string): DocsPage | undefined {
  return allDocsPages.find((p) => p.section === section && p.slug === slug);
}

/** Get prev/next pages relative to a given page */
export function getPrevNextPages(section: string, slug: string): { prev: DocsPage | null; next: DocsPage | null } {
  const idx = allDocsPages.findIndex((p) => p.section === section && p.slug === slug);
  return {
    prev: idx > 0 ? allDocsPages[idx - 1] : null,
    next: idx < allDocsPages.length - 1 ? allDocsPages[idx + 1] : null,
  };
}

/** Get the section a page belongs to */
export function getDocsSection(sectionId: string): DocsSection | undefined {
  return docsConfig.find((s) => s.id === sectionId);
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/lib/docs-config.ts
git commit -m "feat(website): add docs navigation config"
```

---

### Task 2: Create New Docs Loader

**Files:**
- Create: `apps/website/src/lib/docs-new.ts`

Replaces the cockpit-dependent `docs.ts`. Loads MDX from `content/docs-v2/[section]/[slug].mdx`.

- [ ] **Step 1: Create docs-new.ts**

```typescript
import fs from 'fs';
import path from 'path';
import { allDocsPages, type DocsPage } from './docs-config';

const resolveContentDir = (): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs-v2');
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs-v2');
};

export interface ResolvedDoc {
  page: DocsPage;
  content: string;
  title: string;
}

export function getDocBySlug(section: string, slug: string): ResolvedDoc | null {
  const page = allDocsPages.find((p) => p.section === section && p.slug === slug);
  if (!page) return null;

  const dir = resolveContentDir();
  const filePath = path.join(dir, section, `${slug}.mdx`);
  if (!fs.existsSync(filePath)) return null;

  const content = fs.readFileSync(filePath, 'utf8');
  const titleMatch = content.match(/^#\s+(.+)$/m);
  return {
    page,
    content,
    title: titleMatch?.[1] ?? page.title,
  };
}

export function getAllDocSlugs(): { section: string; slug: string }[] {
  return allDocsPages.map((p) => ({ section: p.section, slug: p.slug }));
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/lib/docs-new.ts
git commit -m "feat(website): add new docs loader (cockpit-independent)"
```

---

### Task 3: Create 3 Placeholder Content Pages

**Files:**
- Create: `apps/website/content/docs-v2/getting-started/introduction.mdx`
- Create: `apps/website/content/docs-v2/guides/streaming.mdx`
- Create: `apps/website/content/docs-v2/api/angular.mdx`

These prove the system works end-to-end. Real content comes in the follow-up plan.

- [ ] **Step 1: Create directory structure and introduction page**

Create `apps/website/content/docs-v2/getting-started/introduction.mdx`:

```mdx
# Introduction

Angular Agent Framework brings full parity with React's `useStream()` hook to Angular 20+. It's the enterprise streaming resource for LangChain and Angular — built natively with Angular Signals, not wrapped or adapted.

<Callout type="info" title="Who is this for?">
Angular Agent Framework serves two audiences: Angular developers building AI-powered apps, and AI/agent developers who need an Angular frontend.
</Callout>

## What you'll build

With agent(), you can build Angular applications that connect to LangGraph agents with:

- **Token-by-token streaming** via SSE
- **Thread persistence** across sessions
- **Human-in-the-loop** interrupts and approvals
- **Time travel** debugging
- **Deterministic testing** with MockAgentTransport

## Next steps

<CardGroup cols={2}>
  <Card title="Quick Start" href="/docs/getting-started/quickstart">
    Build your first streaming chat in 5 minutes
  </Card>
  <Card title="Installation" href="/docs/getting-started/installation">
    Detailed setup and configuration guide
  </Card>
</CardGroup>
```

- [ ] **Step 2: Create streaming guide page**

Create `apps/website/content/docs-v2/guides/streaming.mdx`:

```mdx
# Streaming

Angular Agent Framework provides token-by-token streaming from LangGraph agents via Server-Sent Events (SSE). Every update lands directly in Angular Signals.

<Callout type="tip" title="Prerequisites">
Make sure you've completed the [Installation](/docs/getting-started/installation) guide first.
</Callout>

## Basic streaming

<Tabs items={['TypeScript', 'Template']}>
<Tab>
```typescript
// chat.component.ts
const chat = agent<{ messages: BaseMessage[] }>({
  assistantId: 'chat_agent',
});

// Status updates as streaming progresses
const isStreaming = computed(() => chat.status() === 'streaming');
```
</Tab>
<Tab>
```html
<!-- chat.component.html -->
@for (msg of chat.messages(); track $index) {
  <p [class.streaming]="$last && isStreaming()">
    {{ msg.content }}
  </p>
}
```
</Tab>
</Tabs>

## Stream status

The `status()` signal reports the current state:

<Steps>
<Step title="idle">
No active stream. Ready to send a message.
</Step>
<Step title="streaming">
Tokens are arriving. Messages update in real-time.
</Step>
<Step title="error">
Something went wrong. Check `error()` for details.
</Step>
</Steps>
```

- [ ] **Step 3: Create API reference page**

Create `apps/website/content/docs-v2/api/angular.mdx`:

```mdx
# agent()

Creates a streaming resource connected to a LangGraph agent. Must be called within an Angular injection context.

## Signature

```typescript
function agent<TState>(options: AgentOptions<TState>): Agent<TState>
```

## Options

| Parameter | Type | Description |
|-----------|------|-------------|
| `assistantId` | `string` | Agent or graph identifier |
| `apiUrl` | `string` | LangGraph Platform base URL |
| `threadId` | `Signal<string \| null> \| string \| null` | Thread to connect to |
| `onThreadId` | `(id: string) => void` | Called when a new thread is created |
| `onInterrupt` | `(data: unknown) => void` | Called when the agent pauses for input |
| `transport` | `StreamTransport` | Custom transport (default: FetchStreamTransport) |

## Return type

`agent()` returns an object with these Signal properties:

| Property | Type | Description |
|----------|------|-------------|
| `messages()` | `Signal<BaseMessage[]>` | Current message list |
| `status()` | `Signal<'idle' \| 'streaming' \| 'error'>` | Stream status |
| `error()` | `Signal<Error \| null>` | Last error, if any |
| `threadId()` | `Signal<string \| null>` | Current thread ID |

## Methods

| Method | Description |
|--------|-------------|
| `submit(input)` | Send a message or resume from interrupt |
| `history()` | Get execution history for time travel |
```

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs-v2/
git commit -m "feat(website): add placeholder docs content (3 pages)"
```

---

### Task 4: Create MDX Components — Callout

**Files:**
- Create: `apps/website/src/components/docs/mdx/Callout.tsx`

- [ ] **Step 1: Create Callout component**

```tsx
import { tokens } from '../../../../lib/design-tokens';

const CALLOUT_STYLES = {
  info: { border: tokens.colors.accent, bg: 'rgba(0, 64, 144, 0.04)' },
  warning: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.04)' },
  tip: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.04)' },
  danger: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.04)' },
} as const;

interface Props {
  type?: keyof typeof CALLOUT_STYLES;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: Props) {
  const style = CALLOUT_STYLES[type];
  return (
    <div style={{
      padding: '12px 16px',
      borderRadius: 8,
      borderLeft: `3px solid ${style.border}`,
      background: style.bg,
      marginBottom: 16,
    }}>
      {title && (
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: style.border,
          marginBottom: 4,
        }}>{title}</div>
      )}
      <div style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/mdx/Callout.tsx
git commit -m "feat(website): add Callout MDX component"
```

---

### Task 5: Create MDX Components — Steps

**Files:**
- Create: `apps/website/src/components/docs/mdx/Steps.tsx`

- [ ] **Step 1: Create Steps and Step components**

```tsx
import React from 'react';
import { tokens } from '../../../../lib/design-tokens';

export function Steps({ children }: { children: React.ReactNode }) {
  const steps = React.Children.toArray(children);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginBottom: 16 }}>
      {steps.map((child, i) => {
        if (!React.isValidElement(child)) return null;
        return React.cloneElement(child as React.ReactElement<{ stepNumber: number }>, { stepNumber: i + 1 });
      })}
    </div>
  );
}

export function Step({ title, children, stepNumber }: { title: string; children: React.ReactNode; stepNumber?: number }) {
  return (
    <div style={{ display: 'flex', gap: 12 }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <div style={{
          width: 24, height: 24, borderRadius: '50%',
          background: tokens.colors.accent, color: '#fff',
          fontSize: 12, fontWeight: 600,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          flexShrink: 0,
        }}>{stepNumber ?? 1}</div>
        <div style={{ width: 1, flex: 1, background: `${tokens.colors.accent}33`, marginTop: 4 }} />
      </div>
      <div style={{ flex: 1, paddingBottom: 8 }}>
        <div style={{
          fontWeight: 600,
          fontSize: '0.9rem',
          color: tokens.colors.textPrimary,
          marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.6 }}>
          {children}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/mdx/Steps.tsx
git commit -m "feat(website): add Steps MDX component"
```

---

### Task 6: Create MDX Components — Tabs

**Files:**
- Create: `apps/website/src/components/docs/mdx/Tabs.tsx`

- [ ] **Step 1: Create Tabs and Tab components**

```tsx
'use client';
import { useState, Children } from 'react';
import { tokens } from '../../../../lib/design-tokens';

export function Tabs({ items, children }: { items: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);

  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `1px solid ${tokens.colors.accentBorder}`,
      }}>
        {items.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            style={{
              padding: '8px 16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: active === i ? 500 : 400,
              color: active === i ? tokens.colors.accent : tokens.colors.textMuted,
              background: 'none',
              border: 'none',
              borderBottom: active === i ? `2px solid ${tokens.colors.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'color 0.15s',
            }}>
            {label}
          </button>
        ))}
      </div>
      <div>{tabs[active]}</div>
    </div>
  );
}

export function Tab({ children }: { children: React.ReactNode }) {
  return <div>{children}</div>;
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/mdx/Tabs.tsx
git commit -m "feat(website): add Tabs MDX component"
```

---

### Task 7: Create MDX Components — Card / CardGroup

**Files:**
- Create: `apps/website/src/components/docs/mdx/Card.tsx`

- [ ] **Step 1: Create Card and CardGroup components**

```tsx
import Link from 'next/link';
import { tokens } from '../../../../lib/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${cols}, 1fr)`,
      gap: 12,
      marginBottom: 16,
    }}>
      {children}
    </div>
  );
}

export function Card({ title, href, icon, children }: { title: string; href: string; icon?: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{
        padding: 16,
        borderRadius: 10,
        border: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        transition: 'box-shadow 0.2s, border-color 0.2s',
        cursor: 'pointer',
      }}>
        {icon && <div style={{ fontSize: '1.25rem', marginBottom: 6 }}>{icon}</div>}
        <div style={{
          fontFamily: 'var(--font-garamond)',
          fontWeight: 700,
          fontSize: '1rem',
          color: tokens.colors.textPrimary,
          marginBottom: 4,
        }}>{title}</div>
        <div style={{ fontSize: '0.8rem', color: tokens.colors.textSecondary, lineHeight: 1.5 }}>
          {children}
        </div>
      </div>
    </Link>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/mdx/Card.tsx
git commit -m "feat(website): add Card/CardGroup MDX component"
```

---

### Task 8: Create MDX Components — CodeGroup

**Files:**
- Create: `apps/website/src/components/docs/mdx/CodeGroup.tsx`

- [ ] **Step 1: Create CodeGroup component**

```tsx
'use client';
import { useState, Children, isValidElement } from 'react';
import { tokens } from '../../../../lib/design-tokens';

export function CodeGroup({ children }: { children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const blocks = Children.toArray(children).filter(isValidElement);

  // Extract title from pre > code data attributes or fallback to index
  const titles = blocks.map((block, i) => {
    const pre = block as React.ReactElement<{ 'data-title'?: string; children?: React.ReactNode }>;
    return pre.props['data-title'] ?? `File ${i + 1}`;
  });

  return (
    <div style={{
      borderRadius: 12,
      border: `1px solid ${tokens.glass.border}`,
      boxShadow: tokens.glass.shadow,
      overflow: 'hidden',
      marginBottom: 16,
    }}>
      <div style={{
        display: 'flex', gap: 0,
        background: 'rgba(26, 27, 38, 0.95)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}>
        {titles.map((title, i) => (
          <button
            key={title}
            onClick={() => setActive(i)}
            style={{
              padding: '8px 14px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.7rem',
              color: active === i ? '#a9b1d6' : '#4A527A',
              background: active === i ? 'rgba(255,255,255,0.05)' : 'transparent',
              border: 'none',
              cursor: 'pointer',
            }}>
            {title}
          </button>
        ))}
      </div>
      <div>{blocks[active]}</div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/mdx/CodeGroup.tsx
git commit -m "feat(website): add CodeGroup MDX component"
```

---

### Task 9: Create New Docs Sidebar

**Files:**
- Create: `apps/website/src/components/docs/DocsSidebarNew.tsx`

- [ ] **Step 1: Create collapsible sidebar with section groups**

```tsx
'use client';
import { useState } from 'react';
import Link from 'next/link';
import { docsConfig, type DocsSection } from '../../lib/docs-config';
import { tokens } from '../../../lib/design-tokens';

interface Props {
  activeSection: string;
  activeSlug: string;
}

function SectionGroup({ section, activeSection, activeSlug }: { section: DocsSection; activeSection: string; activeSlug: string }) {
  const hasActive = section.pages.some((p) => p.section === activeSection && p.slug === activeSlug);
  const [open, setOpen] = useState(hasActive || true);
  const headerColor = section.color === 'red' ? tokens.colors.angularRed : tokens.colors.accent;

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setOpen(!open)}
        className="w-full text-left px-4 py-1.5 flex items-center justify-between"
        style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
        <span className="font-mono text-xs uppercase tracking-wider" style={{ color: headerColor, fontWeight: 600 }}>
          {section.title}
        </span>
        <span style={{ color: tokens.colors.textMuted, fontSize: 10, transition: 'transform 0.2s', transform: open ? 'rotate(0)' : 'rotate(-90deg)' }}>
          ▾
        </span>
      </button>

      {open && (
        <nav className="flex flex-col mt-1">
          {section.pages.map((page) => {
            const isActive = page.section === activeSection && page.slug === activeSlug;
            return (
              <Link
                key={`${page.section}/${page.slug}`}
                href={`/docs/${page.section}/${page.slug}`}
                className="px-4 py-1.5 text-sm mx-2 rounded-md transition-all"
                style={{
                  color: isActive ? tokens.colors.accent : tokens.colors.textSecondary,
                  background: isActive ? tokens.colors.accentSurface : 'transparent',
                  fontSize: '0.825rem',
                }}>
                {page.title}
              </Link>
            );
          })}
        </nav>
      )}
    </div>
  );
}

export function DocsSidebarNew({ activeSection, activeSlug }: Props) {
  return (
    <aside
      className="w-64 shrink-0 py-6 overflow-y-auto"
      style={{
        borderRight: `1px solid ${tokens.glass.border}`,
        background: tokens.glass.bg,
        backdropFilter: `blur(${tokens.glass.blur})`,
        WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
        minHeight: 'calc(100vh - 4rem)',
        position: 'sticky',
        top: '4rem',
      }}>
      {/* Search trigger */}
      <div className="px-4 mb-6">
        <button
          className="w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between"
          style={{
            background: 'rgba(255,255,255,0.5)',
            border: `1px solid ${tokens.glass.border}`,
            color: tokens.colors.textMuted,
            cursor: 'pointer',
          }}
          onClick={() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: true }))}>
          <span style={{ fontSize: '0.8rem' }}>Search docs...</span>
          <span style={{
            background: tokens.colors.accentSurface,
            padding: '1px 6px',
            borderRadius: 4,
            fontFamily: 'var(--font-mono)',
            fontSize: '0.65rem',
            color: tokens.colors.accent,
          }}>⌘K</span>
        </button>
      </div>

      {docsConfig.map((section) => (
        <SectionGroup
          key={section.id}
          section={section}
          activeSection={activeSection}
          activeSlug={activeSlug}
        />
      ))}
    </aside>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/DocsSidebarNew.tsx
git commit -m "feat(website): add collapsible docs sidebar with section groups"
```

---

### Task 10: Create Breadcrumb and Prev/Next Components

**Files:**
- Create: `apps/website/src/components/docs/DocsBreadcrumb.tsx`
- Create: `apps/website/src/components/docs/DocsPrevNext.tsx`

- [ ] **Step 1: Create DocsBreadcrumb**

```tsx
import Link from 'next/link';
import { tokens } from '../../../lib/design-tokens';
import { getDocsSection } from '../../lib/docs-config';

export function DocsBreadcrumb({ section, title }: { section: string; title: string }) {
  const sectionData = getDocsSection(section);
  return (
    <div className="flex items-center gap-2 mb-4" style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem', color: tokens.colors.textMuted }}>
      <Link href="/docs/getting-started/introduction" style={{ color: tokens.colors.textMuted, textDecoration: 'none' }}>Docs</Link>
      <span>›</span>
      <span>{sectionData?.title ?? section}</span>
      <span>›</span>
      <span style={{ color: tokens.colors.textSecondary }}>{title}</span>
    </div>
  );
}
```

- [ ] **Step 2: Create DocsPrevNext**

```tsx
import Link from 'next/link';
import { tokens } from '../../../lib/design-tokens';
import { getPrevNextPages } from '../../lib/docs-config';

export function DocsPrevNext({ section, slug }: { section: string; slug: string }) {
  const { prev, next } = getPrevNextPages(section, slug);

  return (
    <div className="flex justify-between gap-4 mt-12 pt-8" style={{ borderTop: `1px solid ${tokens.glass.border}` }}>
      {prev ? (
        <Link href={`/docs/${prev.section}/${prev.slug}`} style={{ textDecoration: 'none', flex: 1 }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>← Previous</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{prev.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
      {next ? (
        <Link href={`/docs/${next.section}/${next.slug}`} style={{ textDecoration: 'none', flex: 1, textAlign: 'right' }}>
          <div className="p-4 rounded-lg transition-all" style={{
            border: `1px solid ${tokens.glass.border}`,
            background: tokens.glass.bg,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: '0.7rem', color: tokens.colors.textMuted, marginBottom: 4 }}>Next →</div>
            <div style={{ fontSize: '0.9rem', color: tokens.colors.textPrimary, fontWeight: 500 }}>{next.title}</div>
          </div>
        </Link>
      ) : <div style={{ flex: 1 }} />}
    </div>
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/docs/DocsBreadcrumb.tsx apps/website/src/components/docs/DocsPrevNext.tsx
git commit -m "feat(website): add DocsBreadcrumb and DocsPrevNext components"
```

---

### Task 11: Create Cmd+K Search Modal

**Files:**
- Create: `apps/website/src/components/docs/DocsSearch.tsx`

- [ ] **Step 1: Create search modal with fuzzy matching**

```tsx
'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { allDocsPages, docsConfig } from '../../lib/docs-config';
import { tokens } from '../../../lib/design-tokens';

export function DocsSearch() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const results = query.length > 0
    ? allDocsPages.filter((p) =>
        p.title.toLowerCase().includes(query.toLowerCase()) ||
        p.slug.toLowerCase().includes(query.toLowerCase()) ||
        p.section.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : allDocsPages.slice(0, 6);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
      e.preventDefault();
      setOpen((o) => !o);
    }
    if (e.key === 'Escape') setOpen(false);
  }, []);

  useEffect(() => {
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelected(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  const navigate = (page: typeof allDocsPages[0]) => {
    router.push(`/docs/${page.section}/${page.slug}`);
    setOpen(false);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected((s) => Math.min(s + 1, results.length - 1)); }
    if (e.key === 'ArrowUp') { e.preventDefault(); setSelected((s) => Math.max(s - 1, 0)); }
    if (e.key === 'Enter' && results[selected]) { navigate(results[selected]); }
  };

  const getSectionLabel = (sectionId: string) => docsConfig.find((s) => s.id === sectionId)?.title ?? sectionId;

  if (!open) return null;

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 100,
      background: 'rgba(0,0,0,0.3)',
      backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      paddingTop: '20vh',
    }} onClick={() => setOpen(false)}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 520,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: `blur(${tokens.glass.blur})`,
          border: `1px solid ${tokens.glass.border}`,
          borderRadius: 12,
          boxShadow: '0 16px 64px rgba(0,0,0,0.15)',
          overflow: 'hidden',
        }}>
        <div style={{ padding: '12px 16px', borderBottom: `1px solid ${tokens.glass.border}` }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelected(0); }}
            onKeyDown={handleInputKeyDown}
            placeholder="Search documentation..."
            style={{
              width: '100%', border: 'none', outline: 'none',
              fontFamily: 'var(--font-inter)', fontSize: '0.95rem',
              color: tokens.colors.textPrimary, background: 'transparent',
            }}
          />
        </div>
        <div style={{ maxHeight: 320, overflowY: 'auto', padding: 8 }}>
          {results.map((page, i) => (
            <button
              key={`${page.section}/${page.slug}`}
              onClick={() => navigate(page)}
              className="w-full text-left"
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '10px 12px', borderRadius: 8,
                background: i === selected ? tokens.colors.accentSurface : 'transparent',
                border: 'none', cursor: 'pointer', width: '100%',
              }}>
              <span style={{ fontSize: '0.875rem', color: tokens.colors.textPrimary }}>{page.title}</span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: '0.65rem',
                color: tokens.colors.textMuted, background: 'rgba(0,0,0,0.04)',
                padding: '2px 6px', borderRadius: 4,
              }}>{getSectionLabel(page.section)}</span>
            </button>
          ))}
          {results.length === 0 && (
            <div style={{ padding: 16, textAlign: 'center', color: tokens.colors.textMuted, fontSize: '0.85rem' }}>
              No results for &ldquo;{query}&rdquo;
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/DocsSearch.tsx
git commit -m "feat(website): add Cmd+K search modal for docs"
```

---

### Task 12: Update MdxRenderer — Register Custom Components

**Files:**
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`

- [ ] **Step 1: Replace MdxRenderer with custom MDX component registration**

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import { tokens } from '../../../lib/design-tokens';
import { Callout } from './mdx/Callout';
import { Steps, Step } from './mdx/Steps';
import { Tabs, Tab } from './mdx/Tabs';
import { Card, CardGroup } from './mdx/Card';
import { CodeGroup } from './mdx/CodeGroup';
import { DocsBreadcrumb } from './DocsBreadcrumb';
import { DocsPrevNext } from './DocsPrevNext';

const mdxComponents = {
  Callout,
  Steps,
  Step,
  Tabs,
  Tab,
  Card,
  CardGroup,
  CodeGroup,
};

interface Props {
  source: string;
  section: string;
  slug: string;
  title: string;
}

export function MdxRendererNew({ source, section, slug, title }: Props) {
  return (
    <div className="flex-1 py-8 px-8 md:px-12 max-w-3xl">
      <DocsBreadcrumb section={section} title={title} />
      <article className="prose max-w-none"
        style={{
          '--tw-prose-body': tokens.colors.textSecondary,
          '--tw-prose-headings': tokens.colors.textPrimary,
          '--tw-prose-code': tokens.colors.accent,
          '--tw-prose-links': tokens.colors.accent,
        } as React.CSSProperties}>
        <MDXRemote source={source} components={mdxComponents} />
      </article>
      <DocsPrevNext section={section} slug={slug} />
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/MdxRenderer.tsx
git commit -m "feat(website): register custom MDX components in renderer"
```

---

### Task 13: Update Docs Page — New Routing + Layout

**Files:**
- Modify: `apps/website/src/app/docs/[[...slug]]/page.tsx`

- [ ] **Step 1: Replace docs page with new 2-segment routing**

```tsx
import { notFound } from 'next/navigation';
import { DocsSidebarNew } from '../../../components/docs/DocsSidebarNew';
import { MdxRendererNew } from '../../../components/docs/MdxRenderer';
import { DocsSearch } from '../../../components/docs/DocsSearch';
import { getDocBySlug, getAllDocSlugs } from '../../../lib/docs-new';
import { tokens } from '../../../../lib/design-tokens';

export function generateStaticParams() {
  return getAllDocSlugs().map(({ section, slug }) => ({ slug: [section, slug] }));
}

export default async function DocsPage({ params }: { params: Promise<{ slug?: string[] }> }) {
  const { slug: rawSlug } = await params;
  const slugParts = rawSlug ?? ['getting-started', 'introduction'];

  // Support both 2-segment (new) routing
  const [section, slug] = slugParts.length >= 2
    ? [slugParts[0], slugParts[1]]
    : ['getting-started', 'introduction'];

  const doc = getDocBySlug(section, slug);
  if (!doc) notFound();

  return (
    <div className="flex min-h-screen pt-16" style={{ background: 'var(--gradient-bg-flow)' }}>
      <DocsSearch />
      <DocsSidebarNew activeSection={section} activeSlug={slug} />
      <div className="flex-1" style={{ background: 'rgba(255, 255, 255, 0.85)' }}>
        <MdxRendererNew source={doc.content} section={section} slug={slug} title={doc.title} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:3000/docs/getting-started/introduction and verify:
- Sidebar renders with 4 collapsible sections
- Content renders with Callout and CardGroup components
- Breadcrumb shows "Docs › Getting Started › Introduction"
- Prev/Next shows at bottom

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/docs/[[...slug]]/page.tsx
git commit -m "feat(website): wire up new docs routing with sidebar, search, and MDX components"
```

---

### Task 14: Verify All Pages and Fix Issues

- [ ] **Step 1: Navigate to each placeholder page**

Open:
- http://localhost:3000/docs/getting-started/introduction
- http://localhost:3000/docs/guides/streaming
- http://localhost:3000/docs/api/angular

Verify each renders correctly with custom MDX components.

- [ ] **Step 2: Test Cmd+K search**

Press Cmd+K, type "stream", verify results appear and navigation works.

- [ ] **Step 3: Test prev/next navigation**

On the introduction page, verify "Next → Quick Start" appears (even though quickstart.mdx doesn't exist yet — the link should still render).

- [ ] **Step 4: Fix any issues found and commit**

```bash
git add -A
git commit -m "fix(website): docs infrastructure polish and fixes"
```
