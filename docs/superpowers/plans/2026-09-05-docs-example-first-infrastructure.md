# Example-first docs infrastructure (PR 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the `<ExampleCode>` MDX include, its guards, and the removal of the never-rendered narrative-docs machinery, so the LangGraph pilot (PR 2) can rewrite pages against a real component.

**Architecture:** The docs route already loads each mapped page's example files into a `ContentBundle`; this PR adds the raw sources to that bundle, resolves them in a pure Website module (`lib/example-code.ts`), and renders them through a server component that feeds a synthesized code fence back into the same `MDXRemote` pipeline the page uses, so highlighting, the `Pre` copy button and every existing `pre` style apply unchanged. A unit guard joins registry descriptors to MDX files and fails on missing or unresolvable includes. The walkthrough renderer, panel, descriptor field and analytics hook are deleted.

**Tech Stack:** Next.js app router (RSC), `next-mdx-remote/rsc`, `rehype-pretty-code`, Vitest (jsdom for `apps/website`, node for the libs), Nx.

**Spec:** `docs/superpowers/specs/2026-09-05-docs-example-first-content-design.md`

**Branch:** `blove/docs-example-first-infra`, created from `origin/main` after `git fetch origin main` (see CONTRIBUTING "Working in a git worktree"; never branch from a stale local main).

**Test commands used throughout** (run from the repo root unless stated):

- Website unit: `cd apps/website && npx vitest run <spec-name>` (never `--root`)
- Libraries: `npx nx test cockpit-shell`, `npx nx test workspace-react`, `npx nx test cockpit-registry`
- Full: `npx nx run-many -t test --projects=cockpit-registry,cockpit-shell,workspace-react,website`
- Lint: `npx nx run-many -t lint --projects=cockpit-registry,cockpit-shell,workspace-react,website` (lint ERRORS block; warnings do not)
- Build: `rm -rf apps/website/.next dist/apps/website/.next && GROWTH_FORM_POLICY=growth_v1 npx nx build website` (the prod build requires that env var, as ci.yml sets; output lands in `dist/apps/website/.next`)

---

## File map

| Path | Responsibility |
| --- | --- |
| `libs/cockpit-shell/src/lib/workspace-content.ts` (modify) | `ContentBundle.codeSources` (raw text per asset path); drop `narrativeDocs` |
| `libs/cockpit-shell/src/lib/render-markdown.ts` + `.spec.ts` (delete) | Walkthrough renderer; nothing else uses it |
| `libs/cockpit-shell/src/lib/workspace-presentation.ts` (modify) | drop `docsAssetPaths` from both presentation unions |
| `libs/cockpit-registry/src/lib/content-descriptors.ts` (modify) | drop `docsAssetPaths` from the type, the freezer, 40 entries, `deriveAvailableModes` |
| `cockpit/*/*/{python,angular}/src/index.ts` (modify, 41 files) | drop the mirrored `docsAssetPaths` type line and 40 values |
| `deployments/{ag-ui-dev,shared-dev}/deps/**` (regenerate) | generated copies of the example modules |
| `libs/workspace-react/src/lib/components/narrative-docs/*` (delete) | Walkthrough panel |
| `libs/workspace-react/src/lib/{workspace-shell,workspace-provider,host-services}.ts(x)` (modify) | remove the panel branch and `trackNarrativeAction` plumbing |
| `apps/website/src/lib/example-code.ts` + `.spec.ts` (create) | pure resolution: file lookup, region slicing, fence synthesis, error types |
| `apps/website/src/components/docs/mdx-options.ts` (create) | the one `MDXRemote` options object, shared by the page renderer and `ExampleCode` |
| `apps/website/src/components/docs/mdx/ExampleCode.tsx` + `.spec.tsx` (create) | server component factory bound to a page's example context |
| `apps/website/src/components/docs/MdxRenderer.tsx` (modify) | `exampleCode` prop → bound `ExampleCode` in the component map |
| `apps/website/src/lib/workspace-page.ts` + `.spec.ts` (modify) | `getExampleCodeContext(model)` |
| `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx` + `.spec.tsx` (modify) | pass the context to `MdxRenderer` |
| `apps/website/src/lib/docs-example-code.spec.ts` (create) | the guard: mapped pages include their example; includes resolve; docs-only pages never include |
| `apps/website/content/docs/langgraph/guides/streaming.mdx` (modify) | first consumer |
| `apps/website/src/styles/docs.css` (modify) | `.mdx-example-code*` rules |
| `apps/website/src/components/workspace/WebsiteWorkspace.tsx` + `.spec.tsx`, `apps/website/src/lib/analytics/events.ts` (modify) | drop `trackNarrativeAction` and its event |
| `CONTRIBUTING.md` (modify) | "Docs pages and example code" section |

---

### Task 1: Raw sources in the content bundle

**Files:**
- Modify: `libs/cockpit-shell/src/lib/workspace-content.ts`
- Test: `libs/cockpit-shell/src/lib/workspace-content.spec.ts`
- Modify (fixtures, type only): `libs/workspace-react/src/lib/workspace-shell.spec.tsx:62-75`, `libs/workspace-react/src/lib/workspace-provider.spec.tsx:57`, `libs/workspace-react/src/lib/public-api.spec.tsx:93`, `apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx:72`, `apps/website/src/lib/workspace-page.spec.ts:80`

- [ ] **Step 1: Write the failing tests**

In `workspace-content.spec.ts`, inside `describe('getContentBundle')`, extend the first test (`returns highlighted code and raw prompt content…`) with:

```ts
    expect(bundle.codeSources).toEqual({
      'cockpit/langgraph/streaming/python/src/index.ts': 'const x = 1;',
    });
```

and extend `returns a placeholder string when a code file is missing` with:

```ts
    expect(bundle.codeSources).toEqual({});
```

and extend `returns empty maps for a docs-only presentation` with:

```ts
    expect(bundle.codeSources).toEqual({});
```

- [ ] **Step 2: Run the spec to verify it fails**

Run: `npx nx test cockpit-shell --skip-nx-cache`
Expected: FAIL, `expected undefined to deeply equal { 'cockpit/…/index.ts': 'const x = 1;' }` (TypeScript also reports `codeSources` missing on `ContentBundle`).

- [ ] **Step 3: Implement**

In `workspace-content.ts`:

```ts
export interface ContentBundle {
  codeFiles: Record<string, string>;
  /** Raw text of every readable code or backend asset, keyed like codeFiles. */
  codeSources: Record<string, string>;
  promptFiles: Record<string, string>;
  runtimeUrl: string | null;
  docSections: DocSection[];
  narrativeDocs: NarrativeDoc[];
}
```

In the docs-only early return add `codeSources: {},`. In the loop:

```ts
  const codeFiles: Record<string, string> = {};
  const codeSources: Record<string, string> = {};
  for (const path of allCodePaths) {
    const source = readFileSafe(workspaceRoot, path);
    if (source === null) {
      codeFiles[path] = `File not found: ${path}`;
    } else {
      codeFiles[path] = await highlightCode(source, path);
      codeSources[path] = source;
```

