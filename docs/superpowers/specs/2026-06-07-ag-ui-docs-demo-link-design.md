# AG-UI Docs Polish — Demo Link + API Reference + Custom-Events Guide

**Date:** 2026-06-07
**Status:** Design / spec
**Scope:** Website docs surface for the `@threadplane/ag-ui` adapter. No library code changes, no `/ag-ui` marketing-landing-page changes.

---

## Goal

Close the three concrete AG-UI website/docs gaps surfaced by the reassessment against latest `main`:

1. **Demo link** — the live demo we shipped at `ag-ui.threadplane.ai` is not linked anywhere on the site. Surface it as a **context-scoped** link in the AG-UI docs navigation (not the global navbar).
2. **API Reference nav (B)** — AG-UI has a generated `api-docs.json` but, unlike langgraph/render/chat, no hand-authored API Reference section in the docs nav. Author parity API pages and wire the section.
3. **Custom-events guide (C)** — the `AgUiAgent.customEvents` signal (shipped in #606 for live a2ui streaming) is mentioned only in passing. Add a dedicated guide.

## Non-Goals (YAGNI)

- No changes to the global top navbar `links` array (`Demo` / `Examples` stay as-is, pointing at the LangGraph demo + cockpit).
- No `/ag-ui` product/landing page changes (no hero "See it live" button, no embedded iframe on the landing page).
- No global "demos" dropdown menu. The `demoUrl` config field makes that trivial later, but it is out of scope now.
- No library (`libs/ag-ui`) source changes. API reference content is authored prose mirroring the existing langgraph API mdx pages.

---

## Architecture & key decisions

### Where the demo link lives

The global top navbar (`apps/website/src/components/shared/Nav.tsx`, `links` array) is **global and single-valued** — it already carries one `Demo` → `https://demo.threadplane.ai` (LangGraph) and one `Examples` → `https://cockpit.threadplane.ai`. A second, library-specific "AG-UI Demo" entry there would clutter it and make "Demo" ambiguous.

Instead the demo link is attached to the **per-library docs config** and rendered only in the **contextual docs navigation**, which already knows which library you are viewing:

- **Desktop:** `apps/website/src/components/docs/DocsSidebar.tsx` — a "Live demo ↗" link rendered directly under the `LibraryDropdown`, shown only when the active library config defines a `demoUrl`.
- **Mobile:** `apps/website/src/components/shared/Nav.tsx` — the docs-tab rendering path (NOT the global site `links`) renders the same link when the selected library config defines a `demoUrl`.

The global navbar is therefore **untouched**. The link appears only while reading AG-UI docs.

This is driven by adding optional fields to the `DocsLibrary` interface in `apps/website/src/lib/docs-config.ts`:

```ts
export interface DocsLibrary {
  id: LibraryId;
  title: string;
  description: string;
  /** Optional external live-demo URL, surfaced contextually in docs nav. */
  demoUrl?: string;
  /** Optional label override for the demo link. Defaults to 'Live demo'. */
  demoLabel?: string;
  sections: DocsSection[];
}
```

For the AG-UI library entry: `demoUrl: 'https://ag-ui.threadplane.ai'`. No other library sets `demoUrl` in this change, so nothing else renders a demo link.

A complementary in-content callout is added to `apps/website/content/docs/ag-ui/getting-started/introduction.mdx` so on-page readers also see the demo link (using whatever callout/link primitives the existing AG-UI mdx already uses — to be matched at implementation time).

### API Reference (B)

Mirror the langgraph pattern exactly. langgraph has `apps/website/content/docs/langgraph/api/{inject-agent,provide-agent,fetch-stream-transport,mock-stream-transport}.mdx` plus a generated `api-docs.json`, wired via an `API Reference` section (`id: 'api'`) in `docs-config.ts`.

The `@threadplane/ag-ui` public surface (from `libs/ag-ui/src/public-api.ts`):

- Functions: `toAgent(source, options?) → AgUiAgent`, `provideAgent(configOrFactory) → Provider[]`, `injectAgent() → Agent`, `provideFakeAgent(config?) → Provider[]`, `bridgeCitationsState(thread, messages) → Message[]`
- Class: `FakeAgent`
- Types: `AgUiAgent` (extends `Agent` with `customEvents: Signal<CustomStreamEvent[]>`), `AgentConfig`, `ToAgentOptions`, `CustomStreamEvent`

**Decision: 4 core API pages (parity with langgraph):**

| Page (`api/<slug>.mdx`) | Primary symbol | Folds in |
| --- | --- | --- |
| `provide-agent` | `provideAgent()` | `AgentConfig` |
| `inject-agent` | `injectAgent()` | `AgUiAgent` returned contract, incl. `customEvents` (cross-link to custom-events guide) |
| `to-agent` | `toAgent()` | `ToAgentOptions`, `CustomStreamEvent` (lower-level adapter entrypoint) |
| `fake-agent` | `provideFakeAgent()` + `FakeAgent` | testing surface |

`bridgeCitationsState` is niche — it is cross-linked from the existing `guides/citations.mdx` rather than given its own API page.

Wire these into a new `API Reference` section (`id: 'api'`, after `Reference`) in the AG-UI entry of `docs-config.ts`:

```ts
{
  title: 'API Reference',
  id: 'api',
  color: 'blue',
  pages: [
    { title: 'provideAgent()', slug: 'provide-agent', section: 'api' },
    { title: 'injectAgent()', slug: 'inject-agent', section: 'api' },
    { title: 'toAgent()', slug: 'to-agent', section: 'api' },
    { title: 'FakeAgent', slug: 'fake-agent', section: 'api' },
  ],
},
```

The generated `api-docs.json` is already current (regenerated in #606, confirmed during reconnaissance). Implementation re-runs `npm run generate-api-docs` and commits only if the output changes.

### Custom-events guide (C)

New `apps/website/content/docs/ag-ui/guides/custom-events.mdx`, added to the AG-UI `Guides` section in `docs-config.ts` (after `citations`, before `interrupts` — both are CUSTOM-event features so they sit together).

Content outline:
- What `customEvents` is: AG-UI `CUSTOM` events (other than `on_interrupt`) accumulate into the `AgUiAgent.customEvents` signal — `Signal<CustomStreamEvent[]>` where `CustomStreamEvent = { name: string; data: unknown }`. Reset on `RUN_STARTED`.
- The backend side: a LangGraph `get_stream_writer()` → `stream_mode='custom'` emit becomes an AG-UI `CUSTOM` event becomes an entry in `customEvents()`.
- Worked example: consuming `agent.customEvents()` for live/progressive a2ui surface updates during a run.
- Cross-links: `concepts/architecture.mdx` (where customEvents is mentioned), `reference/event-mapping.mdx` (the CUSTOM row), and `api/inject-agent.mdx` (the signal on the returned agent).
- Match the established AG-UI doc voice (per the recent voice pass): no fabricated anecdotes, trimmed technical register.

---

## Components / files touched

**Config (shared by all three):**
- `apps/website/src/lib/docs-config.ts` — add `demoUrl`/`demoLabel` to `DocsLibrary`; set `demoUrl` on ag-ui; add `API Reference` section; add `custom-events` to Guides.

**Demo link:**
- `apps/website/src/components/docs/DocsSidebar.tsx` — render contextual "Live demo ↗" link when `libConfig?.demoUrl`.
- `apps/website/src/components/shared/Nav.tsx` — render the same in the mobile docs-tab path when `currentLib?.demoUrl`.
- `apps/website/content/docs/ag-ui/getting-started/introduction.mdx` — in-content demo callout.

**API Reference:**
- `apps/website/content/docs/ag-ui/api/provide-agent.mdx` (new)
- `apps/website/content/docs/ag-ui/api/inject-agent.mdx` (new)
- `apps/website/content/docs/ag-ui/api/to-agent.mdx` (new)
- `apps/website/content/docs/ag-ui/api/fake-agent.mdx` (new)
- `apps/website/content/docs/ag-ui/guides/citations.mdx` — add `bridgeCitationsState` cross-link.

**Custom-events guide:**
- `apps/website/content/docs/ag-ui/guides/custom-events.mdx` (new)

---

## Data flow (demo link)

`docs-config.ts` (`DocsLibrary.demoUrl`) → consumed by `DocsSidebar.tsx` (desktop) and `Nav.tsx` mobile docs path → renders an external anchor (`target="_blank" rel="noopener noreferrer"`) with analytics tracking matching the existing `trackExternalLinkClick` pattern (e.g. `cta_id: 'docs_sidebar_demo'` / `'mobile_nav_demo'`, `cta_text` from `demoLabel`).

## Error handling / edge cases

- Libraries without `demoUrl` render no demo link (the common case). Guard with a simple truthiness check.
- The demo link is external and unauthenticated; no app state depends on it.
- API mdx pages are static content; the only failure mode is a broken internal cross-link — caught by the website build + any link-check in CI.

## Testing / verification

This is a static Next.js docs + mdx change. Verification per workstream:

- **Build:** `nx build website` (or the repo's website build target) succeeds with the new mdx pages and nav entries.
- **Lint/typecheck:** the `docs-config.ts` interface change and the two component edits typecheck (`nx lint website` / `tsc`).
- **Nav rendering:** the new API Reference section and `custom-events` guide appear in the AG-UI sidebar; the "Live demo" link appears only on AG-UI docs (desktop sidebar + mobile docs tab) and resolves to `https://ag-ui.threadplane.ai`.
- **Cross-links:** new pages' internal links resolve (no 404s in build).
- **No regressions:** other libraries' nav is unchanged; global navbar is unchanged.
- **API docs regen:** `npm run generate-api-docs` produces no unexpected diff (or commit the refreshed `api-docs.json` if it does).

A Playwright/visual smoke is optional; if the website has an existing docs e2e harness, add a minimal assertion that the AG-UI sidebar shows the demo link and the API Reference section. Otherwise rely on build + manual verification.

---

## Decomposition (for the plan)

Three largely independent workstreams; `docs-config.ts` is the one shared file (sequence its edits to avoid churn):

- **A — Demo link:** config field + DocsSidebar + Nav mobile + introduction callout.
- **B — API reference:** 4 API mdx pages + config `API Reference` section + citations cross-link + api-docs regen check.
- **C — Custom-events guide:** 1 guide mdx + config Guides entry.

Suggested order: A, then B, then C (each appends to `docs-config.ts`, minimizing conflicts). Single PR, or one PR per workstream if review prefers smaller diffs.
