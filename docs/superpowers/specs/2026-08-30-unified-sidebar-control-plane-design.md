# Unified sidebar control plane for Docs and Cockpit

## Status

Approved through interactive design review on 2026-08-30. This document is the implementation contract for the first production iteration.

## Summary

Replace the separate Docs navigation sidebar and Cockpit navigation-plus-header-mode-switcher with one shared sidebar model: a compact activity rail plus a contextual control pane.

The rail selects the kind of work. The context pane governs the current library, capability, environment, and available actions. The main area remains the place where reading, running, coding, and API inspection happen.

The implementation must feel like one Threadplane control plane across both applications without pretending that Docs and Cockpit have identical data or capabilities. Shared React primitives own structure and accessibility; app adapters provide truthful data, navigation, actions, and token mappings.

## Problem

The current sidebars are navigation-only and diverge in important ways:

- Docs has a 16rem library-and-page navigator, a separate right-side table of contents, and page actions in a split Copy button.
- Cockpit has a 16rem product navigator, while Run, Code, Docs, and API live in a separate header mode switcher.
- Section headings use uppercase monospaced styling that is louder and less readable than the surrounding interface.
- Several icons and chevrons are one-off inline SVGs with inconsistent weight.
- Page-level utilities compete with content instead of living in a quiet overflow menu.
- The UI has no stable place to expose scope, environment, activity, and settings as the product grows.

This creates two product grammars for the same workflow and makes each new control fight for space in an arbitrary toolbar or navigation list.

## Research synthesis

The design is grounded in these findings:

- A control plane exposes current scope, consequential state, and high-frequency controls; it does not absorb the detailed work surface.
- Stable mode rails reduce relocation cost when the contextual pane changes.
- Adaptive navigation should preserve the primary workspace at narrow widths rather than permanently consuming most of the viewport.
- Sidebar hierarchies should remain shallow, use disclosure controls with accurate state, and preserve keyboard and target-size requirements.
- Composable sidebar infrastructure is useful, but the product must still define its own information architecture and state model.

Primary references:

