# Workspace control-plane v2 navigation and polish

## Status

Approved through interactive design review on 2026-09-01. This is release 3 of the unified control-plane program and depends on both the unified workspace shell and custom runtime targets.

## Summary

Turn the unified rail and context pane into a fast, restrained workspace control plane. Add a unified command palette, device-local pins and recents, Activity filters, and complete the requested visual and interaction polish across Docs and operational modes.

The design remains rail-first and context-led. It does not become a dashboard, launcher grid, or dense toolbar. Modern icons support recognition, but every action retains an accessible name and keyboard path.

## Goals

1. Make any capability, mode, or safe runtime action reachable through one palette.
2. Keep important and recent capabilities visible without overwhelming primary navigation.
3. Make Activity useful during diagnosis without persisting operational history.
4. Finish the approved minimal headings, rounded active states, modern iconography, and three-dot page actions.
5. Provide robust mobile, tablet, Firefox, Safari/WebKit, forced-color, and reduced-motion behavior.
6. Normalize remaining product labels, including `AG-UI`.

## Non-goals

- Account-synced pins or recents.
- Persistent Activity history.
- Arbitrary shell commands, destructive runtime actions, or credential-bearing palette commands.
- Cloud search or a new indexing backend.
- Replacing docs content hierarchy with a flat launcher.
- New behavioral analytics beyond existing allowlisted event contracts needed for current features.

## Preference model

Create a versioned preference migration from both predecessor records:

- `threadplane:control-plane:v1`, whose exact `ControlPlanePreferencesV1` shape contains Docs and Cockpit disclosure state plus `cockpit.activeMode`.
- `threadplane:runtime-targets:v1`, whose exact `RuntimeTargetPreferencesV1` shape contains `selectedTargetId` and `savedTargets` but no credentials.

The new authoritative `threadplane:workspace-preferences:v2` record stores only non-secret state:

```ts
interface WorkspacePreferencesV2 {
  version: 2;
  expanded: Record<string, boolean>;
  lastMode: ControlPlaneMode;
  pins: string[];
  recents: string[];
  activityFilter: 'all' | 'runtime' | 'navigation' | 'errors';
  selectedTargetId: string;
  savedTargets: SavedRuntimeTarget[];
}
```

Rules:

- Maximum 12 pins and 8 recents.
- Attempting to add a thirteenth pin leaves the existing pins unchanged and announces `You can pin up to 12 capabilities`; it never silently evicts a pin.
- Adding a ninth unique recent item evicts the oldest item after deduplication.
- IDs must resolve through the current workspace registry; unknown IDs are dropped on read.
- Recents are unique, newest first, and updated only on a successful workspace navigation.
- The current workspace may appear in Pinned but is not duplicated in Recent rendering.
- A failed or malformed migration falls back to defaults without deleting unrelated browser data.
- When no v2 record exists, migration validates each predecessor independently, preserves every valid disclosure and target field, maps `cockpit.activeMode` to `lastMode`, and writes v2 only after constructing a complete valid record. The predecessor keys remain during this release for rollback but are no longer authoritative after a successful v2 write.
- Activity events and API keys are structurally absent from the preference type.
- On initial navigation, an explicit valid `mode` query wins, followed by the canonical route default from release 1. `lastMode` never overrides a deep link or the Docs default; it is used only by mode-preserving in-shell navigation that has no explicit destination mode.

## Context hierarchy

Desktop context order:

1. Command trigger.
2. Scope.
3. Pinned, when non-empty.
4. Recent, when non-empty.
5. Mode-specific Learn or Capability navigation.
6. Runtime.

Empty Pinned and Recent sections are omitted. The shell does not render instructional empty-state cards in the persistent pane.

Section headings use quiet title case, the shared sans font, moderate weight, and readable size. They are not uppercase or letter-spaced microcopy.

## Command palette

`Cmd+K` on macOS and `Ctrl+K` elsewhere opens the palette from any mode. The visible context trigger opens the same surface.

Palette groups:

- Pinned.
- Recent.
- Capabilities.
- Documentation.
- Modes.
- Safe runtime commands.

Safe runtime commands are limited to Recheck, Reload runtime, Open runtime, Copy diagnostics, and Configure runtime. Disabled commands remain discoverable with a reason. Clearing Activity stays in the Activity menu. Removing targets and clearing credentials stay in Settings.

Behavior:

- Local search only. Capability results are registry-derived; Documentation results reuse the existing Docs search index and ranking.
- Match product, title, topic, section, and stable aliases.
- Arrow keys move through results; Home and End jump; Enter selects; Escape closes and restores focus.
- Results use semantic links for navigation and buttons for commands.
- The active item and query are never persisted.
- Credentials, endpoints, Activity summaries, and remote response text are not searchable.
- Mobile uses the same dialog and semantics.
- The existing Docs search trigger opens this palette, and `Cmd+K` or `Ctrl+K` has exactly one workspace-level handler. The prior standalone Docs-search dialog is removed only after its indexing, ranking, keyboard navigation, and accessible labeling are covered in the unified palette.

