# Docs Mintlify Alignment + Code Highlighting Fix

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix broken code block syntax highlighting in docs and align docs page design with Mintlify patterns — three-column layout with TOC, polished MDX components, and consistent typography.

**Architecture:** Install `rehype-pretty-code` for Shiki-based code highlighting in the MDX pipeline. Create a `DocsTOC` component that extracts `##` headings from MDX source. Polish existing MDX components (Callout icons, Card hover, Tabs styling). Update global CSS with prose code block styles.

**Tech Stack:** rehype-pretty-code, Shiki (tokyo-night), next-mdx-remote/rsc, Tailwind CSS v4, design tokens

**Spec:** `docs/superpowers/specs/2026-04-04-docs-mintlify-alignment-design.md`

---

### Task 1: Install rehype-pretty-code and Fix Code Highlighting

**Files:**
- Modify: `package.json` (install dep)
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`
- Modify: `apps/website/src/app/global.css`

- [ ] **Step 1: Install rehype-pretty-code**

Run: `npm install rehype-pretty-code`

- [ ] **Step 2: Update MdxRendererNew to use rehype-pretty-code**

Replace the full file `apps/website/src/components/docs/MdxRenderer.tsx`:

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
import rehypePrettyCode from 'rehype-pretty-code';

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

const rehypeOptions = {
  theme: 'tokyo-night',
  keepBackground: true,
};

interface NewProps {
  source: string;
  section: string;
  slug: string;
  title: string;
}

export function MdxRendererNew({ source, section, slug, title }: NewProps) {
  return (
    <div className="flex-1 py-8 px-6 md:px-12 max-w-3xl">
      <DocsBreadcrumb section={section} title={title} />
      <article className="docs-prose prose prose-slate max-w-none"
        style={{
          '--tw-prose-body': tokens.colors.textSecondary,
          '--tw-prose-headings': tokens.colors.textPrimary,
          '--tw-prose-code': tokens.colors.accent,
          '--tw-prose-links': tokens.colors.accent,
        } as React.CSSProperties}>
        <MDXRemote
          source={source}
          components={mdxComponents}
          options={{
            mdxOptions: {
              rehypePlugins: [[rehypePrettyCode, rehypeOptions] as any],
            },
          }}
        />
      </article>
      <DocsPrevNext section={section} slug={slug} />
    </div>
  );
}
```

- [ ] **Step 3: Add code block CSS styles to global.css**

Add these styles after the existing `.shiki` styles in `apps/website/src/app/global.css`:

