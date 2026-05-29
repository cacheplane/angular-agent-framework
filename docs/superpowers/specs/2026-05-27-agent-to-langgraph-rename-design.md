# Agent → LangGraph Docs Rename & Adapter API Symmetry

**Status:** Design — ready for plan
**Date:** 2026-05-27
**Owner:** Brian Love

## Background

The library at `libs/langgraph/` (published as `@threadplane/langgraph` v0.0.47) is the LangChain/LangGraph adapter for `@threadplane/chat`. Its underlying package was renamed from `agent` to `langgraph` at the code level, but the website, content directory, public routes, README messaging, telemetry slugs, and the library's public API surface still carry the older `agent` label and a factory pattern that does not match the sibling `@threadplane/ag-ui` adapter.

This creates two problems:

1. **Discoverability.** Developers landing on `/docs/agent` or reading `@threadplane/langgraph`'s README cannot easily tell that the library is LangGraph-specific, or how it relates to the sibling `@threadplane/ag-ui` adapter that ships in the same monorepo.
2. **API asymmetry.** Swapping between the two adapters today requires different import shapes, different DI patterns (`agent()` factory vs `inject(AG_UI_AGENT)`), and different config-type names. Each adapter exported whatever its implementation needed, not a coherent contract.

This design covers a single coordinated cleanup that fixes both: rename the public docs surface from `agent` to `langgraph`, reshape both adapter public APIs to a symmetric three-export contract, add a "Choosing an adapter" docs page that makes the LangGraph-vs-AG-UI decision explicit, and sweep the codebase for residual stale references using parallel subagents.

## Goals

1. Eliminate the stale `agent` library label across the public surface: website routes, content, READMEs, package metadata, telemetry.
2. Make it explicit and discoverable that `@threadplane/langgraph` is the LangChain/LangGraph adapter, and `@threadplane/ag-ui` is the AG-UI protocol adapter — both consume the runtime-neutral `Agent` contract from `@threadplane/chat`.
3. Achieve API symmetry between the two adapters so the getting-started flow is parallel: each lib exports `provideAgent()`, `injectAgent()`, and `AgentConfig` — and consumer code is byte-identical regardless of which adapter is wired in `app.config.ts`.
4. Add a "Choosing an adapter" docs page and link it prominently from both library landing pages and the docs index.

## Non-goals

- Renaming the `Agent` / `AbstractAgent` contract types in `@threadplane/chat` — they're runtime-neutral by design.
- Renaming the `[agent]` template binding on `<chat>` — also part of the neutral contract.
- Backwards-compat redirects (`/docs/agent/* → /docs/langgraph/*`). User explicitly accepted that external links to `/docs/agent/*` will 404.
- Deprecated export aliases. User explicitly accepted the breaking-change cost at 0.0.x.
- Touching historical specs/plans under `docs/superpowers/` — they're frozen artifacts.
- Migrating PostHog historical events. We accept the telemetry seam at the rename point and note it in the next weekly GTM snapshot.
- Aligning the adapter **testing** surface (`mockLangGraphAgent` vs `FakeAgent`). Tracked separately in `project_adapter_testing_surface_alignment.md` as phase 2.

## Target API: symmetric adapter surface

Both `@threadplane/langgraph` and `@threadplane/ag-ui` will export exactly three things for agent wiring:

| Surface | `@threadplane/langgraph` | `@threadplane/ag-ui` |
|---|---|---|
| Provider | `provideAgent(config)` | `provideAgent(config)` |
| Config type | `AgentConfig` | `AgentConfig` |
| Inject helper | `injectAgent()` | `injectAgent()` |
| Agent token (DI) | `AGENT` — **internal**, not exported | `AGENT` — **internal**, not exported |
| Adapter-specific testing | `mockLangGraphAgent`, `MockAgentTransport`, `FetchStreamTransport` | `FakeAgent`, `provideFakeAgent` |
| Adapter-specific helpers | `LangGraphThreadsAdapter`, `createLangGraphClient`, `refreshOnRunEnd`, `refreshOnTransition`, `extractCitations` | `toAgent`, `bridgeCitationsState` |
| Adapter-specific types | `LangGraphAgent`, `LangGraphMultitaskStrategy`, `LangGraphSubmitOptions`, `AgentOptions`, `AgentBranchTree*`, `AgentQueue*`, `AgentTransport`, `StreamEvent`, `CustomStreamEvent`, `SubagentStreamRef`, SDK re-exports | `ToAgentOptions` |

