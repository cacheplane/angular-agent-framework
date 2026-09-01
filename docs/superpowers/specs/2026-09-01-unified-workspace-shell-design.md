# Unified Docs and Cockpit workspace shell

## Status

Approved through interactive design review on 2026-09-01. This is release 1 of the unified control-plane program.

## Summary

Replace the current cross-origin Docs-to-Cockpit handoff with one long-lived application shell hosted by `apps/website`. Docs, Run, Code, and API become modes of the same workspace. The rail, context pane, selected capability, runtime controller, and utility state remain mounted while only the main panel changes.

The website is the host because it already owns canonical docs URLs, MDX rendering, search, SEO, and public navigation. Existing Cockpit panels and runtime behavior move behind shared workspace boundaries rather than being rewritten. Legacy Cockpit remains available during migration and redirects only after the unified surface reaches production parity.

## Baseline

- Docs and Cockpit are separate Next.js applications on separate origins.
- Both use the shared `@threadplane/ui-react` rail and context primitives.
- Docs owns the canonical MDX route and a configuration-only Runtime preview.
- Cockpit owns Run, Code, Docs, API, Runtime, Activity, and Settings.
- `@threadplane/cockpit-registry` maps capability and docs identities, but Docs configuration and Cockpit presentation data still have separate owners.
- Existing Docs rail links perform a full navigation to `cockpit.threadplane.ai`.

## Goals

1. Keep canonical docs content and SEO intact.
2. Switch Docs, Run, Code, and API without leaving or remounting the workspace shell.
3. Give Docs and operational modes one capability identity, preference store, and utility model.
4. Preserve all shipped Cockpit behavior while changing its host.
5. Provide a truthful route for runnable capabilities that have no canonical docs page.
6. Make legacy Cockpit URLs deterministic redirects after parity is verified.
7. Establish the stable memory boundary required by release 2 custom runtime credentials.

## Non-goals

- Custom AG-UI or LangSmith targets; those are release 2.
- Command palette, pins, recents, or Activity filters; those are release 3.
- Account sync, authentication, or server-side workspace state.
- Rewriting Angular examples or the runtime bridge protocol.
- Moving marketing pages into the workspace shell.
- Removing the old Cockpit deployment before production parity.

## Product decisions

1. `apps/website` is the unified host.
2. Existing `/docs/...` routes remain canonical and server-rendered.
3. A safe `mode=docs|run|code|api` query parameter represents the selected panel. No target URL, credential, prompt, or runtime payload enters the page URL.
4. Capabilities without a canonical docs page use `/workspace/[product]/[topic]` in the same application and shell.
5. Unsupported docs pages keep Docs available and disable unavailable operational modes with an explanation. They do not guess a capability or fall back to a generic home page.
6. The current Cockpit app is frozen as a migration fallback once the unified host ships.

## Workspace identity

Create one registry-derived identity contract:

```ts
interface WorkspaceIdentity {
  id: string;
  product: CockpitProduct;
  section: string;
  topic: string;
  page: string;
  language: 'python' | 'typescript';
  title: string;
  docsPath: string | null;
  workspacePath: string;
  runtimeAdapter: 'langgraph' | 'ag-ui' | 'none';
}

type WorkspaceResolution =
  | { kind: 'mapped'; identity: WorkspaceIdentity }
  | {
      kind: 'docs-only';
      docsPath: string;
      title: string;
      unavailableReason: 'no-workspace-capability';
    };
```

`id` is a stable registry key, not a URL. `docsPath` is null when no canonical narrative page exists. `workspacePath` always exists for runnable or inspectable Cockpit entries.

The route resolver returns `WorkspaceResolution`, not a fabricated identity. A `docs-only` resolution has no capability ID, workspace path, runtime adapter, or operational content descriptors. The provider accepts that discriminated state, keeps Docs active, disables Run, Code, and API, and exposes the `unavailableReason` for accessible UI copy. Only a `mapped` resolution may enter capability navigation, runtime configuration, recents, legacy redirects, or workspace-only routes.

`@threadplane/cockpit-registry` becomes the authority for:

- Docs-to-capability mapping.
- Capability-to-docs mapping.
- Canonical workspace paths.
- Legacy Cockpit paths.
- Runtime adapter classification.
- Code, backend, narrative, and API content descriptors.

Generation or drift tests must fail on ambiguous mappings, duplicate IDs, invalid paths, or runnable entries without a runtime adapter.

## Application architecture

### Server route boundary

The website route resolves a `WorkspaceResolution` and server-rendered Docs content. It passes the serializable resolution and content descriptor to a client workspace boundary. MDX remains server-rendered and crawlable even though the shell is interactive.

### Workspace provider

The provider owns:

