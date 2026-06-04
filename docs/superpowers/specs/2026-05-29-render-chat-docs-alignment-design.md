# Render `VIEW_REGISTRY` Drift + Chat Re-export Cleanup + Nits — Design

**Date:** 2026-05-29
**Status:** Approved (brainstorming) — pending implementation plan

## Problem

The README audit (PR #559) and the subsequent ag-ui PR (#567) surfaced one code-level drift item (`@threadplane/render` exports `provideViews` + `VIEW_REGISTRY` that the engine never injects), plus three small leftover nits worth cleaning up in the same pass. While auditing the render token I found that the situation is actually a chain of compounding bugs that mislead consumers:

1. **`@threadplane/render` exports a public API with no behavior.** `VIEW_REGISTRY` is an `InjectionToken<ViewRegistry>`; `provideViews(registry)` returns a provider that binds the token. Nothing in `RenderSpecComponent` / `RenderElementComponent` (the engine) ever calls `inject(VIEW_REGISTRY)`. No code anywhere in the repo (libs, apps, cockpit, examples) injects it either. The render README documents the token as "for consumers to inject directly," but absent any engine consumption that's a documented dead surface.
2. **`@threadplane/chat` re-exports the render token.** `libs/chat/src/public-api.ts:155` re-exports `provideViews` + `VIEW_REGISTRY`. This leaks render's tokens into chat's surface and conflates two libraries' concerns. Chat has its OWN markdown registry token (`MARKDOWN_VIEW_REGISTRY`) consumed by `markdown-children.component.ts` and provided by `<chat-streaming-md>` (factory backed by the `[viewRegistry]` input or `cacheplaneMarkdownViews` default).
3. **The chat README's "Override individual node renderers" example is broken in three ways** simultaneously:
   - Wrong token — uses `provideViews()` (which provides render's `VIEW_REGISTRY`) when the chat markdown components read `MARKDOWN_VIEW_REGISTRY`.
   - Wrong helper semantics — `withViews(base, additions)` is implemented `{ ...additions, ...base }`, so `base` wins. Its doc comment is explicit: it ADDS new keys, it does NOT override.
   - Wrong key — the example uses `'code'`, but the registered node type is `'code-block'` (per `cacheplaneMarkdownViews`).

   A consumer following the README sees no effect at all.

Plus three unrelated leftovers from prior PRs:

4. **`@threadplane/ag-ui` README does not document the new `Agent.interrupt` signal or `submit({ resume })`** that PR #567 shipped — the merge resolution took main's older README, intentionally deferring docs.
5. **Cockpit Playwright `test-results/` dirs are untracked** under the two new ag-ui example apps; no gitignore pattern covers them.
6. **`cockpit-registry`'s `tracks implemented python assets for every approved capability topic` test fails** because the `chat/generative-ui` manifest entry expects `cockpit/chat/generative-ui/python/prompts/generative-ui.md` (the topic-named convention), but the actual file is `dashboard.md`. The example's airline-KPI-dashboard graph reads `dashboard.md` directly.

## Goals

- Stop documenting and exporting public APIs with no behavior.
- Restore one consistent override story for chat's markdown views, with the documented example actually working.
- Document the new ag-ui interrupt feature on both library and website surfaces.
- Drop the `cockpit-registry` test back to green; gitignore Playwright detritus.

## Decisions (from brainstorming)

- **Render `VIEW_REGISTRY`:** wire it into the engine as a fallback (input → `RENDER_CONFIG.registry` → `VIEW_REGISTRY` → null). Make the documented public API real for direct render consumers, instead of removing it.
- **Composition helper:** add a new `overrideViews(base, overrides)` to `@threadplane/render` with override semantics. Keep `withViews` semantics unchanged (additive — its name and doc match).
- **Chat re-export:** drop `provideViews` + `VIEW_REGISTRY` from `@threadplane/chat`'s public surface. Render's tokens belong to render. Acceptable under the patch-only `0.0.x` release policy.
- **Markdown override docs:** the canonical path is `{ provide: MARKDOWN_VIEW_REGISTRY, useValue: overrideViews(cacheplaneMarkdownViews, { 'code-block': MyComp }) }`. Documented in chat README + chat markdown guide + render README + render views API page; theming continues to use the existing `--ngaf-chat-*` / `--a2ui-*` tokens (no re-documentation of theming, just a pointer).
- **ag-ui interrupts docs:** short subsection in `libs/ag-ui/README.md` + a new `apps/website/content/docs/ag-ui/guides/interrupts.mdx` page (parity with the existing langgraph guide), registered in `docs-config.ts`.
- **Nits:** rename `dashboard.md` → `generative-ui.md` to satisfy the topic-named convention (smaller, lower-risk than changing the manifest's path-building rule); gitignore `cockpit/**/angular/test-results/`.
- **Out of scope:** the blog post (separate brainstorming pass after this lands).

## Verified ground truth (from current source)

- `libs/chat/src/public-api.ts:155` — `export { provideViews, VIEW_REGISTRY } from '@threadplane/render';`
- `libs/render/src/lib/provide-views.ts` — `VIEW_REGISTRY` defined and assigned via `provideViews`; nothing else in `libs/render/src/lib` injects it.
- `libs/render/src/lib/views.ts:24-31` — `withViews` is `{ ...additions, ...base }` (additive only).
- `libs/chat/src/lib/markdown/markdown-view-registry.ts` — defines `MARKDOWN_VIEW_REGISTRY`; injected by `markdown-children.component.ts:41`.
- `libs/chat/src/lib/streaming/streaming-markdown.component.ts:51-58` — provides `MARKDOWN_VIEW_REGISTRY` via factory from `resolvedRegistry()`, which prefers the `[viewRegistry]` input over `cacheplaneMarkdownViews`.
- `libs/chat/src/lib/markdown/cacheplane-markdown-views.ts` — 22 entries for partial-markdown@0.2 node types; `'code-block'` is the actual fenced-code key, NOT `'code'`.
- `cockpit/chat/generative-ui/python/src/graph.py:31` — `(Path(...).parent.parent / "prompts" / "dashboard.md").read_text()`.
- `cockpit/chat/generative-ui/python/src/index.ts` — `promptAssetPaths: ['cockpit/chat/generative-ui/python/prompts/dashboard.md']`.
- Failing test: `libs/cockpit-registry/src/lib/manifest.spec.ts:119` — `fs.existsSync(assetPath)` returns false for `cockpit/chat/generative-ui/python/prompts/generative-ui.md` (the manifest's topic-named path) — but the on-disk file is `dashboard.md`.

## Scope (in/out)

**In scope:**
- Library code: render `overrideViews`, render engine resolution order, chat re-export drop.
- Library docs: `libs/render/README.md`, `libs/chat/README.md`, `libs/ag-ui/README.md`, `libs/chat/CHANGELOG.md`.
- Website docs: `apps/website/content/docs/render/api/views.mdx`, `apps/website/content/docs/chat/guides/markdown.mdx`, new `apps/website/content/docs/ag-ui/guides/interrupts.mdx`, `docs-config.ts` registration, regenerated `api-docs.json` (chat + render).
- Cockpit nit: rename `dashboard.md` → `generative-ui.md` + graph.py + descriptor edits.
- Root `.gitignore` pattern.

**Out of scope:**
- Blog post about the new ag-ui interrupt feature (planned separate brainstorming pass).
- Any change to chat's `MARKDOWN_VIEW_REGISTRY` API itself; we are documenting and using the existing surface, not redesigning it.
- Changing the manifest's path-building convention; the rename satisfies the existing convention.
- Touching the langgraph interrupts guide or other adapter docs.

---

## Design

### 1. Render — `overrideViews` helper (`libs/render/src/lib/views.ts`)

Add a sibling to `withViews`/`withoutViews` with inverted spread:

```ts
/**
 * Replaces views in a registry. Keys present in `overrides` win over `base`.
 * Use this when you want to swap an existing renderer; use `withViews` when
 * you want to add new node types without touching existing ones.
 */
export function overrideViews(
  base: ViewRegistry,
  overrides: Record<string, Type<unknown> | RenderViewEntry>,
): ViewRegistry {
  return Object.freeze({ ...base, ...overrides });
}
```

Export from `libs/render/src/lib/public-api.ts` alongside `withViews`/`withoutViews`. Add unit tests in `views.spec.ts` covering: override wins; absent key in overrides preserves base; original `base` reference unchanged; result is frozen.

### 2. Render — wire `VIEW_REGISTRY` into the engine

Add a small private helper to both `RenderSpecComponent` and `RenderElementComponent`:

```ts
private readonly fallbackRegistry = inject(VIEW_REGISTRY, { optional: true });

protected resolveRegistry(): ViewRegistry | null {
  return this.registry()                              // 1. [registry] input
      ?? this.config?.registry                        // 2. RENDER_CONFIG.registry
      ?? this.fallbackRegistry                        // 3. VIEW_REGISTRY token
      ?? null;                                        // 4. existing fallback
}
```

Replace every existing read of `this.registry() ?? this.config?.registry ?? null` (or equivalent) with `this.resolveRegistry()`. If the two components share enough that a tiny `resolve-registry.ts` utility makes sense, extract it; otherwise inline.

Unit tests (`render-spec.component.spec.ts`, `render-element.component.spec.ts`): four priority cases each — input wins over all; `RENDER_CONFIG` wins over `VIEW_REGISTRY`; `VIEW_REGISTRY` is used when neither input nor `RENDER_CONFIG.registry` is set; null when none provided.

### 3. Chat — drop the leaking re-export

In `libs/chat/src/public-api.ts`, remove line 155 (`export { provideViews, VIEW_REGISTRY } from '@threadplane/render';`). Confirm `nx test chat` stays green (chat does not internally inject either — verified). The `views`/`withViews`/`withoutViews`/`toRenderRegistry`/`cacheplaneMarkdownViews`/`MARKDOWN_VIEW_REGISTRY` exports stay where they are. Direct render consumers continue to import `provideViews`/`VIEW_REGISTRY` from `@threadplane/render`.

### 4. Chat README — rewrite the markdown override example

`libs/chat/README.md` — replace the broken "Override individual node renderers" block with:

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

Add a one-sentence pointer that theming uses the existing `--ngaf-chat-*` / `--a2ui-*` tokens documented in the Theming section (do not duplicate the theming surface). Note the per-instance alternative: `<chat-streaming-md [viewRegistry]="…" />`.

### 5. Chat markdown guide (`apps/website/content/docs/chat/guides/markdown.mdx`)

Apply the same correction end-to-end: `MARKDOWN_VIEW_REGISTRY` is the token; `overrideViews` is the helper; the actual node-type keys come from `cacheplaneMarkdownViews`. Include a compact node-type reference (the 22 keys with one-line descriptions). Link to the render API page for `views`/`withViews`/`withoutViews`/`overrideViews`/`toRenderRegistry`.

### 6. Render README

`libs/render/README.md` — under "DI providers", rewrite the `provideViews` description to reflect the new resolution order: `[registry]` input → `RENDER_CONFIG.registry` → `VIEW_REGISTRY` (provided via `provideViews`) → null. Add `overrideViews` to the composition-helper list alongside `withViews`/`withoutViews`. The previous "for consumers to inject directly" phrasing goes away — the engine now consumes it.

### 7. Render views API page (`apps/website/content/docs/render/api/views.mdx`)

Add a documented `overrideViews` entry parallel to `withViews`/`withoutViews` (signature, semantics, contrasting example). Update `provideViews` description with the engine resolution order.

### 8. Regenerated API JSON

Run `npm run generate-api-docs` to refresh `apps/website/content/docs/chat/api/api-docs.json` (will lose `provideViews`/`VIEW_REGISTRY` entries from chat) and `apps/website/content/docs/render/api/api-docs.json` (will gain `overrideViews`). Commit the regenerated files.

### 9. `libs/chat/CHANGELOG.md`

Add an Unreleased entry:

> **Changed:** `@threadplane/chat` no longer re-exports `provideViews` / `VIEW_REGISTRY` from `@threadplane/render`. Consumers using `<render-spec>` / `<render-element>` directly should import from `@threadplane/render`. For chat's markdown view overrides, provide `MARKDOWN_VIEW_REGISTRY` directly using `overrideViews(cacheplaneMarkdownViews, { … })` — the previously-documented `provideViews(withViews(…))` pattern never actually drove rendering.

### 10. ag-ui README — interrupt feature subsection

`libs/ag-ui/README.md` — add an "Interrupts (human-in-the-loop)" subsection under Capabilities:

- `agent.interrupt()` is a `Signal<AgentInterrupt | undefined>` populated from AG-UI `CUSTOM` / `on_interrupt` events. The reducer parses string-serialized `value` payloads (e.g. `ag-ui-langgraph` ships them via `dump_json_safe`) so consumers see the structured object.
- `agent.submit({ resume })` resumes the run via `runAgent({ forwardedProps: { command: { resume } } })`; the server reads `forwarded_props.command.resume`.
- One short example mirroring `cockpit/ag-ui/interrupts`: bind `<chat-approval-card matchKind="refund_approval">` and call `submit({ resume: { approved: true } })`.
- Link the langgraph interrupts guide for the broader HITL conceptual reference (same `Agent` contract).

### 11. New ag-ui interrupts guide (`apps/website/content/docs/ag-ui/guides/interrupts.mdx`)

Parity with `apps/website/content/docs/langgraph/guides/interrupts.mdx`. Short, focused content:

- The AG-UI event shape: `CUSTOM` event with `name: "on_interrupt"`, `value`: the structured payload from the backend (e.g. `{ kind, ... }`).
- The resume mechanism: `submit({ resume })` → `runAgent({ forwardedProps: { command: { resume } } })` → server reads `forwarded_props.command.resume`.
- The component side: bind `<chat-approval-card matchKind="…">`, the structured payload shape, approve/reject actions.
- Pointer at the working `cockpit/ag-ui/interrupts` example.

Register the new page in `apps/website/src/lib/docs-config.ts` under the existing `ag-ui` library's `Guides` section, placed adjacent to the existing guides (fake-agent, citations, troubleshooting).

### 12. Root `.gitignore`

Add a single pattern covering current and future cockpit examples:

```
cockpit/**/angular/test-results/
```

Verify no committed `test-results/` path exists in any cockpit example (`git ls-files cockpit/ | grep test-results`) before committing.

### 13. Cockpit chat/generative-ui prompt rename

- `git mv cockpit/chat/generative-ui/python/prompts/dashboard.md cockpit/chat/generative-ui/python/prompts/generative-ui.md`
- `cockpit/chat/generative-ui/python/src/graph.py:31` — `"dashboard.md"` → `"generative-ui.md"`.
- `cockpit/chat/generative-ui/python/src/index.ts` `promptAssetPaths` — `prompts/dashboard.md` → `prompts/generative-ui.md`.
- Verify: `npx nx test cockpit-registry` (the previously-failing test goes green); `npx nx smoke cockpit-chat-generative-ui-python` still passes.

---

## Testing strategy

- Unit tests for `overrideViews` (§1) and the render-engine resolution order (§2, both components, four priority cases each).
- `nx test chat` green after the re-export drop (§3). `nx test render` green.
- `nx test cockpit-registry` green after the prompt rename (§13).
- Manual confirmation that `nx run-many -t build` for `render`, `chat`, `ag-ui`, and both `cockpit-ag-ui-*-angular` apps stays green throughout (no API contract regression in chat from the drop).
- `npm run generate-api-docs` runs cleanly and the regenerated files are committed (§8).
- Docs site `nx build website` succeeds after the new ag-ui interrupts guide (§11) is added and registered (§ `docs-config.ts`).

## Success criteria

- `@threadplane/render` exports `overrideViews`; `RenderSpecComponent` and `RenderElementComponent` resolve registries through the new four-step priority.
- `@threadplane/chat` no longer exports `provideViews` / `VIEW_REGISTRY`.
- The chat README markdown override example, the chat markdown guide, and the render README/views API page all describe the corrected story consistently.
- `libs/ag-ui/README.md` documents `Agent.interrupt` + `submit({ resume })`.
- `/docs/ag-ui/guides/interrupts` exists, registered in the nav, mirroring the langgraph guide's depth.
- Cockpit Playwright `test-results/` dirs ignored repo-wide.
- `nx test cockpit-registry` is green.
- `npm run generate-api-docs` produces no spurious diff after the work; the committed API JSON matches the source.