**Removed from public surface:**

- From `@threadplane/langgraph`: `agent` (the factory function), `AGENT_CONFIG`
- From `@threadplane/ag-ui`: `AG_UI_AGENT`, `injectAgUiAgent`, `provideAgUiAgent`, `provideFakeAgUiAgent`, `AgUiAgentConfig`, `FakeAgUiAgentConfig`

**Consumer code becomes identical regardless of adapter:**

```ts
// app.config.ts — pick your adapter on this line only
import { provideAgent } from '@threadplane/langgraph'; // or '@threadplane/ag-ui'

export const appConfig: ApplicationConfig = {
  providers: [provideAgent({ /* adapter-specific config */ })],
};

// component — identical across adapters
import { injectAgent } from '@threadplane/langgraph'; // or '@threadplane/ag-ui'

@Component({ imports: [ChatComponent], template: `<chat [agent]="agent" />` })
export class App {
  protected readonly agent = injectAgent();
}
```

**Mixed-adapter apps (rare).** If a single app needs both adapters, name collisions on `provideAgent`, `injectAgent`, and `AgentConfig` are resolved with import renaming:

```ts
import { provideAgent as provideLangGraphAgent } from '@threadplane/langgraph';
import { provideAgent as provideAgUiAgent } from '@threadplane/ag-ui';
```

Each lib defines its own private `InjectionToken` instance, so DI itself does not collide — the import renames above fully resolve the disambiguation. Mixing both adapters in one app is still rare and largely undocumented; the "Choosing an adapter" page recommends picking one per app rather than treating mixed use as a supported pattern.

## The rename surface

### Library code (libs/langgraph + libs/ag-ui)

**`libs/langgraph/src/public-api.ts`** — restrict surface:

- Remove: `agent` (factory function), `AGENT_CONFIG`
- Add: `injectAgent()` — thin wrapper over `inject(AGENT)` where `AGENT` is the now-internal token previously implicit in `agent()`'s factory implementation
- Keep: `provideAgent`, `AgentConfig` (type), lifecycle exports, transport exports, LangGraph-prefixed types, threads adapter, `extractCitations`, `createLangGraphClient`, `toAbsoluteApiUrl`

**`libs/ag-ui/src/public-api.ts`** — restrict surface + rename:

- Remove: `AG_UI_AGENT`, `injectAgUiAgent`, `provideAgUiAgent`, `provideFakeAgUiAgent`, `AgUiAgentConfig`, `FakeAgUiAgentConfig`
- Add (renames): `provideAgent` (was `provideAgUiAgent`), `injectAgent` (was `injectAgUiAgent`), `AgentConfig` (was `AgUiAgentConfig`), `provideFakeAgent` (was `provideFakeAgUiAgent`), `FakeAgentConfig` (was `FakeAgUiAgentConfig`)
- Keep: `toAgent`, `ToAgentOptions`, `FakeAgent`, `bridgeCitationsState`

**Internal call sites in each lib's `src/lib/*` and `test/*`** — update imports and any spec files that exercise the removed names. **No `replace_all`** for `provideAgent`, `injectAgent`, `AgentConfig` — they overlap as substrings with `AgentLifecycle`, `AgentOptions`, `AgentTransport`, `AgentBranchTree`, `AgentQueue`, etc. Manual review per occurrence. (Codified in `feedback_chat_prefix_substring_overlap.md`.)

### Library metadata

