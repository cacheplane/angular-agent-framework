# Narrative Docs System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add authored markdown tutorials per capability rendered as rich HTML with Shiki code blocks, rename the existing DocsMode to ApiMode, and create a four-mode cockpit: Run | Code | Docs | API.

**Architecture:** Add `docsAssetPaths` to capability modules. Create a `renderMarkdown()` function that converts markdown to HTML with Shiki-highlighted code blocks using `marked`. Add a `NarrativeDoc` type to `ContentBundle`. Create a new Docs mode component that renders the HTML. Rename the existing DocsMode to ApiMode. Write the first tutorial (guide.md) for the streaming capability.

**Tech Stack:** `marked` (markdown → HTML), Shiki (code block highlighting), Next.js server components, Tailwind

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `apps/cockpit/src/lib/render-markdown.ts` | markdown → HTML with Shiki code blocks |
| Create | `apps/cockpit/src/lib/render-markdown.spec.ts` | Tests |
| Modify | `cockpit/langgraph/streaming/python/src/index.ts` | Add `docsAssetPaths` |
| Modify | `apps/cockpit/src/lib/route-resolution.ts` | Add `docsAssetPaths` to presentation |
| Modify | `apps/cockpit/src/lib/content-bundle.ts` | Add `narrativeDocs` to bundle |
| Rename | `apps/cockpit/src/components/docs-mode/` → `api-mode/` | Rename DocsMode → ApiMode |
| Create | `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx` | Render narrative HTML |
| Create | `apps/cockpit/src/components/narrative-docs/narrative-docs.spec.tsx` | Tests |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Four modes, wire new components |
| Create | `cockpit/langgraph/streaming/python/docs/guide.md` | Streaming tutorial |
| Modify | `apps/cockpit/package.json` | Add `marked` dep |

---

### Task 1: Add `marked` dependency and create renderMarkdown

**Files:**
- Modify: `apps/cockpit/package.json`
- Create: `apps/cockpit/src/lib/render-markdown.ts`
- Create: `apps/cockpit/src/lib/render-markdown.spec.ts`

- [ ] **Step 1: Add `marked` to cockpit package.json**

Add `"marked": "^15.0.0"` to the dependencies in `apps/cockpit/package.json`. Then run `npm install`.

- [ ] **Step 2: Write failing tests for renderMarkdown**

