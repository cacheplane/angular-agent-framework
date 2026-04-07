# Cockpit Example Harness + First Example App Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the cockpit to show real implementation code, auto-generated docs, and a running Angular example app — starting with LangGraph Streaming.

**Architecture:** Extend `CockpitCapabilityModule` with `backendAssetPaths`. Add a JSDoc/docstring extraction layer to `getContentBundle()` that produces `DocSection[]`. Re-add Docs mode to the shell. Update the streaming capability module to point to real Angular + Python files. Build the first Angular demo app and Python LangGraph backend.

**Tech Stack:** Next.js 16, Tailwind v4, shadcn/ui, Shiki, Vitest, Angular 19 (standalone), LangGraph (Python), angular library

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Modify | `cockpit/langgraph/streaming/python/src/index.ts` | Add `backendAssetPaths`, update `codeAssetPaths` to real files |
| Modify | `apps/cockpit/src/lib/route-resolution.ts` | Add `backendAssetPaths` to `CapabilityPresentation` |
| Modify | `apps/cockpit/src/lib/route-resolution.spec.ts` | Test `backendAssetPaths` forwarding |
| Create | `apps/cockpit/src/lib/extract-docs.ts` | JSDoc/docstring extraction functions |
| Create | `apps/cockpit/src/lib/extract-docs.spec.ts` | Tests for doc extraction |
| Modify | `apps/cockpit/src/lib/content-bundle.ts` | Add `docSections` to ContentBundle, integrate extraction, remove DEFAULT_FRONTEND_ASSET_PATHS |
| Modify | `apps/cockpit/src/lib/content-bundle.spec.ts` | Test docSections extraction |
| Create | `apps/cockpit/src/components/docs-mode/docs-mode.tsx` | New Docs mode rendering DocSection[] |
| Create | `apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx` | Tests |
| Modify | `apps/cockpit/src/components/cockpit-shell.tsx` | Re-add Docs mode, remove DEFAULT_FRONTEND_ASSET_PATHS, pass docSections |
| Modify | `apps/cockpit/src/components/code-mode/code-mode.tsx` | Accept backendAssetPaths as separate tab group |
| Create | `cockpit/langgraph/streaming/angular/` | Angular demo app (component, service, config) |
| Create | `cockpit/langgraph/streaming/python/src/graph.py` | LangGraph streaming graph |
| Modify | `cockpit/langgraph/streaming/python/prompts/streaming.md` | Real system prompt |
| Modify | Various `*.spec.tsx` | Update tests for new props/structure |

---

### Task 1: Add backendAssetPaths to types and capability module

**Files:**
- Modify: `cockpit/langgraph/streaming/python/src/index.ts`
- Modify: `apps/cockpit/src/lib/route-resolution.ts`
- Modify: `apps/cockpit/src/lib/route-resolution.spec.ts`

- [ ] **Step 1: Write failing test for backendAssetPaths in presentation**

Add to `apps/cockpit/src/lib/route-resolution.spec.ts` inside the `getCapabilityPresentation` describe block:

```ts
it('includes backendAssetPaths from the capability module', () => {
  const entry = resolveCockpitEntry({
    manifest: cockpitManifest,
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  });
  const presentation = getCapabilityPresentation(entry);

  expect(presentation).toMatchObject({
    kind: 'capability',
    backendAssetPaths: ['cockpit/langgraph/streaming/python/src/graph.py'],
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --testPathPattern=route-resolution`
Expected: FAIL — `backendAssetPaths` not on presentation

- [ ] **Step 3: Update CockpitCapabilityModule interface and streaming module**

Replace `cockpit/langgraph/streaming/python/src/index.ts`:

```ts
export interface CockpitCapabilityModule {
  id: string;
  manifestIdentity: {
    product: 'langgraph';
    section: 'core-capabilities';
    topic: 'streaming';
    page: 'overview';
    language: 'python';
  };
  title: string;
  docsPath: string;
  promptAssetPaths: string[];
  codeAssetPaths: string[];
  backendAssetPaths: string[];
  runtimeUrl?: string;
  devPort?: number;
}

export const langgraphStreamingPythonModule: CockpitCapabilityModule = {
  id: 'langgraph-streaming-python',
  manifestIdentity: {
    product: 'langgraph',
    section: 'core-capabilities',
    topic: 'streaming',
    page: 'overview',
    language: 'python',
  },
  title: 'LangGraph Streaming (Python)',
  docsPath: '/docs/langgraph/core-capabilities/streaming/overview/python',
  promptAssetPaths: ['cockpit/langgraph/streaming/python/prompts/streaming.md'],
  codeAssetPaths: [
    'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts',
    'cockpit/langgraph/streaming/angular/src/app/streaming.service.ts',
  ],
  backendAssetPaths: [
    'cockpit/langgraph/streaming/python/src/graph.py',
  ],
  runtimeUrl: 'langgraph/streaming',
  devPort: 4300,
};
```