- `libs/langgraph/package.json`: update `description` to "LangGraph adapter for `@threadplane/chat` — Angular bindings for LangGraph Platform." Add keywords: `langgraph`, `langchain`, `angular`, `adapter`.
- `libs/ag-ui/package.json`: update `description` to "AG-UI protocol adapter for `@threadplane/chat` — works with any AG-UI-compatible backend." Add keywords: `ag-ui`, `angular`, `adapter`.
- `libs/langgraph/README.md` and `libs/ag-ui/README.md`: rewrite quick-start sections to use the new symmetric API. Add a cross-link to "Choosing an adapter."
- Root `README.md`: verify and update the library list to use `@threadplane/*` scope and accurate descriptions.

Version bumps: both libs to `0.0.48` (patch-only, per `feedback_patch_only_releases.md`).

### Website routes & content

**Move directories (preserve git history):**

- `git mv apps/website/content/docs/agent apps/website/content/docs/langgraph`
- All MDX/JSON inside, including `api/api-docs.json`

**Update `apps/website/src/lib/docs-config.ts`:**

- `LibraryId`: `'agent'` → `'langgraph'`
- `docsConfig` entry: `id: 'agent'` → `id: 'langgraph'`; `title: 'Agent'` → `title: 'LangGraph'`; `description` → "LangChain/LangGraph adapter for Angular"
- API section: remove `{ title: 'agent()', slug: 'agent' }`; add `{ title: 'injectAgent()', slug: 'inject-agent' }`; keep `provideAgent()` entry at slug `provide-agent`

**Update other website routing:**

- `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx:30`: content-folder lookup map `'agent': 'agent'` → `'langgraph': 'langgraph'`
- `apps/website/src/app/docs/page.tsx:28, 38`: `/docs/agent/*` hrefs → `/docs/langgraph/*`
- `apps/website/src/app/llms-full.txt/route.ts:5`: import path from `content/docs/agent/api/api-docs.json` to `content/docs/langgraph/api/api-docs.json`

Routes are dynamic under `[library]`, so the URL change is driven entirely by `docsConfig` plus the content-folder lookup map — no new route files added or removed.

### Website link references

Files needing `/docs/agent/*` → `/docs/langgraph/*` (enumerated; verified at design time):

- `apps/website/src/app/page.tsx:51, 114`
- `apps/website/src/app/langgraph/page.tsx:57, 85, 137`
- `apps/website/src/app/ag-ui/page.tsx:57, 123`
- `apps/website/src/app/pilot-to-prod/page.tsx:168`
- `apps/website/src/components/shared/Nav.tsx:63, 255`
- `apps/website/src/components/shared/Footer.tsx:173, 174`
- `apps/website/src/components/landing/HomeFAQ.tsx:46`
- `apps/website/src/components/docs/mdx/FeatureChips.tsx:13-20` (8 hrefs)
- `apps/website/src/components/docs/DocsSearch.tsx:68`
- `apps/website/src/app/blog/[slug]/page.tsx:99` (`library="agent"` prop)

### Telemetry

PostHog event labels referencing the library identifier:

- `apps/website/src/components/shared/Nav.tsx:255`: the `library: currentLib.id === 'agent' || ...` allow-list. Replace `'agent'` with `'langgraph'`.
- `apps/website/src/components/docs/DocsSearch.tsx:68`: same allow-list pattern.
- `apps/website/src/app/blog/[slug]/page.tsx:99`: `library="agent"` prop on the event-emitting component.

Accept the historical seam — `agent`-labeled events stop, `langgraph`-labeled events start. The next weekly GTM snapshot's Notes section calls this out.

### "Choosing an adapter" page (new)

**Location:** `apps/website/content/docs/choosing-an-adapter/index.mdx`, served at `/docs/choosing-an-adapter` as a top-level docs route (not nested under a library). Routing requires either a small static page handler at `apps/website/src/app/docs/choosing-an-adapter/page.tsx` that loads the MDX, or a top-level entry in `docsConfig` if its three-segment URL shape `[library]/[section]/[slug]` is generalized. **The static-page approach is preferred** because the page is a single comparison document, not a multi-section library.

**Content outline:**