- Active mode.
- Active workspace resolution and, only when mapped, its identity.
- Runtime controller and Activity state.
- Control-plane disclosure preferences.
- Active utility and focus-restoration state.
- A server-rendered Docs slot.
- Resolved Run, Code, and API panel data.

The provider must live above mode panels so switching modes cannot unmount the runtime iframe or discard later memory-only credentials.

### Component boundaries

- Shared structural primitives stay in `@threadplane/ui-react`.
- Workspace-specific state and shell components move from `apps/cockpit` into a private React workspace library or an equivalent importable library boundary.
- `apps/website` owns route composition and provides the Docs slot.
- `apps/cockpit` temporarily consumes the same workspace library during migration so parity can be verified without maintaining two shell implementations.
- Mode panels remain isolated components with explicit identity and content inputs.

No library may import from an application directory.

## Routing and history

- `/docs/[library]/[section]/[slug]` defaults to Docs.
- `?mode=run`, `?mode=code`, and `?mode=api` deep-link to mapped panels.
- `/workspace/[product]/[topic]` defaults to Run for runnable entries and Docs for narrative-only entries.
- Explicit mode changes update browser history without remounting the provider.
- Back and Forward restore modes and identities.
- Canonical metadata for docs pages omits `mode`.
- Unknown or incompatible modes fall back to the route's truthful default.

Legacy Cockpit paths map through the registry. Redirect activation is a separate, reversible deployment step after production smoke proves the new destination.

## Information architecture

The desktop shell retains the approved three-column geometry:

1. Mode and utility rail.
2. Context pane.
3. Main panel.

The context pane contains Scope, mode-specific navigation, and Runtime. Activity and Settings replace the context content temporarily, preserve the selected mode, support Escape, and restore focus to their invokers.

Docs page actions stay in the existing top-right ellipsis menu. The main article remains visually primary; operational controls do not become an application dashboard header.

## Responsive behavior

- Desktop at `64rem` and wider keeps the persistent rail and context pane.
- Tablet from `48rem` through `63.999rem` keeps the rail and collapses the context pane behind its trigger.
- Mobile below `48rem` uses one modal navigation sheet and a compact mode strip.
- Escape or an explicit close from the normal context view dismisses the tablet or mobile surface and restores focus to its navigation invoker.
- Selecting a mode or capability closes the surface and moves focus to the destination panel heading after navigation completes.
- Selecting Activity or Settings keeps the tablet or mobile surface open, replaces its context body, and moves focus to the utility heading.
- Closing a utility returns to the normal context body and restores focus to the utility control that opened it; a subsequent close dismisses the surface and restores the navigation invoker.
- The same semantic labels and ordering are used at every breakpoint.

## Migration

1. Add the unified identity contract and drift tests without changing routes.
2. Extract the existing Cockpit shell and mode panels behind an importable workspace boundary.
3. Render the existing Docs mode inside the workspace shell on website docs routes.
4. Enable Run, Code, and API for mapped pages and add `/workspace/...` routes.
5. Reach unit, E2E, accessibility, and production-smoke parity.
6. Activate registry-driven redirects from legacy Cockpit URLs.
7. Observe production before removing the fallback deployment in a later task.

Each step must be deployable without a flag-day dependency on the next.

## Error handling

- A missing mapping leaves the docs page functional and operational modes disabled.
- A mode panel failure is contained by a panel boundary and does not replace Docs or navigation.
- Existing Runtime and Activity error boundaries remain active.
- Invalid legacy routes return the existing not-found behavior rather than a guessed redirect.
- A failed redirect rollout can be reversed without rebuilding the unified workspace.

## Testing

- Registry tests for uniqueness, round trips, and canonical path stability.
- Provider tests proving mode changes keep the runtime panel mounted.
- Route tests for docs pages, workspace-only capabilities, query modes, and legacy mappings.
- Component tests for disabled unavailable modes, focus restoration, and utility semantics.
- Browser E2E for Docs → Run → Code → API → Docs on one route.
- Tablet and mobile utility replacement, focus restoration, navigation, and history restoration E2E.
- Existing Cockpit runtime, Activity, Settings, forced-colors, reduced-motion, and production-smoke coverage must pass against the unified host before redirects activate.

## Acceptance criteria

1. A mapped docs page can switch among all four modes without a cross-origin navigation.
2. The runtime iframe is not remounted by ordinary mode or utility changes.
3. Canonical docs markup remains server-rendered and indexed at its existing URL.
4. Unmapped docs pages make no false capability claim.
5. Workspace-only capabilities have stable same-origin routes.
6. Legacy redirects are registry-derived and covered before activation.
7. Existing control-plane accessibility and production-smoke behavior is preserved.