## Pins and recents

- The page header exposes Pin or Unpin as a direct reversible icon action.
- The action has a visible tooltip, pressed state, and live-region confirmation.
- Context entries use modern Pin and History icons only where they add recognition; row text remains visible.
- Selecting an entry navigates within the mounted workspace provider.
- The palette and context sections use the same selectors and ordering helpers.

## Activity filters

Activity remains newest-first, memory-only, and capped by the existing reducer. Add four filters:

- All.
- Runtime.
- Navigation.
- Errors.

Filtering never changes the underlying event list or attention indicator. The selected filter may persist locally because it contains no operational data. Empty filtered results state `No matching session activity`. Clear session activity remains in the three-dot menu.

Every `SessionActivityEvent` has an allowlisted `category: 'runtime' | 'navigation'` assigned by the central event factory. Existing runtime/check/reload/open/diagnostics/configuration events and release 2 target events are `runtime`. The only navigation inputs are `mode_changed` and a new `capability_changed` event emitted after a successful registry-resolved in-shell capability navigation; it contains stable from/to capability IDs and no URL. Filter predicates are deterministic:

- All: every event.
- Runtime: `event.category === 'runtime'`.
- Navigation: `event.category === 'navigation'`.
- Errors: `event.severity === 'error'`, intentionally overlapping the two domain categories.

New event kinds must declare category and severity in the same exhaustive factory before they compile.

## Visual design

- Active and hover rows use rounded backgrounds consistent with docs cards and inputs.
- Remove the disliked active left-border or rounded-left-edge marker from the website, docs navigation, and workspace navigation.
- Use current Lucide icons with consistent 2px stroke weight and optical size.
- Replace remaining thin or hand-drawn carets with the shared chevron treatment.
- Keep icon-only quick actions in toolbars; labels remain available through accessible tooltips.
- Keep `On this page` and `Copy page as Markdown` inside the page ellipsis menu.
- Refine that menu's spacing, focus ring, selection feedback, and narrow-screen placement.
- Normalize product presentation through shared labels: `AG-UI`, `LangGraph`, `Deep Agents`, `A2UI`, and `JSON Render` where applicable.
- Preserve serif article headings; control-plane section headings remain minimal sans-serif.

## Responsive and browser behavior

- Desktop: persistent rail and context pane.
- Tablet: collapsible context pane with persistent mode access.
- Mobile: modal context sheet, compact mode strip, 44px minimum targets, inert background, scroll isolation, and deterministic focus restoration.
- Tooltips never become the only mobile label.
- Menus and palette stay within the visual viewport and respect safe areas.
- Motion used for disclosure or panel changes is removed under reduced-motion.
- Forced colors preserve boundaries, current state, focus, and attention without relying on background color.

Add focused Chromium, Firefox, and WebKit shell E2E. The full capability matrix may remain Chromium-only; cross-browser coverage targets the unified shell, palette, Settings, Activity, menus, and one representative runtime.

## Error handling

- Blocked storage leaves pins, recents, and preferences as in-memory progressive enhancement.
- Stale registry IDs are discarded, not rendered as broken links.
- Palette errors close only the palette and do not replace the workspace.
- Activity boundary behavior remains isolated.
- A missing icon or label mapping falls back to a readable title, never a raw lowercase product ID when an approved product label exists.

## Testing

- Two-record-to-v2 preference migration, field preservation, route precedence, bounds, deduplication, and malformed storage tests.
- Pure palette indexing and matching tests.
- Docs search parity and single-shortcut-handler tests.
- Component tests for keyboard traversal, focus restoration, pressed pin state, filtered Activity, and menu placement.
- CSS contract tests for rounded active states and absence of active left-border treatments.
- Label tests for AG-UI, A2UI, and JSON Render.
- Responsive E2E at mobile, tablet, and desktop widths.
- Forced-colors and reduced-motion E2E.
- Representative Chromium, Firefox, and WebKit shell E2E.
- Chrome visual audit for Docs, Run, Code, API, palette, Activity, Settings, custom target errors, and mobile sheet.

## Acceptance criteria

1. A keyboard-only user can reach any capability, mode, pin, recent item, or safe runtime command through the palette.
2. Pins and recents survive refresh without storing Activity or credentials.
3. Activity filters work without mutating history or attention state.
4. No active navigation treatment uses a left border or partial rounded edge.
5. Page-specific secondary actions remain in a polished three-dot menu.
6. Product labels and icons are consistent across Docs and operational modes.
7. The representative unified shell passes Chromium, Firefox, and WebKit coverage plus accessibility media-state tests.
