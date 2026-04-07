# Spec B: Narrative Docs System

## Problem

Docs mode currently shows raw JSDoc/docstring extraction — fragments of API reference without context. Developers need a full narrative tutorial that walks them through building the example, with highlighted code, prose explanations, and a separate API reference view.

## Goal

Add authored markdown tutorials per capability that render as rich HTML with Shiki-highlighted code blocks. Add a separate API mode for JSDoc-extracted reference. The cockpit gets four modes: Run | Code | Docs | API.

## Architecture

### Doc Files Per Capability

Each capability gets a `docs/` directory with authored markdown:

```
cockpit/langgraph/streaming/python/
├── docs/
│   └── guide.md              # Narrative tutorial
├── prompts/
│   └── streaming.md
└── src/
    ├── index.ts
    └── graph.py
```

The `CockpitCapabilityModule` gains a new field:

```typescript
docsAssetPaths: string[];    // e.g., ['cockpit/langgraph/streaming/python/docs/guide.md']
```

### ContentBundle Extension

```typescript
interface ContentBundle {
  codeFiles: Record<string, string>;
  promptFiles: Record<string, string>;
  runtimeUrl: string | null;
  docSections: DocSection[];           // JSDoc API reference (existing)
  narrativeDocs: NarrativeDoc[];       // Markdown tutorials (new)
}

interface NarrativeDoc {
  title: string;          // extracted from first # heading
  html: string;           // markdown → HTML with Shiki code blocks
  sourceFile: string;
}
```

### Markdown → HTML Pipeline

At build time in `getContentBundle()`:

1. Read each file in `docsAssetPaths`
2. Parse markdown with `marked` (lightweight, zero-config)
3. Post-process fenced code blocks: replace each with Shiki `codeToHtml()` output (same theme as Code mode — `github-dark`)
4. Extract the first `# heading` as the `title`
5. Return as `NarrativeDoc`

New dependency: `marked` (added to `apps/cockpit/package.json`).

### Four Modes

The shell mode switcher becomes: **Run | Code | Docs | API**

- **Run** — Full-bleed iframe (unchanged)
- **Code** — Tabbed source viewer with frontend | backend | prompts (unchanged)
- **Docs** — Narrative tutorial rendered as rich HTML. If multiple doc files exist, render as tabs.
- **API** — Auto-extracted JSDoc/docstring reference cards (the existing DocsMode, renamed to ApiMode)

### Docs Mode Component (New)

Renders `narrativeDocs` as rich HTML via `dangerouslySetInnerHTML`. The HTML is safe because it's generated server-side from our own markdown files + Shiki output.

Styling: standard prose typography — headings, paragraphs, lists, inline code, links. Tailwind's `prose` classes would work but we can use targeted styles since the content is known.

### API Mode Component (Renamed)

The existing `DocsMode` component is renamed to `ApiMode`. Same functionality — renders `DocSection[]` cards with signatures, params, returns. No changes to the extraction logic.

### guide.md Content (First Example: Streaming)

A tutorial that walks through:
1. What streaming does in angular
2. Setting up `provideAgent()` with a LangGraph Cloud URL
3. Creating a component with `agent()`
4. Binding the template to Signals (`stream.messages()`, `stream.isLoading()`)
5. Submitting messages with `stream.submit()`
6. Error handling and thread management

Each step has a fenced code block showing the relevant Angular/TypeScript code, highlighted with Shiki at build time.

## Type Changes

- `CockpitCapabilityModule`: Add `docsAssetPaths: string[]`
- `CapabilityPresentation` (capability variant): Add `docsAssetPaths: string[]`
- `ContentBundle`: Add `narrativeDocs: NarrativeDoc[]`
- `getCapabilityPresentation()`: Forward `docsAssetPaths`
- `getContentBundle()`: Read + render markdown files into `narrativeDocs`
- Shell modes: `['Run', 'Code', 'Docs', 'API']`

## File Changes

| Action | File |
|--------|------|
| Create | `cockpit/langgraph/streaming/python/docs/guide.md` |
| Create | `apps/cockpit/src/lib/render-markdown.ts` |
| Create | `apps/cockpit/src/lib/render-markdown.spec.ts` |
| Create | `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` |
| Create | `apps/cockpit/src/components/narrative-docs/narrative-docs.spec.tsx` |
| Rename | `docs-mode/docs-mode.tsx` → `api-mode/api-mode.tsx` |
| Rename | `docs-mode/docs-mode.spec.tsx` → `api-mode/api-mode.spec.tsx` |
| Modify | `cockpit/langgraph/streaming/python/src/index.ts` |
| Modify | `apps/cockpit/src/lib/route-resolution.ts` |
| Modify | `apps/cockpit/src/lib/content-bundle.ts` |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` |
| Modify | `apps/cockpit/package.json` (add `marked`) |

## Out of Scope

- MDX support (we don't need React components in markdown)
- Live editing of markdown
- Search within docs
- Cross-linking between capabilities
