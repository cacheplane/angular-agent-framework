# Multi-Library Documentation Architecture

**Date:** 2026-04-06
**Status:** Draft
**Approach:** Config-driven multi-library (Approach A)

## Overview

Expand the website docs to support all three libraries (agent, render, chat) with independent sections per library, a shared landing page at `/docs`, and a dropdown library selector in the sidebar.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Docs structure | Library-scoped | Each lib gets its own Getting Started, Guides, API, etc. |
| Landing page | Shared at `/docs` | Introduces ecosystem, links into each library |
| Sidebar switcher | Dropdown selector | Compact, scales well, familiar pattern (Stripe/Tailwind) |
| URL structure | `/docs/[library]/[section]/[slug]` | Library first matches mental model of "pick a lib, browse its docs" |
| Content directory | `content/docs/<library>/<section>/` | Filesystem mirrors URL structure |
| Content migration | Move `docs-v2/` to `docs/agent/` | Drop "v2" naming, establish clean structure |
| File renames | Drop "new"/"v2" suffixes | `docs-new.ts` -> `docs.ts`, `DocsSidebarNew` -> `DocsSidebar`, `MdxRendererNew` -> `MdxRenderer` |
| Placeholder content | Skeleton MDX for render & chat | Titles + one-paragraph descriptions; full authoring is a follow-up task |

## Config & Types

### docs-config.ts

```ts
export type LibraryId = 'agent' | 'render' | 'chat';

export interface DocsLibrary {
  id: LibraryId;
  title: string;        // "Agent", "Render", "Chat"
  description: string;  // One-liner for /docs landing page
  sections: DocsSection[];
}

export interface DocsSection {
  title: string;
  id: string;
  color: 'blue' | 'red';
  pages: DocsPage[];
}

export interface DocsPage {
  title: string;
  slug: string;
  section: string;
}

export const docsConfig: DocsLibrary[] = [
  {
    id: 'agent',
    title: 'Agent',
    description: 'Streaming state management for LangGraph agents',
    sections: [
      // Getting Started, Guides, Concepts, API Reference (existing pages)
    ],
  },
  {
    id: 'render',
    title: 'Render',
    description: 'Declarative UI rendering from JSON specifications',
    sections: [
      // Getting Started, Guides, API Reference
    ],
  },
  {
    id: 'chat',
    title: 'Chat',
    description: 'Pre-built chat UI components for agent interfaces',
    sections: [
      // Getting Started, Guides, Components, API Reference
    ],
  },
];
```

Helper functions gain a `library` parameter:

- `getLibraryConfig(library: LibraryId): DocsLibrary | undefined`
- `findDocsPage(library: LibraryId, section: string, slug: string): DocsPage | undefined`
- `getPrevNextPages(library: LibraryId, section: string, slug: string): { prev, next }`
- `getAllDocSlugs(): { library, section, slug }[]` — iterates all libraries

## Content Directory

```
content/docs/
├── agent/
│   ├── getting-started/
│   │   ├── introduction.mdx
│   │   ├── quickstart.mdx
│   │   └── installation.mdx
│   ├── guides/
│   │   ├── streaming.mdx
│   │   ├── persistence.mdx
│   │   ├── interrupts.mdx
│   │   ├── memory.mdx
│   │   ├── time-travel.mdx
│   │   ├── subgraphs.mdx
│   │   ├── testing.mdx
│   │   └── deployment.mdx
│   ├── concepts/
│   │   ├── angular-signals.mdx
│   │   ├── langgraph-basics.mdx
│   │   ├── agent-architecture.mdx
│   │   └── state-management.mdx
│   └── api/
│       ├── agent.mdx
│       ├── provide-agent.mdx
│       ├── fetch-stream-transport.mdx
│       ├── mock-stream-transport.mdx
│       └── api-docs.json
├── render/
│   ├── getting-started/
│   │   ├── introduction.mdx
│   │   ├── quickstart.mdx
│   │   └── installation.mdx
│   ├── guides/
│   │   ├── registry.mdx
│   │   ├── state-store.mdx
│   │   ├── specs.mdx
│   │   └── events.mdx
│   └── api/
│       ├── render-spec-component.mdx
│       ├── define-angular-registry.mdx
│       ├── signal-state-store.mdx
│       └── provide-render.mdx
└── chat/
    ├── getting-started/
    │   ├── introduction.mdx
    │   ├── quickstart.mdx
    │   └── installation.mdx
    ├── guides/
    │   ├── theming.mdx
    │   ├── markdown.mdx
    │   ├── generative-ui.mdx
    │   └── configuration.mdx
    ├── components/
    │   ├── chat.mdx
    │   ├── chat-messages.mdx
    │   ├── chat-input.mdx
    │   ├── chat-interrupt-panel.mdx
    │   ├── chat-tool-call-card.mdx
    │   ├── chat-subagent-card.mdx
    │   └── chat-debug.mdx
    └── api/
        ├── provide-chat.mdx
        ├── chat-config.mdx
        └── create-mock-stream-resource-ref.mdx
```