```css
/* rehype-pretty-code — docs code blocks */
.docs-prose [data-rehype-pretty-code-figure] {
  margin: 1.5rem 0;
}

.docs-prose [data-rehype-pretty-code-figure] pre {
  padding: 1.25rem 1.5rem;
  border-radius: 0.75rem;
  border: 1px solid rgba(255, 255, 255, 0.6);
  box-shadow: 0 4px 24px rgba(0, 0, 0, 0.06);
  overflow-x: auto;
  font-size: 0.8rem;
  line-height: 1.7;
}

.docs-prose [data-rehype-pretty-code-figure] code {
  font-family: var(--font-mono), monospace;
  font-size: inherit;
  background: none !important;
  padding: 0 !important;
  border-radius: 0 !important;
  color: inherit !important;
}

.docs-prose [data-rehype-pretty-code-figure] [data-line] {
  padding: 0 0.25rem;
}

/* Language label */
.docs-prose [data-rehype-pretty-code-figure] [data-rehype-pretty-code-title] {
  font-family: var(--font-mono), monospace;
  font-size: 0.7rem;
  color: #8b8fa3;
  padding: 0.5rem 1.5rem;
  background: #1a1b26;
  border-bottom: 1px solid rgba(255, 255, 255, 0.06);
  border-radius: 0.75rem 0.75rem 0 0;
}

.docs-prose [data-rehype-pretty-code-figure]:has([data-rehype-pretty-code-title]) pre {
  border-radius: 0 0 0.75rem 0.75rem;
}

/* Inline code in prose (not in code blocks) */
.docs-prose :not(pre) > code {
  font-family: var(--font-mono), monospace;
  font-size: 0.85em;
  background: rgba(0, 64, 144, 0.06);
  color: #004090;
  padding: 0.15rem 0.4rem;
  border-radius: 0.25rem;
  font-weight: 400;
}

/* Prose heading spacing */
.docs-prose h1 { font-size: 1.875rem; font-weight: 700; margin-top: 0; margin-bottom: 1rem; font-family: var(--font-garamond); }
.docs-prose h2 { font-size: 1.5rem; font-weight: 600; margin-top: 2.5rem; margin-bottom: 1rem; font-family: var(--font-garamond); }
.docs-prose h3 { font-size: 1.25rem; font-weight: 600; margin-top: 2rem; margin-bottom: 0.75rem; font-family: var(--font-garamond); }
.docs-prose p { line-height: 1.75; margin-bottom: 1.25rem; }
.docs-prose ul, .docs-prose ol { margin-bottom: 1.25rem; }
.docs-prose li { margin-bottom: 0.25rem; }

/* Table styling */
.docs-prose table { width: 100%; border-collapse: collapse; font-size: 0.875rem; margin: 1.5rem 0; }
.docs-prose th { text-align: left; padding: 0.5rem 0.75rem; font-family: var(--font-mono); font-size: 0.75rem; text-transform: uppercase; color: #8b8fa3; border-bottom: 1px solid rgba(0, 64, 144, 0.15); }
.docs-prose td { padding: 0.5rem 0.75rem; border-bottom: 1px solid rgba(0, 64, 144, 0.08); color: #555770; }
.docs-prose td code { font-size: 0.8em; }
```

- [ ] **Step 4: Build and verify**

Run: `npx nx build website --skip-nx-cache 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 5: Commit**

```bash
git add package.json package-lock.json apps/website/src/components/docs/MdxRenderer.tsx apps/website/src/app/global.css
git commit -m "feat(website): fix code highlighting with rehype-pretty-code + prose styles"
```

---

### Task 2: Create DocsTOC — "On This Page" Right Sidebar

**Files:**
- Create: `apps/website/src/components/docs/DocsTOC.tsx`
- Modify: `apps/website/src/app/docs/[[...slug]]/page.tsx`

- [ ] **Step 1: Create the TOC component**

Create `apps/website/src/components/docs/DocsTOC.tsx`:

```tsx
'use client';
import { useState, useEffect } from 'react';
import { tokens } from '../../../lib/design-tokens';

interface Heading {
  id: string;
  text: string;
  level: number;
}

export function DocsTOC({ headings }: { headings: Heading[] }) {
  const [activeId, setActiveId] = useState('');

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        }
      },
      { rootMargin: '-80px 0px -80% 0px' },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  return (
    <aside className="hidden xl:block w-52 shrink-0 py-8 pl-8"
      style={{ position: 'sticky', top: '5rem', maxHeight: 'calc(100vh - 6rem)', overflowY: 'auto' }}>
      <p className="font-mono text-xs uppercase tracking-wider mb-3"
        style={{ color: tokens.colors.textMuted, fontWeight: 600 }}>On this page</p>
      <nav className="flex flex-col gap-1.5">
        {headings.map((h) => (
          <a
            key={h.id}
            href={`#${h.id}`}
            className="text-sm transition-colors block"
            style={{
              color: activeId === h.id ? tokens.colors.accent : tokens.colors.textMuted,
              paddingLeft: h.level === 3 ? 12 : 0,
              fontSize: h.level === 3 ? '0.8rem' : '0.825rem',
              lineHeight: 1.5,
            }}>
            {h.text}
          </a>
        ))}
      </nav>
    </aside>
  );
}