- One-sentence summary of each adapter
- Decision matrix: backend type → adapter (LangGraph Platform → langgraph; AG-UI-protocol backend like CrewAI/Mastra/Agent Framework/AG2/Pydantic AI/AWS Strands/CopilotKit runtime → ag-ui)
- Side-by-side code comparison using the new symmetric API
- "Both adapters consume the same `Agent` contract from `@threadplane/chat`" explainer
- Note about mixing both adapters (rare; pick one per app; import-rename pattern shown)

**Cross-links from:**

- `/docs` landing page (added to "Popular topics")
- `/langgraph` landing page (CTA section)
- `/ag-ui` landing page (CTA section)
- `HomeFAQ.tsx` (new Q: "Which adapter should I use?")

### Getting-started flow polish

Both libs' README quick-start blocks and their `getting-started/introduction.mdx` (now under `content/docs/langgraph/`) and the equivalent ag-ui-side getting-started content surface the adapter choice up-front, link to "Choosing an adapter," and use the new symmetric API in all code examples.

## Out of scope

- Historical specs/plans under `docs/superpowers/` — left as-is.
- The `Agent` contract type from `@threadplane/chat` — stays neutral.
- The `[agent]` template binding on `<chat>` — stays.
- The cockpit directory naming `cockpit/langgraph/*` — already correct; nothing to do.
- Phase 2 testing-surface alignment (`mockLangGraphAgent` vs `FakeAgent`) — saved separately.

## Phasing

One PR per phase. Each PR's description includes a verification checklist from the Verification section. Phase A merges first (libs are foundation), then B, C, D, E in order. CI runs the typecheck + build on every PR so a stale import surfaces before review.

### Phase A — Library API symmetry (`libs/langgraph` + `libs/ag-ui`)

- Reshape both `public-api.ts` to the symmetric three-export surface
- Add `injectAgent()` to langgraph; perform all renames in ag-ui (`provideAgUiAgent` → `provideAgent`, `injectAgUiAgent` → `injectAgent`, `AgUiAgentConfig` → `AgentConfig`, fake-agent variants)
- Update internal call sites in each lib's `src/lib/*` and `test/*`
- Update `package.json` `description` + keywords in both libs
- Bump both to `0.0.48`
- Per-lib unit + conformance specs pass with the new API names

### Phase B — Website content + route rename