- [WezTerm vertical tabs pull request](https://github.com/wezterm/wezterm/pull/7679) — a useful implementation signal for resizable vertical navigation, but not by itself a complete control-plane model.
- [shadcn/ui Sidebar](https://ui.shadcn.com/docs/components/base/sidebar) — composable rail, group, action, badge, and collapse primitives.
- [Microsoft NavigationView](https://learn.microsoft.com/en-us/windows/apps/design/controls/navigationview) — adaptive pane modes and compact navigation behavior.
- [Apple Human Interface Guidelines: Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars) — sidebar hierarchy and content-preservation guidance.
- [WAI-ARIA disclosure pattern](https://www.w3.org/WAI/ARIA/apg/patterns/disclosure/) — expanded-state and keyboard semantics.
- [WAI-ARIA toolbar pattern](https://www.w3.org/WAI/ARIA/apg/patterns/toolbar/) — grouped command semantics.
- [WCAG 2.2 target size minimum](https://www.w3.org/WAI/WCAG22/Understanding/target-size-minimum.html) — pointer target requirements.

## Goals

1. Establish one recognizable control-plane grammar across Docs and Cockpit.
2. Put Docs, Run, Code, and API in a stable primary rail.
3. Put current scope, contextual navigation, environment, and actions in the adjacent pane.
4. Keep the main workspace visually calm and as wide as practical.
5. Use modern, consistent icons and stronger chevrons.
6. Replace uppercase monospaced section headings with minimal sentence-case labels.
7. Use complete rounded hover and active backgrounds; do not use decorative left-edge rails or partial rounded borders.
8. Consolidate page utilities, including On this page and Copy page, into a polished three-dot overflow menu.
9. Preserve existing routes, content sources, analytics, runtime iframe continuity, and accessible keyboard behavior.
10. Provide an adaptive mobile presentation without forcing the full desktop pane to remain open.

## Non-goals

- A backend activity/event service.
- Invented deployment health, branch, last-run, or connectivity data.
- User-reorderable sidebar modules.
- Arbitrarily nestable navigation trees.
- A new global command palette.
- Changes to cockpit manifest route shapes or docs content taxonomy.
- Rebuilding the Docs content renderer, Cockpit mode panes, or runtime examples.
- Replacing the existing design-token systems.

## Design principles

### The sidebar governs; the workspace performs

The sidebar owns choices that affect the whole workspace: mode, scope, capability, environment, and commands. Long-form documentation, code, runtime interaction, logs, and API details stay in the main workspace.

### No inert or fictional controls

Rail utilities and environment rows render only when an adapter supplies a real destination, value, or handler. Missing data is omitted rather than filled with plausible-looking placeholder state.

### Context-sensitive defaults with remembered intent

Docs defaults to Docs mode and a collapsed Environment section. Cockpit defaults to Run mode and an expanded Environment section. After the user changes a mode or disclosure state, the shell remembers that choice independently for each surface.

### Labels where comprehension matters; icons where commands are familiar

Primary modes and navigation rows keep visible labels. Quick actions and the bottom Activity/Settings utilities are icon-only with accessible names and tooltips. Icons never carry meaning without a programmatic label.

## Information architecture

### Activity rail

Primary modes, top to bottom:

1. Docs
2. Run
3. Code
4. API

Global utilities, anchored at the bottom and visually separated from primary modes:

- Activity — icon-only. It opens a current-session view when a surface supplies real activity data. If no adapter is available, the item is omitted rather than disabled.
- Settings — icon-only. It opens the surface's existing preferences, including theme and language where available. If a surface has no real preference controls, the item is omitted under the same rule as Activity.

The rail remains stable while the context pane and main workspace change.

Activity and Settings are utility panels, not routes or popovers. Selecting one temporarily replaces the context pane's Scope/Learn/Environment/Actions content while leaving the rail and main workspace unchanged. The selected utility uses `aria-pressed="true"` and the normal fully rounded active background. Utility selection is ephemeral and is not written to preferences.

Each utility panel has a visible title and close button. It closes when the user presses Escape, activates its rail item again, activates any primary mode, or uses the close button. Closing restores the ordinary contextual pane and returns focus to the invoking rail item when dismissal came from Escape or the close button.

When a narrow layout keeps the compact rail, the same behavior applies inside the focus-trapped control-plane drawer. When the compact rail is omitted, the drawer renders each adapter-supplied utility in an icon-only toolbar anchored below its ordinary navigation content. Selecting a utility replaces only the drawer body and keeps that utility toolbar mounted. Escape or the utility panel's close button restores the ordinary drawer body and returns focus to the invoking utility button. Closing the entire drawer through its global close button or backdrop returns focus to the external mobile navigation trigger. Docs supplies neither Activity nor Settings in the first iteration because the website has no real activity source or preference controls; the utility toolbar is therefore omitted there. Cockpit supplies Settings and omits Activity.

Representative behavior:

- In desktop Cockpit, Settings replaces the capability pane with Language and Appearance controls while Run remains visible and mounted in the main workspace.
- At 320–360px in Cockpit, Settings opens in the control-plane drawer and receives initial focus at its heading or first control. Closing only Settings restores the ordinary drawer and focuses the Settings utility button; closing the whole drawer focuses the external mobile navigation trigger.

### Context pane

The context pane contains, in order:

1. **Scope** — current library/product, capability or page, framework, and language when applicable.
2. **Learn** in Docs or **Capability** in Cockpit — contextual navigation.
3. **Environment** — truthful configuration and runtime facts supplied by the surface adapter.
4. **Actions** — a compact icon-only command strip. It renders only handlers that exist for the current context.
5. Footer utilities such as search and theme when they are not active rail destinations.

### Environment rows

The shared component accepts labeled rows but does not define their values.

Docs may provide:

- Package/library name.
- Framework compatibility derived from repository configuration.
- Package-manager convention.
- Live demo destination when configured.

Cockpit may provide:

- Current product, capability, page, and language from the manifest entry.
- Runtime target derived from `contentBundle.runtimeUrl`.
- Framework or backend language from manifest/content metadata.

The first iteration must not label a deployment Healthy, show a branch, or show a last-run time unless the application can prove that value.

## Surface behavior

### Docs

- The Docs rail item is active.
- Run, Code, and API are cross-surface links, not mutable local Docs modes. They link to an explicitly mapped Cockpit capability when one exists. When no mapping exists, they link to the Cockpit home route rather than guessing.
- Docs-to-Cockpit links append a validated mode query (`?mode=run`, `?mode=code`, or `?mode=api`). Cockpit treats that explicit query as a one-time navigation instruction: after hydration it overrides the stored Cockpit mode, becomes the current persisted Cockpit mode, and is removed from the URL with `history.replaceState` so refreshes use the normal saved preference. Missing or invalid mode queries fall back to the saved Cockpit preference and then to Run.
- The website constructs links from `NEXT_PUBLIC_COCKPIT_BASE_URL`, defaulting to `https://cockpit.threadplane.ai` in production. Local development can point the website at a local Cockpit origin. Cross-origin state is handed off only through the validated URL query; Docs never attempts to read or write Cockpit localStorage.
- Scope uses the active library, section, and page.
- Learn renders the existing docs configuration and preserves section disclosure.
- Environment defaults collapsed.
- Actions contains control-plane commands only, such as Open demo when a configured destination exists. Page-reading and page-editing utilities do not appear here.
- Activity and Settings are omitted in the first iteration because the website currently supplies neither real session activity nor a functional theme/preferences system. Do not reuse Cockpit's ThemeToggle: it depends on Cockpit's theme provider and `/api/theme` route, neither of which exists in the website.
- Search remains available through the existing command-K behavior.
- The existing right-side table of contents remains on wide screens for scanability.
- Page actions change from a Copy split button to one borderless ellipsis trigger. Its menu contains:
  - On this page. On wide screens this focuses the existing table of contents; on narrower screens it reveals the heading list within the menu.
  - Copy page as Markdown.
  - Open in ChatGPT.
  - View as Markdown.
  - Edit on GitHub.
- Menu keyboard behavior preserves first-item focus, arrow navigation, Home/End, Escape, outside click, and focus restoration.

#### Deterministic Docs-to-Cockpit mapping

Create a typed, explicit `docsCockpitMappings` record in `apps/website/src/lib/cockpit-links.ts`, keyed by the complete Docs identity `${library}/${section}/${slug}`. Each value is a complete Cockpit identity: product, section, topic, page, and language. Link generation may validate that identity against `cockpitManifest`, which is already available to the website through `@threadplane/cockpit-registry`, but it must not infer a topic from string similarity.

Complete first-iteration mapping set:

| Docs identity | Cockpit identity | Case |
| --- | --- | --- |
| `langgraph/guides/streaming` | `langgraph/core-capabilities/streaming/overview/python` | Exact topic name |
| `langgraph/guides/deployment` | `langgraph/core-capabilities/deployment-runtime/overview/python` | Explicit rename |
| `render/guides/specs` | `render/core-capabilities/spec-rendering/overview/python` | Explicit rename |
| `render/guides/registry` | `render/core-capabilities/registry/overview/python` | Exact topic name |
| `chat/guides/generative-ui` | `chat/core-capabilities/generative-ui/overview/python` | Exact topic name |
| `langgraph/api/inject-agent` | no entry | Unsupported; use Cockpit home |
| `docs/choosing-an-adapter` | no entry | Special page; use Cockpit home |

The five non-empty rows above are the exhaustive approved mapping record for the first iteration. Every other Docs identity, including the two unsupported examples shown, uses Cockpit home. Adding a Cockpit capability does not implicitly create a Docs mapping, and adding a Docs page does not silently inherit one. Unit tests cover every record target plus renamed and unsupported examples.

### Cockpit

- Run, Code, Docs, and API move from the header switcher into the rail.
- The active mode continues to control the existing pane-rendering logic. Run remains mounted while hidden so iframe state is preserved.
- Scope uses the current manifest entry and language.
- Capability renders the current navigation tree.
- Environment defaults expanded.
- Actions render only real commands. The first iteration may include opening the runtime in a new tab, refreshing the runtime iframe through an explicit shell callback, or copying a current prompt when the corresponding data and handler exist.
- Settings hosts the existing LanguagePicker and ThemeToggle rather than duplicating them elsewhere.
- Activity can expose only real current-session facts already available to the shell. A fabricated event feed is out of scope.
- Cockpit owns `activeUtility: 'Activity' | 'Settings' | null` as transient component state. Opening a utility does not change or unmount the active primary mode. Selecting a primary mode clears `activeUtility` before applying the mode change.

## Visual design

### Typography

- Section labels use Inter, sentence case, medium weight, and muted neutral color.
- Approved labels are Scope, Learn/Capability, Environment, and Actions.
- Remove uppercase transformation, wide tracking, and monospaced section headings.
- Monospace remains appropriate for code, package identifiers, keyboard shortcuts, and aligned environment values.

### Icons

- Add `lucide-react` and use one outline icon family across rail modes, navigation metadata, environment facts, actions, search, theme, overflow menus, and disclosure controls.
- Default icon sizes are 16px in rows/actions and 18px in the primary rail.
- Use a consistent stroke weight through the library defaults; do not mix thin one-off chevrons with heavier mode icons.
- Decorative icons are `aria-hidden`. Icon-only buttons have `aria-label` and a tooltip.

### Active and hover states

- Dense navigation and action targets use the existing small/medium radius, approximately 6–8px depending on the surface token.
- The background covers the complete target rectangle.
- No left-edge accent border, pseudo-element rail, or half-rounded active shape.
- Active state combines accent text, a subtle accent surface, and `aria-current` or pressed/selected semantics.
- Hover uses the surface-dim token and must not shift layout.

### Page overflow menu

- Borderless 34–36px ellipsis trigger with a rounded hover/expanded background.
- Opaque tokenized popover, 8–10px radius, compact shadow, and 36px minimum menu rows.
- Every row has a consistent 16px icon and visible label.
- Group related reading actions before external/editing actions when a separator improves scanning.

## Shared architecture

Create structural primitives in `@threadplane/ui-react`:

- `ControlPlaneRail`
- `ControlPlaneRailItem`
- `ControlPlanePane`
- `ControlPlaneSection`
- `ControlPlaneEnvironmentList`
- `ControlPlaneActionBar`
- `ControlPlaneIconButton`
- `useControlPlanePreferences`

These primitives own:

- Semantic structure and ARIA attributes.
- Disclosure behavior.
- Keyboard and focus behavior for rail items and icon toolbars.
- Local preference persistence.
- Stable data attributes/class names for styling.

They do not own:

- Next.js routing.
- Docs config or cockpit manifest interpretation.
- Analytics event names.
- Runtime health determination.
- Application color tokens.

Each application supplies an adapter and app-specific CSS token mapping. Shared components expose stable `data-control-plane-*` hooks so the two apps share geometry and behavior without forcing their distinct `--color-*` and `--ds-*` token namespaces into one package.

## State and persistence

Use one versioned localStorage record:

```ts
interface ControlPlanePreferencesV1 {
  version: 1;
  docs: {
    expanded: Record<string, boolean>;
  };
  cockpit: {
    activeMode: 'Docs' | 'Run' | 'Code' | 'API';
    expanded: Record<string, boolean>;
  };
}
```

Defaults:

- Docs: Docs is always the local active destination; Environment collapsed.
- Cockpit: `activeMode = 'Run'`, Environment expanded.
- Learn/Capability expanded on both surfaces.

Requirements:

- Read storage only after hydration.
- Validate the stored version and values before use.
- Fall back silently to defaults for missing, invalid, or blocked storage.
- Persist only user changes, not every render.
- Keep Docs and Cockpit preferences independent.
- Do not persist utility-panel selection. Docs has no persisted `activeMode` because its non-Docs rail items navigate to Cockpit rather than changing a local pane.

## Responsive behavior

### Desktop

- Use rail + context pane + main workspace.
- Target approximately 54–58px for the rail and 256–280px for the context pane.
- The context pane can scroll independently; the main workspace retains its current scroll model.
- Do not add the right-side width cost of a second permanent control pane. The existing wide-screen Docs table of contents is retained because it is page-local reading navigation, not control-plane chrome.

### Narrow screens

- Preserve the compact rail only where the viewport can still provide compliant targets and readable content.
- The context pane becomes an overlay/drawer instead of permanently pushing the workspace below or beside it.
- Cockpit may reuse and restyle its existing MobileNavOverlay.
- Docs must reuse its existing global `Nav` mobile trigger and Site/Docs overlay rather than adding a second trigger. The Docs tab is recomposed from the same context content as the desktop control plane and uses the same headings, icons, and rounded states while preserving Site navigation and existing mobile analytics.
- The main workspace must not horizontally overflow at 320px.

## Accessibility

- Rail is a labeled navigation landmark.
- Active destination uses `aria-current="page"` for navigation or `aria-pressed`/tab semantics for local mode changes.
- Disclosure buttons expose `aria-expanded` and `aria-controls`.
- Icon-only controls have accessible names and focusable tooltips; essential meaning is not hover-only.
- Touch targets are approximately 44px on coarse pointers.
- Overflow menus preserve current keyboard behavior and visible focus rings.
- Motion respects `prefers-reduced-motion`.
- Color is never the only active-state signal.

## Error handling

- Invalid persisted preferences fall back to surface defaults.
- Missing Cockpit mappings send the user to the Cockpit home route; no guessed path is generated.
- Missing environment values and action handlers are omitted.
- Copy failures keep the menu usable and do not show a false success state.
- External links use `noopener noreferrer`.
- A runtime refresh action is rendered only when the Run pane exposes a safe callback.

## Analytics

Preserve existing analytics and add events only for new decisions that matter:

- Cockpit mode changes continue emitting `cockpit:mode_switched`.
- Existing recipe-open and code-copy events remain unchanged.
- Docs Copy page continues emitting the current docs copy event.
- New rail utility events may be added only if product analysis has a concrete consumer; do not emit generic click noise.

## Testing strategy

### Shared UI library

- Rail active semantics and labels.
- Icon-only accessible names.
- Disclosure toggle behavior.
- per-surface defaults and independent preference persistence.
- invalid storage fallback.
- Activity item omission when no adapter exists.

### Docs

- Active library/page rendering through the adapter.
- Environment collapsed by default and remembered after interaction.
- full rounded active/hover hooks without left-border classes.
- PageActions is one ellipsis trigger, contains On this page and Copy page, and preserves keyboard navigation/focus restoration.
- deterministic Cockpit mapping and safe fallback behavior.
- mode query handoff uses the configured Cockpit base URL and does not depend on cross-origin storage.
- narrow layout has no horizontal overflow.

### Cockpit

- rail mode changes render the correct existing pane.
- Run iframe stays mounted across mode changes.
- Environment expanded by default and remembered independently from Docs.
- LanguagePicker and ThemeToggle remain reachable through Settings.
- navigation analytics continue firing.
- mobile overlay retains focus and close behavior.

### Visual and integration verification

- `npx nx test ui-react`
- `npx nx lint ui-react`
- `npx nx build ui-react`
- `npx nx test website`
- `npx nx lint website`
- `npx nx build website`
- `npx nx test cockpit`
- `npx nx build cockpit`
- Relevant website and cockpit Playwright coverage at desktop and 320–360px.
- Regenerate public agent context only if the final change alters public product guidance, not merely shell presentation.

## File-level change map

Expected additions:

- `libs/ui-react/src/lib/control-plane/control-plane.tsx`
- `libs/ui-react/src/lib/control-plane/control-plane-icons.tsx`
- `libs/ui-react/src/lib/control-plane/control-plane-preferences.ts`
- `libs/ui-react/src/lib/control-plane/control-plane.spec.tsx`
- `libs/ui-react/src/lib/control-plane/control-plane-preferences.spec.ts`
- `apps/website/src/components/docs/docs-control-plane.tsx`
- `apps/website/src/lib/cockpit-links.ts`
- `apps/cockpit/src/components/control-plane/cockpit-control-plane.tsx`

Expected modifications:

- `libs/ui-react/src/index.ts`
- `libs/ui-react/package.json`
- root `package.json` and `package-lock.json` for `lucide-react`
- `apps/website/src/components/docs/DocsSidebar.tsx`
- `apps/website/src/components/docs/PageActions.tsx`
- `apps/website/src/components/docs/PageActions.spec.tsx`
- `apps/website/src/components/docs/DocsTOC.tsx`
- `apps/website/src/app/docs/[library]/[section]/[slug]/page.tsx`
- `apps/website/src/styles/docs.css`
- `apps/cockpit/src/components/cockpit-shell.tsx`
- `apps/cockpit/src/components/sidebar/cockpit-sidebar.tsx`
- `apps/cockpit/src/components/sidebar/navigation-groups.tsx`
- `apps/cockpit/src/components/mobile-nav-overlay.tsx`
- `apps/cockpit/src/app/cockpit.css`
- Existing Cockpit sidebar, mode, mobile, and pane-rendering tests.

The implementation plan may reduce this file list after inspecting the cleanest existing boundaries, but it must preserve the shared-primitive/app-adapter split.

## Delivery and merge policy

- Work on `blove/sidebar-control-plane`.
- Use focused commits; do not make mid-task checkpoint commits.
- Open a pull request after fresh project-scoped verification.
- Wait for required CI checks and review feedback.
- Merge only when required checks are green and the branch is mergeable.
- Do not bypass protections or merge with pending/failing required checks.

## Acceptance criteria

1. Docs and Cockpit visibly share the same rail + contextual-pane grammar on desktop.
2. Docs defaults to Docs with Environment collapsed; Cockpit defaults to Run with Environment expanded.
3. Docs disclosure state and Cockpit mode/disclosure state persist safely and independently; explicit cross-surface mode links override Cockpit state once through a validated query.
4. Primary modes stay labeled; adapter-supplied Activity and Settings items are icon-only with tooltips and accessible names. Docs omits both utilities in the first iteration, and Cockpit exposes Settings only.
5. Section headings are sentence-case Inter labels, not uppercase mono.
6. Modern icons and consistent chevrons replace ad hoc glyphs in the changed surfaces.
7. Active/hover backgrounds are fully rounded and have no decorative left rail.
8. Quick actions are compact icon-only controls and render only real handlers.
9. Docs page utilities, including On this page and Copy page, live in the ellipsis menu.
10. Existing Cockpit pane behavior, Docs routing, analytics, and mobile accessibility remain intact.
11. Relevant Nx tests, lint, builds, and browser checks pass before the PR is merged.
12. Activity and Settings use a defined replacement-pane interaction with correct dismissal, focus restoration, and narrow-screen drawer behavior.
