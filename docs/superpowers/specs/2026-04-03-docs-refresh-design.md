# Docs Refresh — Mintlify-Inspired Custom Build

**Date:** 2026-04-03
**Scope:** Website docs system (`apps/website`) — full restructure
**Approach:** Mintlify-inspired custom build within existing Next.js app

## Overview

Replace the cockpit-manifest-driven docs system (74 pages, 5-segment slugs) with a focused, Diataxis-structured documentation site. 19 purposeful pages covering streamResource() usage with every LangGraph and Deep Agents capability. Mintlify-inspired UI with custom MDX components, Cmd+K search, collapsible sidebar, and glass design treatment.

**Audience:** Both Angular developers learning agents AND AI/agent developers learning Angular — with separate entry points.

**Content scope:** Full product docs — streamResource usage AND LangGraph/Deep Agents concepts. Self-contained, users don't need to leave the site.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Architecture | Custom build in existing Next.js app |
| Content structure | Diataxis (Getting Started, Guides, Concepts, API Reference) |
| Routing | `/docs/[section]/[slug]` (2-segment, simplified from 5) |
| MDX components | Callout, Steps, Tabs, CodeGroup, Card/CardGroup |
| Search | Client-side fuzzy search via Cmd+K modal |
| Cockpit dependency | Removed — standalone docs system |
| Page count | 19 pages (from 74) |
| Design system | Glass treatment matching website redesign |

## Layout

### Sidebar (left, 256px, glass treatment)

- **Cmd+K search bar** at top — glass panel with keyboard shortcut badge
- **4 collapsible section groups** with headers:
  - Getting Started (blue accent header)
  - Guides (blue accent header)
  - Concepts (red accent header — Angular-focused)
  - API Reference (blue accent header)
- Active page: `accentSurface` background + `accent` text
- Sticky positioning, scrollable independently
- Glass treatment: `glass.bg`, `glass.blur`, `glass.border`
- Border-right separating from content

### Content Area (right, flex-1, white background)

- **Breadcrumb** trail: Section > Page title
- **Page title** in Garamond serif, large
- **MDX content** rendered with custom components
- **Prev/Next navigation** at bottom — glass cards with page titles
- Background: `rgba(255, 255, 255, 0.85)` for readability
- Max-width prose container

### Responsive

- **Desktop (1024px+):** Fixed sidebar + scrollable content
- **Tablet (768px-1023px):** Narrower sidebar (200px)
- **Mobile (<768px):** Sidebar collapses to drawer, hamburger toggle in docs header

## MDX Components

### Callout
Styled alert box with left border accent. Types: `info`, `warning`, `tip`, `danger`.

```mdx
<Callout type="info" title="Prerequisites">
  Angular 20+ and Node.js 18+ required.
</Callout>
```

Rendering:
- Left border: 3px solid, color varies by type (info=accent, warning=amber, tip=green, danger=red)
- Background: type-tinted glass (e.g., `rgba(0,64,144,0.04)` for info)
- Title in bold, body text below
- Rounded corners, padding 12px 16px

### Steps
Numbered sequential instructions with accent-colored step circles.

```mdx
<Steps>
  <Step title="Install the package">
    Content with code blocks, etc.
  </Step>
  <Step title="Configure the provider">
    More content here.
  </Step>
</Steps>
```

Rendering:
- Left vertical line connecting steps (accent at 20% opacity)
- Step number in accent-colored circle (20px, white text)
- Title bold, content below with standard prose styling
- Each step separated by 16px gap

### Tabs
Tabbed content switcher for multi-file/multi-language examples.

```mdx
<Tabs items={['TypeScript', 'Template', 'Test']}>
  <Tab>TypeScript content</Tab>
  <Tab>Template content</Tab>
  <Tab>Test content</Tab>
</Tabs>
```

Rendering:
- Tab bar with bottom border, active tab has 2px accent bottom border
- Active tab: accent text, others: textMuted
- Content area below with smooth transition
- 'use client' component for state

