# Docs and workspace unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One route family under `/docs`, a Website surface that never says "cockpit", and no infrastructure whose only purpose is the retired `cockpit.threadplane.ai` host.

**Architecture:** Three pull requests in order. Part A gives the six workspace-only capabilities their own docs pages so every manifest entry has a unique docs path, then deletes the `/workspace` route and the primary-capability override. Part B mechanically renames `data-cockpit-*`/`.cockpit-*` hooks to `data-workspace-*`/`.workspace-*`, fixes the remaining user-facing copy, and adds a word-guard. Part C deletes the redirect app, its Vercel config, smoke script, legacy-path resolution, three empty scaffold libraries, and the CI jobs and deploy-job steps that served it, relocating the four load-bearing scripts. Part D is a manual external cleanup after Part C is on main.

**Tech Stack:** Next.js app router (`apps/website`), React workspace shell (`libs/workspace-react`), registry (`libs/cockpit-registry`), vitest, Playwright, GitHub Actions with `node:test` workflow guards, Vercel REST API.

**Spec:** `docs/superpowers/specs/2026-09-04-docs-workspace-unification-design.md`

**Conventions the engineer must know:**

- Work in `/Users/blove/repos/angular-agent-framework/.claude/worktrees/pr-963-production-deploy-e76853`. Each part starts a fresh branch from `origin/main` (`git fetch origin main && git checkout -B <branch> origin/main`). Never `git stash`.
- Website unit tests: `npx nx test website --skip-nx-cache` from the root (targeted: `cd apps/website && npx vitest run <name>`; never `--root`; running from `apps/website` falsely fails `cockpit-retirement.spec.ts`, so always confirm from the root).
- Registry / shell unit tests: `npx nx run-many -t test --projects=cockpit-registry,cockpit-shell,cockpit-runtime-bridge,workspace-react --skip-nx-cache`.
- Workflow guards: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs scripts/ci-scope.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`.
- Website e2e locally: `npx nx e2e website --skip-nx-cache` (starts the dev server, three example apps, and the fixture; free ports 4300/4308/4321/4399/4506 first). Against a deployed target: `BASE_URL=https://threadplane.ai npx nx e2e website --skip-nx-cache`.
- Commit messages end with `Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>`. No SPDX headers. Run `npx prettier --write` on touched TS/TSX/MDX files before committing.
- PRs: `gh pr create --base main`, wait for `CI — required` plus the two preview lanes (`Website — e2e (deployed preview)`, `Cockpit — immutable preview smoke`), check `gh api repos/cacheplane/angular-agent-framework/pulls/<n>/comments` for AI review findings, then `gh pr merge <n> --squash`.

---

## File structure

| Part | File | Responsibility |
| --- | --- | --- |
| A | `libs/cockpit-registry/src/lib/docs-links.ts` | topic → docs path table; six entries change |
| A | `libs/cockpit-registry/src/lib/content-descriptors.ts` | per-capability `docsPath`; six entries change |
| A | `libs/cockpit-registry/src/lib/workspace-resolution.ts` | drop `PRIMARY_CAPABILITY_BY_DOCS_PATH`; destination is always the docs path |
| A | `libs/cockpit-registry/src/lib/validate-manifest.ts` | duplicate docs path is an error |
| A | `apps/website/src/lib/docs-config.ts` | six new `DocsPage` entries |
| A | `apps/website/content/docs/{langgraph,ag-ui,render}/guides/*.mdx` | six new pages |
| A | `apps/website/src/app/workspace/` | deleted |
| A | `apps/website/src/components/workspace/WebsiteWorkspace.tsx` | drop `routeKind` prop; documentation labels only |
| A | `apps/website/src/app/docs/page.tsx` | default example resolved by docs path |
| A | `apps/website/e2e/workspace-shell.spec.ts`, `apps/website/e2e/platform-production-smoke.spec.ts` | no workspace-only cases |
| B | `libs/workspace-react/src/**`, `apps/website/src/styles/docs.css`, `apps/website/e2e/*.spec.ts`, `apps/website/scripts/capture-screenshots*.ts` | mechanical hook/class rename |
| B | `apps/website/src/lib/cockpit-retirement.spec.ts` | word-guard for user-facing copy |
| C | `libs/cockpit-registry/src/lib/capability-registry.ts` (moved) | single source of truth for assembled examples |
| C | `scripts/examples/{serve-example,generate-combined-langgraph,runtime-wiring-audit}.ts` (moved) | developer tooling |
| C | `.github/workflows/ci.yml`, `scripts/ci-workflow.spec.mjs`, `scripts/ci-scope.mjs`, `scripts/ci-scope.spec.mjs` | cockpit jobs and steps removed |

---

# Part A — one route family

Branch: `blove/docs-one-route-family` from `origin/main`.

### Task A1: Give the six topics unique docs paths in the registry

**Files:**
- Modify: `libs/cockpit-registry/src/lib/docs-links.ts`
- Modify: `libs/cockpit-registry/src/lib/content-descriptors.ts` (lines 134, 314, 340, 367, 421, 656)
- Modify: `libs/cockpit-registry/src/lib/workspace-resolution.ts`
- Modify: `libs/cockpit-registry/src/lib/validate-manifest.ts`
- Modify: `libs/cockpit-registry/src/lib/workspace-resolution.spec.ts`
- Modify: `libs/cockpit-registry/src/lib/validate-manifest.spec.ts`

- [ ] **Step 1: Write the failing tests**

In `libs/cockpit-registry/src/lib/workspace-resolution.spec.ts`, replace the test `'uses an explicit primary capability for duplicate Docs paths, not manifest order'` (starts at line 72) with:

```ts
  it('gives every manifest entry a unique docs path so no override table is needed', () => {
    const seen = new Map<string, string>();
    for (const entry of cockpitManifest) {
      expect(entry.docsPath, entry.id).not.toBe('');
      const previous = seen.get(entry.docsPath);
      expect(previous, `${entry.id} shares ${entry.docsPath} with ${previous}`).toBeUndefined();
      seen.set(entry.docsPath, entry.id);
    }
    expect(
      resolveDocsWorkspace('/docs/langgraph/guides/durable-execution', 'Durable Execution')
    ).toMatchObject({
      kind: 'mapped',
      identity: {
        id: 'langgraph:core-capabilities:durable-execution:overview:python',
      },
    });
    expect(
      getWorkspaceDestinationPath({
        id: 'langgraph:core-capabilities:durable-execution:overview:python',
        docsPath: '/docs/langgraph/guides/durable-execution',
        workspacePath: '/workspace/langgraph/durable-execution',
      })
    ).toBe('/docs/langgraph/guides/durable-execution');
  });
```

Remove `PRIMARY_CAPABILITY_BY_DOCS_PATH` from that file's import list and add `getWorkspaceDestinationPath` if it is not already imported.

Replace the test `'omits Docs mode on a canonical Docs path and includes it on a secondary workspace path'` (starts at line 199) with:

```ts
  it('omits Docs mode on every canonical Docs path', () => {
    const primary = resolveLegacyPath(
      '/langgraph/core-capabilities/persistence/overview/python'
    );
    const secondary = resolveLegacyPath(
      '/langgraph/core-capabilities/durable-execution/overview/python'
    );
    expect(primary).not.toBeNull();
    expect(secondary).not.toBeNull();
    if (!primary || !secondary) return;

    expect(getCanonicalWebsiteWorkspaceHref(primary, 'Docs')).toBe(
      '/docs/langgraph/guides/persistence'
    );
    expect(getCanonicalWebsiteWorkspaceHref(secondary, 'Docs')).toBe(
      '/docs/langgraph/guides/durable-execution'
    );
    expect(getCanonicalWebsiteWorkspaceHref(secondary, 'Run')).toBe(
      '/docs/langgraph/guides/durable-execution?mode=run'
    );
    expect(getCanonicalWebsiteWorkspaceHref(primary, 'Code')).toBe(
      '/docs/langgraph/guides/persistence?mode=code'
    );
  });
```