/** Extract ## and ### headings from MDX source for TOC */
export function extractHeadings(source: string): Heading[] {
  const lines = source.split('\n');
  const headings: Heading[] = [];
  let inCodeBlock = false;

  for (const line of lines) {
    if (line.trim().startsWith('```')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;

    const match = line.match(/^(#{2,3})\s+(.+)$/);
    if (match) {
      const text = match[2].replace(/`/g, '');
      const id = text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-');
      headings.push({ id, text, level: match[1].length });
    }
  }

  return headings;
}
```

- [ ] **Step 2: Update docs page to include TOC**

Read the current `apps/website/src/app/docs/[[...slug]]/page.tsx`, then update it to import and render the TOC. Add these imports at the top:

```typescript
import { DocsTOC, extractHeadings } from '../../../components/docs/DocsTOC';
```

Then in the JSX, change the content area from:
```tsx
<div className="flex-1" style={{ background: 'rgba(255, 255, 255, 0.85)' }}>
  <MdxRendererNew ... />
  {section === 'api' && ...}
</div>
```

To:
```tsx
<div className="flex-1 flex" style={{ background: 'rgba(255, 255, 255, 0.85)' }}>
  <div className="flex-1 min-w-0">
    <MdxRendererNew source={doc.content} section={section} slug={slug} title={doc.title} />
    {section === 'api' && (() => {
      const entries = loadApiDocs();
      const target = API_NAME_MAP[slug];
      const apiEntry = target ? entries.find((e: ApiDocEntry) => e.name === target) : null;
      return apiEntry ? (
        <div className="px-6 md:px-12 max-w-3xl pb-8">
          <ApiDocRenderer entry={apiEntry} />
        </div>
      ) : null;
    })()}
  </div>
  <DocsTOC headings={extractHeadings(doc.content)} />
</div>
```

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/docs/DocsTOC.tsx 'apps/website/src/app/docs/[[...slug]]/page.tsx'
git commit -m "feat(website): add On This Page TOC sidebar for docs"
```

---

### Task 3: Polish Callout Component — Add Icons

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Callout.tsx`

- [ ] **Step 1: Replace Callout with icon-enhanced version**

Replace `apps/website/src/components/docs/mdx/Callout.tsx`:

```tsx
import { tokens } from '../../../../lib/design-tokens';

const CALLOUT_STYLES = {
  info: { border: tokens.colors.accent, bg: 'rgba(0, 64, 144, 0.05)', icon: 'ℹ️' },
  warning: { border: '#f59e0b', bg: 'rgba(245, 158, 11, 0.05)', icon: '⚠️' },
  tip: { border: '#22c55e', bg: 'rgba(34, 197, 94, 0.05)', icon: '💡' },
  danger: { border: '#ef4444', bg: 'rgba(239, 68, 68, 0.05)', icon: '🚫' },
} as const;

interface Props {
  type?: keyof typeof CALLOUT_STYLES;
  title?: string;
  children: React.ReactNode;
}

export function Callout({ type = 'info', title, children }: Props) {
  const s = CALLOUT_STYLES[type];
  return (
    <div style={{
      padding: '14px 18px',
      borderRadius: 10,
      borderLeft: `3px solid ${s.border}`,
      background: s.bg,
      marginTop: 16,
      marginBottom: 20,
    }}>
      {title && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: '0.8rem',
          fontWeight: 600,
          color: s.border,
          marginBottom: 6,
        }}>
          <span style={{ fontSize: '0.9rem' }}>{s.icon}</span>
          {title}
        </div>
      )}
      <div style={{ fontSize: '0.875rem', color: tokens.colors.textSecondary, lineHeight: 1.7 }}>
        {children}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/docs/mdx/Callout.tsx
git commit -m "feat(website): add icons and polish Callout component"
```

---

### Task 4: Polish Card Component — Hover Effects + Arrow

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Card.tsx`

- [ ] **Step 1: Replace Card with hover-enhanced version**

Replace `apps/website/src/components/docs/mdx/Card.tsx`:

```tsx
'use client';
import Link from 'next/link';
import { tokens } from '../../../../lib/design-tokens';

export function CardGroup({ cols = 2, children }: { cols?: number; children: React.ReactNode }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(auto-fit, minmax(min(100%, ${100 / cols - 2}%), 1fr))`,
      gap: 14,
      marginTop: 16,
      marginBottom: 20,
    }}>
      {children}
    </div>
  );
}

export function Card({ title, href, icon, children }: { title: string; href: string; icon?: string; children: React.ReactNode }) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div
        className="group"
        style={{
          padding: 18,
          borderRadius: 12,
          border: `1px solid ${tokens.glass.border}`,
          background: tokens.glass.bg,
          backdropFilter: `blur(${tokens.glass.blur})`,
          WebkitBackdropFilter: `blur(${tokens.glass.blur})`,
          transition: 'box-shadow 0.2s, border-color 0.2s, transform 0.2s',
          cursor: 'pointer',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.boxShadow = tokens.glow.card;
          e.currentTarget.style.borderColor = tokens.colors.accentBorderHover;
          e.currentTarget.style.transform = 'translateY(-1px)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.boxShadow = 'none';
          e.currentTarget.style.borderColor = tokens.glass.border;
          e.currentTarget.style.transform = 'translateY(0)';
        }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            {icon && <div style={{ fontSize: '1.15rem', marginBottom: 6 }}>{icon}</div>}
            <div style={{
              fontFamily: 'var(--font-garamond)',
              fontWeight: 700,
              fontSize: '0.95rem',
              color: tokens.colors.textPrimary,
              marginBottom: 4,
            }}>{title}</div>
          </div>
          <span style={{ color: tokens.colors.textMuted, fontSize: '0.9rem', marginTop: 2, transition: 'transform 0.2s' }}>→</span>
        </div>
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
git commit -m "feat(website): add hover effects and arrow to Card component"
```

---

### Task 5: Polish Tabs Component

**Files:**
- Modify: `apps/website/src/components/docs/mdx/Tabs.tsx`

- [ ] **Step 1: Replace Tabs with polished version**

Replace `apps/website/src/components/docs/mdx/Tabs.tsx`:

```tsx
'use client';
import { useState, Children } from 'react';
import { tokens } from '../../../../lib/design-tokens';

export function Tabs({ items, children }: { items?: string[]; children: React.ReactNode }) {
  const [active, setActive] = useState(0);
  const tabs = Children.toArray(children);
  const labels = items ?? tabs.map((_, i) => `Tab ${i + 1}`);

  return (
    <div style={{ marginTop: 16, marginBottom: 20 }}>
      <div style={{
        display: 'flex', gap: 0,
        borderBottom: `1px solid ${tokens.colors.accentBorder}`,
        marginBottom: 0,
      }}>
        {labels.map((label, i) => (
          <button
            key={label}
            onClick={() => setActive(i)}
            style={{
              padding: '10px 18px',
              fontFamily: 'var(--font-mono)',
              fontSize: '0.8rem',
              fontWeight: active === i ? 600 : 400,
              color: active === i ? tokens.colors.accent : tokens.colors.textMuted,
              background: active === i ? tokens.colors.accentSurface : 'transparent',
              border: 'none',
              borderBottom: active === i ? `2px solid ${tokens.colors.accent}` : '2px solid transparent',
              cursor: 'pointer',
              transition: 'all 0.15s',
              borderRadius: '6px 6px 0 0',
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
git commit -m "feat(website): polish Tabs component styling"
```

---

### Task 6: Verify All Pages

- [ ] **Step 1: Build the website**

Run: `npx nx build website --skip-nx-cache 2>&1 | tail -5`
Expected: Build succeeds

- [ ] **Step 2: Visual verification**

Open these pages and verify:
- http://localhost:3000/docs/getting-started/quickstart — code blocks highlighted, Callout has icon
- http://localhost:3000/docs/guides/streaming — Tabs with highlighted code inside
- http://localhost:3000/docs/guides/testing — multiple code blocks highlighted
- http://localhost:3000/docs/concepts/angular-signals — inline code styled

Verify on desktop:
- "On This Page" TOC appears on the right
- TOC highlights active section on scroll
- Code blocks have rounded corners and glass borders

- [ ] **Step 3: Commit any fixes**

```bash
git add -A
git commit -m "fix(website): docs design polish and fixes"
```