and return `{ codeFiles, codeSources, promptFiles, runtimeUrl, docSections, narrativeDocs }`.

Add `codeSources: {},` to each `ContentBundle` fixture listed under Files (`workspace-shell.spec.tsx` gets `codeSources: { 'example.ts': 'source' }`).

- [ ] **Step 4: Run the tests**

Run: `npx nx run-many -t test --projects=cockpit-shell,workspace-react,website --skip-nx-cache`
Expected: all PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/cockpit-shell/src/lib/workspace-content.ts libs/cockpit-shell/src/lib/workspace-content.spec.ts libs/workspace-react/src/lib/*.spec.tsx apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx apps/website/src/lib/workspace-page.spec.ts
git commit -m "feat(cockpit-shell): carry raw example sources in the content bundle"
```

---

### Task 2: Pure example-code resolution

**Files:**
- Create: `apps/website/src/lib/example-code.ts`
- Test: `apps/website/src/lib/example-code.spec.ts`

- [ ] **Step 1: Write the failing tests**

```ts
import { describe, expect, it } from 'vitest';
import {
  ExampleCodeError,
  exampleTitle,
  fenceFor,
  resolveExampleFile,
  sliceRegion,
  type ExampleCodeContext,
} from './example-code';

const context: ExampleCodeContext = {
  docsPath: '/docs/langgraph/guides/streaming',
  assetPaths: [
    'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts',
    'cockpit/langgraph/streaming/angular/src/app/app.config.ts',
    'cockpit/langgraph/streaming/python/src/graph.py',
  ],
  sources: {
    'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts': 'export class StreamingComponent {}',
    'cockpit/langgraph/streaming/angular/src/app/app.config.ts': 'export const appConfig = {};',
    'cockpit/langgraph/streaming/python/src/graph.py': 'graph = None',
  },
};

describe('resolveExampleFile', () => {
  it('resolves a basename to the one asset path that ends with it', () => {
    expect(resolveExampleFile('streaming.component.ts', context)).toBe(
      'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts'
    );
  });

  it('accepts a full repo-relative path', () => {
    expect(
      resolveExampleFile('cockpit/langgraph/streaming/python/src/graph.py', context)
    ).toBe('cockpit/langgraph/streaming/python/src/graph.py');
  });

  it('throws with the page and file when nothing matches', () => {
    expect(() => resolveExampleFile('missing.ts', context)).toThrow(ExampleCodeError);
    expect(() => resolveExampleFile('missing.ts', context)).toThrow(
      /\/docs\/langgraph\/guides\/streaming.*missing\.ts/
    );
  });

  it('throws when a basename is ambiguous', () => {
    const ambiguous: ExampleCodeContext = {
      ...context,
      assetPaths: ['a/index.ts', 'b/index.ts'],
      sources: { 'a/index.ts': '', 'b/index.ts': '' },
    };
    expect(() => resolveExampleFile('index.ts', ambiguous)).toThrow(/ambiguous/);
  });

  it('throws when the asset is declared but its source was not readable', () => {
    const unread: ExampleCodeContext = { ...context, sources: {} };
    expect(() => resolveExampleFile('graph.py', unread)).toThrow(/could not be read/);
  });
});

describe('sliceRegion', () => {
  it('slices a TypeScript region, strips the markers, and de-indents', () => {
    const source = [
      'class A {',
      '  // #region submit',
      '  send(text: string) {',
      '    this.agent.submit({ message: text });',
      '  }',
      '  // #endregion',
      '}',
    ].join('\n');
    expect(sliceRegion(source, 'submit', 'x.ts')).toBe(
      ['send(text: string) {', '  this.agent.submit({ message: text });', '}'].join('\n')
    );
  });

  it('accepts the Python and HTML marker forms', () => {
    expect(sliceRegion('# region g\ngraph = 1\n# endregion\n', 'g', 'x.py')).toBe('graph = 1');
    expect(
      sliceRegion('<!-- #region t -->\n<p>hi</p>\n<!-- #endregion -->\n', 't', 'x.html')
    ).toBe('<p>hi</p>');
  });

  it('throws naming the file when the region is missing or unterminated', () => {
    expect(() => sliceRegion('const a = 1;', 'nope', 'x.ts')).toThrow(/x\.ts.*nope/);
    expect(() => sliceRegion('// #region open\nconst a = 1;', 'open', 'x.ts')).toThrow(
      /unterminated/
    );
  });
});

describe('fenceFor', () => {
  it('maps the extension to a fence language', () => {
    expect(fenceFor('const a = 1;', 'x.ts')).toBe('```ts\nconst a = 1;\n```');
    expect(fenceFor('a = 1', 'x.py')).toBe('```python\na = 1\n```');
    expect(fenceFor('<p/>', 'x.html')).toBe('```html\n<p/>\n```');
  });

  it('uses a longer fence than any backtick run inside the code', () => {
    expect(fenceFor('const s = `a```b`;', 'x.ts')).toBe('````ts\nconst s = `a```b`;\n````');
  });

  it('strips one trailing newline so the fence closes on its own line', () => {
    expect(fenceFor('a = 1\n', 'x.py')).toBe('```python\na = 1\n```');
  });
});

describe('exampleTitle', () => {
  it('is the basename', () => {
    expect(exampleTitle('cockpit/langgraph/streaming/python/src/graph.py')).toBe('graph.py');
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/website && npx vitest run example-code`
Expected: FAIL, `Failed to resolve import "./example-code"`.

- [ ] **Step 3: Implement `apps/website/src/lib/example-code.ts`**

```ts
/**
 * Resolution for `<ExampleCode>`: which asset a docs page means, which slice
 * of it, and the fence that feeds it back through the MDX code pipeline.
 * Pure so the build-time component and the unit guard share one rule.
 */

export interface ExampleCodeContext {
  /** The docs route the include appears on; only used in error messages. */
  readonly docsPath: string;
  /** codeAssetPaths + backendAssetPaths of the page's capability. */
  readonly assetPaths: readonly string[];
  /** Raw text per asset path (ContentBundle.codeSources). */
  readonly sources: Readonly<Record<string, string>>;
}

export class ExampleCodeError extends Error {
  override readonly name = 'ExampleCodeError';
}

export function resolveExampleFile(file: string, context: ExampleCodeContext): string {
  const matches = context.assetPaths.filter(
    (path) => path === file || path.endsWith(`/${file}`)
  );
  if (matches.length === 0) {
    throw new ExampleCodeError(
      `${context.docsPath}: <ExampleCode file="${file}"> matches none of the page's example files: ${context.assetPaths.join(', ')}`
    );
  }
  if (matches.length > 1) {
    throw new ExampleCodeError(
      `${context.docsPath}: <ExampleCode file="${file}"> is ambiguous: ${matches.join(', ')}. Use the full path.`
    );
  }
  const [path] = matches;
  if (!(path in context.sources)) {
    throw new ExampleCodeError(
      `${context.docsPath}: <ExampleCode file="${file}"> resolves to ${path}, which could not be read`
    );
  }
  return path;
}