In `libs/cockpit-registry/src/lib/validate-manifest.spec.ts`, replace the test `'rejects ambiguous reverse Docs mappings without an explicit primary mapping'` (starts at line 125) with:

```ts
  it('rejects two entries that publish the same Docs path', () => {
    const first = getLangGraphEntry('streaming');
    const second = getLangGraphEntry('interrupts');
    const invalidManifest = [first, { ...second, docsPath: first.docsPath }];

    expect(validateManifest(invalidManifest)).toContain(
      `Duplicate Docs path: ${first.docsPath}`
    );
  });

  it('rejects an entry without a Docs path', () => {
    const entry = getLangGraphEntry('streaming');

    expect(validateManifest([{ ...entry, docsPath: '' }])).toContain(
      `Missing docsPath for ${entry.id}`
    );
  });
```

Remove `PRIMARY_CAPABILITY_BY_DOCS_PATH` from that file's imports.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx nx test cockpit-registry --skip-nx-cache 2>&1 | grep -E "×|✓ .*unique docs|Tests |FAIL" | head`
Expected: the new tests fail (duplicate docs paths exist; `Duplicate Docs path` is not emitted).

- [ ] **Step 3: Point the six topics at their own pages**

In `libs/cockpit-registry/src/lib/docs-links.ts`, change these six values (keep the keys; delete the comments that explained the sharing):

```ts
  'langgraph/core-capabilities/durable-execution':
    '/docs/langgraph/guides/durable-execution',
  ...
  'ag-ui/core-capabilities/tool-views': '/docs/ag-ui/guides/tool-views',
  'ag-ui/core-capabilities/json-render': '/docs/ag-ui/guides/json-render',
  'ag-ui/core-capabilities/client-tools': '/docs/ag-ui/guides/client-tools',
  'ag-ui/core-capabilities/subagents': '/docs/ag-ui/guides/subagents',
  ...
  'render/core-capabilities/repeat-loops': '/docs/render/guides/repeat-loops',
```

In `libs/cockpit-registry/src/lib/content-descriptors.ts`, change the `docsPath` of the six descriptors to the same six values (`langgraph-durable-execution-python` line 134, `ag-ui-tool-views-python` line 314, `ag-ui-json-render-python` line 340, `ag-ui-client-tools-python` line 367, `ag-ui-subagents-python` line 421, `render-repeat-loops-python` line 656).

- [ ] **Step 4: Remove the override table**

In `libs/cockpit-registry/src/lib/workspace-resolution.ts`:

Delete the `PRIMARY_CAPABILITY_BY_DOCS_PATH` constant and its doc comment.

Replace `getWorkspaceDestinationPath` with:

```ts
export const getWorkspaceDestinationPath = (
  identity: Pick<WorkspaceIdentity, 'id' | 'docsPath' | 'workspacePath'>
): string => {
  if (!identity.docsPath) {
    throw new Error(`Manifest entry without a docs path: ${identity.id}`);
  }
  return identity.docsPath;
};
```

Replace `resolveDocsWorkspace` with:

```ts
export const resolveDocsWorkspace = (
  docsPath: string,
  title: string,
  manifest: readonly CockpitManifestEntry[] = cockpitManifest
): WorkspaceResolution => {
  const matches = manifest.filter((entry) => entry.docsPath === docsPath);
  if (matches.length === 1) return mapped(matches[0]);
  if (matches.length > 1) {
    throw new Error(
      `Docs path ${docsPath} is published by ${matches.length} manifest entries`
    );
  }

  return {
    kind: 'docs-only',
    docsPath,
    title,
    unavailableReason: 'no-workspace-capability',
  };
};
```

In `libs/cockpit-registry/src/lib/validate-manifest.ts`:

- Delete the `import { PRIMARY_CAPABILITY_BY_DOCS_PATH }` line, the `ValidateManifestOptions` interface, the `options` parameter, and the `primaryDocsMappings` constant.
- Replace the block from `const docsPathEntries = new Map` through the closing of the `for (const [docsPath, entries] ...)` loop with:

```ts
  const docsPaths = new Set<string>();
  for (const entry of manifest) {
    if (!entry.docsPath) {
      errors.push(`Missing docsPath for ${entry.id}`);
      continue;
    }
    if (docsPaths.has(entry.docsPath)) {
      errors.push(`Duplicate Docs path: ${entry.docsPath}`);
    } else {
      docsPaths.add(entry.docsPath);
    }
  }
```

Keep the signature `validateManifest(manifest)`; grep for callers passing a second argument (`git grep -n "validateManifest(" -- libs apps scripts`) and drop the argument where present.

- [ ] **Step 5: Run the registry tests**

Run: `npx nx test cockpit-registry --skip-nx-cache 2>&1 | tail -4`
Expected: `Successfully ran target test for project cockpit-registry`.

- [ ] **Step 6: Commit**

```bash
git add libs/cockpit-registry
git commit -m "feat(registry): every capability publishes a unique docs path

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A2: Register and author the six docs pages

**Files:**
- Modify: `apps/website/src/lib/docs-config.ts`
- Create: `apps/website/content/docs/langgraph/guides/durable-execution.mdx`
- Create: `apps/website/content/docs/ag-ui/guides/client-tools.mdx`
- Create: `apps/website/content/docs/ag-ui/guides/tool-views.mdx`
- Create: `apps/website/content/docs/ag-ui/guides/json-render.mdx`
- Create: `apps/website/content/docs/ag-ui/guides/subagents.mdx`
- Create: `apps/website/content/docs/render/guides/repeat-loops.mdx`

- [ ] **Step 1: Write the failing test**

Append to `apps/website/src/lib/docs.spec.ts` (inside its top-level `describe`; if the file has none, wrap in `describe('docs pages', ...)`):

```ts
  it('publishes a docs page for every capability the registry maps', () => {
    const configured = new Set(
      docsLibraries.flatMap((library) =>
        library.sections.flatMap((section) =>
          section.pages.map(
            (page) => `/docs/${library.id}/${section.id}/${page.slug}`
          )
        )
      )
    );
    for (const entry of cockpitManifest) {
      expect(configured.has(entry.docsPath), entry.docsPath).toBe(true);
      const file = path.join(
        process.cwd(),
        'apps/website/content',
        `${entry.docsPath}.mdx`
      );
      expect(fs.existsSync(file), file).toBe(true);
    }
  });
```

Add the imports the file lacks: `import fs from 'node:fs'; import path from 'node:path'; import { cockpitManifest } from '@threadplane/cockpit-registry'; import { docsLibraries } from './docs-config';` (check the actual export name of the libraries array at the top of `docs-config.ts` and use it).

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx nx test website --skip-nx-cache 2>&1 | grep -E "publishes a docs page|Tests " | head -3`
Expected: the new test fails on `/docs/langgraph/guides/durable-execution`.

- [ ] **Step 3: Register the pages**

In `apps/website/src/lib/docs-config.ts`:

- LangGraph `guides` section, after `{ title: 'Persistence', slug: 'persistence', section: 'guides' },`:
  `{ title: 'Durable Execution', slug: 'durable-execution', section: 'guides' },`