- [ ] **Step 4: Add backendAssetPaths to CapabilityPresentation and getCapabilityPresentation**

In `apps/cockpit/src/lib/route-resolution.ts`, update the capability variant:

```ts
export type CapabilityPresentation =
  | {
      kind: 'docs-only';
      entry: CockpitManifestEntry;
      docsPath: string;
    }
  | {
      kind: 'capability';
      entry: CockpitManifestEntry;
      docsPath: string;
      promptAssetPaths: string[];
      codeAssetPaths: string[];
      backendAssetPaths: string[];
      runtimeUrl?: string;
      devPort?: number;
    };
```

Update the return in `getCapabilityPresentation`:

```ts
return {
  kind: 'capability',
  entry,
  docsPath: module?.docsPath ?? entry.docsPath,
  promptAssetPaths: module?.promptAssetPaths ?? entry.promptAssetPaths,
  codeAssetPaths: module?.codeAssetPaths ?? entry.codeAssetPaths,
  backendAssetPaths: module?.backendAssetPaths ?? [],
  runtimeUrl: module?.runtimeUrl,
  devPort: module?.devPort,
};
```

- [ ] **Step 5: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --testPathPattern=route-resolution`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/index.ts apps/cockpit/src/lib/route-resolution.ts apps/cockpit/src/lib/route-resolution.spec.ts
git commit -m "feat(cockpit): add backendAssetPaths to capability module and presentation"
```

---

### Task 2: JSDoc/docstring extraction

**Files:**
- Create: `apps/cockpit/src/lib/extract-docs.ts`
- Create: `apps/cockpit/src/lib/extract-docs.spec.ts`

- [ ] **Step 1: Write failing tests for doc extraction**

```ts
// apps/cockpit/src/lib/extract-docs.spec.ts
import { describe, expect, it } from 'vitest';
import { extractTsDocSections, extractPyDocSections } from './extract-docs';

describe('extractTsDocSections', () => {
  it('extracts JSDoc blocks preceding export declarations', () => {
    const source = `
/**
 * StreamingService provides real-time token streaming from LangGraph.
 *
 * Call \`connect()\` to establish the streaming connection, then subscribe
 * to the returned Observable for incremental tokens.
 */
export class StreamingService {
  /**
   * Starts a streaming session with the given prompt.
   * @param prompt - The user message to send
   * @returns Observable emitting StreamEvent objects
   */
  stream(prompt: string): Observable<StreamEvent> {}
}
`;
    const sections = extractTsDocSections(source, 'streaming.service.ts');

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('StreamingService');
    expect(sections[0].content).toContain('real-time token streaming');
    expect(sections[0].sourceFile).toBe('streaming.service.ts');
    expect(sections[0].language).toBe('typescript');
    expect(sections[1].title).toBe('stream');
    expect(sections[1].content).toContain('streaming session');
  });

  it('returns empty array when no JSDoc blocks exist', () => {
    const source = `export function foo() { return 1; }`;
    expect(extractTsDocSections(source, 'foo.ts')).toEqual([]);
  });
});

describe('extractPyDocSections', () => {
  it('extracts docstrings from class and function definitions', () => {
    const source = `
class StreamingGraph:
    """
    LangGraph StateGraph that streams LLM responses token by token.

    The graph accepts a user message, passes it through a prompt template,
    and streams the response via LangSmith.
    """

    def invoke(self, message: str) -> AsyncIterator[str]:
        """Stream tokens for the given user message."""
        pass
`;
    const sections = extractPyDocSections(source, 'graph.py');

    expect(sections).toHaveLength(2);
    expect(sections[0].title).toBe('StreamingGraph');
    expect(sections[0].content).toContain('streams LLM responses');
    expect(sections[0].language).toBe('python');
    expect(sections[1].title).toBe('invoke');
  });

  it('returns empty array when no docstrings exist', () => {
    const source = `def foo():\n    return 1`;
    expect(extractPyDocSections(source, 'foo.py')).toEqual([]);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --testPathPattern=extract-docs`
Expected: FAIL — module not found

- [ ] **Step 3: Implement extraction functions**