### CodeGroup
Multiple code blocks displayed as tabs with filename headers.

```mdx
<CodeGroup>
  ```typescript title="chat.component.ts"
  code here
  ```
  ```html title="chat.component.html"
  code here
  ```
</CodeGroup>
```

Rendering:
- Tab bar with filenames
- Dark code block (tokyo-night) below
- Glass border on container
- Copy button on each block

### Card / CardGroup
Navigation cards for linking to related pages.

```mdx
<CardGroup cols={2}>
  <Card title="Streaming" href="/docs/guides/streaming" icon="⚡">
    Description text
  </Card>
</CardGroup>
```

Rendering:
- Glass card with icon, title, description
- Hover glow effect
- Click navigates to href
- Grid layout: 1 col mobile, `cols` on desktop

## Search (Cmd+K)

### Build-time Index
- Script extracts title, headings, first 200 chars from each MDX file
- Outputs `public/docs-search-index.json` (~5KB for 19 pages)
- Runs as part of the build process

### Runtime
- `'use client'` modal component
- Opens on Cmd+K (or Ctrl+K on Windows)
- Text input with fuzzy matching against index
- Results show: page title, section badge, content preview snippet
- Arrow keys navigate, Enter selects, Escape closes
- Glass-styled modal with backdrop blur overlay

## Content Structure

### Getting Started (3 pages)

| Slug | Title | Content |
|------|-------|---------|
| `introduction` | Introduction | What is Angular Stream Resource, dual audience (Angular devs & AI devs), key value props, what you'll build |
| `quickstart` | Quick Start | 5-minute end-to-end: install → configure → build chat component → run. Uses CardGroup to link to next steps. |
| `installation` | Installation | npm install, provideStreamResource() config, environment variables, Angular version matrix, LangGraph Cloud setup |

### Guides (8 pages)

| Slug | Title | Content |
|------|-------|---------|
| `streaming` | Streaming | Token-by-token streaming, stream modes, SSE transport, status signal, messages signal, error handling. Code examples showing Angular template bindings. |
| `persistence` | Persistence | Thread persistence, threadId signal, onThreadId callback, localStorage pattern, checkpoint recovery, session resumption. |
| `interrupts` | Interrupts | Human-in-the-loop, onInterrupt handler, resume with user input, approval UI component pattern, multi-step approval. |
| `memory` | Memory | Short-term (thread-scoped conversation), long-term (cross-session), memory store, namespace-based storage, semantic search. |
| `time-travel` | Time Travel | History browsing via history(), forking from checkpoints, replay, debugging agent decisions, branch selection UI. |
| `subgraphs` | Subgraphs | Modular agent composition, orchestrator pattern, subagent delegation, tracking subagent progress, multi-graph state. |
| `testing` | Testing | MockStreamTransport, scripting events, stepping through sequences, Angular TestBed integration, deterministic specs. |
| `deployment` | Deployment | Production config, LangGraph Cloud setup, environment variables, error boundaries, retry patterns, health checks. |

### Concepts (4 pages)

| Slug | Title | Content |
|------|-------|---------|
| `angular-signals` | Angular Signals | How streamResource maps to Signals, OnPush change detection, computed(), effect(), Signal-based templates, comparison with RxJS. |
| `langgraph-basics` | LangGraph Basics | Graphs, nodes, edges, state, checkpoints explained for Angular developers. Graph API vs Functional API. When to use each. |
| `agent-architecture` | Agent Architecture | How agents work: planning → tool calling → state machine → control flow. Agent lifecycle, the role of streamResource in the loop. |
| `state-management` | State Management | State design, reducers, MessagesState, thread state vs application state, state serialization, checkpoint structure. |

### API Reference (4 pages)