- AG-UI `guides` section, after `{ title: 'Interrupts', slug: 'interrupts', section: 'guides' },`:
  ```ts
          { title: 'Client Tools', slug: 'client-tools', section: 'guides' },
          { title: 'Tool Views', slug: 'tool-views', section: 'guides' },
          { title: 'JSON Render', slug: 'json-render', section: 'guides' },
          { title: 'Subagents', slug: 'subagents', section: 'guides' },
  ```
- Render `guides` section, after `{ title: 'Specs & Elements', slug: 'specs', section: 'guides' },`:
  `{ title: 'Repeat Loops', slug: 'repeat-loops', section: 'guides' },`

- [ ] **Step 4: Author the pages**

Existing guides start with an H1 and prose (no frontmatter is required; `docs.ts` strips one if present). Create each file with this shape, substituting the bracketed parts:

`apps/website/content/docs/langgraph/guides/durable-execution.mdx`:

```mdx
# Durable Execution

Durable execution keeps a LangGraph run alive across process restarts and long waits. The checkpointer records every super-step, so a run that is interrupted, redeployed, or paused for a human can resume from its last checkpoint instead of starting over.

This page is the live example for durable execution. Use **Run** to drive the agent, **Code** to read the Angular and Python sources, and **API** for the extracted reference. The checkpointer configuration the example relies on is written up in the [Persistence guide](/docs/langgraph/guides/persistence).
```

`apps/website/content/docs/ag-ui/guides/client-tools.mdx`:

```mdx
# Client Tools

An AG-UI agent can call tools that live in the browser. The Angular app declares the tool, the adapter forwards the agent's call, and the result flows back into the run without a server round trip.

This page is the live example for client tools over AG-UI. Use **Run** to drive the agent, **Code** to read the Angular and Python sources, and **API** for the extracted reference. The browser-side tool contract is documented in the [Chat client tools guide](/docs/chat/guides/client-tools).
```

`apps/website/content/docs/ag-ui/guides/tool-views.mdx`:

```mdx
# Tool Views

Tool views render an AG-UI tool call as a purpose-built component instead of a generic card: a map for a location lookup, a table for a query, a form for a confirmation.

This page is the live example for tool views. Use **Run** to drive the agent, **Code** to read the Angular and Python sources, and **API** for the extracted reference. The tool-call component surface is documented in [ChatToolCalls](/docs/chat/components/chat-tool-calls).
```

`apps/website/content/docs/ag-ui/guides/json-render.mdx`:

```mdx
# JSON Render

An AG-UI agent can stream a declarative UI specification that `@threadplane/render` turns into a live Angular component tree, so the agent shapes the interface rather than only its text.

This page is the live example for JSON rendering over AG-UI. Use **Run** to drive the agent, **Code** to read the Angular and Python sources, and **API** for the extracted reference. The rendering engine is introduced in the [Render introduction](/docs/render/getting-started/introduction).
```

`apps/website/content/docs/ag-ui/guides/subagents.mdx`:

```mdx
# Subagents

AG-UI carries subagent activity as first-class events, so a delegating agent's child runs show up as attributed cards with their own tool calls and messages instead of being folded into the parent transcript.

This page is the live example for subagents over AG-UI. Use **Run** to drive the agent, **Code** to read the Angular and Python sources, and **API** for the extracted reference. The card component is documented in [ChatSubagentCard](/docs/chat/components/chat-subagent-card).
```

`apps/website/content/docs/render/guides/repeat-loops.mdx`:

```mdx
# Repeat Loops

A repeat loop renders one element per item of a bound collection, with `$item` and `$index` available to child expressions, so a spec can describe a list without enumerating its rows.

This page is the live example for repeat loops. Use **Run** to drive the agent, **Code** to read the Angular and Python sources, and **API** for the extracted reference. The spec format, including the repeat element, is documented in [Specs & Elements](/docs/render/guides/specs).
```

- [ ] **Step 5: Run the Website unit tests**

Run: `npx nx test website --skip-nx-cache 2>&1 | tail -3`
Expected: `Successfully ran target test for project website`. If `public-copy.spec.ts` or `angular-support-copy.spec.ts` flags a phrase in the new pages, reword to satisfy it; do not touch the guard.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/lib/docs-config.ts apps/website/src/lib/docs.spec.ts apps/website/content/docs
git commit -m "docs: give the six workspace-only capabilities their own guides

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task A3: Delete the `/workspace` route and the workspace route kind in the Website

**Files:**
- Delete: `apps/website/src/app/workspace/[product]/[topic]/page.tsx`, `apps/website/src/app/workspace/[product]/[topic]/page.spec.tsx`
- Modify: `apps/website/src/components/workspace/WebsiteWorkspace.tsx`
- Modify: `apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx`
- Modify: `apps/website/src/lib/workspace-page.ts` (remove `getWebsiteWorkspaceRoutePage` if nothing else uses it)
- Modify: `apps/website/src/app/docs/page.tsx`
- Modify: `apps/website/e2e/workspace-shell.spec.ts`
- Modify: `apps/website/e2e/platform-production-smoke.spec.ts`

- [ ] **Step 1: Update the Website unit tests first**

In `apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx`:

- Delete the tests `'uses host-neutral labels and no fabricated Docs slot on workspace routes'` (line 382), `'restores the canonical workspace Docs mode on reload'` (line 510), and `'uses workspace routes only when Docs are absent or would lose identity'` (line 538).
- In `'serializes Docs mode explicitly on workspace routes and keeps the selected mode synchronized'` (line 475): rename to `'keeps the selected mode synchronized on a docs route'`; change the fourth `mappedResolution` argument to `'/docs/langgraph/guides/durable-execution'`; replace every `/workspace/langgraph/durable-execution` with `/docs/langgraph/guides/durable-execution`; delete the `routeKind: 'workspace',` line; change the expected push to `'/docs/langgraph/guides/durable-execution'` (Docs mode on a docs route serializes without a query) and the expected `requestedMode` to `null`.
- In `'keeps workspace mode state aligned across Back and Forward history entries'` (line 788): same path substitutions, delete `routeKind: 'workspace',`, and replace the two `?mode=docs` URLs with the bare docs path.
- Add, after the deleted line-538 test's former position:

```ts
  it('always links a capability to its docs path', () => {
    renderWorkspace();
    const resolveHref = mocks.latestProviderProps?.resolveIdentityHref;
    if (!resolveHref) throw new Error('Expected Website identity resolver');

    expect(
      resolveHref({
        id: 'langgraph:core-capabilities:durable-execution:overview:python',
        docsPath: '/docs/langgraph/guides/durable-execution',
        workspacePath: '/workspace/langgraph/durable-execution',
      } as never)
    ).toBe('/docs/langgraph/guides/durable-execution');
  });
```

- Anywhere else in the file that passes `routeKind: 'workspace'` or asserts `routeKind` on provider props, remove it.

- [ ] **Step 2: Run to verify they fail**

Run: `cd apps/website && npx vitest run WebsiteWorkspace 2>&1 | grep -E "×|Tests " | head`
Expected: the edited tests fail (the component still labels workspace routes and pushes `?mode=docs` on the old path).

- [ ] **Step 3: Simplify `WebsiteWorkspace.tsx`**

- Delete `readonly routeKind?: 'docs' | 'workspace';` (line 54) and `routeKind = 'docs',` (line 175) and `const isWorkspaceRoute = routeKind === 'workspace';` (line 182).
- Replace `routeKind={routeKind}` (line 319) with `routeKind="docs"`.
- Replace the five conditional labels (lines 340–353) with their documentation branch: `'Documentation workspace'`, `'Documentation modes'`, `'Documentation context'`, `'Documentation control plane'`, `'Documentation'`.
- Remove `props.routeKind,` from the memo dependency list (line 481).