```ts
// apps/cockpit/src/lib/extract-docs.ts
export interface DocSection {
  title: string;
  content: string;
  sourceFile: string;
  language: 'typescript' | 'python';
}

/**
 * Extracts JSDoc blocks that precede export declarations or named members.
 * Pattern: /** ... * / followed by export or a method/property name.
 */
export function extractTsDocSections(source: string, filePath: string): DocSection[] {
  const sections: DocSection[] = [];
  const pattern = /\/\*\*\s*\n([\s\S]*?)\*\/\s*\n\s*(?:export\s+)?(?:class|function|interface|const|type|abstract\s+class)?\s*(\w+)/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const rawComment = match[1];
    const name = match[2];
    const content = rawComment
      .split('\n')
      .map((line) => line.replace(/^\s*\*\s?/, ''))
      .join('\n')
      .trim();

    if (content) {
      sections.push({ title: name, content, sourceFile: filePath, language: 'typescript' });
    }
  }

  return sections;
}

/**
 * Extracts Python docstrings from class and def declarations.
 * Pattern: class/def name(...): followed by triple-quoted string.
 */
export function extractPyDocSections(source: string, filePath: string): DocSection[] {
  const sections: DocSection[] = [];
  const pattern = /(?:class|def)\s+(\w+)[^:]*:\s*\n\s*"""([\s\S]*?)"""/g;

  let match: RegExpExecArray | null;
  while ((match = pattern.exec(source)) !== null) {
    const name = match[1];
    const content = match[2]
      .split('\n')
      .map((line) => line.replace(/^\s{4}/, ''))
      .join('\n')
      .trim();

    if (content) {
      sections.push({ title: name, content, sourceFile: filePath, language: 'python' });
    }
  }

  return sections;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --testPathPattern=extract-docs`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/lib/extract-docs.ts apps/cockpit/src/lib/extract-docs.spec.ts