- `git mv apps/website/content/docs/agent apps/website/content/docs/langgraph`
- Update `docs-config.ts` (`LibraryId`, `docsConfig` entry, API page slugs to match Phase A's new exports)
- Update the content-folder lookup map in `[library]/[section]/[slug]/page.tsx`
- Update `llms-full.txt/route.ts` import path
- Update MDX content where it references `agent()` → `injectAgent()` and old export names

### Phase C — Link references + telemetry

- All `/docs/agent/*` href updates listed above
- Telemetry slug updates in `Nav.tsx`, `DocsSearch.tsx`, blog `library` prop
- Update `apps/website/src/app/langgraph/page.tsx` and `/ag-ui` page CTAs and prose

### Phase D — "Choosing an adapter" page + getting-started polish

- New `content/docs/choosing-an-adapter/index.mdx` plus its static-page handler
- Add top-level entry to docs landing's "Popular topics"
- Add CTA blocks on `/langgraph` and `/ag-ui` landing pages
- Add new FAQ entry to `HomeFAQ.tsx`
- Update both libs' READMEs and getting-started MDX to make the adapter choice obvious

### Phase E — Sweep + verification (subagent-driven)

See Verification → Parallel subagent sweep below.

## Verification

### Parallel subagent sweep (Phase E)

After Phase D, dispatch five `Explore` subagents in a single message so they run concurrently. Each returns a punch-list of stale references; their output drives Phase E cleanup commits.

**Subagent 1 — Docs content sweep**

> Scope: `apps/website/content/docs/**`, `docs/**` (excluding `docs/superpowers/`), all `*.md`/`*.mdx`. Grep for: `agent library`, `@threadplane/agent`, `@ngaf/agent`, `/docs/agent/`, `provideAgUiAgent`, `injectAgUiAgent`, `AG_UI_AGENT`, `AGENT_CONFIG`, `AgUiAgentConfig`, `provideFakeAgUiAgent`, `FakeAgUiAgentConfig`, any `agent()` factory examples that should now use `injectAgent()`. Report file:line for every hit with one-line context. Do NOT edit.

**Subagent 2 — Website source sweep**

> Scope: `apps/website/src/**`. Same grep patterns as Subagent 1, plus: `'agent'` as a string literal (often a library id), `library="agent"`, `library: 'agent'`. Report file:line. Do NOT edit.

**Subagent 3 — Library READMEs + root README + package.json sweep**

> Scope: `libs/*/README.md`, `libs/*/package.json`, root `README.md`, root `package.json`. Grep for stale library names, `agent()` factory references, old `@ngaf/*` scope mentions, and confirm descriptions explicitly name LangGraph or AG-UI. Report file:line. Do NOT edit.

**Subagent 4 — Cockpit + examples + other apps sweep**

> Scope: `cockpit/**`, `apps/**` (excluding `apps/website/`). Same grep patterns. Any consumer of `@threadplane/langgraph` or `@threadplane/ag-ui` that uses the removed exports needs flagging. Report file:line. Do NOT edit.

**Subagent 5 — llms.txt sweep**

> Scope: `apps/website/src/app/llms.txt/route.ts`, `apps/website/src/app/llms-full.txt/route.ts`, and any content they import. Confirm the assembled output uses the new library names and API. Report exact paragraphs that need editing. Do NOT edit.

### Build & functional verification

Evidence-based, per `superpowers:verification-before-completion`:

1. `npx nx run-many -t lint test build --projects=langgraph,ag-ui` clean.
2. `npx nx build website` clean.
3. `npx nx serve website` running locally; manually click through:
   - `/docs` landing — library card links to `/docs/langgraph/getting-started/introduction` (200)
   - `/docs/langgraph/api/inject-agent` renders
   - `/docs/langgraph/api/provide-agent` renders
   - `/docs/choosing-an-adapter` renders
   - `/langgraph` and `/ag-ui` landing pages — every CTA resolves
   - `HomeFAQ` new entry renders
   - `Nav.tsx` mobile picker defaults to `'langgraph'`
   - `Footer.tsx` API Reference link resolves
4. `curl localhost:3000/docs/agent/getting-started/introduction` → 404 (confirms old route is gone, per "no redirects" decision).
5. Residual-reference grep: `git grep -nE "'agent'|/docs/agent/|@threadplane/agent|@ngaf/agent" -- 'apps/website' 'libs' ':!docs/superpowers'` → empty (or only legitimate prose like `agent runtime`).

## Risk register

| Risk | Mitigation |
|---|---|
| Substring overlap during `Agent*` token rename clobbers `AgentLifecycle`, `AgentOptions`, `AgentTransport`, etc. | No `replace_all` for `provideAgent`, `injectAgent`, `AgentConfig`. Manual review per occurrence. Codified in `feedback_chat_prefix_substring_overlap.md`. |
| External docs/blog posts link to `/docs/agent/*` and 404 after merge | User explicitly accepted this. Spec records the decision. |
| PostHog event timeline shows a discontinuity at the rename | Accept the seam. Next weekly GTM snapshot's Notes section calls it out. |
| Cockpit-shell, examples, or another app silently imports a removed export | Subagent 4 in Phase E catches this. CI build also fails hard on a missing import, blocking merge. |
| `package-lock.json` regenerated on macOS drops Linux SWC bindings | Per `feedback_lockfile_platform_bindings.md`, edit surgically — don't regenerate. |
| Mixed-adapter apps confuse import-time `provideAgent` / `injectAgent` / `AgentConfig` name collisions for runtime DI collisions | Resolved by the documented import-rename pattern. "Choosing an adapter" page recommends one adapter per app to keep mental model clean. |

## Open decisions

None. All design decisions captured above were explicitly approved during brainstorming.
