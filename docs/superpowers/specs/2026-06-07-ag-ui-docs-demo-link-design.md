# AG-UI Demo Discoverability + Docs Polish

**Date:** 2026-06-07
**Status:** Design / spec
**Scope:** Website (`apps/website`) — surface the AG-UI live demo, present LangGraph + AG-UI demos as a paired choice everywhere a demo is referenced, rebuild the homepage demo section, and close the remaining AG-UI docs gaps. No `@threadplane/*` library source changes.

---

## Goal

Make the AG-UI live demo (`ag-ui.threadplane.ai`, shipped earlier) discoverable, and present it as a first-class peer to the LangGraph demo across the marketing site, while closing two AG-UI docs gaps surfaced during the reassessment.

Five workstreams:

- **A — Paired demo CTAs site-wide.** Everywhere "the demo" is referenced, show **two parallel CTAs** (LangGraph + AG-UI), driven by one shared source of truth.
- **B — Homepage demo section rebuild.** Replace the single embedded LangGraph iframe with a **tabbed, video-first** section that shows both demos large and launches the live interactive embed on click.
- **C — AG-UI docs demo link.** A context-scoped demo link in the AG-UI docs nav + AG-UI-specific content callouts.
- **D — API reference nav.** Author parity AG-UI API mdx pages and wire the `API Reference` nav section.
- **E — Custom-events guide.** A dedicated guide for the `AgUiAgent.customEvents` signal (#606).

## Non-Goals (YAGNI)

- No `/ag-ui` product/landing-page redesign (no hero "See it live" button, no landing iframe). The landing page is out of scope.
- No `libs/ag-ui` (or any library) source changes. API reference content is authored prose.
- No new backend/runtime; the demos already exist (`demo.threadplane.ai`, `ag-ui.threadplane.ai`).
- The chat product page's "See it live →" (→ cockpit) and the homepage Hero screenshot (→ cockpit example) are **examples** links, not demo links — left unchanged.

---

## Decisions locked during brainstorming

- **FinalCTA:** two demo buttons (LangGraph + AG-UI) **and** keep the existing cockpit "See each feature in action →" ghost secondary.
- **Navbar:** the single global "Demo" link becomes a **"Demo ▾" dropdown** (desktop) listing LangGraph + AG-UI; mobile renders the two as separate entries.
- **Homepage:** **Layout A — tabbed single large frame** (LangGraph | AG-UI tabs, LangGraph-first), **video-first**: each tab opens with a looping muted recording and a "Launch live demo ▶" overlay that swaps in the real interactive iframe on click. Approved composition copy: eyebrow "See it running", headline "One chat UI. Two runtimes. Same code.", parity subhead, paired CTAs + cockpit ghost, caption.

---

## Architecture

### Single source of truth for demos

New `apps/website/src/lib/demos.ts`:

```ts
export interface DemoTarget {
  /** Stable key for analytics cta_id suffixes. */
  key: 'langgraph' | 'ag-ui';
  /** Button/link label (without trailing arrow — callers add it). */
  label: string;
  href: string;
}

export const DEMOS: DemoTarget[] = [
  { key: 'langgraph', label: 'LangGraph demo', href: 'https://demo.threadplane.ai' },
  { key: 'ag-ui', label: 'AG-UI demo', href: 'https://ag-ui.threadplane.ai' },
];
```

Every demo surface reads from `DEMOS`, so adding/retargeting a demo is a one-line change.

### Workstream A — Paired demo CTAs site-wide

| Surface | File | Change |
| --- | --- | --- |
| Reusable button pair | `apps/website/src/components/landing/DemoCtaPair.tsx` (new) | Renders the two `DEMOS` entries as parallel `Button`s (props: `size`, primary/secondary `variant` per entry, per-click analytics `cta_id` = `${surface}_demo_${key.replace(/-/g,'_')}`, i.e. `ag-ui` → `ag_ui`). |
| FinalCTA (9 pages) | `apps/website/src/components/landing/FinalCTA.tsx` | Replace the single `primary` "Try the demo →" with `<DemoCtaPair>`; **keep** the cockpit `secondary` ghost. Preserve existing per-page `primary`/`secondary` override props for callers that pass them (default path uses the pair). |
| Navbar (desktop) | `apps/website/src/components/shared/Nav.tsx` | Replace the `Demo` entry in `links` with a **"Demo ▾" dropdown** (reuse the click-outside dropdown pattern from `DocsSidebar`'s `LibraryDropdown`) listing the `DEMOS` entries. |
| Navbar (mobile) | `apps/website/src/components/shared/Nav.tsx` | In the mobile site-links list, render the `DEMOS` entries as two rows ("LangGraph demo", "AG-UI demo") in place of the single "Demo" row. |
| Footer | `apps/website/src/components/shared/Footer.tsx` | Replace the single "Demo" link with two links from `DEMOS`. |

Analytics: each rendered link/button keeps `trackExternalLinkClick`/`trackCtaClick` with distinct `cta_id`s (`nav_demo_langgraph`, `nav_demo_ag_ui`, `footer_demo_langgraph`, `final_cta_demo_langgraph`, etc.) so click attribution survives the split.

### Workstream B — Homepage demo section rebuild

New `apps/website/src/components/landing/DemoShowcase.tsx` (client component) replaces the `LiveDemoFrame` usage at `apps/website/src/app/page.tsx:115`. Structure (approved):

- Eyebrow "See it running" · headline "One chat UI. Two runtimes. Same code." · parity subhead.
- **Tabs**: `LangGraph | AG-UI` (LangGraph default). Tab state is local (`useState`).
- **Frame** (`BrowserFrame`): per active tab, render the **video-first** state — a looping, muted, `playsInline`, `autoPlay` `<video>` (poster = a static screenshot fallback) with a "Launch live demo ▶" overlay button. Clicking the overlay (or the matching CTA) swaps that tab to the live `<iframe src={demo.href}>` (lazy; only mounts on launch). Switching tabs returns to the video state unless that tab was already launched (track launched-tab set).
- **Paired CTAs** beneath: `<DemoCtaPair>` + cockpit "See each feature in action →" ghost.
- Caption: "Video loops instantly · click Launch to open the live, interactive demo · MIT · no signup".

**Video assets** (`apps/website/public/demo/`): `langgraph-demo.mp4` + `.webm`, `ag-ui-demo.mp4` + `.webm`, plus `langgraph-demo-poster.webp` / `ag-ui-demo-poster.webp`. Each video is a ~15–25s screen capture of a real run (prompt → streaming answer → a2ui surface render), encoded small (target < 2–3 MB, H.264 + VP9). Production is a discrete task.

**Shippability guard:** the section must render correctly **before** the videos exist — if a video asset is missing, the tab shows the poster image (or a screenshot) with the launch overlay, so the section degrades to a static-poster + launch-to-live state. Video is layered in without blocking the rest.

`LiveDemoFrame.tsx` is removed once `DemoShowcase` replaces its only usage (confirm no other importers first; reconnaissance shows only `page.tsx`).

### Workstream C — AG-UI docs demo link (context-scoped)

Add optional fields to `DocsLibrary` in `apps/website/src/lib/docs-config.ts`:

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

Set `demoUrl: 'https://ag-ui.threadplane.ai'` on the AG-UI entry only. Render a "Live demo ↗" link:
- **Desktop:** `apps/website/src/components/docs/DocsSidebar.tsx` — under the `LibraryDropdown`, shown only when `libConfig?.demoUrl`.
- **Mobile:** `apps/website/src/components/shared/Nav.tsx` docs-tab path — same, when `currentLib?.demoUrl`.

**AG-UI-specific content callouts** (the "augment AG-UI content" ask): add a demo callout/link to:
- `apps/website/content/docs/ag-ui/getting-started/introduction.mdx`
- `apps/website/content/docs/ag-ui/getting-started/quickstart.mdx`

using the callout/link primitives already used in the AG-UI mdx (matched at implementation time). Both point at `https://ag-ui.threadplane.ai`.

### Workstream D — API reference nav

Mirror the langgraph pattern (hand-authored mdx + generated `api-docs.json`, wired via an `id: 'api'` section). The `@threadplane/ag-ui` public surface: `toAgent`, `provideAgent`, `injectAgent`, `provideFakeAgent`, `bridgeCitationsState`, `FakeAgent`; types `AgUiAgent`, `AgentConfig`, `ToAgentOptions`, `CustomStreamEvent`.

**4 core API pages** under `apps/website/content/docs/ag-ui/api/`:

| Page (`<slug>.mdx`) | Primary symbol | Folds in |
| --- | --- | --- |
| `provide-agent` | `provideAgent()` | `AgentConfig` |
| `inject-agent` | `injectAgent()` | `AgUiAgent` returned contract incl. `customEvents` (cross-link to custom-events guide) |
| `to-agent` | `toAgent()` | `ToAgentOptions`, `CustomStreamEvent` |
| `fake-agent` | `provideFakeAgent()` + `FakeAgent` | testing surface |

`bridgeCitationsState` is cross-linked from `guides/citations.mdx` rather than given its own page.

Wire a new section into the AG-UI entry of `docs-config.ts` (after `Reference`):

```ts
{
  title: 'API Reference', id: 'api', color: 'blue',
  pages: [
    { title: 'provideAgent()', slug: 'provide-agent', section: 'api' },
    { title: 'injectAgent()', slug: 'inject-agent', section: 'api' },
    { title: 'toAgent()', slug: 'to-agent', section: 'api' },
    { title: 'FakeAgent', slug: 'fake-agent', section: 'api' },
  ],
},
```

Re-run `npm run generate-api-docs`; commit refreshed `api-docs.json` only if it changes.

### Workstream E — Custom-events guide

New `apps/website/content/docs/ag-ui/guides/custom-events.mdx`, added to the AG-UI `Guides` section in `docs-config.ts` (after `citations`). Outline:

- `customEvents`: AG-UI `CUSTOM` events (other than `on_interrupt`) accumulate into `AgUiAgent.customEvents` — `Signal<CustomStreamEvent[]>`, `CustomStreamEvent = { name: string; data: unknown }`, reset on `RUN_STARTED`.
- Backend side: LangGraph `get_stream_writer()` → `stream_mode='custom'` → AG-UI `CUSTOM` → an entry in `customEvents()`.
- Worked example: consuming `agent.customEvents()` for live/progressive a2ui surface updates during a run.
- Cross-links: `concepts/architecture.mdx`, `reference/event-mapping.mdx` (CUSTOM row), `api/inject-agent.mdx`.
- AG-UI doc voice (recent voice pass): no fabricated anecdotes, trimmed technical register.

---

## Files touched (summary)

**New:** `lib/demos.ts`, `components/landing/DemoCtaPair.tsx`, `components/landing/DemoShowcase.tsx`, `public/demo/{langgraph,ag-ui}-demo.{mp4,webm}` + posters, `content/docs/ag-ui/api/{provide-agent,inject-agent,to-agent,fake-agent}.mdx`, `content/docs/ag-ui/guides/custom-events.mdx`.

**Modified:** `lib/docs-config.ts` (DocsLibrary fields + ag-ui demoUrl + API section + custom-events guide entry), `components/landing/FinalCTA.tsx`, `components/shared/Nav.tsx` (desktop demo dropdown + mobile entries + docs demo link), `components/shared/Footer.tsx`, `app/page.tsx` (swap LiveDemoFrame → DemoShowcase), `components/docs/DocsSidebar.tsx`, `content/docs/ag-ui/getting-started/{introduction,quickstart}.mdx`, `content/docs/ag-ui/guides/citations.mdx`.

**Removed:** `components/landing/LiveDemoFrame.tsx` (after confirming sole importer).

---

## Error handling / edge cases

- **Missing video asset:** `DemoShowcase` falls back to poster/screenshot + launch overlay; never a broken `<video>`. Section ships before videos are produced.
- **Demo iframe cold-load:** the video-first default hides the cold-load entirely; the live iframe mounts only on explicit launch.
- **Libraries without `demoUrl`:** render no docs demo link (guard on truthiness). Only AG-UI sets it.
- **FinalCTA per-page overrides:** pages currently passing a custom `primary`/`secondary` keep that behavior; only the default closer renders the pair.
- **Analytics:** distinct `cta_id`s per demo so the LangGraph/AG-UI split is measurable.

## Testing / verification

Static Next.js site + mdx. Per workstream:

- **Build:** website build succeeds with new components, mdx pages, and nav entries; no broken internal links.
- **Lint/typecheck:** `demos.ts`, the two new components, the `DocsLibrary` interface change, and all edited components typecheck and lint clean.
- **Demo CTAs:** FinalCTA shows two demo buttons + cockpit ghost on a sampled page; navbar shows the Demo dropdown (desktop) and two entries (mobile); footer shows two demo links; each links to the correct host.
- **Homepage:** `DemoShowcase` renders tabs; default tab shows the video-first state with launch overlay (poster fallback when video absent); launching mounts the live iframe; CTAs resolve.
- **AG-UI docs:** sidebar (desktop) + mobile docs tab show the "Live demo ↗" link only on AG-UI; introduction/quickstart callouts resolve to `ag-ui.threadplane.ai`.
- **API reference:** the `API Reference` section appears in the AG-UI sidebar with 4 pages; pages render; `generate-api-docs` yields no unexpected diff.
- **Custom-events guide:** appears in AG-UI Guides; renders; cross-links resolve.
- **No regressions:** other libraries' nav unchanged; the chat "See it live"/Hero-screenshot examples links unchanged.

If the website has an existing docs/landing e2e harness, add minimal assertions (demo dropdown present; AG-UI sidebar demo link + API section present). Otherwise rely on build + manual verification. Video production is verified by visual review of the recorded clips.

---

## Decomposition (for the plan)

Order chosen to minimize churn on the two shared files (`docs-config.ts`, `Nav.tsx`):

1. **A1 — `demos.ts` + `DemoCtaPair`** (foundation; no behavior change yet).
2. **A2 — FinalCTA** uses the pair (keep cockpit ghost).
3. **A3 — Footer** two demo links.
4. **A4 — Navbar** desktop Demo dropdown + mobile two entries.
5. **B1 — `DemoShowcase`** component (tabbed, video-first, poster fallback) + swap on homepage; remove `LiveDemoFrame`.
6. **B2 — Demo video assets** (record/encode/host) — discrete production task; section already ships with posters.
7. **C1 — `DocsLibrary.demoUrl`** + DocsSidebar + Nav mobile docs link + ag-ui `demoUrl`.
8. **C2 — AG-UI content callouts** (introduction, quickstart).
9. **D — API reference**: 4 mdx pages + `docs-config` API section + citations cross-link + api-docs regen.
10. **E — Custom-events guide**: mdx + `docs-config` guides entry.

Single PR is feasible but large; recommend splitting into **(i) demo CTAs + homepage (A+B)** and **(ii) AG-UI docs C+D+E** as two PRs for reviewability. Video assets (B2) can be a third, follow-on PR if not ready when (i) merges.