const REGION_START = /^\s*(?:\/\/|#|<!--)\s*#?region\s+(\S+)\s*(?:-->)?\s*$/;
const REGION_END = /^\s*(?:\/\/|#|<!--)\s*#?endregion\b/;

export function sliceRegion(source: string, region: string, filePath: string): string {
  const lines = source.split('\n');
  const start = lines.findIndex((line) => REGION_START.exec(line)?.[1] === region);
  if (start === -1) {
    throw new ExampleCodeError(`${filePath}: no "#region ${region}" marker`);
  }
  const end = lines.findIndex((line, index) => index > start && REGION_END.test(line));
  if (end === -1) {
    throw new ExampleCodeError(`${filePath}: "#region ${region}" is unterminated`);
  }
  const body = lines.slice(start + 1, end);
  const indent = Math.min(
    ...body.filter((line) => line.trim().length > 0).map((line) => /^\s*/.exec(line)![0].length)
  );
  return body.map((line) => line.slice(Math.min(indent, line.length))).join('\n');
}

const FENCE_LANG: Record<string, string> = {
  ts: 'ts',
  tsx: 'tsx',
  js: 'js',
  mjs: 'js',
  py: 'python',
  html: 'html',
  css: 'css',
  json: 'json',
  md: 'md',
  yaml: 'yaml',
  yml: 'yaml',
};

export function fenceFor(code: string, filePath: string): string {
  const ext = filePath.slice(filePath.lastIndexOf('.') + 1);
  const lang = FENCE_LANG[ext] ?? 'text';
  const longestRun = Math.max(0, ...(code.match(/`+/g) ?? []).map((run) => run.length));
  const fence = '`'.repeat(Math.max(3, longestRun + 1));
  const body = code.endsWith('\n') ? code.slice(0, -1) : code;
  return `${fence}${lang}\n${body}\n${fence}`;
}

export function exampleTitle(filePath: string): string {
  return filePath.slice(filePath.lastIndexOf('/') + 1);
}
```

- [ ] **Step 4: Run the spec**

Run: `cd apps/website && npx vitest run example-code`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/example-code.ts apps/website/src/lib/example-code.spec.ts
git commit -m "feat(website): pure resolution for example-code includes"
```

---

### Task 3: Shared MDX options and the `ExampleCode` component

**Files:**
- Create: `apps/website/src/components/docs/mdx-options.ts`
- Create: `apps/website/src/components/docs/mdx/ExampleCode.tsx`
- Test: `apps/website/src/components/docs/mdx/ExampleCode.spec.tsx`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx:91-117`
- Modify: `apps/website/src/styles/docs.css` (after the `.mdx-pre-copy[data-copied]` rule, line ~650)

- [ ] **Step 1: Write the failing tests**

```tsx
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { ExampleCodeError, type ExampleCodeContext } from '../../../lib/example-code';
import { createExampleCode } from './ExampleCode';

const context: ExampleCodeContext = {
  docsPath: '/docs/langgraph/guides/streaming',
  assetPaths: ['cockpit/langgraph/streaming/angular/src/app/streaming.component.ts'],
  sources: {
    'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts': [
      'class StreamingComponent {',
      '  // #region send',
      '  send(text: string) {}',
      '  // #endregion',
      '}',
    ].join('\n'),
  },
};

function findMdx(node: ReactNode): ReactElement<{ source: string; components: object }> | null {
  if (Array.isArray(node)) {
    for (const child of node) {
      const found = findMdx(child);
      if (found) return found;
    }
    return null;
  }
  if (!isValidElement<{ source: string; components: object; children?: ReactNode }>(node)) return null;
  if (node.type === MDXRemote) return node;
  return findMdx(node.props.children);
}

describe('ExampleCode', () => {
  it('renders the whole file as a fence through MDXRemote with the file title', () => {
    const ExampleCode = createExampleCode(context);
    const element = ExampleCode({ file: 'streaming.component.ts' });
    const mdx = findMdx(element);

    expect(element.props['data-example-file']).toBe(
      'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts'
    );
    expect(mdx?.props.source).toBe(
      '```ts\n' + context.sources['cockpit/langgraph/streaming/angular/src/app/streaming.component.ts'] + '\n```'
    );
    expect(Object.keys(mdx?.props.components ?? {})).toEqual(['pre']);
  });

  it('renders a region and records it on the wrapper', () => {
    const ExampleCode = createExampleCode(context);
    const element = ExampleCode({ file: 'streaming.component.ts', region: 'send', title: 'send()' });

    expect(element.props['data-example-region']).toBe('send');
    expect(findMdx(element)?.props.source).toBe('```ts\nsend(text: string) {}\n```');
  });

  it('throws on a docs-only page', () => {
    const ExampleCode = createExampleCode(null);
    expect(() => ExampleCode({ file: 'streaming.component.ts' })).toThrow(ExampleCodeError);
    expect(() => ExampleCode({ file: 'streaming.component.ts' })).toThrow(/mapped example/);
  });

  it('throws on an unknown file', () => {
    const ExampleCode = createExampleCode(context);
    expect(() => ExampleCode({ file: 'nope.ts' })).toThrow(ExampleCodeError);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/website && npx vitest run ExampleCode`
Expected: FAIL, `Failed to resolve import "./ExampleCode"`.

- [ ] **Step 3: Create `mdx-options.ts`**

```ts
import rehypePrettyCode from 'rehype-pretty-code';
import rehypeSlug from 'rehype-slug';
import remarkGfm from 'remark-gfm';

const rehypeOptions = {
  theme: 'tokyo-night',
  keepBackground: true,
};

/**
 * The one MDX compile configuration. `MdxRenderer` uses it for whole pages and
 * `ExampleCode` for the fence it synthesizes, so included code is highlighted
 * and styled exactly like a hand-written block.
 */
export const mdxCompileOptions = {
  mdxOptions: {
    remarkPlugins: [remarkGfm],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    rehypePlugins: [rehypeSlug, [rehypePrettyCode, rehypeOptions] as any],
  },
};
```

In `MdxRenderer.tsx` delete the three plugin imports, the `rehypeOptions` constant and the inline `options={{ … }}`; import `mdxCompileOptions` from `./mdx-options` and pass `options={mdxCompileOptions}`.

- [ ] **Step 4: Create `ExampleCode.tsx`**

```tsx
import { MDXRemote } from 'next-mdx-remote/rsc';
import {
  ExampleCodeError,
  exampleTitle,
  fenceFor,
  resolveExampleFile,
  sliceRegion,
  type ExampleCodeContext,
} from '../../../lib/example-code';
import { mdxCompileOptions } from '../mdx-options';
import { Pre } from './CodeBlock';

export interface ExampleCodeProps {
  /** Basename or repo-relative path of one of the page's example files. */
  file: string;
  /** Name of a `#region` / `#endregion` pair inside that file. */
  region?: string;
  /** Title bar text; defaults to the file's basename. */
  title?: string;
}

/**
 * Binds `<ExampleCode>` to one docs page's example. The component renders
 * the requested file (or region) as a code fence through the same MDX
 * pipeline as the page, so highlighting, the copy button and every `pre`
 * style are identical to a hand-written block. Anything unresolvable throws
 * at build time: a docs page without its code is wrong, not degraded.
 */
export function createExampleCode(context: ExampleCodeContext | null) {
  return function ExampleCode({ file, region, title }: ExampleCodeProps) {
    if (!context) {
      throw new ExampleCodeError(
        `<ExampleCode file="${file}"> is only valid on a docs page with a mapped example`
      );
    }
    const path = resolveExampleFile(file, context);
    const source = context.sources[path];
    const code = region ? sliceRegion(source, region, path) : source;

    return (
      <div className="mdx-example-code" data-example-file={path} data-example-region={region}>
        <div className="mdx-example-code-title">{title ?? exampleTitle(path)}</div>
        <MDXRemote source={fenceFor(code, path)} components={{ pre: Pre }} options={mdxCompileOptions} />
      </div>
    );
  };
}
```

- [ ] **Step 5: Add the styles to `docs.css`** (directly after the `.mdx-pre-copy[data-copied]` rule):

```css
/* mdx — ExampleCode (code included from the page's live example). The fence
 * inside is an ordinary rehype-pretty-code figure; only the title bar and the
 * outer margin are new, so the figure's own margin is collapsed here. */
.mdx-example-code {
  margin: 1.5rem 0;
}
.mdx-example-code-title {
  padding: 6px 14px;
  font-family: var(--font-mono);
  font-size: 0.7rem;
  color: var(--docs-code-title-fg);
  background: var(--docs-code-bg);
  border: 1px solid var(--docs-code-border);
  border-bottom: 1px solid var(--docs-code-title-rule);
  border-radius: 0.75rem 0.75rem 0 0;
}
.docs-prose .mdx-example-code [data-rehype-pretty-code-figure] {
  margin: 0;
}
.docs-prose .mdx-example-code [data-rehype-pretty-code-figure] pre {
  border-top-left-radius: 0;
  border-top-right-radius: 0;
}
```

- [ ] **Step 6: Run the tests**

Run: `cd apps/website && npx vitest run ExampleCode style-contracts`
Expected: PASS. If `style-contracts.spec.ts` objects to the new selectors, read its message: it names the file the rule must live in; move the block there rather than loosening the guard.

- [ ] **Step 7: Commit**

```bash
git add apps/website/src/components/docs/mdx-options.ts apps/website/src/components/docs/mdx/ExampleCode.tsx apps/website/src/components/docs/mdx/ExampleCode.spec.tsx apps/website/src/components/docs/MdxRenderer.tsx apps/website/src/styles/docs.css
git commit -m "feat(website): ExampleCode server component renders example files through the docs MDX pipeline"
```

---

### Task 4: Bind the component per page

**Files:**
- Modify: `apps/website/src/lib/workspace-page.ts`
- Test: `apps/website/src/lib/workspace-page.spec.ts`
- Modify: `apps/website/src/components/docs/MdxRenderer.tsx`
- Modify: `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx:103-106,171`
- Test: `apps/website/src/app/docs/[library]/[section]/[slug]/page.spec.tsx`

- [ ] **Step 1: Write the failing tests**

`workspace-page.spec.ts`, new cases (reuse the file's existing imports; add `getExampleCodeContext` to the import from `./workspace-page`):

```ts
  it('builds an example-code context for a page with code assets', async () => {
    const model = await getWebsiteWorkspacePage({
      docsPath: '/docs/langgraph/guides/streaming',
      title: 'Streaming',
    });
    const context = getExampleCodeContext(model);

    expect(context?.docsPath).toBe('/docs/langgraph/guides/streaming');
    expect(context?.assetPaths).toEqual([
      'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts',
      'cockpit/langgraph/streaming/angular/src/app/app.config.ts',
      'cockpit/langgraph/streaming/python/src/graph.py',
    ]);
    expect(Object.keys(context?.sources ?? {})).toEqual(context?.assetPaths);
  });

  it('has no example-code context for a docs-only page', async () => {
    const model = await getWebsiteWorkspacePage({
      docsPath: '/docs/langgraph/guides/testing',
      title: 'Testing',
    });
    expect(getExampleCodeContext(model)).toBeNull();
  });
```

`page.spec.tsx`, extend `ElementProps` with `exampleCode?: { assetPaths?: readonly string[] } | null;` and add to the first test (`passes mapped descriptor-backed content…`):

```ts
    const mdx = findElement(workspace?.props.docsSlot, MdxRenderer as ComponentType<never>);
    expect(mdx?.props.exampleCode?.assetPaths).toContain(
      'cockpit/langgraph/streaming/angular/src/app/streaming.component.ts'
    );
```

and to `keeps an unmapped page as a complete server Docs slot`:

```ts
    expect(findElement(slot, MdxRenderer as ComponentType<never>)?.props.exampleCode).toBeNull();
```

- [ ] **Step 2: Run to verify failure**

Run: `cd apps/website && npx vitest run workspace-page page.spec`
Expected: FAIL, `getExampleCodeContext is not a function` and `expected undefined to contain …`.

- [ ] **Step 3: Implement**

`workspace-page.ts`, append:

```ts
import type { ExampleCodeContext } from './example-code';

/**
 * The example a docs page may include code from. Null for docs-only pages and
 * for capabilities that declare no code assets, so `<ExampleCode>` on such a
 * page throws at build time instead of rendering nothing.
 */
export function getExampleCodeContext(
  model: WebsiteWorkspacePageModel
): ExampleCodeContext | null {
  const { presentation, contentBundle } = model;
  if (presentation.kind !== 'capability') return null;
  const assetPaths = [...presentation.codeAssetPaths, ...presentation.backendAssetPaths];
  if (assetPaths.length === 0) return null;
  return { docsPath: presentation.docsPath, assetPaths, sources: contentBundle.codeSources };
}
```

`MdxRenderer.tsx`:

```tsx
import { createExampleCode } from './mdx/ExampleCode';
import type { ExampleCodeContext } from '../../lib/example-code';

interface MdxRendererProps {
  source: string;
  /** Present on docs pages that embed a runnable example; null elsewhere. */
  exampleCode?: ExampleCodeContext | null;
}

export function MdxRenderer({ source, exampleCode = null }: MdxRendererProps) {
  return (
    <div className="docs-prose">
      <MDXRemote
        source={source}
        components={{ ...mdxComponents, ExampleCode: createExampleCode(exampleCode) }}
        options={mdxCompileOptions}
      />
    </div>
  );
}
```

Create `apps/website/src/components/docs/MdxRenderer.spec.tsx` so the bound component map is covered:

```tsx
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it } from 'vitest';
import { MDXRemote } from 'next-mdx-remote/rsc';
import { MdxRenderer } from './MdxRenderer';

function findMdx(node: ReactNode): ReactElement<{ components: Record<string, unknown> }> | null {
  if (!isValidElement<{ components: Record<string, unknown>; children?: ReactNode }>(node)) return null;
  if (node.type === MDXRemote) return node;
  return findMdx(node.props.children);
}

describe('MdxRenderer', () => {
  it('always registers ExampleCode, bound to the page context', () => {
    const withContext = findMdx(
      MdxRenderer({
        source: '# x',
        exampleCode: { docsPath: '/docs/p', assetPaths: ['a/b.ts'], sources: { 'a/b.ts': '' } },
      })
    );
    const without = findMdx(MdxRenderer({ source: '# x' }));

    expect(typeof withContext?.props.components['ExampleCode']).toBe('function');
    expect(typeof without?.props.components['ExampleCode']).toBe('function');
    expect(() =>
      (without?.props.components['ExampleCode'] as (p: { file: string }) => unknown)({ file: 'b.ts' })
    ).toThrow(/mapped example/);
  });
});
```

`page.tsx`: import `getExampleCodeContext` next to `getWebsiteWorkspacePage`, and change the article line to

```tsx
            <MdxRenderer source={doc.body} exampleCode={getExampleCodeContext(workspacePage)} />
```

- [ ] **Step 4: Run the tests**

Run: `cd apps/website && npx vitest run workspace-page page.spec MdxRenderer`
Expected: PASS (the new `MdxRenderer.spec.tsx` included).

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/workspace-page.ts apps/website/src/lib/workspace-page.spec.ts apps/website/src/components/docs/MdxRenderer.tsx apps/website/src/components/docs/MdxRenderer.spec.tsx 'apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx' 'apps/website/src/app/docs/[library]/[section]/[slug]/page.spec.tsx'
git commit -m "feat(website): bind ExampleCode to each docs page's example"
```

---

### Task 5: The guard

**Files:**
- Create: `apps/website/src/lib/docs-example-code.spec.ts`

- [ ] **Step 1: Confirm the pending list**

The list below was generated on 2026-09-05 (41 mapped pages minus streaming). Re-run this to confirm it still matches before pasting; if it differs, use the fresh output:

```bash
npx tsx -e 'import {capabilityModules} from "./libs/cockpit-registry/src/index"; const m=new Set(capabilityModules.filter(d=>d.codeAssetPaths.length+(d.backendAssetPaths?.length??0)>0).map(d=>d.docsPath)); m.delete("/docs/langgraph/guides/streaming"); console.log([...m].sort().map(p=>`  \x27${p}\x27,`).join("\n"))'
```

Expected: 40 lines, identical to the `PENDING_PAGES` block below.

- [ ] **Step 2: Write the spec**

```ts
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join, relative, resolve } from 'node:path';
import { capabilityModules } from '@threadplane/cockpit-registry';
import { describe, expect, it } from 'vitest';
import {
  resolveExampleFile,
  sliceRegion,
  type ExampleCodeContext,
} from './example-code';

/**
 * Every docs page that embeds a runnable example teaches through that
 * example: it includes code with `<ExampleCode>`, and every include resolves
 * against the capability's declared assets by the same rule the component
 * uses at build time. Docs-only pages never include.
 *
 * PENDING_PAGES lists mapped pages not yet rewritten. Each product PR removes
 * its pages; a page that gains an include must leave the list in the same PR.
 */
const PENDING_PAGES = new Set<string>([
  '/docs/a2ui/getting-started/introduction',
  '/docs/ag-ui/guides/client-tools',
  '/docs/ag-ui/guides/interrupts',
  '/docs/ag-ui/guides/json-render',
  '/docs/ag-ui/guides/subagents',
  '/docs/ag-ui/guides/tool-views',
  '/docs/ag-ui/reference/event-mapping',
  '/docs/chat/a2ui/overview',
  '/docs/chat/components/chat-debug',
  '/docs/chat/components/chat-input',
  '/docs/chat/components/chat-interrupt-panel',
  '/docs/chat/components/chat-subagent-card',
  '/docs/chat/components/chat-tool-calls',
  '/docs/chat/components/chat-trace',
  '/docs/chat/concepts/message-model',
  '/docs/chat/guides/client-tools',
  '/docs/chat/guides/generative-ui',
  '/docs/chat/guides/theming',
  '/docs/chat/guides/thread-routing',
  '/docs/deep-agents/capabilities/filesystem',
  '/docs/deep-agents/capabilities/memory',
  '/docs/deep-agents/capabilities/planning',
  '/docs/deep-agents/capabilities/skills',
  '/docs/deep-agents/capabilities/subagents',
  '/docs/langgraph/guides/deployment',
  '/docs/langgraph/guides/durable-execution',
  '/docs/langgraph/guides/interrupts',
  '/docs/langgraph/guides/memory',
  '/docs/langgraph/guides/persistence',
  '/docs/langgraph/guides/subgraphs',
  '/docs/langgraph/guides/time-travel',
  '/docs/render/api/provide-render',
  '/docs/render/api/render-spec-component',
  '/docs/render/guides/registry',
  '/docs/render/guides/repeat-loops',
  '/docs/render/guides/specs',
  '/docs/render/guides/state-store',
  '/docs/runtimes/aws-strands/overview',
  '/docs/runtimes/mastra/overview',
  '/docs/runtimes/microsoft-agent-framework/overview',
]);

const findWorkspaceRoot = (): string => {
  let directory = process.cwd();
  while (directory !== resolve(directory, '..')) {
    if (existsSync(join(directory, 'nx.json'))) return directory;
    directory = resolve(directory, '..');
  }
  throw new Error('workspace root (nx.json) not found');
};
const WORKSPACE_ROOT = findWorkspaceRoot();
const CONTENT_ROOT = join(WORKSPACE_ROOT, 'apps/website/content');

interface MappedPage {
  readonly docsPath: string;
  readonly assetPaths: readonly string[];
}

/** docsPath → union of code assets across every descriptor sharing it. */
function mappedPages(): MappedPage[] {
  const byPath = new Map<string, Set<string>>();
  for (const descriptor of capabilityModules) {
    const assets = [
      ...descriptor.codeAssetPaths,
      ...(descriptor.backendAssetPaths ?? []),
    ];
    if (assets.length === 0) continue;
    const set = byPath.get(descriptor.docsPath) ?? new Set<string>();
    for (const asset of assets) set.add(asset);
    byPath.set(descriptor.docsPath, set);
  }
  return [...byPath].map(([docsPath, assets]) => ({
    docsPath,
    assetPaths: [...assets],
  }));
}

function mdxFor(docsPath: string): string {
  return readFileSync(join(CONTENT_ROOT, `${docsPath}.mdx`), 'utf8');
}

function contextFor(page: MappedPage): ExampleCodeContext {
  const sources: Record<string, string> = {};
  for (const path of page.assetPaths) {
    const full = join(WORKSPACE_ROOT, path);
    if (existsSync(full)) sources[path] = readFileSync(full, 'utf8');
  }
  return { docsPath: page.docsPath, assetPaths: page.assetPaths, sources };
}

interface Include {
  readonly file: string;
  readonly region?: string;
}

function includesIn(mdx: string): Include[] {
  return [...mdx.matchAll(/<ExampleCode\b([^>]*?)\/?>/g)].map(([, attrs]) => ({
    file: /\bfile="([^"]+)"/.exec(attrs)?.[1] ?? '',
    region: /\bregion="([^"]+)"/.exec(attrs)?.[1],
  }));
}

function allDocsMdx(): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) return walk(path);
      return entry.name.endsWith('.mdx') ? [path] : [];
    });
  return walk(join(CONTENT_ROOT, 'docs'));
}

describe('docs pages teach through their example', () => {
  const pages = mappedPages();
  const mappedPaths = new Set(pages.map((page) => page.docsPath));

  it('has an MDX file for every mapped page', () => {
    for (const page of pages) {
      expect(existsSync(join(CONTENT_ROOT, `${page.docsPath}.mdx`)), page.docsPath).toBe(true);
    }
  });

  it('lists only mapped pages as pending, and none that already include', () => {
    for (const pending of PENDING_PAGES) {
      expect(mappedPaths.has(pending), `${pending} is not a mapped page`).toBe(true);
      expect(includesIn(mdxFor(pending)), `${pending} includes code; remove it from PENDING_PAGES`).toEqual([]);
    }
  });

  it('includes at least one example file on every rewritten mapped page', () => {
    const missing = pages
      .filter((page) => !PENDING_PAGES.has(page.docsPath))
      .filter((page) => includesIn(mdxFor(page.docsPath)).length === 0)
      .map((page) => page.docsPath);
    expect(missing).toEqual([]);
  });

  it('resolves every include against the capability assets', () => {
    for (const page of pages) {
      const context = contextFor(page);
      for (const include of includesIn(mdxFor(page.docsPath))) {
        const label = `${page.docsPath} <ExampleCode file="${include.file}">`;
        expect(include.file, label).not.toBe('');
        const path = resolveExampleFile(include.file, context);
        if (include.region) {
          expect(() => sliceRegion(context.sources[path], include.region!, path), label).not.toThrow();
        }
      }
    }
  });

  it('never includes on a docs-only page', () => {
    const offenders = allDocsMdx()
      .map((file) => '/' + relative(CONTENT_ROOT, file).replace(/\.mdx$/, ''))
      .filter((docsPath) => !mappedPaths.has(docsPath))
      .filter((docsPath) => includesIn(mdxFor(docsPath)).length > 0);
    expect(offenders).toEqual([]);
  });
});
```

- [ ] **Step 3: Run it and read the failure**

Run: `cd apps/website && npx vitest run docs-example-code`
Expected: exactly one failure, `includes at least one example file…` with `['/docs/langgraph/guides/streaming']`, because streaming is not pending and not yet converted. Every other case passes. If `has an MDX file` fails, a descriptor points at a page with no file; report it instead of allow-listing.

- [ ] **Step 4: Commit the spec (red on purpose; Task 6 turns it green)**

```bash
git add apps/website/src/lib/docs-example-code.spec.ts
git commit -m "test(website): guard that mapped docs pages include their example code"
```

---

### Task 6: First consumer on the streaming page

**Files:**
- Modify: `apps/website/content/docs/langgraph/guides/streaming.mdx:99-100` (right after the closing `</Tabs>` of "How streaming works")

- [ ] **Step 1: Add the include**

Insert after the `</Tabs>` that closes the `agent.py` / `chat.component.ts` / `chat.component.html` group:

```mdx
### The running example

The demo in the Run tab is the smallest real integration of this pattern. The component below is the one that renders it: it injects the agent configured in `app.config.ts` and hands it to the prebuilt `<chat>` composition, which owns message rendering, input, and the typing indicator.

<ExampleCode file="streaming.component.ts" />
```

- [ ] **Step 2: Run the guard and the page spec**

Run: `cd apps/website && npx vitest run docs-example-code page.spec docs-search`
Expected: PASS (the search-index specs are unaffected: the tag is not a heading and carries no fence).

- [ ] **Step 3: Build the site to prove the server component renders**

Run: `rm -rf apps/website/.next && npx nx build website`
Expected: build succeeds; `/docs/langgraph/guides/streaming` is in the static page list. Then:

```bash
grep -o 'data-example-file="[^"]*"' apps/website/.next/server/app/docs/langgraph/guides/streaming.html | head -1
```

Expected: `data-example-file="cockpit/langgraph/streaming/angular/src/app/streaming.component.ts"`. Also confirm the fence went through highlighting:

```bash
grep -c 'data-rehype-pretty-code-figure' apps/website/.next/server/app/docs/langgraph/guides/streaming.html
```

Expected: a number one higher than on `origin/main` for the same page (the page already has several fences).

- [ ] **Step 4: Mutation check, then revert**

Temporarily change the include to `file="nope.ts"`, run `npx nx build website --skip-nx-cache`, expect the build to FAIL with `/docs/langgraph/guides/streaming: <ExampleCode file="nope.ts"> matches none of the page's example files`. Restore the file (`git checkout -- apps/website/content/docs/langgraph/guides/streaming.mdx` then re-apply Step 1, or edit back).

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/docs/langgraph/guides/streaming.mdx
git commit -m "docs(langgraph): streaming page includes the running example's component"
```

---

### Task 7a: Remove `docsAssetPaths` from the registry, the example modules, and generated deployments

**Files:**
- Modify: `libs/cockpit-registry/src/lib/content-descriptors.ts` (type line 23, freezer lines 1039-1041, 40 entries, `deriveAvailableModes` line 1080)
- Modify: `libs/cockpit-registry/src/lib/content-descriptors.spec.ts:181,213,302-305`
- Modify: 41 files `cockpit/*/*/{python,angular}/src/index.ts`
- Regenerate: `deployments/ag-ui-dev/deps/**`, `deployments/shared-dev/deps/**`

- [ ] **Step 1: Update the spec first**

In `content-descriptors.spec.ts` remove `descriptor.docsAssetPaths,` from the frozen-arrays loop (line 181) and `...(descriptor.docsAssetPaths ?? []),` from the exists loop (line 213). Change the Docs-mode assertion (lines 302-305) to:

```ts
      expect(entry.availableModes.includes('Docs')).toBe(entry.docsPath.length > 0);
```

Run: `npx nx test cockpit-registry --skip-nx-cache`
Expected: PASS still (the assertions are weaker, not wrong). This step exists so Step 2 cannot leave a stale reference.

- [ ] **Step 2: Strip the field everywhere**

```bash
sed -i '' '/^  readonly docsAssetPaths?: readonly string\[\];$/d' libs/cockpit-registry/src/lib/content-descriptors.ts
sed -i '' "/^    docsAssetPaths: \['cockpit\/[^']*\/docs\/guide\.md'\],$/d" libs/cockpit-registry/src/lib/content-descriptors.ts
grep -rl 'docsAssetPaths' cockpit --include=index.ts | xargs sed -i '' '/docsAssetPaths/d'
grep -rn 'docsAssetPaths' libs/cockpit-registry cockpit --include='*.ts' | grep -v '\.spec\.'
```

Expected from the last command: three lines left in `content-descriptors.ts` (the freezer spread and the `deriveAvailableModes` condition). Edit those by hand: delete the `...(descriptor.docsAssetPaths ? { docsAssetPaths: freezeAssetPaths(descriptor.docsAssetPaths) } : {}),` spread, and change the Docs condition to `if (docsPath.length > 0) {`.

- [ ] **Step 3: Regenerate the deployment copies**

```bash
npx tsx scripts/generate-ag-ui-deployment-config.ts
npx tsx scripts/generate-shared-deployment-config.ts
git status --short deployments | wc -l
grep -rn 'docsAssetPaths' deployments | wc -l
```

Expected: about 40 modified files; `0` remaining occurrences.

- [ ] **Step 4: Test**

Run: `npx nx run-many -t test,lint --projects=cockpit-registry --skip-nx-cache && cd apps/website && npx vitest run cockpit-docs-links`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add libs/cockpit-registry cockpit deployments
git commit -m "refactor(cockpit-registry): drop docsAssetPaths; walkthroughs are no longer a registry asset"
```

---

### Task 7b: Remove the walkthrough renderer from `cockpit-shell`

**Files:**
- Modify: `libs/cockpit-shell/src/lib/workspace-presentation.ts:43,62,214,258`
- Modify: `libs/cockpit-shell/src/lib/workspace-presentation.spec.ts:145-147,165,258-262,331,451`
- Modify: `libs/cockpit-shell/src/lib/workspace-content.ts`
- Modify: `libs/cockpit-shell/src/lib/workspace-content.spec.ts`
- Delete: `libs/cockpit-shell/src/lib/render-markdown.ts`, `libs/cockpit-shell/src/lib/render-markdown.spec.ts`
- Modify: `libs/cockpit-shell/src/index.ts:7`
- Modify (fixtures): the five `ContentBundle` fixtures from Task 1 lose `narrativeDocs`

- [ ] **Step 1: Update the specs first**

`workspace-presentation.spec.ts`: delete the `expect(presentation.docsAssetPaths).toEqual([...])` block (145-147), the `...presentation.docsAssetPaths,` spread (165), the `docsAssetPaths: [...]` key in the `toMatchObject` at 258-262, and the two `docsAssetPaths: descriptor?.docsAssetPaths…` keys (331, 451).

`workspace-content.spec.ts`: remove `mockRenderMarkdown` from the hoisted block, the `vi.mock('./render-markdown', …)` call, every `expect(bundle.narrativeDocs)…` line, the `docsAssetPaths: [...]` keys in every presentation literal, the `narrativeDocs` assertion in `loads workspace-only capabilities…` (386-390), and the whole test `skips a narrative rendering failure and continues loading the bundle`. Rename `contains missing prompt and narrative assets` to `contains missing prompt assets`.

Delete `render-markdown.spec.ts`.

Run: `npx nx test cockpit-shell --skip-nx-cache`
Expected: PASS (the production code still has the fields; the specs simply stop asserting them). If anything fails, a spec still references the machinery: fix the spec, not the code.

- [ ] **Step 2: Remove the code**

`workspace-presentation.ts`: delete the `docsAssetPaths: string[];` lines in both unions (43, 62) and the two `docsAssetPaths: [...(…docsAssetPaths ?? [])],` spreads (214, 258).

`workspace-content.ts`: delete `import { renderMarkdown } from './render-markdown';`, the `NarrativeDoc` interface, `narrativeDocs: NarrativeDoc[];` from `ContentBundle`, `narrativeDocs: [],` from the docs-only return, the whole `narrativeDocs` loop (193-211), and `narrativeDocs` from the final return.

Delete `render-markdown.ts`. Remove `export * from './lib/render-markdown';` from `libs/cockpit-shell/src/index.ts`.

Remove `narrativeDocs: […]` / `narrativeDocs: [],` from the five fixtures.

- [ ] **Step 3: Verify nothing else imports the renderer**

```bash
grep -rn "render-markdown\|renderMarkdown\|narrativeDocs\|NarrativeDoc\b\|docsAssetPaths" libs/cockpit-shell libs/cockpit-registry apps/website/src --include='*.ts' --include='*.tsx'
```

Expected: no output except `libs/workspace-react` matches (handled in 7c) — this grep is scoped so it must print nothing.

- [ ] **Step 4: Test**

Run: `npx nx run-many -t test,lint --projects=cockpit-shell,cockpit-registry --skip-nx-cache`
Expected: PASS. (`marked` stays in `package.json`; removing a dependency edits the lockfile, which is a separate, platform-sensitive change per CONTRIBUTING.)

- [ ] **Step 5: Commit**

```bash
git add libs/cockpit-shell libs/workspace-react/src/lib/*.spec.tsx apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx apps/website/src/lib/workspace-page.spec.ts
git commit -m "refactor(cockpit-shell): delete the walkthrough renderer and narrative bundle"
```

---

### Task 7c: Remove the narrative panel and its analytics hook from `workspace-react`

**Files:**
- Delete: `libs/workspace-react/src/lib/components/narrative-docs/narrative-docs.tsx`, `narrative-docs.spec.tsx`
- Modify: `libs/workspace-react/src/index.ts:46`
- Modify: `libs/workspace-react/src/lib/workspace-shell.tsx:28,152,522-531`
- Modify: `libs/workspace-react/src/lib/workspace-provider.tsx:31,76,168,410,447`
- Modify: `libs/workspace-react/src/lib/host-services.ts:15-22`
- Modify: `libs/workspace-react/src/lib/workspace-shell.spec.tsx:371-376`

- [ ] **Step 1: Update the shell spec first**

Delete the test `uses registry narrative Docs when no server slot is present` (371-376). Add in its place:

```ts
  it('renders nothing in the Docs panel when no server slot is present', () => {
    renderWorkspace({ requestedMode: 'docs' });
    const panel = screen.getByRole('region', { name: 'Docs workspace panel' });
    expect(panel.querySelector('h1')).toBeNull();
  });
```

Run: `npx nx test workspace-react --skip-nx-cache`
Expected: the new test FAILS (the registry narrative heading still renders).

- [ ] **Step 2: Remove the code**

`workspace-shell.tsx`: delete the `NarrativeDocs` import (28) and `trackNarrativeAction,` from the context destructure (152); replace the Docs panel body

```tsx
                {docsSlot !== null ? (
                  docsSlot
                ) : (
                  <NarrativeDocs … />
                )}
```

with `{docsSlot}`.

`workspace-provider.tsx`: remove `TrackNarrativeAction,` from the type import, the `readonly trackNarrativeAction?: TrackNarrativeAction;` prop, the `trackNarrativeAction,` destructure, and both `trackNarrativeAction,` entries in the context value and its dependency array. Also remove it from the context value interface (grep `trackNarrativeAction` in the file until empty).

`host-services.ts`: delete `WorkspaceNarrativeAnalytics` and `TrackNarrativeAction`.

Delete the `narrative-docs` directory and its line in `src/index.ts`.

- [ ] **Step 3: Verify**

```bash
grep -rn "NarrativeDocs\|TrackNarrativeAction\|trackNarrativeAction\|narrative" libs/workspace-react/src
```

Expected: no output.

Run: `npx nx run-many -t test,lint --projects=workspace-react --skip-nx-cache`
Expected: PASS, including `public-api.spec.tsx` (its regex may still name `renderMarkdown`; that is fine, the check is that the string is absent).

- [ ] **Step 4: Commit**

```bash
git add libs/workspace-react
git commit -m "refactor(workspace-react): remove the narrative Docs panel and its analytics hook"
```

---

### Task 7d: Remove the Website side of the hook

**Files:**
- Modify: `apps/website/src/components/workspace/WebsiteWorkspace.tsx:32,118-127,326`
- Modify: `apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx:544`
- Modify: `apps/website/src/lib/analytics/events.ts:23`

- [ ] **Step 1: Update the spec first**

Delete line 544 `expect(props.trackNarrativeAction).toBeTypeOf('function');`.

- [ ] **Step 2: Remove the code**

Remove `type TrackNarrativeAction,` from the import, the `trackNarrativeAction` constant (118-127), and the `trackNarrativeAction={trackNarrativeAction}` prop (326). Delete the `docsWorkspaceNarrativeAction` line in `events.ts`.

```bash
grep -rn "NarrativeAction\|narrative_action" apps/website/src
```

Expected: no output.

- [ ] **Step 3: Test and type-check**

Run: `cd apps/website && npx vitest run WebsiteWorkspace analytics && npx tsc -p tsconfig.json --noEmit && cd ../.. && npx nx lint website --skip-nx-cache`
Expected: PASS (the Website has no `typecheck` target; `tsc --noEmit` is the type gate).

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/workspace/WebsiteWorkspace.tsx apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx apps/website/src/lib/analytics/events.ts
git commit -m "refactor(website): drop the narrative-action analytics hook"
```

---

### Task 8: Contributor documentation

**Files:**
- Modify: `CONTRIBUTING.md` (new `##` section before "## Code review")

- [ ] **Step 1: Write the section**

```markdown
## Docs pages and example code

A docs page whose capability ships a runnable example (the page shows Run and
Code tabs) teaches through that example. Its code comes from the example
files, never from a hand-typed copy:

```mdx
<ExampleCode file="streaming.component.ts" />
<ExampleCode file="graph.py" region="stream-modes" title="Stream modes" />
```

- `file` is a basename or a repo-relative path among the capability's
  `codeAssetPaths` and `backendAssetPaths` in
  `libs/cockpit-registry/src/lib/content-descriptors.ts`. An unknown or
  ambiguous name fails the build.
- `region` names a marker pair in that file. Markers are `// #region name` …
  `// #endregion` in TypeScript, `# region name` … `# endregion` in Python,
  and `<!-- #region name -->` … `<!-- #endregion -->` in HTML. The marker
  lines are stripped and the slice is de-indented. Markers stay visible in the
  Code tab; keep the names meaningful.
- Hand-written fences stay allowed for fragments the example does not cover,
  such as another runtime's variant.

`apps/website/src/lib/docs-example-code.spec.ts` fails when a mapped page
includes nothing, when an include does not resolve, or when a docs-only page
uses the tag. Pages not yet rewritten sit in its `PENDING_PAGES` list; a page
that gains its first include must leave the list in the same change.
```

- [ ] **Step 2: Check the nested fence**

The section contains an inner ```` ```mdx ```` fence. When pasting into `CONTRIBUTING.md` it is a top-level block (not nested), so three backticks are correct. Confirm with `grep -c '^```' CONTRIBUTING.md` that the count is even.

- [ ] **Step 3: Commit**

```bash
git add CONTRIBUTING.md
git commit -m "docs(contributing): how docs pages include example code"
```

---

### Task 9: Whole-tree verification and PR

- [ ] **Step 1: Deletion safety**

```bash
grep -rn "narrativeDocs\|NarrativeDoc\b\|docsAssetPaths\|renderMarkdown\|render-markdown\|TrackNarrativeAction" libs apps scripts cockpit deployments --include='*.ts' --include='*.tsx' --include='*.mjs' | grep -v 'libs/chat/'
```

Expected: no output. (`libs/chat` has its own unrelated `renderMarkdown`.)

- [ ] **Step 2: Full test, lint, build**

```bash
npx nx run-many -t test,lint --projects=cockpit-registry,cockpit-shell,workspace-react,website --skip-nx-cache
rm -rf apps/website/.next && npx nx build website
npx nx test scripts --skip-nx-cache
```

Expected: all PASS; the build succeeds. Lint warnings are acceptable, errors are not.

- [ ] **Step 3: Confirm the walkthrough files are now untouched by code**

```bash
ls cockpit/*/*/*/docs/guide.md | wc -l
```

Expected: `40` — they stay on disk until each product PR absorbs them (spec §4).

- [ ] **Step 4: Open the PR**

```bash
git push -u origin blove/docs-example-first-infra
gh pr create --title "feat(docs): ExampleCode include + guards; retire the walkthrough renderer" --body-file - <<'EOF'
PR 1 of the example-first docs program (spec: docs/superpowers/specs/2026-09-05-docs-example-first-content-design.md).

- `<ExampleCode file= region= title=>` renders a page's example files through the docs MDX pipeline (same highlighting, copy button, styles). Unresolvable includes fail the build.
- Guard `apps/website/src/lib/docs-example-code.spec.ts`: mapped pages include their example (40 pending, streaming converted), includes resolve, docs-only pages never include.
- Deleted the never-rendered walkthrough machinery: `docsAssetPaths`, `renderMarkdown`, `NarrativeDocs`, `trackNarrativeAction`. The 40 `guide.md` files stay until each product PR absorbs them.

Verification: unit + lint on cockpit-registry, cockpit-shell, workspace-react, website; `nx build website`; mutation check (unknown file fails the build).

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
```

Then wait for the Website preview lane; open `/docs/langgraph/guides/streaming` on the aliased preview and confirm the "The running example" block shows highlighted code with a copy button and a `streaming.component.ts` title bar.