```ts
// apps/cockpit/src/lib/render-markdown.spec.ts
import { describe, expect, it, vi } from 'vitest';

const { mockCodeToHtml } = vi.hoisted(() => ({
  mockCodeToHtml: vi.fn(),
}));

vi.mock('shiki', () => ({
  codeToHtml: mockCodeToHtml,
}));

import { renderMarkdown } from './render-markdown';

describe('renderMarkdown', () => {
  it('converts markdown to HTML with headings and paragraphs', async () => {
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>highlighted</code></pre>');

    const md = `# Getting Started\n\nThis is a paragraph.\n\n## Step 1\n\nAnother paragraph.`;
    const result = await renderMarkdown(md);

    expect(result.title).toBe('Getting Started');
    expect(result.html).toContain('<h1');
    expect(result.html).toContain('Getting Started');
    expect(result.html).toContain('<p>This is a paragraph.</p>');
    expect(result.html).toContain('<h2');
  });

  it('highlights fenced code blocks with Shiki', async () => {
    mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>const x = 1;</code></pre>');

    const md = '# Test\n\n```typescript\nconst x = 1;\n```';
    const result = await renderMarkdown(md);

    expect(result.html).toContain('class="shiki"');
    expect(mockCodeToHtml).toHaveBeenCalledWith('const x = 1;\n', expect.objectContaining({ lang: 'typescript' }));
  });

  it('extracts title from first h1', async () => {
    const md = '# My Title\n\nContent here.';
    const result = await renderMarkdown(md);
    expect(result.title).toBe('My Title');
  });

  it('returns empty title when no h1 exists', async () => {
    const md = 'Just a paragraph.';
    const result = await renderMarkdown(md);
    expect(result.title).toBe('');
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --testPathPattern=render-markdown`
Expected: FAIL

- [ ] **Step 4: Implement renderMarkdown**

```ts
// apps/cockpit/src/lib/render-markdown.ts
import { marked } from 'marked';
import { codeToHtml } from 'shiki';

export interface RenderedMarkdown {
  title: string;
  html: string;
}

export async function renderMarkdown(source: string): Promise<RenderedMarkdown> {
  // Extract title from first # heading
  const titleMatch = source.match(/^#\s+(.+)$/m);
  const title = titleMatch?.[1]?.trim() ?? '';

  // Collect fenced code blocks and their positions for async Shiki highlighting
  const codeBlocks: Array<{ lang: string; code: string; placeholder: string }> = [];
  let blockIndex = 0;

  const renderer = new marked.Renderer();
  const originalCode = renderer.code;

  renderer.code = function ({ text, lang }: { text: string; lang?: string }) {
    const placeholder = `<!--SHIKI_BLOCK_${blockIndex}-->`;
    codeBlocks.push({ lang: lang ?? 'text', code: text, placeholder });
    blockIndex++;
    return placeholder;
  };

  // Parse markdown to HTML (synchronous except code blocks)
  let html = await marked.parse(source, { renderer });

  // Replace placeholders with Shiki-highlighted code
  for (const block of codeBlocks) {
    try {
      const highlighted = await codeToHtml(block.code, {
        lang: block.lang,
        theme: 'github-dark',
      });
      html = html.replace(block.placeholder, highlighted);
    } catch {
      html = html.replace(
        block.placeholder,
        `<pre><code>${block.code.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</code></pre>`
      );
    }
  }

  return { title, html };
}
```

- [ ] **Step 5: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=render-markdown`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/package.json package-lock.json apps/cockpit/src/lib/render-markdown.ts apps/cockpit/src/lib/render-markdown.spec.ts
git commit -m "feat(cockpit): add markdown rendering with Shiki code highlighting"
```

---

### Task 2: Add docsAssetPaths to types and capability module

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/index.ts`
- Modify: `apps/cockpit/src/lib/route-resolution.ts`

- [ ] **Step 1: Add docsAssetPaths to CockpitCapabilityModule and streaming module**

In `cockpit/langgraph/streaming/python/src/index.ts`, add `docsAssetPaths: string[]` to the interface and populate it:

```ts
docsAssetPaths: string[];
```

In the module instance, add:
```ts
docsAssetPaths: ['cockpit/langgraph/streaming/python/docs/guide.md'],
```

- [ ] **Step 2: Add docsAssetPaths to CapabilityPresentation**

In `apps/cockpit/src/lib/route-resolution.ts`, add `docsAssetPaths: string[];` to the capability variant of the union type.

In `getCapabilityPresentation()`, add to the return:
```ts
docsAssetPaths: module?.docsAssetPaths ?? [],
```

- [ ] **Step 3: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/index.ts apps/cockpit/src/lib/route-resolution.ts
git commit -m "feat(cockpit): add docsAssetPaths to capability module and presentation"
```

---

### Task 3: Integrate narrativeDocs into ContentBundle

**Files:**
- Modify: `apps/cockpit/src/lib/content-bundle.ts`
- Modify: `apps/cockpit/src/lib/content-bundle.spec.ts`

- [ ] **Step 1: Add NarrativeDoc type and update ContentBundle**

In `content-bundle.ts`:

1. Import `renderMarkdown` and `RenderedMarkdown` from `./render-markdown`
2. Add `NarrativeDoc` type:
```ts
export interface NarrativeDoc {
  title: string;
  html: string;
  sourceFile: string;
}
```
3. Add `narrativeDocs: NarrativeDoc[]` to `ContentBundle`
4. In `getContentBundle()`, after processing code/prompt files, read and render doc files:

```ts
const narrativeDocs: NarrativeDoc[] = [];
const docPaths = presentation.docsAssetPaths ?? [];
for (const path of docPaths) {
  const source = readFileSafe(path);
  if (source) {
    const rendered = await renderMarkdown(source);
    const fileName = path.split('/').pop() ?? path;
    narrativeDocs.push({ title: rendered.title, html: rendered.html, sourceFile: fileName });
  }
}
```

5. Update return: `return { codeFiles, promptFiles, runtimeUrl, docSections, narrativeDocs };`
6. Update docs-only return: `return { codeFiles: {}, promptFiles: {}, runtimeUrl: null, docSections: [], narrativeDocs: [] };`

- [ ] **Step 2: Update tests**

Add `narrativeDocs: []` to existing test assertions. Add a test for narrativeDocs rendering. Update the mock to handle `renderMarkdown`'s call to `marked` (it's a real dependency, not mocked — only Shiki is mocked).

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=content-bundle`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/lib/content-bundle.ts apps/cockpit/src/lib/content-bundle.spec.ts
git commit -m "feat(cockpit): add narrativeDocs to ContentBundle"
```

---

### Task 4: Rename DocsMode → ApiMode

**Files:**
- Rename: `apps/cockpit/src/components/docs-mode/docs-mode.tsx` → `apps/cockpit/src/components/api-mode/api-mode.tsx`
- Rename: `apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx` → `apps/cockpit/src/components/api-mode/api-mode.spec.tsx`

- [ ] **Step 1: Create api-mode directory and move files**

```bash
mkdir -p apps/cockpit/src/components/api-mode
mv apps/cockpit/src/components/docs-mode/docs-mode.tsx apps/cockpit/src/components/api-mode/api-mode.tsx
mv apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx apps/cockpit/src/components/api-mode/api-mode.spec.tsx
rmdir apps/cockpit/src/components/docs-mode
```

- [ ] **Step 2: Rename the component and aria-label**

In `api-mode.tsx`:
- Rename `DocsMode` → `ApiMode`
- Change `aria-label="Docs mode"` → `aria-label="API mode"`
- Change empty state text: "No API documentation extracted yet — add JSDoc to TypeScript files or docstrings to Python files."

In `api-mode.spec.tsx`:
- Rename `DocsMode` → `ApiMode`
- Update import path
- Update "No documentation extracted" → "No API documentation extracted"

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=api-mode`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add -A apps/cockpit/src/components/docs-mode apps/cockpit/src/components/api-mode
git commit -m "refactor(cockpit): rename DocsMode to ApiMode"
```

---

### Task 5: Create NarrativeDocs component

**Files:**
- Create: `apps/cockpit/src/components/narrative-docs/narrative-docs.tsx`
- Create: `apps/cockpit/src/components/narrative-docs/narrative-docs.spec.tsx`

- [ ] **Step 1: Write test**

```tsx
// apps/cockpit/src/components/narrative-docs/narrative-docs.spec.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { NarrativeDocs } from './narrative-docs';

describe('NarrativeDocs', () => {
  it('renders narrative HTML content', () => {
    const html = renderToStaticMarkup(
      <NarrativeDocs
        narrativeDocs={[
          { title: 'Streaming Guide', html: '<h1>Streaming Guide</h1><p>Learn to stream.</p>', sourceFile: 'guide.md' },
        ]}
      />
    );

    expect(html).toContain('Streaming Guide');
    expect(html).toContain('Learn to stream.');
  });

  it('renders empty state when no docs', () => {
    const html = renderToStaticMarkup(<NarrativeDocs narrativeDocs={[]} />);
    expect(html).toContain('No documentation available');
  });
});
```

- [ ] **Step 2: Implement NarrativeDocs**

```tsx
// apps/cockpit/src/components/narrative-docs/narrative-docs.tsx
import React from 'react';
import type { NarrativeDoc } from '../../lib/content-bundle';

interface NarrativeDocsProps {
  narrativeDocs: NarrativeDoc[];
}

export function NarrativeDocs({ narrativeDocs }: NarrativeDocsProps) {
  if (narrativeDocs.length === 0) {
    return (
      <section aria-label="Docs mode" className="grid place-items-center h-full text-muted-foreground text-sm">
        <p>No documentation available for this capability.</p>
      </section>
    );
  }

  return (
    <section aria-label="Docs mode" className="h-full overflow-auto py-4 px-2">
      {narrativeDocs.map((doc) => (
        <article
          key={doc.sourceFile}
          className="prose prose-invert prose-sm max-w-none
            prose-headings:font-serif prose-headings:font-semibold prose-headings:tracking-tight prose-headings:text-foreground
            prose-h1:text-xl prose-h1:mb-4 prose-h1:border-b prose-h1:border-border prose-h1:pb-3
            prose-h2:text-lg prose-h2:mt-8 prose-h2:mb-3
            prose-h3:text-base prose-h3:mt-6 prose-h3:mb-2
            prose-p:text-foreground/85 prose-p:leading-relaxed
            prose-a:text-primary prose-a:no-underline hover:prose-a:underline
            prose-code:text-primary prose-code:bg-muted prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-[0.85em] prose-code:before:content-none prose-code:after:content-none
            prose-li:text-foreground/85
            prose-strong:text-foreground"
          dangerouslySetInnerHTML={{ __html: doc.html }}
        />
      ))}
    </section>
  );
}
```

- [ ] **Step 3: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=narrative-docs`
Expected: PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src/components/narrative-docs/
git commit -m "feat(cockpit): add NarrativeDocs component for rendered markdown tutorials"
```

---

### Task 6: Wire four modes into CockpitShell

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`

- [ ] **Step 1: Update shell to four modes**

1. Replace `DocsMode` import with `ApiMode` from `./api-mode/api-mode` and `NarrativeDocs` from `./narrative-docs/narrative-docs`
2. Modes: `['Run', 'Code', 'Docs', 'API'] as const`
3. Add Docs rendering: `<NarrativeDocs narrativeDocs={contentBundle.narrativeDocs} />`
4. Add API rendering: `<ApiMode docSections={contentBundle.docSections} />`

- [ ] **Step 2: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx
git commit -m "feat(cockpit): add four-mode shell with Docs and API modes"
```

---

### Task 7: Write the streaming tutorial guide.md

**Files:**
- Create: `cockpit/langgraph/streaming/python/docs/guide.md`

- [ ] **Step 1: Write the tutorial**

```markdown
# Streaming with angular

This guide walks through building a real-time streaming chat interface using
`agent()` from `@cacheplane/langgraph` connected to a LangGraph
backend on LangSmith Cloud.

## What you'll build

A minimal Angular chat component that sends messages to a LangGraph backend
and displays the response as tokens stream in — giving users immediate
visual feedback instead of waiting for a complete response.

## 1. Configure the provider

Set up `provideAgent()` in your app config with the LangGraph Cloud URL:

```typescript
import { provideAgent } from '@cacheplane/langgraph';

export const appConfig: ApplicationConfig = {
  providers: [
    provideAgent({
      apiUrl: 'https://your-deployment.langgraph.app',
    }),
  ],
};
```

This makes the API URL available to all `agent()` calls in your app.

## 2. Create the streaming resource

In your component, call `agent()` in a field initializer (injection context required):

```typescript
import { agent } from '@cacheplane/langgraph';

export class StreamingComponent {
  protected readonly stream = agent({
    assistantId: 'streaming',
  });
}
```

The returned `stream` ref provides Angular Signals for all state:
- `stream.messages()` — the conversation messages
- `stream.isLoading()` — whether a response is in progress
- `stream.error()` — the last error, if any
- `stream.status()` — the resource status (idle, loading, resolved, error)

## 3. Bind the template

Use Angular's control flow to render messages reactively:

```html
@for (msg of stream.messages(); track $index) {
  <div [class]="'message--' + msg.getType()">
    {{ msg.content }}
  </div>
}
```

The template re-renders automatically as tokens arrive — no manual
subscriptions or change detection needed.

## 4. Submit messages

Call `stream.submit()` with a LangGraph message payload:

```typescript
send(): void {
  const text = this.prompt().trim();
  if (!text || this.stream.isLoading()) return;
  this.prompt.set('');
  this.stream.submit({
    messages: [{ role: 'human', content: text }],
  });
}
```

The submit call opens a streaming connection to the LangGraph backend.
As tokens arrive, `stream.messages()` updates reactively.

## 5. The LangGraph backend

The backend is a LangGraph `StateGraph` deployed to LangSmith Cloud:

```python
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI

def build_streaming_graph():
    llm = ChatOpenAI(model="gpt-5-mini", streaming=True)

    async def generate(state):
        response = await llm.ainvoke(state["messages"])
        return {"messages": [response]}

    graph = StateGraph(dict)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)
    return graph.compile()
```

Deploy with `langgraph deploy` from the `langgraph-cli`. The `assistantId`
in your Angular code must match the graph name in `langgraph.json`.

## Key concepts

- **No service layer needed** — `agent()` replaces wrapper services entirely
- **Signal-based** — all state is exposed as Angular Signals for zero-boilerplate reactivity
- **Thread management** — use `stream.switchThread()` to manage conversation history
- **Error recovery** — check `stream.error()` and call `stream.reload()` to retry
```

- [ ] **Step 2: Commit**

```bash
git add cockpit/langgraph/streaming/python/docs/guide.md
git commit -m "docs(cockpit): add streaming tutorial guide"
```

---

### Task 8: Fix tests and verify

**Files:**
- Modify: Various test files

- [ ] **Step 1: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`

- [ ] **Step 2: Fix failures**

Common fixes:
- Tests referencing `DocsMode` → `ApiMode`
- `ContentBundle` assertions need `narrativeDocs: []`
- Shell tests: modes now `['Run', 'Code', 'Docs', 'API']`
- `pane-rendering.spec.tsx`: update for renamed component and new mode

- [ ] **Step 3: Run tests again**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src
git commit -m "test(cockpit): update tests for narrative docs system"
```

---

### Task 9: Visual verification and push

- [ ] **Step 1: Restart dev server and verify all four modes at 1440x900**

- Run: iframe (empty state since backend not running)
- Code: file tabs with Shiki highlighting
- Docs: rendered markdown tutorial with Shiki code blocks
- API: JSDoc/docstring reference cards

- [ ] **Step 2: Push and verify CI**

```bash
git push
```

Check the PR and CI status.
