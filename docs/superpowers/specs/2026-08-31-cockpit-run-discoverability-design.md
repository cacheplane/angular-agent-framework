# Cockpit: making Run discoverable from Code

**Date:** 2026-08-31
**Status:** Approved, ready for planning

## Problem

On a capability page in Code view, nothing tells the user they can run the example. The
mode rail exists and works, but it does not read as a switch.

Three failures, observed on the live page at 1440×900
(`/ag-ui/core-capabilities/streaming/overview/python`):

1. **The rail reads as chrome.** `Docs / Run / Code / API` sit in a 66px column at the far
   left edge, at the same visual weight as the `Activity` and `Settings` utilities beneath
   them. Nothing groups the four as views of one capability. Inactive items are painted
   with `--ds-text-muted` — the token also used for disabled text — so they read as
   unavailable rather than clickable.

2. **Code view has no exit affordance.** Roughly 1250px of the viewport is file tree, tabs
   and source. The only route back to Run is a 48px target ~1200px away, with no
   in-context prompt.

3. **Runtime controls sit below the fold.** The `Runtime` section renders after the full
   capability nav list. Measured on the live page: the heading lands at `y=1860` inside a
   900px viewport, in a pane with 1997px of scroll height. The one surface that says a
   live runtime exists is unreachable without scrolling past ~30 nav links.

**Amplifier.** `activeMode` is persisted in `localStorage` under a single global key
(`libs/ui-react/src/lib/control-plane/control-plane-preferences.ts`), not scoped per
capability. Verified live: a single Code click persisted for the rest of the session and
across navigations. One exploratory click therefore makes Code the landing view for *every*
capability, on *every* future visit. The `'Run'` default only ever applies to a first-time
visitor.

## Non-goals

- No in-content affordance inside the Code pane (a header "run this" pill, a live peek at
  the running app). Both were considered and deliberately deferred; see Alternatives.
- No change to Docs, API or narrative content.
- No change to the mobile overlay beyond what falls out of shared components.

**Accepted tradeoff:** this design does not address failure 2. Nothing lands in the 1250px
where the user's eye is while reading code. The rail becomes legible; it does not become
close. This is a deliberate first step, to be evaluated before deciding whether the header
pill is still needed.

## Design

### 1. Mode is no longer sticky

Every capability opens in Run. Mode becomes per-page state, not a preference.

- Remove `activeMode` / `setActiveMode` from `ControlPlanePreferencesV1['cockpit']` and
  from `useControlPlanePreferences`. The hook retains `expanded` only.
- `CockpitShell` holds the mode in `useState<ControlPlaneMode>('Run')`.
- The `?mode=` deep link keeps working. It currently waits on `preferences.hydrated`;
  with mode as local state it instead applies in a mount effect, so the server-rendered
  Run markup and the first client render agree and hydration stays clean.
- No storage version bump. `activeMode` in existing stored blobs is simply no longer read;
  a stale ignored key is harmless. The `docs` surface does not use this field.

Rationale: the cockpit's value is the running example; the code is supporting evidence. A
preference that quietly demotes the demo to a code dump is the wrong thing to remember —
and it is remembered from a single exploratory click, which is weak evidence of intent.

### 2. Rail legibility

In `apps/cockpit/src/app/cockpit.css`:

- **Resting contrast:** inactive `[data-control-plane-rail-item]` moves from
  `--ds-text-muted` to `--ds-text-secondary`.
- **Group rule:** a hairline above `[data-control-plane-rail-group="utilities"]`. The DOM
  already separates `primary` from `utilities`
  (`libs/ui-react/src/lib/control-plane/control-plane.tsx`); only the CSS is missing.
- **Set label:** a small `VIEW` cap above the primary group, so the switch is named rather
  than inferred. Decorative, `aria-hidden` — the rail's `nav` already carries
  `aria-label="Cockpit modes"`.

### 3. A runtime phase dot on Run

The `Run` rail item carries a dot driven by `runtimeSnapshot.phase`, already available in
`CockpitShell` via `controller.snapshot`.

| Phase | Dot |
| --- | --- |
| `ready` | success |
| `connecting`, `checking`, `reloading` | working |
| `unresponsive`, `error`, `invalid_configuration` | error |
| `not_configured` | none |

`not_configured` renders no dot: there is no runtime, so absence is the honest signal.

`.cockpit-control-plane` already defines `--cockpit-state-success` and
`--cockpit-state-error` (with dark-theme overrides). The success and error buckets use
those; the working bucket needs one new sibling token defined the same way.

Constraints:

- **Colour is not the only channel.** The state goes into the Run item's accessible name
  ("Run, runtime ready" / "Run, runtime error"), reusing the existing rail tooltip for the
  hover affordance.
