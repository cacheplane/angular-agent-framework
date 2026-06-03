# Render `VIEW_REGISTRY` Drift + Chat Re-export Cleanup + Nits — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `@threadplane/render`'s `VIEW_REGISTRY` actually drive rendering, add the missing `overrideViews` helper, drop the leaking chat re-export, fix the broken markdown-override documentation across every surface, document the new ag-ui interrupt feature, and clean up three nits (`.gitignore`, prompt rename, ag-ui docs).

**Architecture:** Sequential — code changes first (engine + helper + chat surface trim), then library READMEs, then website docs, then regenerated API JSON (must run after the source changes), then ag-ui docs, then the three small nits. Each task is independently committable.

**Tech Stack:** Angular 20/21, TypeScript, Vitest; Nx; MDX (Next.js website); python (for the cockpit prompt rename).

**Spec:** `docs/superpowers/specs/2026-05-29-render-chat-docs-alignment-design.md`

---

## Conventions

- Run all commands from the repo root: `/Users/blove/repos/angular-agent-framework/.claude/worktrees/interesting-mccarthy-5d4ea0`.
- Commit after each task; do NOT push.
- TDD where there's code: failing test → implement → green → commit.

---

## File Structure

**Code:**
- Modify `libs/render/src/lib/views.ts` (+ spec) — `overrideViews`.
- Modify `libs/render/src/lib/public-api.ts` — export `overrideViews`.
- Modify `libs/render/src/lib/render-spec.component.ts` (+ spec) — resolution order.
- Modify `libs/render/src/lib/render-element.component.ts` (+ spec) — resolution order.
- Modify `libs/chat/src/public-api.ts` — drop re-export.

**Library docs:**
- Modify `libs/render/README.md`, `libs/chat/README.md`, `libs/ag-ui/README.md`, `libs/chat/CHANGELOG.md`.

**Website docs:**
- Modify `apps/website/content/docs/render/api/views.mdx`.
- Modify `apps/website/content/docs/chat/guides/markdown.mdx`.
- Create `apps/website/content/docs/ag-ui/guides/interrupts.mdx`.
- Modify `apps/website/src/lib/docs-config.ts` — register the new guide.
- Regenerate `apps/website/content/docs/chat/api/api-docs.json` + `apps/website/content/docs/render/api/api-docs.json`.

**Cockpit + workspace nits:**
- Rename `cockpit/chat/generative-ui/python/prompts/dashboard.md` → `generative-ui.md`.
- Modify `cockpit/chat/generative-ui/python/src/graph.py` (line 31).
- Modify `cockpit/chat/generative-ui/python/src/index.ts` (`promptAssetPaths`).
- Modify root `.gitignore`.

---

## Task 1: `overrideViews` helper

**Files:**
- Modify: `libs/render/src/lib/views.ts`
- Modify: `libs/render/src/lib/public-api.ts`
- Test: `libs/render/src/lib/views.spec.ts`

- [ ] **Step 1: Write failing tests**

In `libs/render/src/lib/views.spec.ts` (mirror the existing test style; reuse imports for `views`/`withViews` already there). Add:

```ts
import { Component } from '@angular/core';
import { views, withViews, overrideViews } from './views';

@Component({ standalone: true, template: '' }) class A {}
@Component({ standalone: true, template: '' }) class B {}
@Component({ standalone: true, template: '' }) class C {}

describe('overrideViews', () => {
  it('replaces matching keys; overrides win over base', () => {
    const base = views({ foo: A, bar: B });
    const result = overrideViews(base, { foo: C });
    expect(result['foo']).toBe(C);
    expect(result['bar']).toBe(B);
  });

  it('adds new keys not present in base', () => {
    const base = views({ foo: A });
    const result = overrideViews(base, { bar: B });
    expect(result['foo']).toBe(A);
    expect(result['bar']).toBe(B);
  });

  it('does not mutate base', () => {
    const base = views({ foo: A });
    overrideViews(base, { foo: B });
    expect(base['foo']).toBe(A);
  });

  it('returns a frozen object', () => {
    const result = overrideViews(views({}), {});
    expect(Object.isFrozen(result)).toBe(true);
  });
});
```

