# Docs Page Design — Mintlify Alignment + Code Highlighting Fix

**Date:** 2026-04-04
**Scope:** Docs page layout, code highlighting, MDX component polish

## Overview

Fix broken code block syntax highlighting in docs and align the docs page design with Mintlify patterns — three-column layout, polished typography, icons on callouts, hover effects on cards, and an "On This Page" table of contents.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Code highlighting | `rehype-pretty-code` (Shiki-based rehype plugin for MDX) |
| Theme | `tokyo-night` (matches landing page) |
| Layout | Three-column: sidebar + content + right TOC |
| TOC | Extract `##` headings from MDX source, render as right sidebar |
| Callout icons | Unicode icons per type (info, warning, tip, danger) |
| Card hover | Scale + glow effect |

## Fix 1: Code Block Highlighting

**Root cause:** `MDXRemote` renders plain `<pre><code>` without Shiki.

**Fix:** Add `rehype-pretty-code` to MDXRemote's rehype pipeline. Runs at compile time on the server.

```typescript
import rehypePrettyCode from 'rehype-pretty-code';

<MDXRemote
  source={source}
  components={mdxComponents}
  options={{
    mdxOptions: {
      rehypePlugins: [[rehypePrettyCode, { theme: 'tokyo-night' }]],
    },
  }}
/>
```

**CSS needed:** Style the generated `[data-rehype-pretty-code-figure]` elements, `[data-language]` labels, and add a copy button.

## Fix 2: Mintlify-Aligned Layout

### Three-Column Layout
- Left sidebar: 256px (existing `DocsSidebarNew`)
- Content: `max-w-3xl` (existing)
- Right TOC: 200px, sticky, hidden below `xl` breakpoint
- TOC component extracts `##` headings from the MDX source string via regex

### Typography
- Page title: `text-3xl font-bold` with description subtitle
- Body: `leading-relaxed`
- Inline code: glass background `rgba(0,64,144,0.06)`, `rounded`, `px-1.5 py-0.5`, mono font
- Headings: clear hierarchy with `mt-10 mb-4` spacing

### Code Blocks
- `rounded-lg` with glass border
- Language label top-left (from `data-language` attribute)
- Copy button top-right on hover
- `my-6` vertical margins

### Callouts
- Icons: info=ℹ️, warning=⚠️, tip=💡, danger=🚫
- `rounded-lg` corners
- Slightly stronger background tint
- Better padding and spacing

### Cards
- Hover: `scale(1.01)` transform + glow shadow
- Arrow `→` indicator
- Glass border

### Spacing
- More generous vertical margins between sections
- `my-6` on code blocks, `mt-10 mb-4` on headings

## Files to Create/Modify

| File | Change |
|------|--------|
| `apps/website/src/components/docs/MdxRenderer.tsx` | Add rehype-pretty-code, update prose styles |
| `apps/website/src/app/global.css` | Add rehype-pretty-code styles, prose overrides |
| `apps/website/src/components/docs/DocsTOC.tsx` | NEW — "On This Page" right sidebar |
| `apps/website/src/components/docs/mdx/Callout.tsx` | Add icons, improve styling |
| `apps/website/src/components/docs/mdx/Card.tsx` | Add hover effects, arrow |
| `apps/website/src/components/docs/mdx/Tabs.tsx` | Polish tab bar styling |
| `apps/website/src/components/docs/mdx/Steps.tsx` | Polish spacing |
| `apps/website/src/app/docs/[[...slug]]/page.tsx` | Add TOC to layout, pass headings |

## Verification
- Open /docs/getting-started/quickstart — code blocks have syntax highlighting
- Code inside Tabs components is highlighted
- Callouts show icons
- Cards have hover glow + arrow
- "On This Page" TOC appears on wide screens
- Mobile: TOC hidden, content fills width
- All 19 doc pages render without errors