- **Steady fills, no pulse.** A blinking dot in permanent peripheral vision costs
  attention without carrying information.
- Reuses the existing dot treatment established by `[data-cockpit-activity-attention]`.

### 4. Activity's dot is re-scoped to unseen problems

Adding a phase dot to Run collides with the Activity dot: today
`runtimeNeedsAttention(phase)` fires on exactly `invalid_configuration`, `unresponsive`
and `error` — the same three phases where Run now goes red. Left alone, one fault paints
two red dots in one 66px column and neither says which to click.

The two dots are re-scoped to make two distinct claims:

- **Run** — what the runtime is doing *right now*.
- **Activity** — there are problems in the log you have not read.

Definition: the Activity dot shows when there is at least one event with
`severity === 'error'` that arrived since the panel was last opened. `severity` is already
assigned in `createSessionActivityEvent`, so this needs no new event plumbing. It covers
`runtime_unresponsive`, `runtime_initialization_error`, `configuration_invalid` and
`diagnostics_copy_failed`.

- Seen-marker: opening the Activity utility marks all current events seen. `CockpitShell`
  already tracks `activityOpenCycle` on open, which is the natural hook.
- **Direction matters.** `activityReducer` *prepends* (`[action.event, ...state]`), so the
  log is newest-first: the seen events are the array's tail and the unseen window runs from
  index 0. A naive `slice(seenCount)` is exactly inverted and still passes the obvious
  tests, so the selector needs a case that pins the direction.
- Known limitation: the marker is a count, and the log is capped at `MAX_ACTIVITY_EVENTS`
  (50). Once the cap is reached, `length - seenCount` saturates at 0 and further errors
  would not flag. Keying the marker on the newest seen event id would be robust; the count
  is kept because the cap is far outside ordinary use. Revisit if the cap ever drops.
- Clearing the log clears the marker.
- Deriving from `severity === 'error'` rather than "any unread event" matters: `mode_changed`
  and `runtime_ready` fire during ordinary use, and counting them would light the dot
  constantly from the user's own actions.

This is strictly better than today's behaviour on one case: a runtime that failed and then
self-recovered currently leaves no trace once the phase clears, because the dot tracks
live phase. Under the new rule the unread error survives the recovery until someone looks.

`runtimeNeedsAttention` becomes dead once the Activity dot stops calling it: the Run dot
goes through `runtimeRailStatus`, not through it. It is deleted along with its test table
rather than left as an exported, tested, uncalled predicate.

## Components touched

| Unit | Change |
| --- | --- |
| `control-plane-preferences.ts` | Drop `activeMode` from the persisted shape and the hook |
| `control-plane.tsx` | Rail item gains optional status-dot + accessible-name support |
| `cockpit-control-plane.tsx` | Pass phase to Run; switch Activity's dot to unseen-errors |
| `cockpit-shell.tsx` | Mode as local state; `?mode=` on mount; track seen-marker |
| `activity-panel.tsx` | `attention` prop reinterpreted as unseen-errors |
| `cockpit.css` | Contrast, group rule, `VIEW` cap, dot variants |

## Testing

- **Preferences:** stored `activeMode` is ignored; a fresh capability opens in Run;
  `?mode=code` still lands in Code without a hydration mismatch.
- **Phase mapping:** all eight phases map to the right dot, `not_configured` renders none,
  and the accessible name changes with phase.
- **Activity dot:** does not fire on `mode_changed` or `runtime_ready`; fires on an error
  event; clears on panel open; survives a fault that recovers before the panel is opened.
- **Mutation check.** The Activity-dot rule and the `not_configured` no-dot case both fail
  silently if wired wrong — the assertion is an absence. Each needs a deliberate mutation
  to confirm the test actually fails, per prior experience with tests that pass vacuously.
- Existing rail, overflow-menu and mobile-overlay suites must stay green.

## Alternatives considered

- **Header runtime pill** (`● Running ›› See it run` in the workspace header). Hits all
  three failures, lands where the eye is, and covers Docs and API with one affordance.
  Recommended, not chosen — deferred so the cheaper rail work can be evaluated first.
- **Live peek** — the running app kept on screen beneath the code. Architecturally cheap,
  because `RunMode` never unmounts (`invisible absolute inset-0`) and the iframe is already
  warm. Deferred: these demos are chat UIs that want vertical room, and at laptop height it
  risks leaving both panes unusable. Wants a real-size prototype before committing.
- **Presence-only dot on Run** (one colour, "a runtime is live"). Avoids the Activity
  collision entirely. Not chosen: full phase is more informative, and the collision turned
  out to have a resolution that improves Activity independently.