git commit -m "feat(cockpit): add JSDoc and Python docstring extraction"
```

---

### Task 3: Integrate doc extraction into ContentBundle

**Files:**
- Modify: `apps/cockpit/src/lib/content-bundle.ts`
- Modify: `apps/cockpit/src/lib/content-bundle.spec.ts`

- [ ] **Step 1: Write failing test for docSections in ContentBundle**

Add to `apps/cockpit/src/lib/content-bundle.spec.ts` in the `getContentBundle` describe:

```ts
it('extracts docSections from code and backend files', async () => {
  mockReadFileSync.mockImplementation((filePath: unknown) => {
    const p = String(filePath);
    if (p.includes('streaming.component.ts')) return '/** StreamingComponent renders a chat UI. */\nexport class StreamingComponent {}';
    if (p.includes('graph.py')) return 'class StreamingGraph:\n    """Streams LLM responses."""\n    pass';
    if (p.includes('streaming.md')) return '# Prompt';
    throw new Error('ENOENT');
  });
  mockCodeToHtml.mockResolvedValue('<pre class="shiki"><code>highlighted</code></pre>');

  const presentation = {
    kind: 'capability' as const,
    entry: {} as any,
    docsPath: '/docs/test',
    promptAssetPaths: ['prompts/streaming.md'],
    codeAssetPaths: ['src/streaming.component.ts'],
    backendAssetPaths: ['src/graph.py'],
    runtimeUrl: undefined,
    devPort: undefined,
  };

  vi.stubEnv('NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL', '');
  const bundle = await getContentBundle(presentation);

  expect(bundle.docSections).toHaveLength(2);
  expect(bundle.docSections[0].title).toBe('StreamingComponent');
  expect(bundle.docSections[0].language).toBe('typescript');
  expect(bundle.docSections[1].title).toBe('StreamingGraph');
  expect(bundle.docSections[1].language).toBe('python');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --testPathPattern=content-bundle`
Expected: FAIL — `docSections` not on bundle

- [ ] **Step 3: Update ContentBundle type and getContentBundle**

In `apps/cockpit/src/lib/content-bundle.ts`:

1. Import `DocSection`, `extractTsDocSections`, `extractPyDocSections` from `./extract-docs`
2. Add `docSections: DocSection[]` to the `ContentBundle` interface
3. Remove the `DEFAULT_FRONTEND_ASSET_PATHS` constant
4. In `getContentBundle`, merge `codeAssetPaths` + `backendAssetPaths` into `allCodePaths` (no more default paths)
5. After reading each code file, extract doc sections based on file extension
6. Return `docSections` in the bundle

Updated `getContentBundle`:

```ts
export async function getContentBundle(
  presentation: CapabilityPresentation
): Promise<ContentBundle> {
  if (presentation.kind === 'docs-only') {
    return { codeFiles: {}, promptFiles: {}, runtimeUrl: null, docSections: [] };
  }

  const backendPaths = presentation.backendAssetPaths ?? [];
  const allCodePaths = [...presentation.codeAssetPaths, ...backendPaths];
  const docSections: DocSection[] = [];

  const codeFiles: Record<string, string> = {};
  for (const path of allCodePaths) {
    const source = readFileSafe(path);
    if (source === null) {
      codeFiles[path] = `File not found: ${path}`;
    } else {
      codeFiles[path] = await highlightCode(source, path);

      // Extract doc sections
      const fileName = path.split('/').pop() ?? path;
      if (path.endsWith('.ts') || path.endsWith('.tsx')) {
        docSections.push(...extractTsDocSections(source, fileName));
      } else if (path.endsWith('.py')) {
        docSections.push(...extractPyDocSections(source, fileName));
      }
    }
  }

  const promptFiles: Record<string, string> = {};
  for (const path of presentation.promptAssetPaths) {
    const source = readFileSafe(path);
    promptFiles[path] = source ?? `File not found: ${path}`;
  }

  const runtimeUrl = resolveRuntimeUrl({
    runtimeUrl: presentation.runtimeUrl,
    devPort: presentation.devPort,
  });

  return { codeFiles, promptFiles, runtimeUrl, docSections };
}
```

- [ ] **Step 4: Update existing tests that assert on ContentBundle shape**

Add `docSections: []` or appropriate value to any existing test assertions that use `toEqual` on the full bundle.

- [ ] **Step 5: Run tests**

Run: `npx nx test cockpit -- --run --testPathPattern=content-bundle`
Expected: ALL PASS

- [ ] **Step 6: Commit**

```bash
git add apps/cockpit/src/lib/content-bundle.ts apps/cockpit/src/lib/content-bundle.spec.ts
git commit -m "feat(cockpit): integrate doc extraction into ContentBundle"
```

---

### Task 4: Create new DocsMode component

**Files:**
- Create: `apps/cockpit/src/components/docs-mode/docs-mode.tsx`
- Create: `apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx`

- [ ] **Step 1: Write failing test**

```tsx
// apps/cockpit/src/components/docs-mode/docs-mode.spec.tsx
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { DocsMode } from './docs-mode';

describe('DocsMode', () => {
  it('renders extracted doc sections grouped by language', () => {
    const html = renderToStaticMarkup(
      <DocsMode
        docSections={[
          { title: 'StreamingComponent', content: 'Renders a streaming chat UI.', sourceFile: 'streaming.component.ts', language: 'typescript' },
          { title: 'StreamingGraph', content: 'Streams LLM responses.', sourceFile: 'graph.py', language: 'python' },
        ]}
      />
    );

    expect(html).toContain('StreamingComponent');
    expect(html).toContain('Renders a streaming chat UI.');
    expect(html).toContain('StreamingGraph');
    expect(html).toContain('Streams LLM responses.');
    expect(html).toContain('streaming.component.ts');
    expect(html).toContain('graph.py');
  });

  it('renders empty state when no doc sections', () => {
    const html = renderToStaticMarkup(<DocsMode docSections={[]} />);
    expect(html).toContain('No documentation extracted');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test cockpit -- --run --testPathPattern=docs-mode`
Expected: FAIL

- [ ] **Step 3: Implement DocsMode**

```tsx
// apps/cockpit/src/components/docs-mode/docs-mode.tsx
import React from 'react';
import type { DocSection } from '../../lib/extract-docs';

interface DocsModeProps {
  docSections: DocSection[];
}

export function DocsMode({ docSections }: DocsModeProps) {
  if (docSections.length === 0) {
    return (
      <section aria-label="Docs mode" className="grid place-items-center h-full text-muted-foreground text-sm">
        <p>No documentation extracted yet — add JSDoc to TypeScript files or docstrings to Python files.</p>
      </section>
    );
  }

  const tsSections = docSections.filter((s) => s.language === 'typescript');
  const pySections = docSections.filter((s) => s.language === 'python');

  return (
    <section aria-label="Docs mode" className="h-full overflow-auto space-y-6 py-2">
      {tsSections.length > 0 ? (
        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-3">Angular</h3>
          {tsSections.map((section) => (
            <article key={`${section.sourceFile}:${section.title}`} className="mb-4">
              <div className="flex items-baseline gap-2 mb-1">
                <h4 className="text-sm font-medium font-mono">{section.title}</h4>
                <span className="text-xs text-muted-foreground">{section.sourceFile}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content}</p>
            </article>
          ))}
        </div>
      ) : null}

      {pySections.length > 0 ? (
        <div>
          <h3 className="text-xs font-mono text-muted-foreground uppercase tracking-wide mb-3">LangGraph</h3>
          {pySections.map((section) => (
            <article key={`${section.sourceFile}:${section.title}`} className="mb-4">
              <div className="flex items-baseline gap-2 mb-1">
                <h4 className="text-sm font-medium font-mono">{section.title}</h4>
                <span className="text-xs text-muted-foreground">{section.sourceFile}</span>
              </div>
              <p className="text-sm text-muted-foreground whitespace-pre-wrap">{section.content}</p>
            </article>
          ))}
        </div>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test cockpit -- --run --testPathPattern=docs-mode`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add apps/cockpit/src/components/docs-mode/
git commit -m "feat(cockpit): add DocsMode component for auto-generated documentation"
```

---

### Task 5: Re-add Docs mode to CockpitShell and update CodeMode

**Files:**
- Modify: `apps/cockpit/src/components/cockpit-shell.tsx`
- Modify: `apps/cockpit/src/components/code-mode/code-mode.tsx`

- [ ] **Step 1: Update CockpitShell**

Changes:
1. Import `DocsMode`
2. Modes become `['Run', 'Code', 'Docs'] as const`
3. Remove `DEFAULT_FRONTEND_ASSET_PATHS` — code paths come entirely from the capability module
4. Pass `backendAssetPaths` to CodeMode (for tab grouping)
5. Pass `docSections` to DocsMode
6. Add Docs rendering in the mode surface

The `codeAssetPaths` computation simplifies to:

```ts
const codeAssetPaths = isCapability ? presentation.codeAssetPaths : [];
const backendAssetPaths = isCapability ? (presentation.backendAssetPaths ?? []) : [];
```

CodeMode call becomes:
```tsx
<CodeMode
  entryTitle={entryTitle}
  codeAssetPaths={codeAssetPaths}
  backendAssetPaths={backendAssetPaths}
  codeFiles={contentBundle.codeFiles}
  promptFiles={contentBundle.promptFiles}
/>
```

DocsMode call:
```tsx
<DocsMode docSections={contentBundle.docSections} />
```

- [ ] **Step 2: Update CodeMode to accept backendAssetPaths**

Add `backendAssetPaths: readonly string[]` to `CodeModeProps`. Render backend tabs as a separate group between code tabs and prompt tabs:

```tsx
{/* Frontend tabs */}
{codeAssetPaths.map((path) => (
  <TabsTrigger key={path} value={path}>{getTabLabel(path)}</TabsTrigger>
))}
{/* Backend separator + tabs */}
{backendAssetPaths.length > 0 ? (
  <>
    <span className="mx-2 text-border">|</span>
    {backendAssetPaths.map((path) => (
      <TabsTrigger key={path} value={path}>{getTabLabel(path)}</TabsTrigger>
    ))}
  </>
) : null}
{/* Prompt separator + tabs */}
{promptPaths.length > 0 ? (
  <>
    <span className="mx-2 text-border">|</span>
    {promptPaths.map((path) => (
      <TabsTrigger key={path} value={path} className="text-primary/70 data-[state=active]:text-primary">
        {getTabLabel(path)}
      </TabsTrigger>
    ))}
  </>
) : null}
```

Backend paths render the same way as code paths (Shiki HTML via `dangerouslySetInnerHTML`) since they're all in `codeFiles`.

The `defaultPath` should prefer the first code path, then backend, then prompt:

```ts
const defaultPath = codeAssetPaths[0] ?? backendAssetPaths[0] ?? promptPaths[0];
```

- [ ] **Step 3: Commit**

```bash
git add apps/cockpit/src/components/cockpit-shell.tsx apps/cockpit/src/components/code-mode/code-mode.tsx
git commit -m "feat(cockpit): re-add Docs mode, remove boilerplate paths, add backend tab group"
```

---

### Task 6: Build the Angular streaming demo app

**Files:**
- Create: `cockpit/langgraph/streaming/angular/project.json`
- Create: `cockpit/langgraph/streaming/angular/package.json`
- Create: `cockpit/langgraph/streaming/angular/tsconfig.json`
- Create: `cockpit/langgraph/streaming/angular/tsconfig.app.json`
- Create: `cockpit/langgraph/streaming/angular/src/index.html`
- Create: `cockpit/langgraph/streaming/angular/src/main.ts`
- Create: `cockpit/langgraph/streaming/angular/src/styles.css`
- Create: `cockpit/langgraph/streaming/angular/src/app/app.config.ts`
- Create: `cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`
- Create: `cockpit/langgraph/streaming/angular/src/app/streaming.service.ts`

- [ ] **Step 1: Create Nx Angular project configuration**

`cockpit/langgraph/streaming/angular/project.json`:
```json
{
  "name": "cockpit-langgraph-streaming-angular",
  "$schema": "../../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "cockpit/langgraph/streaming/angular/src",
  "projectType": "application",
  "tags": ["scope:cockpit", "type:example"],
  "targets": {
    "build": {
      "executor": "@angular-devkit/build-angular:application",
      "options": {
        "outputPath": "dist/cockpit/langgraph/streaming/angular",
        "index": "cockpit/langgraph/streaming/angular/src/index.html",
        "browser": "cockpit/langgraph/streaming/angular/src/main.ts",
        "tsConfig": "cockpit/langgraph/streaming/angular/tsconfig.app.json",
        "styles": ["cockpit/langgraph/streaming/angular/src/styles.css"]
      }
    },
    "serve": {
      "executor": "@angular-devkit/build-angular:dev-server",
      "options": {
        "buildTarget": "cockpit-langgraph-streaming-angular:build",
        "port": 4300
      }
    }
  }
}
```

- [ ] **Step 2: Create supporting config files**

`cockpit/langgraph/streaming/angular/package.json`:
```json
{
  "name": "cockpit-langgraph-streaming-angular",
  "version": "0.0.1",
  "private": true
}
```

`cockpit/langgraph/streaming/angular/tsconfig.json`:
```json
{
  "extends": "../../../../tsconfig.base.json",
  "compilerOptions": {
    "target": "ES2022",
    "module": "ES2022",
    "moduleResolution": "bundler",
    "experimentalDecorators": true,
    "strict": true
  }
}
```

`cockpit/langgraph/streaming/angular/tsconfig.app.json`:
```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "outDir": "../../../../dist/out-tsc",
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.ts"]
}
```

- [ ] **Step 3: Create the Angular app entry point**

`cockpit/langgraph/streaming/angular/src/index.html`:
```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>LangGraph Streaming</title>
  <meta name="viewport" content="width=device-width, initial-scale=1" />
</head>
<body>
  <app-streaming></app-streaming>
</body>
</html>
```

`cockpit/langgraph/streaming/angular/src/main.ts`:
```ts
import { bootstrapApplication } from '@angular/platform-browser';
import { StreamingComponent } from './app/streaming.component';
import { appConfig } from './app/app.config';

bootstrapApplication(StreamingComponent, appConfig).catch((err) =>
  console.error(err)
);
```

`cockpit/langgraph/streaming/angular/src/styles.css`:
```css
*,
*::before,
*::after {
  box-sizing: border-box;
}

body {
  margin: 0;
  font-family: system-ui, -apple-system, sans-serif;
  background: #08111f;
  color: #edf3ff;
}
```

- [ ] **Step 4: Create the Angular app config**

`cockpit/langgraph/streaming/angular/src/app/app.config.ts`:
```ts
import { ApplicationConfig } from '@angular/core';
import { provideHttpClient } from '@angular/common/http';

/**
 * Application configuration for the LangGraph Streaming demo.
 *
 * Provides HttpClient for communicating with the LangGraph backend
 * via the angular library.
 */
export const appConfig: ApplicationConfig = {
  providers: [provideHttpClient()],
};
```

- [ ] **Step 5: Create the streaming service**

`cockpit/langgraph/streaming/angular/src/app/streaming.service.ts`:
```ts
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';

/**
 * StreamingService wraps the LangGraph streaming endpoint.
 *
 * Uses Server-Sent Events to stream tokens from the LangGraph backend
 * in real time. The service manages the EventSource connection lifecycle
 * and exposes an Observable interface for Angular components.
 */
@Injectable({ providedIn: 'root' })
export class StreamingService {
  private readonly apiUrl = 'http://localhost:8000/stream';

  constructor(private readonly http: HttpClient) {}

  /**
   * Streams a response from the LangGraph backend for the given prompt.
   *
   * Opens an SSE connection to the /stream endpoint and emits each token
   * as it arrives. The Observable completes when the stream ends.
   *
   * @param prompt - The user's message to send to the LangGraph chain
   * @returns Observable that emits string tokens as they arrive
   */
  stream(prompt: string): Observable<string> {
    const tokens$ = new Subject<string>();

    const eventSource = new EventSource(
      `${this.apiUrl}?prompt=${encodeURIComponent(prompt)}`
    );

    eventSource.onmessage = (event) => {
      if (event.data === '[DONE]') {
        eventSource.close();
        tokens$.complete();
      } else {
        tokens$.next(event.data);
      }
    };

    eventSource.onerror = () => {
      eventSource.close();
      tokens$.error(new Error('Stream connection failed'));
    };

    return tokens$.asObservable();
  }
}
```

- [ ] **Step 6: Create the streaming component**

`cockpit/langgraph/streaming/angular/src/app/streaming.component.ts`:
```ts
import { Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { NgFor, NgIf } from '@angular/common';
import { StreamingService } from './streaming.service';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * StreamingComponent demonstrates real-time LLM streaming with LangGraph.
 *
 * This standalone Angular component provides a minimal chat interface
 * that sends prompts to a LangGraph backend and displays the response
 * as tokens stream in. Each token is appended to the assistant message
 * in real time, giving immediate visual feedback.
 *
 * Key integration points:
 * - Uses StreamingService to open an SSE connection
 * - Subscribes to the token Observable and appends to the active message
 * - Handles loading state and error recovery
 */
@Component({
  selector: 'app-streaming',
  standalone: true,
  imports: [FormsModule, NgFor, NgIf],
  template: `
    <div class="chat-container">
      <div class="messages">
        <div *ngFor="let msg of messages" [class]="'message message--' + msg.role">
          <span class="message__role">{{ msg.role }}</span>
          <p class="message__content">{{ msg.content }}</p>
        </div>
      </div>
      <form class="input-bar" (ngSubmit)="send()">
        <input
          [(ngModel)]="prompt"
          name="prompt"
          placeholder="Type a message..."
          [disabled]="isStreaming"
        />
        <button type="submit" [disabled]="isStreaming || !prompt.trim()">Send</button>
      </form>
    </div>
  `,
  styles: [`
    .chat-container {
      display: grid;
      grid-template-rows: 1fr auto;
      height: 100vh;
      max-width: 640px;
      margin: 0 auto;
      padding: 1rem;
      gap: 1rem;
    }
    .messages {
      overflow-y: auto;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .message {
      padding: 0.75rem 1rem;
      border-radius: 0.5rem;
    }
    .message--user {
      background: rgba(125, 211, 252, 0.15);
      align-self: flex-end;
      max-width: 80%;
    }
    .message--assistant {
      background: rgba(255, 255, 255, 0.05);
      align-self: flex-start;
      max-width: 80%;
    }
    .message__role {
      font-size: 0.7rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      opacity: 0.5;
    }
    .message__content {
      margin: 0.25rem 0 0;
      white-space: pre-wrap;
    }
    .input-bar {
      display: flex;
      gap: 0.5rem;
    }
    .input-bar input {
      flex: 1;
      padding: 0.75rem 1rem;
      border: 1px solid rgba(138, 170, 214, 0.18);
      border-radius: 0.5rem;
      background: rgba(15, 27, 45, 0.9);
      color: #edf3ff;
      font: inherit;
    }
    .input-bar button {
      padding: 0.75rem 1.5rem;
      border: 1px solid rgba(125, 211, 252, 0.35);
      border-radius: 0.5rem;
      background: linear-gradient(180deg, rgba(56, 189, 248, 0.28), rgba(56, 189, 248, 0.14));
      color: #edf3ff;
      font: inherit;
      cursor: pointer;
    }
    .input-bar button:disabled {
      opacity: 0.5;
      cursor: not-allowed;
    }
  `],
})
export class StreamingComponent {
  private readonly streamingService = inject(StreamingService);

  messages: ChatMessage[] = [];
  prompt = '';
  isStreaming = false;

  /**
   * Sends the current prompt to the LangGraph backend and streams the response.
   *
   * Creates a user message, then subscribes to the streaming service.
   * Each token is appended to the assistant message as it arrives.
   */
  send(): void {
    const text = this.prompt.trim();
    if (!text || this.isStreaming) return;

    this.messages.push({ role: 'user', content: text });
    this.messages.push({ role: 'assistant', content: '' });
    this.prompt = '';
    this.isStreaming = true;

    const assistantIndex = this.messages.length - 1;

    this.streamingService.stream(text).subscribe({
      next: (token) => {
        this.messages[assistantIndex].content += token;
      },
      error: () => {
        this.messages[assistantIndex].content += '\n[Stream error]';
        this.isStreaming = false;
      },
      complete: () => {
        this.isStreaming = false;
      },
    });
  }
}
```

- [ ] **Step 7: Commit**

```bash
git add cockpit/langgraph/streaming/angular/
git commit -m "feat(cockpit): add Angular streaming demo app"
```

---

### Task 7: Build the Python LangGraph backend

**Files:**
- Create: `cockpit/langgraph/streaming/python/src/graph.py`
- Modify: `cockpit/langgraph/streaming/python/prompts/streaming.md`
- Create: `cockpit/langgraph/streaming/python/requirements.txt`

- [ ] **Step 1: Create the LangGraph streaming graph**

`cockpit/langgraph/streaming/python/src/graph.py`:
```python
"""
LangGraph Streaming Graph

A minimal StateGraph that demonstrates real-time token streaming from an LLM.
This graph accepts a user message, applies a system prompt, and streams the
response through a Server-Sent Events endpoint.

The graph uses LangSmith for observability — every invocation is traced
automatically when LANGCHAIN_TRACING_V2=true is set.
"""

from typing import TypedDict, AsyncIterator
from langgraph.graph import StateGraph, END
from langchain_openai import ChatOpenAI
from langchain_core.messages import SystemMessage, HumanMessage


class StreamingState(TypedDict):
    """
    State schema for the streaming graph.

    Attributes:
        messages: The conversation message history
        prompt: The user's input message
    """
    messages: list
    prompt: str


def build_streaming_graph() -> StateGraph:
    """
    Constructs the LangGraph StateGraph for streaming.

    The graph has a single node that calls the LLM with the system prompt
    and user message. It streams tokens back via LangGraph's streaming
    protocol.

    Returns:
        A compiled StateGraph ready for invocation
    """
    llm = ChatOpenAI(model="gpt-4o-mini", streaming=True)

    async def generate(state: StreamingState) -> dict:
        """
        Generate a streaming response from the LLM.

        Reads the system prompt from the prompts directory and combines it
        with the user's message to produce a streamed response.
        """
        system_prompt = open("prompts/streaming.md").read()
        messages = [
            SystemMessage(content=system_prompt),
            HumanMessage(content=state["prompt"]),
        ]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(StreamingState)
    graph.add_node("generate", generate)
    graph.set_entry_point("generate")
    graph.add_edge("generate", END)

    return graph.compile()
```

- [ ] **Step 2: Update the streaming prompt**

`cockpit/langgraph/streaming/python/prompts/streaming.md`:
```markdown
# Streaming Assistant

You are a helpful AI assistant demonstrating real-time streaming with LangGraph.

Respond conversationally and naturally. When explaining technical concepts,
use clear examples. Keep responses concise but informative.

You are being served through a LangGraph StateGraph that streams your tokens
to an Angular frontend via Server-Sent Events.
```

- [ ] **Step 3: Create requirements.txt**

`cockpit/langgraph/streaming/python/requirements.txt`:
```
langgraph>=0.2.0
langchain-openai>=0.2.0
langchain-core>=0.3.0
langsmith>=0.2.0
uvicorn>=0.30.0
```

- [ ] **Step 4: Commit**

```bash
git add cockpit/langgraph/streaming/python/src/graph.py cockpit/langgraph/streaming/python/prompts/streaming.md cockpit/langgraph/streaming/python/requirements.txt
git commit -m "feat(cockpit): add LangGraph streaming backend"
```

---

### Task 8: Fix all tests and verify

**Files:**
- Modify: Various test files and pane wrappers

- [ ] **Step 1: Run full test suite and catalog failures**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Collect all failures.

- [ ] **Step 2: Fix test failures**

Common fixes:
- Tests rendering `CockpitShell` need updated: modes now `['Run', 'Code', 'Docs']`, no `DEFAULT_FRONTEND_ASSET_PATHS`
- `ContentBundle` assertions need `docSections` field
- `CodeMode` tests need `backendAssetPaths` and `promptFiles` props
- `pane-rendering.spec.tsx` needs updates for new DocsMode, removed DEFAULT paths
- `code-pane.tsx` needs `backendAssetPaths` and `promptFiles` props on CodeMode

- [ ] **Step 3: Run full test suite**

Run: `npx nx test cockpit -- --run --reporter=verbose`
Expected: ALL PASS

- [ ] **Step 4: Commit**

```bash
git add apps/cockpit/src
git commit -m "test(cockpit): update tests for example harness redesign"
```

---

### Task 9: Visual verification

- [ ] **Step 1: Start cockpit dev server**

Run: `npx nx serve cockpit -- --port 4201`

- [ ] **Step 2: Verify all three modes**

- **Run mode**: Shows empty state ("No runtime available. Start the local dev server to preview.") since the Angular app isn't running
- **Code mode**: Tabs show `streaming.component.ts | streaming.service.ts | graph.py | streaming.md` — real implementation files. Backend tabs separated by `|`. Content shows "File not found" since the Angular files were just created but paths are correct.
- **Docs mode**: Shows empty state ("No documentation extracted yet...") initially. Once the Angular files exist with JSDoc, it will show extracted docs.
- **Sidebar**: Compact with nav tree
- **Header**: Breadcrumb + title + Run/Code/Docs switcher

- [ ] **Step 3: Fix any visual issues**

- [ ] **Step 4: Commit any fixes**

```bash
git add apps/cockpit/src
git commit -m "fix(cockpit): visual polish for example harness"
```

---

### Task 10: Deployment configuration for Angular example + LangGraph backend

**Files:**
- Create: `cockpit/langgraph/streaming/angular/vercel.json`
- Create: `cockpit/langgraph/streaming/python/langgraph.json`
- Modify: `cockpit/langgraph/streaming/python/src/index.ts` (update runtimeUrl for production)

- [ ] **Step 1: Create Vercel config for Angular app**

The Angular demo app deploys to Vercel as a static site. The cockpit uses `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` to resolve the production iframe URL.

`cockpit/langgraph/streaming/angular/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "buildCommand": "npx nx build cockpit-langgraph-streaming-angular",
  "outputDirectory": "dist/cockpit/langgraph/streaming/angular/browser",
  "framework": null
}
```

- [ ] **Step 2: Create LangSmith Cloud deployment config**

LangGraph backends deploy to LangSmith Cloud as managed deployments. The config tells LangSmith how to run the graph.

`cockpit/langgraph/streaming/python/langgraph.json`:
```json
{
  "graphs": {
    "streaming": {
      "module": "src.graph",
      "callable": "build_streaming_graph"
    }
  },
  "dependencies": ["./requirements.txt"],
  "env": ".env"
}
```

- [ ] **Step 3: Update capability module with production runtimeUrl**

The `runtimeUrl` field on the capability module is used with `NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL` to form the production iframe URL. Verify the current value is correct:

```ts
runtimeUrl: 'langgraph/streaming',  // → ${NEXT_PUBLIC_COCKPIT_RUNTIME_BASE_URL}/langgraph/streaming
```

This resolves to e.g., `https://examples.cacheplane.ai/langgraph/streaming` in production.

- [ ] **Step 4: Add deployment instructions to the streaming prompt (as a code comment in graph.py)**

Add a deployment comment block at the top of `graph.py`:

```python
# Deployment:
#   Local:  uvicorn src.server:app --port 8000
#   Cloud:  langsmith deploy --config langgraph.json
#   Docs:   https://docs.smith.langchain.com/langgraph-cloud
```

- [ ] **Step 5: Commit**

```bash
git add cockpit/langgraph/streaming/angular/vercel.json cockpit/langgraph/streaming/python/langgraph.json cockpit/langgraph/streaming/python/src/graph.py
git commit -m "feat(cockpit): add deployment config for Angular app (Vercel) and LangGraph backend (LangSmith Cloud)"
```