- [ ] **Step 4: Delete the route and its helper**

```bash
git rm -r "apps/website/src/app/workspace"
```

In `apps/website/src/lib/workspace-page.ts`, delete `getWebsiteWorkspaceRoutePage` (lines 40–53) if `git grep -n getWebsiteWorkspaceRoutePage -- apps libs` shows no remaining caller.

In `apps/website/src/app/docs/page.tsx`, replace the `DEFAULT_EXAMPLE_RESOLUTION` line and its comment with:

```ts
/**
 * The example the index's Run rail item opens, resolved through the registry
 * so a renamed or removed capability yields null and Run falls back to
 * disabled rather than to a dead link.
 */
const DEFAULT_EXAMPLE_RESOLUTION = resolveDocsWorkspace(
  '/docs/langgraph/guides/streaming',
  'Streaming'
);
```

and update the import from `@threadplane/cockpit-registry` (`resolveWorkspacePath` → `resolveDocsWorkspace`). `getCanonicalWebsiteWorkspaceHref` accepts either resolution kind, so the following lines stay.

- [ ] **Step 5: Update the e2e specs**

In `apps/website/e2e/workspace-shell.spec.ts`: change line 7 to `const durableExecutionDocsPath = '/docs/langgraph/guides/durable-execution';` and replace the test `'uses workspace fallbacks only when a shared Docs path would lose identity'` (line 412) with:

```ts
  test('serves the formerly workspace-only capabilities as docs pages with Run available', async ({
    page,
  }) => {
    const response = await page.goto(durableExecutionDocsPath);
    expect(response?.status()).toBe(200);
    await expect(page).toHaveURL(durableExecutionDocsPath);
    await expect(page.locator('[data-workspace-shell]')).toHaveAttribute(
      'aria-label',
      'Documentation workspace'
    );
    await expectMode(page, 'Docs');
    await modeButton(page, 'Run').click();
    await expect(page).toHaveURL(`${durableExecutionDocsPath}?mode=run`);
    await expect(
      page.locator('iframe[title="LangGraph Durable Execution live example"]')
    ).toBeAttached();

    const missing = await page.goto('/workspace/langgraph/durable-execution');
    expect(missing?.status()).toBe(404);
  });
```

