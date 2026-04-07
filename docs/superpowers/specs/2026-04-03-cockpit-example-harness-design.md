# Cockpit Example Harness + First Example App Design

## Problem

The cockpit shows boilerplate code (page.tsx, cockpit-shell.tsx) instead of real implementation code. There's no Angular example app to embed in Run mode. Docs mode shows generic placeholder text. Developers visiting the cockpit can't see what they actually need: a working example of angular with Angular + LangGraph, the code that makes it work, and auto-generated documentation.

## Goal

Redesign the cockpit to be a useful developer reference surface:
1. **Run mode** embeds a real Angular demo app
2. **Code mode** shows the actual implementation files (Angular component/service + Python graph)
3. **Docs mode** displays auto-generated documentation extracted from JSDoc/docstrings in the code
4. Build the first complete example: **LangGraph Streaming** with an Angular frontend and Python LangGraph backend

## Architecture

### Example App Structure

Each capability example has two parts — an Angular frontend and a Python LangGraph backend — living side by side:

```
cockpit/langgraph/streaming/
├── python/                          # Backend (existing directory, extended)
│   ├── src/
│   │   ├── index.ts                 # Capability module metadata
│   │   └── graph.py                 # LangGraph streaming graph definition
│   ├── prompts/
│   │   └── streaming.md             # System prompt for the chain
│   ├── requirements.txt             # Python dependencies
│   └── project.json                 # Nx project (Python runner)
│
└── angular/                         # Frontend (new)
    ├── src/
    │   ├── app/
    │   │   ├── streaming.component.ts   # Demo component with streaming chat UI
    │   │   ├── streaming.service.ts     # angular service wrapping LangSmith API
    │   │   └── app.config.ts            # Angular standalone bootstrap config
    │   ├── index.html
    │   ├── main.ts
    │   └── styles.css
    ├── project.json                 # Nx Angular app project
    ├── tsconfig.app.json
    └── package.json
```

### Capability Module Contract

The module metadata points to real implementation files:

```typescript
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: CockpitManifestIdentity;
  title: string;
  docsPath: string;
  codeAssetPaths: string[];       // Angular frontend files
  backendAssetPaths: string[];    // Python graph files
  promptAssetPaths: string[];     // Prompt markdown files
  runtimeUrl?: string;            // Deployed example URL
  devPort?: number;               // Local Angular dev server port
}
```

For LangGraph Streaming, the paths would be:
- `codeAssetPaths`: `['cockpit/langgraph/streaming/angular/src/app/streaming.component.ts', 'cockpit/langgraph/streaming/angular/src/app/streaming.service.ts']`
- `backendAssetPaths`: `['cockpit/langgraph/streaming/python/src/graph.py']`
- `promptAssetPaths`: `['cockpit/langgraph/streaming/python/prompts/streaming.md']`
- `devPort`: `4300`

### Content Bundle

`getContentBundle()` reads all files and produces:

```typescript
interface ContentBundle {
  codeFiles: Record<string, string>;      // path → Shiki HTML (frontend + backend)
  promptFiles: Record<string, string>;    // path → raw markdown
  runtimeUrl: string | null;
  docSections: DocSection[];              // auto-extracted from code
}

interface DocSection {
  title: string;
  content: string;        // JSDoc/docstring text as markdown
  sourceFile: string;
  language: 'typescript' | 'python';
}
```

The bundle merges `codeAssetPaths` and `backendAssetPaths` into a single `codeFiles` map — they're all code files, just from different languages. The tab UI groups them by language.

### JSDoc/Docstring Extraction

At build time, `getContentBundle()` extracts documentation:

**TypeScript (JSDoc)**: Regex extracts `/** ... */` blocks immediately preceding `export` declarations. Captures the comment text and the declaration name.

**Python (docstrings)**: Regex extracts triple-quoted strings immediately after `def` or `class` declarations.

No AST parser needed — these patterns are reliable with regex for the structured code we control. The extracted sections become `DocSection[]`. If a file has no JSDoc/docstrings, it produces no sections. If all files lack documentation, Docs mode shows "No documentation extracted yet — add JSDoc to TypeScript files or docstrings to Python files."

### Cockpit UI (Three Modes)

**Run** — Full-height iframe embedding the Angular dev server. No chrome. Empty state: "Start the dev server: `npx nx serve langgraph-streaming-angular`"

**Code** — Tabs grouped by type:
- Frontend tabs: `streaming.component.ts`, `streaming.service.ts`
- `|` separator
- Backend tabs: `graph.py`
- `|` separator
- Prompt tabs: `streaming.md`

Each tab: file path label + Shiki-highlighted source. No headings or descriptions.

**Docs** — Renders `docSections` from the content bundle. Each section shows:
- Section title (class/function name)
- Content (extracted JSDoc/docstring rendered as markdown)
- Source file link

No hand-written content — entirely derived from the code.

### Shell Layout

Compact header: breadcrumb + title + Run/Code/Docs switcher — all on one line.
No action buttons, no descriptions, no prompt drawer.
Sidebar: "COCKPIT" label + language picker + full nav tree.

### DEFAULT_FRONTEND_ASSET_PATHS Removed

The cockpit boilerplate files (page.tsx, cockpit-shell.tsx) are no longer shown in code tabs. Only the capability's actual implementation files appear.

## First Example: LangGraph Streaming

### Angular App (`cockpit/langgraph/streaming/angular/`)

A minimal chat UI that demonstrates angular's streaming capability:

- **`streaming.component.ts`**: Standalone Angular component with a chat interface. Text input, send button, message list. Messages stream in token-by-token using angular's streaming API. Well-documented with JSDoc explaining each part of the streaming integration.

- **`streaming.service.ts`**: Injectable service wrapping the angular client. Exposes a `stream(prompt: string): Observable<StreamEvent>` method. JSDoc documents the connection setup, LangSmith configuration, and event types.

- **`app.config.ts`**: Minimal Angular standalone config with `provideHttpClient()` and any angular providers.

### Python Backend (`cockpit/langgraph/streaming/python/`)

- **`graph.py`**: A LangGraph `StateGraph` that accepts a user message and streams a response. Uses LangSmith for tracing. Docstrings explain the graph structure, nodes, and streaming output format.

- **`streaming.md`**: The system prompt used by the graph's LLM node.

### How It Runs

1. Developer starts the Python backend: `npx nx serve langgraph-streaming-python` (runs the LangGraph server)
2. Developer starts the Angular frontend: `npx nx serve langgraph-streaming-angular --port 4300`
3. Cockpit's Run mode embeds `http://localhost:4300`
4. Code mode shows the Angular + Python implementation files
5. Docs mode shows auto-extracted JSDoc/docstrings

For deployed/CI environments, `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` points to a deployed instance.

## Type Changes

- `CockpitCapabilityModule`: Add `backendAssetPaths: string[]` field
- `CapabilityPresentation` (capability variant): Add `backendAssetPaths: string[]` field
- `ContentBundle`: Add `docSections: DocSection[]` field
- `getCapabilityPresentation()`: Forward `backendAssetPaths` from module
- `getContentBundle()`: Merge `codeAssetPaths` + `backendAssetPaths` into `codeFiles`, extract docs from all files
- Remove `DEFAULT_FRONTEND_ASSET_PATHS` from `cockpit-shell.tsx` and `content-bundle.ts`

## Out of Scope

- Other capability examples (only LangGraph Streaming for this spec)
- Production deployment of example apps
- E2E testing of the streaming example
- TypeScript language variant (future)