- [ ] **Step 2: Run, verify FAIL**

Run: `npx nx test render`
Expected: FAIL — `overrideViews is not exported` / undefined.

- [ ] **Step 3: Implement**

In `libs/render/src/lib/views.ts`, add (place beside `withViews`):

```ts
/**
 * Replaces views in a registry. Keys in `overrides` win over `base`.
 * Use this to swap an existing renderer; use `withViews` to add NEW
 * node types without touching existing entries.
 */
export function overrideViews(
  base: ViewRegistry,
  overrides: Record<string, Type<unknown> | RenderViewEntry>,
): ViewRegistry {
  return Object.freeze({ ...base, ...overrides });
}
```

In `libs/render/src/lib/public-api.ts`, find the line exporting `withViews`/`withoutViews` and add `overrideViews` to the same `export` statement (or add a parallel `export { overrideViews } from './lib/views';` to match the file's existing style — look at how `withViews` is exported and mirror that).

- [ ] **Step 4: Run, verify PASS**

Run: `npx nx test render && npx nx build render`
Expected: all green; build succeeds.

- [ ] **Step 5: Commit**

```bash
git add libs/render/src/lib/views.ts libs/render/src/lib/views.spec.ts libs/render/src/lib/public-api.ts
git commit -m "feat(render): add overrideViews helper for override-semantics composition"
```

---

## Task 2: Wire `VIEW_REGISTRY` into the render engine

**Files:**
- Modify: `libs/render/src/lib/render-spec.component.ts` (+ spec)
- Modify: `libs/render/src/lib/render-element.component.ts` (+ spec)

The change: both components currently resolve their registry from the `[registry]` input or `RENDER_CONFIG.registry`. Add `VIEW_REGISTRY` as a third fallback before null. Same pattern in both components.

- [ ] **Step 1: Read current resolution sites**

Read both component files. Locate every place either component derives its registry. Note the variable names used (`this.registry()`, `this.config?.registry`, etc.). The fallback you add should NOT change behavior when the input or `RENDER_CONFIG.registry` is set — only fire when both are absent.

- [ ] **Step 2: Write failing tests**

In `libs/render/src/lib/render-spec.component.spec.ts` (mirror existing test setup — TestBed + standalone component harness). Add four priority tests:

```ts
import { TestBed } from '@angular/core/testing';
import { Component, signal } from '@angular/core';
import { provideRender } from './provide-render';
import { provideViews, VIEW_REGISTRY } from './provide-views';
import { views } from './views';
import { RenderSpecComponent } from './render-spec.component';

@Component({ standalone: true, template: '' }) class CompFromInput {}
@Component({ standalone: true, template: '' }) class CompFromConfig {}
@Component({ standalone: true, template: '' }) class CompFromToken {}

describe('RenderSpecComponent registry resolution priority', () => {
  it('uses the [registry] input when present (highest priority)', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRender({ registry: views({ leaf: CompFromConfig }) }),
        provideViews(views({ leaf: CompFromToken })),
      ],
    });
    const fix = TestBed.createComponent(RenderSpecComponent);
    fix.componentRef.setInput('registry', views({ leaf: CompFromInput }));
    // The component must resolve to CompFromInput. Assert via the
    // component's `resolveRegistry()` helper (newly extracted in step 3),
    // or via the rendered output for spec = { type: 'leaf' }.
    fix.componentRef.setInput('spec', { type: 'leaf' });
    fix.detectChanges();
    expect(fix.debugElement.query((d) => d.componentInstance instanceof CompFromInput)).toBeTruthy();
  });

  it('uses RENDER_CONFIG.registry when no [registry] input is bound', async () => {
    TestBed.configureTestingModule({
      providers: [
        provideRender({ registry: views({ leaf: CompFromConfig }) }),
        provideViews(views({ leaf: CompFromToken })),
      ],
    });
    const fix = TestBed.createComponent(RenderSpecComponent);
    fix.componentRef.setInput('spec', { type: 'leaf' });
    fix.detectChanges();
    expect(fix.debugElement.query((d) => d.componentInstance instanceof CompFromConfig)).toBeTruthy();
  });

  it('falls back to VIEW_REGISTRY token when no input + no RENDER_CONFIG.registry', async () => {
    TestBed.configureTestingModule({
      providers: [
        // RENDER_CONFIG provided but registry omitted:
        provideRender({}),
        provideViews(views({ leaf: CompFromToken })),
      ],
    });
    const fix = TestBed.createComponent(RenderSpecComponent);
    fix.componentRef.setInput('spec', { type: 'leaf' });
    fix.detectChanges();
    expect(fix.debugElement.query((d) => d.componentInstance instanceof CompFromToken)).toBeTruthy();
  });

  it('renders the existing fallback when nothing is provided', async () => {
    TestBed.configureTestingModule({ providers: [] });
    const fix = TestBed.createComponent(RenderSpecComponent);
    fix.componentRef.setInput('spec', { type: 'leaf' });
    fix.detectChanges();
    // Existing behavior — either renders DefaultFallbackComponent or
    // nothing, depending on how the component handles a null registry
    // today. Adjust the assertion to match the existing fallback.
    // The point is the test confirms the new VIEW_REGISTRY branch did
    // not break the null path.
    expect(fix.nativeElement).toBeTruthy();
  });
});
```

(If the existing tests already cover input + RENDER_CONFIG paths, only add the two new tests — the token-fallback one and the null-path regression check.)

Add a parallel set of four tests in `render-element.component.spec.ts` adapted to that component's input shape.

- [ ] **Step 3: Run, verify the two new "token fallback" tests FAIL**

Run: `npx nx test render`
Expected: the "falls back to VIEW_REGISTRY token" test fails for each component (registry resolves to null, not `CompFromToken`).

- [ ] **Step 4: Implement**

In `render-spec.component.ts`, inside the component class, add:

```ts
private readonly fallbackRegistry = inject(VIEW_REGISTRY, { optional: true });

protected resolveRegistry(): ViewRegistry | null {
  return this.registry()                       // 1. [registry] input
      ?? this.config?.registry                 // 2. RENDER_CONFIG.registry
      ?? this.fallbackRegistry                 // 3. VIEW_REGISTRY token
      ?? null;                                 // 4. existing fallback
}
```

Add the import: `import { VIEW_REGISTRY } from './provide-views';`. Replace every existing `this.registry() ?? this.config?.registry ?? null` (or equivalent) inside the component with `this.resolveRegistry()`. If `inject(VIEW_REGISTRY, { optional: true })` can't run at field-declaration time (Angular requires injection context), move the call into the constructor and assign to a `private readonly` field.

Apply the IDENTICAL change to `render-element.component.ts` (same imports, same helper, same call-site replacement). Keep the two helpers inline (don't extract to a shared utility yet — the two components likely differ on `registry()` input name; revisit only if the duplication grows).

- [ ] **Step 5: Run, verify PASS**

Run: `npx nx test render && npx nx build render`
Expected: all green; build succeeds. The two new token-fallback tests pass; the input/config tests still pass.

- [ ] **Step 6: Commit**

```bash
git add libs/render/src/lib/render-spec.component.ts libs/render/src/lib/render-spec.component.spec.ts \
        libs/render/src/lib/render-element.component.ts libs/render/src/lib/render-element.component.spec.ts
git commit -m "feat(render): wire VIEW_REGISTRY as third-priority registry fallback in engine"
```

---

## Task 3: Drop chat re-export of `provideViews` + `VIEW_REGISTRY` + CHANGELOG entry

**Files:**
- Modify: `libs/chat/src/public-api.ts`
- Modify: `libs/chat/CHANGELOG.md`

- [ ] **Step 1: Confirm no internal chat code uses these**

```bash
grep -rn "from '@threadplane/chat'" libs/chat/src | grep -E "provideViews|VIEW_REGISTRY" || echo "no internal refs"
grep -rn "provideViews\|VIEW_REGISTRY" libs/chat/src | grep -v public-api.ts || echo "clean"
```
Expected: no internal references (chat consumes `MARKDOWN_VIEW_REGISTRY`, not `VIEW_REGISTRY`).

- [ ] **Step 2: Implement**

In `libs/chat/src/public-api.ts`, delete the line: `export { provideViews, VIEW_REGISTRY } from '@threadplane/render';` (around line 155 — confirm exact line by reading first).

Add to `libs/chat/CHANGELOG.md` immediately under `## [Unreleased]` → `### Changed`:

```markdown
- **Public API trim:** `@threadplane/chat` no longer re-exports `provideViews` / `VIEW_REGISTRY` from `@threadplane/render`. Consumers using `<render-spec>` / `<render-element>` directly should import from `@threadplane/render`. For chat's markdown view overrides, provide `MARKDOWN_VIEW_REGISTRY` directly using `overrideViews(cacheplaneMarkdownViews, { … })` from `@threadplane/render` — the previously-documented `provideViews(withViews(…))` pattern never actually drove rendering.
```

If a `### Changed` section doesn't yet exist under `[Unreleased]`, add the heading.

- [ ] **Step 3: Verify**

Run: `npx nx test chat && npx nx build chat`
Expected: all green; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/src/public-api.ts libs/chat/CHANGELOG.md
git commit -m "refactor(chat)!: drop re-export of provideViews/VIEW_REGISTRY from @threadplane/render"
```

(The `!` follows the existing CHANGELOG's convention for marking surface-trimming changes; if the repo uses a different marker, drop it.)

---

## Task 4: Fix chat README markdown override example

**Files:**
- Modify: `libs/chat/README.md`

- [ ] **Step 1: Locate the broken example**

Read `libs/chat/README.md` around the "Override individual node renderers" / "Markdown" section (search for `withViews(cacheplaneMarkdownViews`). Confirm the broken block matches:

```ts
import { withViews, cacheplaneMarkdownViews, provideViews } from '@threadplane/chat';
import { MyCodeBlockComponent } from './my-code-block.component';

providers: [
  provideViews(
    withViews(cacheplaneMarkdownViews, { code: MyCodeBlockComponent })
  ),
],
```

- [ ] **Step 2: Replace with the correct example**

Replace the entire `import …` + `providers: [ … ]` code block above with:

```ts
import { MARKDOWN_VIEW_REGISTRY, cacheplaneMarkdownViews } from '@threadplane/chat';
import { overrideViews } from '@threadplane/render';
import { MyCodeBlockComponent } from './my-code-block.component';

providers: [
  {
    provide: MARKDOWN_VIEW_REGISTRY,
    useValue: overrideViews(cacheplaneMarkdownViews, { 'code-block': MyCodeBlockComponent }),
  },
];
```

Immediately before or after the block, add a one-sentence pointer:

> Per-instance, bind the registry on `<chat-streaming-md [viewRegistry]="…" />` instead. Styling uses the existing `--ngaf-chat-*` / `--a2ui-*` tokens — see the Theming section below.

- [ ] **Step 3: Verify**

```bash
grep -n "MARKDOWN_VIEW_REGISTRY\|overrideViews\|code-block" libs/chat/README.md | head
grep -n "provideViews(withViews" libs/chat/README.md && echo "STALE EXAMPLE REMAINS" || echo "stale example removed"
```
Expected: the new symbols appear; the old `provideViews(withViews(…))` pattern is gone.

- [ ] **Step 4: Commit**

```bash
git add libs/chat/README.md
git commit -m "docs(chat): fix markdown view override example (MARKDOWN_VIEW_REGISTRY + overrideViews)"
```

---

## Task 5: Fix chat markdown website guide

**Files:**
- Modify: `apps/website/content/docs/chat/guides/markdown.mdx`

- [ ] **Step 1: Read the current guide**

Open `apps/website/content/docs/chat/guides/markdown.mdx`. Locate the override section.

- [ ] **Step 2: Replace the override mechanism**

Apply the same correction as Task 4 (`MARKDOWN_VIEW_REGISTRY` + `overrideViews(cacheplaneMarkdownViews, { 'code-block': MyComp })`, import `overrideViews` from `@threadplane/render`). Adjust prose to:

- Name the token (`MARKDOWN_VIEW_REGISTRY`) and explain that `<chat-streaming-md>` provides it on its component injector.
- Show the override helper and the per-instance `[viewRegistry]` input as the two paths.
- Add a compact reference of the 22 node-type keys from `cacheplaneMarkdownViews` (copy the list from `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts`) so consumers know which keys are valid.
- Link the render API page (`/docs/render/api/views`) for `views` / `withViews` / `withoutViews` / `overrideViews` / `toRenderRegistry`.

If the guide doesn't currently have a node-type reference table, add one — it's the most common source of "I overrode `code` and nothing happened."

- [ ] **Step 3: Verify**

```bash
grep -n "MARKDOWN_VIEW_REGISTRY\|overrideViews\|code-block" apps/website/content/docs/chat/guides/markdown.mdx | head
grep -n "provideViews(withViews" apps/website/content/docs/chat/guides/markdown.mdx && echo "STALE" || echo "clean"
```
Expected: new symbols present; no stale `provideViews(withViews(…))`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/chat/guides/markdown.mdx
git commit -m "docs(website): correct markdown view override path in chat guide"
```

---

## Task 6: Update render README — resolution order + `overrideViews`

**Files:**
- Modify: `libs/render/README.md`

- [ ] **Step 1: Locate the DI providers section**

Search `libs/render/README.md` for `provideViews(registry)` (the current line reads "publishes a `ViewRegistry` under the `VIEW_REGISTRY` token for consumers to inject directly").

- [ ] **Step 2: Replace the description**

Change that line to describe the actual engine behavior:

> `provideViews(registry)` publishes a `ViewRegistry` under the `VIEW_REGISTRY` token. `<render-spec>` and `<render-element>` resolve their registry in priority order: the `[registry]` template input, then `RENDER_CONFIG.registry` (from `provideRender(...)`), then `VIEW_REGISTRY` (from `provideViews(...)`), then the existing fallback.

In the same area (composition helpers — currently lists `views`/`withViews`/`withoutViews`), add `overrideViews`:

> `overrideViews(base, overrides)` replaces matching keys (overrides win); use this to swap an existing renderer. `withViews(base, additions)` only adds NEW keys without touching existing ones; use it to extend a registry with previously-unhandled node types.

- [ ] **Step 3: Verify**

```bash
grep -n "overrideViews\|priority order\|VIEW_REGISTRY" libs/render/README.md | head
```
Expected: new symbols and resolution order present.

- [ ] **Step 4: Commit**

```bash
git add libs/render/README.md
git commit -m "docs(render): document engine resolution order + overrideViews helper"
```

---

## Task 7: Update render views API mdx

**Files:**
- Modify: `apps/website/content/docs/render/api/views.mdx`

- [ ] **Step 1: Read the current page**

Open `apps/website/content/docs/render/api/views.mdx`. Confirm it documents `provideViews`/`withViews`/`withoutViews` (and likely `views`, `toRenderRegistry`).

- [ ] **Step 2: Add `overrideViews` + update `provideViews`**

Add an `overrideViews` section parallel to the `withViews` section:

````mdx
## `overrideViews(base, overrides)`

Replaces entries in a registry. Keys in `overrides` win over `base`. Use this when you want to swap an existing renderer; use `withViews` when you want to add NEW node types without touching existing ones.

```ts
import { overrideViews } from '@threadplane/render';

const myRegistry = overrideViews(baseRegistry, {
  'code-block': MyCodeBlockComponent,
});
```

Returns a new frozen `ViewRegistry`. The `base` argument is not mutated.
````

Update the `provideViews` section's description to mention engine consumption: "`provideViews(registry)` registers `VIEW_REGISTRY` in the injector. `RenderSpecComponent` and `RenderElementComponent` consume it as a fallback when no `[registry]` input or `RENDER_CONFIG.registry` is provided."

- [ ] **Step 3: Verify**

```bash
grep -n "overrideViews\|VIEW_REGISTRY" apps/website/content/docs/render/api/views.mdx | head
```
Expected: new symbol section present; provideViews description updated.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/render/api/views.mdx
git commit -m "docs(website): add overrideViews + clarify provideViews engine consumption"
```

---

## Task 8: Regenerate API JSON

**Files (modified by script):**
- `apps/website/content/docs/chat/api/api-docs.json`
- `apps/website/content/docs/render/api/api-docs.json`

- [ ] **Step 1: Confirm the script exists + works**

```bash
grep -n "generate-api-docs" package.json
ls apps/website/scripts/generate-api-docs.ts
```
Expected: script defined; entry file exists.

- [ ] **Step 2: Run**

```bash
npm run generate-api-docs 2>&1 | tail -10
```
Expected: completes without error; both `api-docs.json` files updated.

- [ ] **Step 3: Verify the diff makes sense**

```bash
git diff --stat apps/website/content/docs/chat/api/api-docs.json apps/website/content/docs/render/api/api-docs.json
```
Expected: `chat/api-docs.json` lost entries for `provideViews` and `VIEW_REGISTRY`; `render/api-docs.json` gained an `overrideViews` entry. No spurious noise (no unrelated symbol churn). If the diff is noisy, investigate before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/website/content/docs/chat/api/api-docs.json apps/website/content/docs/render/api/api-docs.json
git commit -m "docs(website): regenerate API JSON for chat re-export drop + render overrideViews"
```

---

## Task 9: ag-ui README — interrupts subsection

**Files:**
- Modify: `libs/ag-ui/README.md`

- [ ] **Step 1: Locate the Capabilities section**

Find the section in `libs/ag-ui/README.md` that lists the Signals (`messages`, `status`, `isLoading`, `error`, `toolCalls`, `state`). Insert the new subsection immediately after that table.

- [ ] **Step 2: Add the subsection**

````markdown
### Interrupts (human-in-the-loop)

`agent.interrupt()` is a `Signal<AgentInterrupt | undefined>` populated from AG-UI `CUSTOM` events with `name: 'on_interrupt'`. The reducer parses string-serialized `value` payloads automatically (e.g. `ag-ui-langgraph` ships interrupts via `dump_json_safe`), so consumers see the structured object directly.

Resume with `agent.submit({ resume })` — this calls `runAgent({ forwardedProps: { command: { resume } } })`, and the server reads `forwarded_props.command.resume` (the `ag-ui-langgraph` convention).

Pair with `<chat-approval-card>` from `@threadplane/chat` for the approve/reject/edit UX:

```ts
import { Component } from '@angular/core';
import { ChatComponent, ChatApprovalCardComponent } from '@threadplane/chat';
import { injectAgent } from '@threadplane/ag-ui';

@Component({
  imports: [ChatComponent, ChatApprovalCardComponent],
  template: `
    <chat [agent]="agent" />
    <chat-approval-card
      [agent]="agent"
      matchKind="refund_approval"
      (action)="onAction($event)" />
  `,
})
export class App {
  protected readonly agent = injectAgent();
  onAction(a: 'approve' | 'cancel') {
    void this.agent.submit({ resume: { approved: a === 'approve' } });
  }
}
```

See `cockpit/ag-ui/interrupts` for a complete working example, and the [LangGraph interrupts guide](https://threadplane.ai/docs/langgraph/guides/interrupts) for the broader HITL contract — the same `Agent.interrupt` / `submit({ resume })` API works across both adapters.
````

- [ ] **Step 3: Verify**

```bash
grep -nE "Interrupts \(human|agent\.interrupt\(\)|submit\(\{.*resume" libs/ag-ui/README.md | head
```
Expected: subsection present.

- [ ] **Step 4: Commit**

```bash
git add libs/ag-ui/README.md
git commit -m "docs(ag-ui): document Agent.interrupt + submit({ resume }) HITL feature"
```

---

## Task 10: New ag-ui interrupts website guide

**Files:**
- Create: `apps/website/content/docs/ag-ui/guides/interrupts.mdx`
- Modify: `apps/website/src/lib/docs-config.ts`

- [ ] **Step 1: Read the langgraph interrupts guide as a template**

Open `apps/website/content/docs/langgraph/guides/interrupts.mdx` and read its structure (frontmatter, sections, code-block conventions, links to API pages).

- [ ] **Step 2: Create the ag-ui version**

Create `apps/website/content/docs/ag-ui/guides/interrupts.mdx`. Mirror the langgraph guide's frontmatter shape (title, description, order in nav), then short sections:

1. **What it is** — same runtime-neutral interrupt feature exposed via the `Agent` contract; this guide is the AG-UI specifics.
2. **The wire format** — AG-UI `CUSTOM` event with `name: 'on_interrupt'`, `value: <structured payload>` (e.g. `{ kind: 'refund_approval', amount, customer_id, reason }`). Note the `ag-ui-langgraph` convention of shipping `value` as a JSON-serialized string and that the adapter parses it.
3. **Reading the interrupt** — `agent.interrupt()` signal; the canonical `{ kind, ... }` payload pattern; matching with `<chat-approval-card matchKind="…">`.
4. **Resuming** — `agent.submit({ resume })`, which becomes `forwardedProps: { command: { resume } }`; server-side `forwarded_props.command.resume` (link to `ag-ui-langgraph` docs for the python side).
5. **End-to-end example** — point at `cockpit/ag-ui/interrupts` (Angular + Python, refund-approval graph). Include one short component code block (the same `<chat-approval-card>` snippet).
6. **Cross-adapter parity** — link the langgraph interrupts guide; note the consumer Angular code is byte-identical except the adapter import.

Keep it tight — under 200 lines. The point is discoverability + the AG-UI-specific wire details, not duplication of the langgraph guide.

- [ ] **Step 3: Register the page**

Read `apps/website/src/lib/docs-config.ts`; find the `ag-ui` library's `Guides` section (lists `fake-agent`, `citations`, `troubleshooting`). Add an `interrupts` entry placed in the same alphabetical/conceptual position as it appears in the langgraph guides. Match the exact entry shape (title, slug, file, order) of the neighboring entries.

- [ ] **Step 4: Verify**

```bash
npx nx build website 2>&1 | tail -5
grep -n "ag-ui.*interrupts\|guides/interrupts" apps/website/src/lib/docs-config.ts | head
```
Expected: website build succeeds (no 404 / broken-link errors from the new page or docs-config); the registration is present.

- [ ] **Step 5: Commit**

```bash
git add apps/website/content/docs/ag-ui/guides/interrupts.mdx apps/website/src/lib/docs-config.ts
git commit -m "docs(website): add ag-ui interrupts guide + register in nav"
```

---

## Task 11: Root `.gitignore` — Playwright `test-results/`

**Files:**
- Modify: `.gitignore`

- [ ] **Step 1: Confirm nothing committed under the pattern**

```bash
git ls-files cockpit/ | grep test-results && echo "COMMITTED test-results exist — DO NOT add pattern blindly" || echo "no committed paths under test-results"
```
Expected: no committed paths (the dirs are runtime detritus).

- [ ] **Step 2: Read current `.gitignore`**

Read the root `.gitignore`. Locate the section where Playwright / e2e / dist patterns live (search for `playwright` or `test-results` to confirm the pattern isn't already there).

- [ ] **Step 3: Add the pattern**

Append (or place near similar e2e patterns):

```
# Playwright artifacts under cockpit examples
cockpit/**/angular/test-results/
```

- [ ] **Step 4: Verify**

```bash
git check-ignore -v cockpit/ag-ui/interrupts/angular/test-results/.dummy 2>&1 | head -1
git check-ignore -v cockpit/ag-ui/streaming/angular/test-results/.dummy 2>&1 | head -1
```
Expected: both paths match the new pattern (the command prints the matching rule).

- [ ] **Step 5: Commit**

```bash
git add .gitignore
git commit -m "chore: gitignore Playwright test-results under cockpit examples"
```

---

## Task 12: Rename `dashboard.md` → `generative-ui.md`

**Files:**
- Rename: `cockpit/chat/generative-ui/python/prompts/dashboard.md` → `generative-ui.md`
- Modify: `cockpit/chat/generative-ui/python/src/graph.py`
- Modify: `cockpit/chat/generative-ui/python/src/index.ts`

- [ ] **Step 1: Rename via git**

```bash
git mv cockpit/chat/generative-ui/python/prompts/dashboard.md cockpit/chat/generative-ui/python/prompts/generative-ui.md
```

- [ ] **Step 2: Update `graph.py`**

In `cockpit/chat/generative-ui/python/src/graph.py`, line 31, change:

```python
_PROMPT = (Path(__file__).parent.parent / "prompts" / "dashboard.md").read_text()
```
to:
```python
_PROMPT = (Path(__file__).parent.parent / "prompts" / "generative-ui.md").read_text()
```

Then search the rest of the file (and the rest of `cockpit/chat/generative-ui/python/`) for any other `"dashboard.md"` literal. If `graph.py` reads OTHER `.md` files from the prompts dir (e.g. tool-specific prompts), those are unrelated — only the topic-level prompt is in scope.

- [ ] **Step 3: Update `python/src/index.ts`**

In `cockpit/chat/generative-ui/python/src/index.ts`, update `promptAssetPaths`:

```ts
promptAssetPaths: ['cockpit/chat/generative-ui/python/prompts/generative-ui.md'],
```

- [ ] **Step 4: Verify**

```bash
ls cockpit/chat/generative-ui/python/prompts/
grep -n "dashboard.md" cockpit/chat/generative-ui/python/src/graph.py cockpit/chat/generative-ui/python/src/index.ts && echo "STALE refs remain" || echo "clean"
npx nx smoke cockpit-chat-generative-ui-python
npx nx test cockpit-registry
```
Expected: only `generative-ui.md` (and any unrelated files like tool prompts) in the prompts dir; no stale `dashboard.md` refs; smoke green; **cockpit-registry test goes from red to green** (the `fs.existsSync` failure resolves).

- [ ] **Step 5: Commit**

```bash
git add cockpit/chat/generative-ui/python
git commit -m "fix(cockpit): rename dashboard.md → generative-ui.md to match manifest convention"
```

---

## Self-Review (completed during planning)

**Spec coverage:**

- §1 (`overrideViews`) → T1
- §2 (engine VIEW_REGISTRY wiring) → T2
- §3 (chat re-export drop) → T3
- §4 (chat README override fix) → T4
- §5 (chat markdown guide fix) → T5
- §6 (render README) → T6
- §7 (render views API mdx) → T7
- §8 (regenerate api-docs.json) → T8
- §9 (chat CHANGELOG) → T3 (folded — the CHANGELOG entry describes the §3 change, committing them together)
- §10 (ag-ui README interrupt subsection) → T9
- §11 (new ag-ui interrupts mdx + docs-config) → T10
- §12 (.gitignore) → T11
- §13 (dashboard.md rename) → T12

All 13 spec items covered.

**Placeholder scan:** Code blocks complete; verification commands have expected output. The `<chat-approval-card>` snippet in T9 and the doc-content descriptions in T5/T10 are intentionally guidance to the implementer for prose, not unresolved TODOs — they specify what to cover with enough detail for the implementer to write it directly.

**Name consistency:** `overrideViews`, `VIEW_REGISTRY`, `MARKDOWN_VIEW_REGISTRY`, `cacheplaneMarkdownViews`, `resolveRegistry`, `fallbackRegistry`, `'code-block'`, `injectAgent`, `submit({ resume })`, `forwardedProps.command.resume`, `on_interrupt` — used identically across tasks.

## Risks

- **T2 unit tests** depend on TestBed setup conventions in the existing render specs. If the existing setup is incompatible with the proposed test structure (e.g. uses a fixture harness), adapt the assertions to match — the priority order is the invariant, not the test mechanism.
- **T8 api-docs regen** depends on the `generate-api-docs.ts` script tracking exports from `public-api.ts`. If the script picks up extra symbols (some downstream consumers may behave differently), inspect the diff before committing.
- **T10 docs-config.ts** edits the docs-site nav. A typo here breaks the website build; T10 Step 4 catches this.