(Confirm the iframe title by reading the entry's `title` in `libs/cockpit-registry/src/lib/manifest.ts`; the frame title is `${entryTitle} live example`.)

In `apps/website/e2e/platform-production-smoke.spec.ts`: delete the `workspaceOnly` lookup (lines 143–145), change the throw to `if (!docsBacked) throw new Error('Production smoke requires a Docs-backed route');`, and delete the `'workspace-only production redirect'` case (lines 165–170). Leave the rest; Part C removes the whole redirect block.

In `apps/cockpit/scripts/deploy-smoke.ts` (still deployed until Part C): `buildPreviewCases` (around line 239) and `buildProductionCases` (around line 288) each look up a workspace-only entry with `getWorkspaceDestinationPath(entry).startsWith('/workspace/')` and throw when none exists. Delete those lookups and the cases built from them (`'workspace Docs serialization'` in preview mode; `'workspace-only production redirect'` in production mode), and change the production guard to `if (!docsBacked) throw new Error('Redirect smoke requires a Docs-backed route');`. Update `apps/cockpit/scripts/deploy-smoke.spec.ts` so no assertion expects those two cases (the `'workspace Docs serialization'` `expect(...some(...))` and any `workspace-only` label check), then run `cd apps/cockpit && npx vitest run deploy-smoke` → all passing, and `npx tsx apps/cockpit/scripts/deploy-smoke.ts --url https://cockpit.threadplane.ai --mode preview --dry-run` → prints a `dry-run:preview:…` line.

Also in this task:
- `libs/cockpit-registry/src/lib/manifest.types.ts`: change `WorkspaceIdentity.docsPath` from `string | null` to `string`, and in `workspace-resolution.ts` `toWorkspaceIdentity` use `docsPath: entry.docsPath` (drop `|| null`). Fix any type errors this surfaces (they will be sites that handled `null`; delete the null branch).
- `.github/workflows/ci.yml`, job `cockpit`: add `cockpit-shell` to the `run-many` project list (`--projects=cockpit,cockpit-docs,cockpit-registry,cockpit-shell,workspace-react`) so the fixture updated in A1 is actually verified by CI; update the guard test `'runs the cockpit sibling libraries that own vitest specs'` in `scripts/ci-workflow.spec.mjs` to expect it.

- [ ] **Step 6: Verify**

Run: `npx nx test website --skip-nx-cache 2>&1 | tail -3` → success.
Run: `npx nx run-many -t test --projects=cockpit,cockpit-registry,cockpit-shell,workspace-react --skip-nx-cache 2>&1 | tail -3` → success (`cockpit` covers the deploy smoke).
Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"` → `# fail 0`.
Run: `npx nx lint website --skip-nx-cache 2>&1 | grep problems` → `0 errors`.
Run: `npx nx build website --skip-nx-cache 2>&1 | tail -3` → success (static params for the six pages generate).
Run: `npx nx e2e website --skip-nx-cache 2>&1 | grep -E "passed|failed"` → all passed.

- [ ] **Step 7: Commit and open the PR**

```bash
git add -A apps/website
git commit -m "feat(website): retire the /workspace route; every capability is a docs page

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin blove/docs-one-route-family
gh pr create --base main --title "feat: one route family — every capability is a docs page" --body "Part A of docs/superpowers/specs/2026-09-04-docs-workspace-unification-design.md. Six formerly workspace-only capabilities get their own guides; the /workspace route and the primary-capability override table are deleted. Follow-ups: Part B (surface rename), Part C (redirect service retirement)."
```

Wait for green (including `Website — e2e (deployed preview)`), address review comments, merge with `gh pr merge --squash`.

---

# Part B — surface rename

Branch: `blove/workspace-surface-rename` from `origin/main` (after Part A merged).

### Task B1: Word-guard for user-facing copy (test first)

**Files:**
- Modify: `apps/website/src/lib/cockpit-retirement.spec.ts`

- [ ] **Step 1: Add the guard**

Append inside `describe('Cockpit surface retirement', ...)`:

```ts
  it('keeps the retired product name out of user-facing Website copy', () => {
    const USER_FACING = /\.(?:mdx|md|tsx)$/;
    const ALLOWED_TOKENS = [
      /cockpit\/[a-z-]+\/[a-z-]+/g, // example repository paths
      /apps\/cockpit\//g, // tooling paths (removed by Part C)
      /@threadplane\/cockpit-[a-z-]+/g, // package names
      /cockpit-[a-z-]+-angular/g, // Nx project names
      /cockpit-(?:registry|shell|runtime-bridge|telemetry|docs|testing|ui)/g,
      /cockpit_(?:did|cap|phk|host)/g, // runtime bridge query params
      /Cockpit(?:ManifestEntry|ManifestIdentity)/g, // type names
      /cockpit-retirement/g, // this guard's own file name
    ];
    const sources = sourceFiles(WEBSITE_ROOT)
      .filter((path) => USER_FACING.test(path))
      .map((path) => ({
        relativePath: relative(WEBSITE_ROOT, path),
        content: readFileSync(path, 'utf8'),
      }));

    const violations = sources.flatMap(({ relativePath, content }) =>
      content.split('\n').flatMap((line, index) => {
        let scrubbed = line;
        for (const token of ALLOWED_TOKENS) scrubbed = scrubbed.replace(token, '');
        return /cockpit/i.test(scrubbed) ? [`${relativePath}:${index + 1}`] : [];
      })
    );

    expect(violations).toEqual([]);
  });
```

- [ ] **Step 2: Run it to see the current violations**

Run: `cd apps/website && npx vitest run cockpit-retirement 2>&1 | grep -A20 "user-facing Website copy" | head -30`
Expected: FAIL listing at least `content/blog/2026-05-17-...mdx:287`, `content/docs/chat/getting-started/introduction.mdx:47`, `src/app/pilot-to-prod/page.tsx:111`, and any TSX carrying `data-cockpit-`/`cockpit-` class strings. Keep this list; Tasks B2 and B3 clear it.

- [ ] **Step 3: Commit the failing guard**

```bash
git add apps/website/src/lib/cockpit-retirement.spec.ts
git commit -m "test(website): guard user-facing copy against the retired product name

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task B2: Mechanical hook and class rename

**Files:** every file listed by `git grep -l "data-cockpit-\|\.cockpit-\|cockpit-\(control-plane\|prose\|shell\|file-tree\|nav-\|tab-trigger\|mobile-\|tablet-\|runtime-status\|code-pane\|api-heading\)" -- apps/website libs/workspace-react`, excluding `package.json`, `tsconfig*.json`, `src/index.ts` (those match package names, not hooks).

- [ ] **Step 1: Apply the rename with an explicit token map**

Save as `/private/tmp/claude-501/rename-cockpit-hooks.py` and run from the repo root with `python3`:

```python
import re, subprocess, pathlib
files = subprocess.check_output(['git','grep','-l','-E',
  r'data-cockpit-|\.cockpit-|cockpit-(control-plane|prose|shell|file-tree|nav-|tab-trigger|mobile-|tablet-|runtime-status|code-pane|api-heading)',
  '--','apps/website','libs/workspace-react']).decode().split()
skip = re.compile(r'(package\.json|tsconfig[^/]*\.json|src/index\.ts)$')
attrs = ['context-content','desktop-navigation','activity-attention','activity-icon','utility','control-plane']
classes = ['control-plane-theme','control-plane-scope','control-plane','prose--wide','prose--code','prose',
  'file-tree','shell-navigation','shell','mobile-control-plane-header','mobile-control-plane-close',
  'mobile-control-plane-panel','mobile-control-plane','mobile-navigation-trigger','tablet-context-trigger',
  'tablet-context-surface','nav-caret--open','nav-caret','nav-item','tab-trigger','runtime-status-loader',
  'code-pane','api-heading']
for f in files:
    if skip.search(f): continue
    p = pathlib.Path(f); s = p.read_text(); o = s
    s = s.replace('data-cockpit-workspace', 'data-workspace-surface')
    for a in attrs: s = s.replace(f'data-cockpit-{a}', f'data-workspace-{a}')
    for c in classes: s = re.sub(rf'(?<![\w-])cockpit-{re.escape(c)}(?![\w-])', f'workspace-{c}', s)
    if s != o: p.write_text(s); print('rewrote', f)
```

`data-cockpit-workspace` becomes `data-workspace-surface` because `data-workspace-shell` already exists and `data-workspace-workspace` would be nonsense. Class tokens are matched as whole identifiers, longest first, so `cockpit-control-plane-theme` is not partially rewritten by `cockpit-control-plane`.

- [ ] **Step 2: Inspect the residue**

Run: `git grep -n "data-cockpit-\|\.cockpit-" -- apps/website libs/workspace-react`
Expected: no output. Then `git grep -n "cockpit-" -- apps/website/src/styles libs/workspace-react/src/styles` → no output.

Run: `git diff --stat | tail -1` and read a few hunks (`git diff libs/workspace-react/src/lib/workspace-shell.tsx | head -60`) to confirm only hook and class strings changed.

- [ ] **Step 3: Rename the screenshot assets and copy**

```bash
git mv apps/website/public/screenshots/cockpit-run.webp apps/website/public/screenshots/workspace-run.webp
git mv apps/website/public/screenshots/cockpit-code.webp apps/website/public/screenshots/workspace-code.webp
git mv apps/website/public/screenshots/cockpit-docs.webp apps/website/public/screenshots/workspace-docs.webp
git mv apps/website/public/screenshots/cockpit-api.webp apps/website/public/screenshots/workspace-api.webp
```

- `apps/website/src/app/pilot-to-prod/page.tsx:111`: `src="/screenshots/workspace-run.webp"`.
- `apps/website/scripts/capture-screenshots.ts` lines 51–60: `name: 'workspace-run'`, `'workspace-code'`, `'workspace-docs'`, `'workspace-api'`; `capture-screenshots.spec.ts` lines 55–56 likewise, and line 42 expects `'[data-workspace-surface]'` (the script's constant was rewritten in Step 1).
- `libs/workspace-react/src/lib/components/sidebar/navigation-groups.tsx:134`: `aria-label="Documentation navigation"`; its spec line 221 expects `'Documentation navigation'`.
- `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx:287`: replace `[cockpit chat example]` with `[chat quickstart example]`.
- `apps/website/content/docs/chat/getting-started/introduction.mdx:47`: replace `Debug cockpit from` with `Debug panel from`.

- [ ] **Step 4: Verify**

Run: `cd apps/website && npx vitest run cockpit-retirement 2>&1 | grep -E "×|Tests "` → all passing (the guard is green).
Run: `npx nx test website --skip-nx-cache 2>&1 | tail -3` → success (`style-contracts.spec.ts` now reads `.workspace-shell`).
Run: `npx nx run-many -t test --projects=workspace-react --skip-nx-cache 2>&1 | tail -3` → success.
Run: `npx nx lint website --skip-nx-cache 2>&1 | grep problems` → `0 errors`.
Run: `npx nx e2e website --skip-nx-cache 2>&1 | grep -E "passed|failed"` → all passed (selectors were rewritten with the markup).

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A apps/website libs/workspace-react
git commit -m "refactor(website): the workspace surface no longer says cockpit

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin blove/workspace-surface-rename
gh pr create --base main --title "refactor: workspace surface rename — hooks, classes, labels, assets" --body "Part B of docs/superpowers/specs/2026-09-04-docs-workspace-unification-design.md. Mechanical data-cockpit-* → data-workspace-* and .cockpit-* → .workspace-* rename with e2e selectors, 'Documentation navigation' aria-label, screenshot assets, two prose fixes, and a word-guard in cockpit-retirement.spec.ts. Internal package, project, and CI names unchanged."
```

Wait for green (the preview lane proves the renamed selectors against a deployed preview), address comments, merge.

---

# Part C — retire the redirect service in the repo

Branch: `blove/retire-cockpit-redirect` from `origin/main` (after Part B merged).

### Task C1: Relocate the load-bearing scripts

**Files:**
- Move: `apps/cockpit/scripts/capability-registry.ts` → `libs/cockpit-registry/src/lib/capability-registry.ts`
- Move: `apps/cockpit/scripts/serve-example.ts`, `serve-example.spec.ts`, `generate-combined-langgraph.ts` → `scripts/examples/`
- Move: `apps/cockpit/runtime-wiring-audit.ts`, `cockpit-capability-wiring.spec.ts`, `cockpit-e2e-wiring.spec.ts` → `scripts/examples/`
- Modify: `libs/cockpit-registry/src/index.ts`, `scripts/assemble-examples.ts`, `scripts/generate-ag-ui-deployment-config.ts`, `scripts/cockpit-runtime-bridge-coverage.spec.mjs`, `scripts/ci-scope.spec.mjs`, `.github/workflows/deploy-ag-ui.yml`, `.github/workflows/deploy-langgraph.yml`, `scripts/vite.config.mts`, three quickstart MDX files, three `cockpit/runtimes/**/docs/guide.md`, `deployments/ag-ui-dev/README.md`, two `deployments/ag-ui-dev/deps/**/docs/guide.md`, `deployments/ag-ui-mastra/README.md`

- [ ] **Step 1: Move the files**

```bash
git mv apps/cockpit/scripts/capability-registry.ts libs/cockpit-registry/src/lib/capability-registry.ts
mkdir -p scripts/examples
git mv apps/cockpit/scripts/serve-example.ts scripts/examples/serve-example.ts
git mv apps/cockpit/scripts/serve-example.spec.ts scripts/examples/serve-example.spec.ts
git mv apps/cockpit/scripts/generate-combined-langgraph.ts scripts/examples/generate-combined-langgraph.ts
git mv apps/cockpit/runtime-wiring-audit.ts scripts/examples/runtime-wiring-audit.ts
git mv apps/cockpit/cockpit-capability-wiring.spec.ts scripts/examples/capability-wiring.spec.ts
git mv apps/cockpit/cockpit-e2e-wiring.spec.ts scripts/examples/e2e-wiring.spec.ts
```

- [ ] **Step 2: Fix imports and exports**

- `libs/cockpit-registry/src/lib/capability-registry.ts`: change `import type { RuntimeAdapter } from '@threadplane/cockpit-registry';` to `import type { RuntimeAdapter } from './manifest.types';` (confirm `RuntimeAdapter` is declared there with `git grep -n "export type RuntimeAdapter" libs/cockpit-registry`).
- `libs/cockpit-registry/src/index.ts`: add `export * from './lib/capability-registry';`.
- `scripts/examples/serve-example.ts`, `serve-example.spec.ts`, `generate-combined-langgraph.ts`, `capability-wiring.spec.ts`, `e2e-wiring.spec.ts`: replace `from './capability-registry'` / `from './scripts/capability-registry'` with `from '@threadplane/cockpit-registry'`; in `e2e-wiring.spec.ts` keep `from '../../cockpit/ports.mjs'` (same depth as before); in the two wiring specs replace `from './runtime-wiring-audit'` with `from './runtime-wiring-audit'` (unchanged, now siblings) and check any `resolve(__dirname, '../..')`-style repo-root computations still land on the repo root (both `apps/cockpit` and `scripts/examples` are two levels deep).
- `scripts/assemble-examples.ts:21` and `scripts/generate-ag-ui-deployment-config.ts:3`: import from `'@threadplane/cockpit-registry'` (these run under `tsx`; confirm `tsconfig.base.json` paths resolve for tsx by running the script in Step 5).
- `scripts/cockpit-runtime-bridge-coverage.spec.mjs:10`: `'libs/cockpit-registry/src/lib/capability-registry.ts'`.
- `scripts/ci-scope.spec.mjs:440`: `'libs/cockpit-registry/src/lib/capability-registry.ts'`, and change that test's project fixture from `{ name: 'cockpit', tags: COCKPIT_APP_TAGS }` to the registry lib's tags: `{ name: 'cockpit-registry', tags: ['scope:cockpit', 'scope:cockpit-e2e', 'scope:cockpit-examples'] }` and drop the `cockpit_deploy_smoke` assertion.
- `.github/workflows/deploy-ag-ui.yml` and `deploy-langgraph.yml` path filters: `- 'libs/cockpit-registry/src/lib/capability-registry.ts'`.
- `scripts/vite.config.mts`: ensure `include` covers `examples/**/*.spec.ts` (read the file; add the glob if the existing patterns do not match `scripts/examples/*.spec.ts`).
- Docs and READMEs: replace `apps/cockpit/scripts/serve-example.ts` with `scripts/examples/serve-example.ts` in `apps/website/content/docs/runtimes/{aws-strands,mastra,microsoft-agent-framework}/quickstart.mdx`, `cockpit/runtimes/{aws-strands/python,mastra/angular,microsoft-agent-framework/python}/docs/guide.md`, `deployments/ag-ui-dev/deps/{aws_strands,microsoft_agent_framework}/docs/guide.md`, `deployments/ag-ui-mastra/README.md`; and `apps/cockpit/scripts/capability-registry.ts` with `libs/cockpit-registry/src/lib/capability-registry.ts` in `deployments/ag-ui-dev/README.md`.

- [ ] **Step 3: Verify the moves**

Run: `git grep -n "apps/cockpit/scripts\|apps/cockpit/runtime-wiring-audit" -- . ':!docs/superpowers'` → no output.
Run: `npx nx test scripts --skip-nx-cache 2>&1 | tail -3` → success, and confirm the three moved specs ran: `npx nx test scripts --skip-nx-cache 2>&1 | grep -E "serve-example|capability-wiring|e2e-wiring"`.
Run: `npx nx test cockpit-registry --skip-nx-cache 2>&1 | tail -3` → success.
Run: `node --test --test-reporter=tap scripts/ci-scope.spec.mjs scripts/cockpit-runtime-bridge-coverage.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"` → `# fail 0` (the `apps/cockpit/project.json` tests still pass because the app still exists at this step).
Run: `npx tsx scripts/examples/serve-example.ts --help 2>&1 | head -3` → usage text, no module-resolution error.
Run: `npx tsx scripts/generate-ag-ui-deployment-config.ts --help 2>&1 | head -3` or the script's dry-run flag → runs.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "refactor: move the capability registry into cockpit-registry and example tooling into scripts/examples

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task C2: Delete the redirect app, legacy-path resolution, scaffolds, and the retired CORS origin

**Files:**
- Delete: `apps/cockpit/` (everything remaining), `vercel.cockpit.json`, `libs/cockpit-docs/`, `libs/cockpit-testing/`, `libs/cockpit-ui/`
- Modify: `tsconfig.base.json` (lines 26, 38, 39), `apps/website/tsconfig.json` (line 23)
- Modify: `libs/cockpit-registry/src/lib/manifest.types.ts`, `manifest.ts`, `validate-manifest.ts`, `validate-manifest.spec.ts`, `workspace-resolution.ts`, `workspace-resolution.spec.ts`
- Modify: `libs/workspace-react/src/lib/workspace-provider.tsx`, `workspace-provider.spec.tsx`, `workspace-shell.spec.tsx`
- Modify: `apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx:106`, `apps/website/e2e/platform-production-smoke.spec.ts`
- Modify: `scripts/ag-ui-proxy.ts:54`, `scripts/examples-middleware.ts:18`

- [ ] **Step 1: Write the failing tests**

In `libs/cockpit-registry/src/lib/validate-manifest.spec.ts`: remove the `['legacy path', 'legacyPath', 'Duplicate legacy path']` row from the `it.each` at line 111 and the `['legacyPath', ...]` row from the `it.each` at line 143.

In `libs/cockpit-registry/src/lib/workspace-resolution.spec.ts`: delete the tests that call `resolveLegacyPath` or `resolveLegacyRequestMode` (`'round-trips canonical workspace and legacy paths'` line 26 — keep only its workspace half if it has one, else delete; `'applies the legacy Cockpit default…'` line 135; `'resolves valid legacy modes…'` line 163; `'omits Docs mode on every canonical Docs path'` from Task A1 — rewrite it to take resolutions from `resolveDocsWorkspace('/docs/langgraph/guides/persistence', 'Persistence')` and `resolveDocsWorkspace('/docs/langgraph/guides/durable-execution', 'Durable Execution')`). Change `'uses Docs for Docs and docs-only routes and Run only for runnable workspace routes'` (line 103) to:

```ts
  it('defaults every route to Docs', () => {
    const mappedDocs = resolveDocsWorkspace('/docs/langgraph/guides/streaming', 'Streaming');
    const docsOnly = resolveDocsWorkspace('/docs/langgraph/api/inject-agent', 'Inject an agent into Angular');
    expect(getRouteDefaultMode(mappedDocs)).toBe('Docs');
    expect(getRouteDefaultMode(docsOnly)).toBe('Docs');
  });
```

In `libs/workspace-react/src/lib/workspace-provider.spec.tsx`: delete `legacyPath` from the identity fixture (line 34); replace `path: identity.legacyPath` (line 84) and `identity.legacyPath` (line 334) with `identity.docsPath`; delete every `routeKind: 'workspace',` (lines 202, 220, 262) — the tests then exercise the docs default, so change any expectation that relied on the Run default to `'Docs'` (the assertions near lines 210–215 expect `'Docs'` already; re-read each after the edit).
In `libs/workspace-react/src/lib/workspace-shell.spec.tsx`: replace `routeKind="workspace"` (line 339) with `routeKind="docs"` and `routePath={identity.legacyPath}` (line 340) with `routePath={identity.docsPath ?? '/docs'}`.
In `apps/website/src/components/workspace/WebsiteWorkspace.spec.tsx:106`: delete the `legacyPath:` line from the fixture.

- [ ] **Step 2: Run to verify they fail**

Run: `npx nx run-many -t test --projects=cockpit-registry,workspace-react --skip-nx-cache 2>&1 | grep -E "×|FAIL|Tests " | head`
Expected: type or assertion failures referencing `legacyPath` / `getRouteDefaultMode` arity.

- [ ] **Step 3: Remove legacy-path resolution**

In `libs/cockpit-registry/src/lib/manifest.types.ts`: delete `legacyPath: string;` from both `WorkspaceIdentity` (line 38) and `CockpitManifestEntry` (line 101).
In `manifest.ts`: delete the `legacyPath:` line of `createEntry` (line 202).
In `validate-manifest.ts`: delete the `legacyPaths` set, its duplicate check, and the `expectedLegacyPath` block.
In `workspace-resolution.ts`: delete `legacyPath: entry.legacyPath,` in `toWorkspaceIdentity`, delete `resolveLegacyPath`, `LEGACY_REQUEST_MODES`, and `resolveLegacyRequestMode`; replace `getRouteDefaultMode` with:

```ts
export const getRouteDefaultMode = (
  _resolution: WorkspaceResolution | null
): WorkspaceMode => 'Docs';
```

In `libs/workspace-react/src/lib/workspace-provider.tsx`: narrow `routeKind` to `'docs'` in the props interface (line 62) and in `normalizedMode` (line 136), and call `getRouteDefaultMode(resolution)`; then remove `routeKind` entirely (props, destructuring at line 160, the `normalizedMode` argument at 183, the dependency at 230/250) and fix the three callers (`WebsiteWorkspace.tsx`, `public-api.spec.tsx:95`, `workspace-shell.spec.tsx:94/339/412`) by dropping the prop.

- [ ] **Step 4: Delete the app, its config, and the scaffolds**

```bash
git rm -r apps/cockpit vercel.cockpit.json libs/cockpit-docs libs/cockpit-testing libs/cockpit-ui
```

- `tsconfig.base.json`: delete the `@threadplane/cockpit-docs`, `@threadplane/cockpit-testing`, `@threadplane/cockpit-ui` path entries (lines 26, 38, 39). `apps/website/tsconfig.json`: delete the `@threadplane/cockpit-docs` entry (line 23).
- `apps/website/e2e/platform-production-smoke.spec.ts`: delete `expectedRedirect`, `docsBacked`, `COCKPIT_REDIRECT_CASES`, and the test(s) that iterate them; delete the now-unused imports (`resolveLegacyPath`, `resolveLegacyRequestMode`, `getCanonicalWebsiteWorkspaceHref` if unused, `COCKPIT_URL` env reads). Keep `WEBSITE_DESTINATIONS` and every Website-facing test.
- `scripts/ag-ui-proxy.ts:54` and `scripts/examples-middleware.ts:18`: delete the `'https://cockpit.threadplane.ai',` line.
- `git grep -n "cockpit.threadplane.ai" -- . ':!docs/superpowers' ':!CONTRIBUTING.md'` → only `apps/website/src/lib/cockpit-retirement.spec.ts` (the guard's own constant) and `.github/workflows/ci.yml` (removed in Task C3) may remain.

- [ ] **Step 5: Verify**

Run: `npx nx run-many -t test --projects=cockpit-registry,cockpit-shell,cockpit-runtime-bridge,workspace-react,scripts --skip-nx-cache 2>&1 | tail -3` → success.
Run: `npx nx test website --skip-nx-cache 2>&1 | tail -3` → success.
Run: `npx nx lint website --skip-nx-cache 2>&1 | grep problems` → `0 errors`; `npx nx lint workspace-react --skip-nx-cache 2>&1 | grep problems` → `0 errors`.
Run: `npx nx show projects 2>/dev/null | grep -E "^cockpit(-docs|-testing|-ui)?$"` → no output.
Run: `npx tsx scripts/assemble-examples.ts 2>&1 | tail -3` → completes (this also proves the registry import path).

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: delete the cockpit redirect service, legacy-path resolution, and empty scaffold libraries

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
```

### Task C3: Remove the cockpit jobs and deploy steps from CI

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `scripts/ci-workflow.spec.mjs`
- Modify: `scripts/ci-scope.mjs`, `scripts/ci-scope.spec.mjs`
- Modify: `CONTRIBUTING.md` (lines mentioning `VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET` and the cockpit preview lane)

- [ ] **Step 1: Update the guard tests first**

In `scripts/ci-workflow.spec.mjs`:
- Delete the tests `'deploys examples before the Cockpit redirect artifact and preserves fail-fast ordering'` (line 394), `'smokes one immutable Cockpit deployment before promoting that exact URL'` (line 454), `'smokes a throwaway cockpit preview on same-repo PRs and queue candidates'` (line 594), and `'gates Cockpit deployment on the production Website smoke even for Cockpit-only changes'` (line 751).
- In `'verifies every protected immutable preview with its own automation bypass'` (line 559): delete the `cockpitStep` lookup and every assertion on it, keep the Website assertions.
- In `'requires both PR-side preview verifications through the scoped gate'` (line 721): rename to `'requires the Website preview verification through the scoped gate'`; delete the `cockpit-preview-smoke` needs assertion, the `RESULT_COCKPIT_PREVIEW_SMOKE` assertion, and the cockpit `require_preview` assertion.
- In the exact-`needs` fixture (line ~1150): delete `'cockpit-deploy-smoke'` and `'cockpit-preview-smoke'`.
- In `'runs the cockpit sibling libraries that own vitest specs'` (line 933): the expected `run-many` project list becomes `cockpit-registry,workspace-react` (drop `cockpit` and `cockpit-docs`); read the test and adjust its assertion accordingly.
- In `'binds Vercel deploys to the renamed Threadplane projects'` (line ~732): delete the `threadplane-cockpit` assertion.
- Add:

```js
  it('carries no cockpit redirect deployment anywhere', async () => {
    const workflow = await readWorkflow();
    assert.doesNotMatch(workflow, /vercel\.cockpit\.json/);
    assert.doesNotMatch(workflow, /threadplane-cockpit/);
    assert.doesNotMatch(workflow, /VERCEL_COCKPIT_/);
    assert.doesNotMatch(workflow, /deploy-smoke\.ts/);
    assert.doesNotMatch(workflow, /cockpit\.threadplane\.ai/);
  });
```

In `scripts/ci-scope.spec.mjs`: delete the tests that read `apps/cockpit/project.json` (`'the Cockpit Vercel gate selects redirect build and deploy smoke'`, `'apps/cockpit is not tagged scope:cockpit-e2e'`, and the `cockpit` half of `'a website-only change leaves cockpit_e2e false'` — replace its `cockpit` project fixture with `libs/cockpit-registry/project.json`), and delete every `scope.cockpit_deploy_smoke` assertion.

- [ ] **Step 2: Run the guards to verify they fail**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs scripts/ci-scope.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"`
Expected: `carries no cockpit redirect deployment` fails, plus any test that now references removed fixtures.

- [ ] **Step 3: Edit `ci.yml`**

- Delete jobs `cockpit-deploy-smoke` and `cockpit-preview-smoke` entirely.
- `cockpit` job: delete `- run: npx nx build cockpit --skip-nx-cache`; change the `run-many` projects to `cockpit-registry,workspace-react`; rename the job's `name` to `Workspace libraries — lint / test`.
- `ci-scope` job outputs: delete `cockpit_deploy_smoke: ...`.
- `required-pr-checks`: delete `- cockpit-deploy-smoke` and `- cockpit-preview-smoke` from `needs`; delete `RESULT_COCKPIT_DEPLOY_SMOKE`, `RESULT_COCKPIT_PREVIEW_SMOKE`, `SCOPE_COCKPIT_DEPLOY_SMOKE` from env; delete the `require_scoped "cockpit_deploy_smoke" ...` and `require_preview "cockpit_deploy_smoke" ...` lines. Keep `require_preview` and `PREVIEW_LANES_ELIGIBLE` for the Website lane.
- `deploy` job: in `Detect deploy-relevant changes`, remove the `cockpit_changed` computation and the `cockpit=` output line; remove `|| steps.affected.outputs.cockpit == 'true'` from the `Cache Playwright browsers`, `Install Playwright browsers`, and `Verify deployed website` conditions; delete the seven steps from `Prepare cockpit Vercel project` through `Verify production cockpit redirects` (lines 1288–1347).
- `scripts/ci-scope.mjs`: delete `'cockpit_deploy_smoke'` from `SCOPE_KEYS`; delete the `apps/cockpit/vite.config.mts` comment at line 85 if it is now misleading.
- `CONTRIBUTING.md`: in the "PR-side deploy verification" subsection, delete the cockpit bullet and the `VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET` mention; elsewhere, remove any line describing the cockpit redirect deploy.

- [ ] **Step 4: Verify**

Run: `node --test --test-reporter=tap scripts/ci-workflow.spec.mjs scripts/ci-scope.spec.mjs 2>&1 | grep -E "^not ok|^# (pass|fail)"` → `# fail 0`.
Run: `python3 -c "import yaml;yaml.safe_load(open('.github/workflows/ci.yml'));print('yaml ok')"` → `yaml ok`.
Run: `git grep -n "cockpit_deploy_smoke\|cockpit-deploy-smoke\|cockpit-preview-smoke\|VERCEL_COCKPIT" -- . ':!docs/superpowers'` → no output.
Run: `node scripts/ci-scope.mjs --event push --output /dev/stdout 2>/dev/null | head` → lists keys without `cockpit_deploy_smoke`.

- [ ] **Step 5: Commit and open the PR**

```bash
git add -A
git commit -m "ci: drop the cockpit redirect jobs and deploy steps

Co-Authored-By: Claude Fable 5.1 <noreply@anthropic.com>"
git push -u origin blove/retire-cockpit-redirect
gh pr create --base main --title "chore: retire the cockpit redirect service" --body "Part C of docs/superpowers/specs/2026-09-04-docs-workspace-unification-design.md. Deletes apps/cockpit, vercel.cockpit.json, the deploy smoke, legacy-path resolution, three empty scaffold libraries, and every CI job and deploy step that served cockpit.threadplane.ai. Relocates the capability registry into @threadplane/cockpit-registry and example tooling into scripts/examples. Part D (Vercel project, DNS record, repository secrets) follows by hand once this is on main."
```

Wait for green, address comments, merge. Then watch the main run's deploy job: it must promote the Website and pass production smoke with the cockpit steps gone.

---

# Part D — external cleanup (manual, after Part C is on main)

Token: `VERCEL_API_TOKEN` in the primary checkout's root `.env` (never print it). Team `team_RWMT2bzjj1nkSXI3N3arQ6CP`. Cockpit project `prj_nVbpDgli7yjZxOaLKh2C2SBARJQd`. Run the steps in one shell so `$tok` carries over.

- [ ] **Step 1: Confirm main no longer references the project**

```bash
git fetch origin main && git grep -c "threadplane-cockpit\|VERCEL_COCKPIT" origin/main -- .github CONTRIBUTING.md || echo "no references on main"
```

Expected: `no references on main`.

- [ ] **Step 2: Delete the Vercel project**

```bash
tok=$(grep -E "^VERCEL_API_TOKEN=" /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2- | tr -d '"'"'"' ')
tid=team_RWMT2bzjj1nkSXI3N3arQ6CP
curl -s -o /dev/null -w "delete project: %{http_code}\n" -X DELETE -H "Authorization: Bearer $tok" "https://api.vercel.com/v9/projects/prj_nVbpDgli7yjZxOaLKh2C2SBARJQd?teamId=$tid"
curl -s -o /dev/null -w "project after delete: %{http_code}\n" -H "Authorization: Bearer $tok" "https://api.vercel.com/v9/projects/prj_nVbpDgli7yjZxOaLKh2C2SBARJQd?teamId=$tid"
```

Expected: `delete project: 204` then `project after delete: 404`.

- [ ] **Step 3: Delete the DNS record**

```bash
rid=$(curl -s -H "Authorization: Bearer $tok" "https://api.vercel.com/v4/domains/threadplane.ai/records?teamId=$tid&limit=100" | python3 -c 'import sys,json;print(next(r["id"] for r in json.load(sys.stdin)["records"] if r.get("name")=="cockpit"))')
curl -s -o /dev/null -w "delete record: %{http_code}\n" -X DELETE -H "Authorization: Bearer $tok" "https://api.vercel.com/v2/domains/threadplane.ai/records/$rid?teamId=$tid"
```

Expected: `delete record: 200`.

- [ ] **Step 4: Delete the repository secrets**

```bash
gh secret delete VERCEL_COCKPIT_PROJECT_ID --repo cacheplane/angular-agent-framework
gh secret delete VERCEL_COCKPIT_AUTOMATION_BYPASS_SECRET --repo cacheplane/angular-agent-framework
gh secret list | grep -c VERCEL_COCKPIT || echo "cockpit secrets gone"
```

Expected: `cockpit secrets gone`.

- [ ] **Step 5: Confirm the host is gone**

```bash
sleep 60; curl -sI --max-time 10 https://cockpit.threadplane.ai/ 2>&1 | head -1 || echo "does not resolve"
```

Expected: a resolution error or `does not resolve` (DNS caches may take longer; re-check later).

- [ ] **Step 6: Update memory**

Edit the memory notes that record the cockpit project id and bypass (`project_deploy_verify_remote_target_guard.md`, `project_release_process_gotchas.md`) to say the project, domain, record, and secrets were deleted on the date of this step.