## Routing

### Before

```
app/docs/[[...slug]]/page.tsx  ->  /docs/[section]/[slug]
```

### After

```
app/docs/page.tsx                            ->  /docs (landing page)
app/docs/[library]/[section]/[slug]/page.tsx ->  /docs/agent/guides/streaming
```

The dynamic route extracts `library`, `section`, and `slug` from params. The `library` param is validated against `docsConfig` library IDs.

## Content Loader (docs.ts)

Renamed from `docs-new.ts`. Changes:

```ts
const resolveContentDir = (library: string): string => {
  const workspacePath = path.join(process.cwd(), 'apps', 'website', 'content', 'docs', library);
  if (fs.existsSync(workspacePath)) return workspacePath;
  return path.join(process.cwd(), 'content', 'docs', library);
};

export function getDocBySlug(library: string, section: string, slug: string): ResolvedDoc | null {
  // Validates against config, resolves from content/docs/<library>/<section>/<slug>.mdx
}

export function getAllDocSlugs(): { library: string; section: string; slug: string }[] {
  // Iterates all libraries from docsConfig
}
```

## Sidebar (DocsSidebar)

Renamed from `DocsSidebarNew`. Changes:

**New props:**
```ts
interface Props {
  activeLibrary: LibraryId;
  activeSection: string;
  activeSlug: string;
}
```

**Dropdown selector:** Positioned below the search trigger, above section groups. Displays current library name. On click, shows a popover/dropdown with three options (Agent, Render, Chat). Selection navigates to that library's first page via `useRouter()`.

**Section groups:** Rendered from `getLibraryConfig(activeLibrary).sections` instead of the flat `docsConfig` array. Same `SectionGroup` component, different data source.

**Link paths:** Change from `/docs/${section}/${slug}` to `/docs/${activeLibrary}/${section}/${slug}`.

## Mobile Nav (DocsMobileNav)

Same dropdown treatment as sidebar — library selector above the section list in the drawer. Gains `activeLibrary` prop.

## Docs Landing Page (/docs)

Standalone React page (`app/docs/page.tsx`). No MDX.

Content:
- Headline introducing Angular Stream Resource
- Three cards (one per library) with title, description, and "Get started" link
- Visual indication of library relationships (agent is core, render + chat build on it)
- Uses existing design tokens and glass styling

## Prev/Next Navigation (DocsPrevNext)

Scoped within a library — prev/next only links to pages in the same library. Uses `getPrevNextPages(library, section, slug)`.

## Search (DocsSearch)

Indexes across all libraries. Search results show a library badge/label so users know which library a result belongs to.

## Top Nav Updates

- "Docs" link: `/docs` (landing page)
- "API" link: `/docs/agent/api/agent`

## File Renames

| Before | After |
|--------|-------|
| `content/docs-v2/` | `content/docs/agent/` (move + rename) |
| `src/lib/docs-new.ts` | `src/lib/docs.ts` |
| `DocsSidebarNew` | `DocsSidebar` |
| `MdxRendererNew` | `MdxRenderer` |
| All imports referencing the above | Updated accordingly |

## Content Authoring (Zero-Shot)

All placeholder MDX pages for render and chat will be authored with real content in this same effort, derived from reading each library's source code. This includes Getting Started guides, concept guides, component docs, and API reference pages.

## Out of Scope

- API docs JSON generation for render and chat
- Versioned docs
- Cross-library search ranking/weighting