| Slug | Title | Content |
|------|-------|---------|
| `stream-resource` | streamResource() | Full function signature, all options (assistantId, threadId, onThreadId, onInterrupt, transport, etc.), return type, all signals, all methods (submit, history, etc.). |
| `provide-stream-resource` | provideStreamResource() | Provider factory, StreamResourceConfig interface, global defaults, per-call overrides. |
| `fetch-stream-transport` | FetchStreamTransport | Constructor, connect/disconnect, SSE handling, error events, retry behavior, custom headers. |
| `mock-stream-transport` | MockStreamTransport | Constructor, script() method, step() method, reset(), event types, testing patterns. |

## Files to Create/Modify

### New Files

**MDX Components** (in `apps/website/src/components/docs/mdx/`):
- `Callout.tsx` — Alert/info boxes
- `Steps.tsx` — Numbered step instructions
- `Tabs.tsx` — Tabbed content switcher ('use client')
- `CodeGroup.tsx` — Multi-file code block tabs
- `Card.tsx` — Navigation card + CardGroup grid

**Docs Infrastructure:**
- `apps/website/src/components/docs/DocsSidebarNew.tsx` — New collapsible sidebar with sections
- `apps/website/src/components/docs/DocsSearch.tsx` — Cmd+K search modal ('use client')
- `apps/website/src/components/docs/DocsBreadcrumb.tsx` — Breadcrumb trail
- `apps/website/src/components/docs/DocsPrevNext.tsx` — Previous/Next page navigation
- `apps/website/src/components/docs/DocsLayout.tsx` — Docs page wrapper with sidebar + content + responsive drawer
- `apps/website/src/lib/docs-config.ts` — Sidebar navigation tree definition (sections, pages, order)
- `apps/website/src/lib/docs-new.ts` — New docs loading utility (replaces cockpit-dependent `docs.ts`)
- `apps/website/scripts/build-search-index.ts` — Build-time search index generator

**Content** (in `apps/website/content/docs-v2/`):
- `getting-started/introduction.mdx`
- `getting-started/quickstart.mdx`
- `getting-started/installation.mdx`
- `guides/streaming.mdx`
- `guides/persistence.mdx`
- `guides/interrupts.mdx`
- `guides/memory.mdx`
- `guides/time-travel.mdx`
- `guides/subgraphs.mdx`
- `guides/testing.mdx`
- `guides/deployment.mdx`
- `concepts/angular-signals.mdx`
- `concepts/langgraph-basics.mdx`
- `concepts/agent-architecture.mdx`
- `concepts/state-management.mdx`
- `api/stream-resource.mdx`
- `api/provide-stream-resource.mdx`
- `api/fetch-stream-transport.mdx`
- `api/mock-stream-transport.mdx`

### Modified Files

- `apps/website/src/app/docs/[[...slug]]/page.tsx` — New routing + layout
- `apps/website/src/components/docs/MdxRenderer.tsx` — Register custom MDX components
- `apps/website/src/app/layout.tsx` — May need docs-specific layout adjustments

### Removed Dependencies

- Remove cockpit-manifest-based routing from docs
- Remove `open-in-cockpit.tsx` from docs pages
- Keep `apps/website/src/lib/docs.ts` as fallback but primary loading moves to `docs-new.ts`

## Implementation Strategy

This decomposes into 4 independent work streams that can be parallelized:

1. **Docs infrastructure** — New sidebar, search, breadcrumbs, prev/next, routing, layout, docs-config
2. **MDX components** — Callout, Steps, Tabs, CodeGroup, Card/CardGroup
3. **Content authoring** — Write all 19 MDX pages with real code examples
4. **Wiring + integration** — Connect everything, update page.tsx, register MDX components, build search index

Streams 1-3 can run in parallel. Stream 4 depends on all three.

## Verification

- Open http://localhost:3000/docs — verify new sidebar renders with all 4 sections
- Click through all 19 pages — verify content renders with MDX components
- Test Cmd+K search — verify modal opens, fuzzy matching works, navigation works
- Test Tabs component — click tabs, verify content switches
- Expand code in CodeGroup — verify syntax highlighting
- Check mobile at 375px — verify sidebar drawer works
- Verify prev/next navigation links at bottom of each page
- Verify breadcrumbs show correct section > page
