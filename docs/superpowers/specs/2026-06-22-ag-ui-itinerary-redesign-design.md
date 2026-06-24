# AG-UI Demo — Itinerary Redesign + App Mode Map — Design

**Date:** 2026-06-22
**Status:** Draft for review
**Scope:** Productize the canonical AG-UI demo's trip-itinerary panel (`examples/ag-ui`) into a polished, chat-library-aligned companion to the chat, then add a hero "App mode" that turns the demo into a Tesla-style natural-language map cockpit (full-bleed Google Map + chat copilot side-by-side).

## Goal

Today the [itinerary panel](../../../examples/ag-ui/angular/src/app/itinerary-panel.component.ts) reads as a debug rail: a 300px column of plain rows with a utility-grade add form, painted with `--tp-border` and `--a2ui-primary` (not the chat library's tokens). The demo it anchors — "the agent reaches into live application state you can see and touch" — is selling the AG-UI value prop, but the visual fidelity undersells it.

Two phases land this design:

1. **Phase 1 — Productize the panel** (one PR). Re-skin to chat library tokens, rebuild rows as numbered cards, add CDK drag-to-reorder within and across days, a subtle "agent just edited this" pulse, a per-day add affordance, and a polished empty state.
2. **Phase 2 — App mode + map** (one PR, follows Phase 1's merge). A new "App mode" toolbar toggle that, when ON, forces sidebar mode and switches the body to **full Google Map on the left + chat copilot on the right** with the Phase-1 panel reused as a dismissible floating overlay (Apple Maps / Google Maps directions pattern). Map renders with `@angular/google-maps`, custom dark style, day-colored markers, per-day route polyline.

The phasing is deliberate: Phase 1 ships and verifies as a standalone polish win; Phase 2's map work depends on no Phase-1 details that aren't shippable on their own.

## Non-goals

- No port to `examples/langgraph` — there is no `examples/langgraph` today; both phases land in `examples/ag-ui` first, port follows in a separate spec if/when useful.
- No per-stop time-of-day field. Array-index order within a day is sufficient for the polyline draw order and the demo's UX.
- No place autocomplete in the add form. Plain text input. Geocoding resolves the entered text behind the scenes.
- No place imagery / hero photos / Google Places photos. Keeps cost predictable and the demo bundle small.
- No new chat library primitives. The toolbar toggle, App mode layout, and floating overlay live in the example shell, not in `@threadplane/chat`.

## Phase 1 — Productize the panel

### 1.1 Visual system

Replace `--tp-border` and `--a2ui-primary` references with chat-library tokens:
- Surfaces: `--ngaf-chat-bg`, `--ngaf-chat-surface-alt`
- Text: `--ngaf-chat-text`, `--ngaf-chat-text-muted`
- Borders: `--ngaf-chat-separator`
- Radii: `--ngaf-chat-radius-card`
- Typography: `--ngaf-chat-font-size-sm`, `--ngaf-chat-font-family`
- Action accent: `--ngaf-chat-primary`

Icons: **Material Symbols** ligatures, reusing the font the a2ui catalog already loads (commit `0c949b63`).
- Drag handle → `drag_indicator`
- Remove stop → `close`
- Add stop → `add`
- Overflow menu → `more_vert`
- Empty-state hero → `luggage`
- Overlay collapse (Phase 2) → `expand_less` / `expand_more`

### 1.2 Layout

```
┌── Trip itinerary ──── 5 stops ── ⋮ ─┐  ← head: title, total badge, overflow menu
│                                     │
│  Day 1 · 3 stops          + Add stop│  ← day header w/ per-day add affordance
│  ┌──────────────────────────────┐   │
│  │ ① Louvre                  ⋮⋮ ✕│   │  ← numbered card; drag handle + remove on hover
│  │   book tickets                │   │  ← note on second line, muted
│  └──────────────────────────────┘   │
│  ┌──────────────────────────────┐   │
│  │ ② Eiffel Tower           ⋮⋮ ✕│   │
│  └──────────────────────────────┘   │
│                                     │
│  Day 2 · 1 stop           + Add stop│
│  ┌──────────────────────────────┐   │
│  │ ① Musée d'Orsay          ⋮⋮ ✕│   │
│  └──────────────────────────────┘   │
└─────────────────────────────────────┘
```

The global bottom "day number + place + Add" form is removed. Day headers carry the add affordance; clicking `+ Add stop` reveals an inline text input scoped to that day, committing on Enter or blur.

### 1.3 Drag-to-reorder

`@angular/cdk/drag-drop`:
- `cdkDropListGroup` wraps all day sections so a stop can drag from one day's list into another's
- `cdkDropList` per day section holds the stops for that day
- `cdkDrag` on each row with `cdkDragHandle` on the `drag_indicator` icon
- Keyboard a11y: focus a row, hold `space`/`enter`, arrow keys move; CDK provides this out of the box

Drop handler:
- Same-list drop → `store.reorder(stopId, day, toIndex)`
- Cross-list drop → `store.reorder(stopId, toDay, toIndex)`

Drop animation: CDK default.

### 1.4 Agent-edit pulse

When the store mutates and the source is *not* the panel UI (i.e., the change came from a client tool), the changed row gets a one-shot visual cue:
- 1.6s animation: `--ngaf-chat-primary` ring + 200ms scale pop, fading to nothing
- Implementation: `ItineraryStore` gains `recentlyChangedId: Signal<string | null>`, set inside `add` / `move` / `reorder` / `remove` whenever the call originates from a client tool. The panel reads this signal and applies a `.itin__stop--pulse` class to the matching row. A `setTimeout(…, 1600)` clears the signal.
- Disambiguating "panel UI" from "client tool" mutations: the panel calls `store.add(…, { source: 'user' })` (default: `'agent'`). Only `'agent'` source sets `recentlyChangedId`.

### 1.5 Empty state

Replaces the current dimmed `<p>No stops planned yet.</p>` with:
- `luggage` Material Symbol at 48px, muted
- "Your trip is empty" — `--ngaf-chat-text`, normal weight
- Two suggestion chips (reuse the chat library's `chat-welcome-suggestion` styling if exported, else mimic): "Plan a Paris weekend", "Add a Day 1 stop". Clicking a chip sends the literal text via `agent.submit({ message })`.
- Reset demo data still available from the panel-head overflow menu.

### 1.6 Data shape

`ItineraryStop` stays:

```ts
interface ItineraryStop { id: string; day: number; place: string; note?: string; }
```

Order within a day is the array slot — no new `order` field. Days are computed by grouping; within each day, stops preserve their array order.

`ItineraryStore` gains:
- `reorder(stopId: string, toDay: number, toIndex: number): void` — atomic remove-and-insert, persisted
- `recentlyChangedId: Signal<string | null>` — see §1.4
- Existing methods (`add`, `move`, `remove`, `clearDay`, `reset`) gain an optional `source: 'user' | 'agent'` parameter (default `'agent'` for backwards compatibility at the client-tool seam; the panel passes `'user'` explicitly)

### 1.7 Client tools

Add to [client-tools.ts](../../../examples/ag-ui/angular/src/app/client-tools.ts):

| Tool | Kind | Schema | Description |
|---|---|---|---|
| `reorder_stop` | action | `{ place: string, toDay: number, toIndex: number }` | "Reorder a stop within or across days. Use after the user describes a sequence change (e.g., 'put Louvre first', 'move Eiffel to day 2 second')." |

Existing tools unchanged. `move_stop` stays as a sugar verb for cross-day moves without an explicit index (resolves to `reorder(id, toDay, lastIndex+1)`).

### 1.8 Testing

- `itinerary-store.spec.ts` extends with: within-day reorder, cross-day reorder, `recentlyChangedId` is set on agent-source mutations and not on user-source mutations, signal clears after 1.6s
- `itinerary-client-tools.spec.ts` extends with: `reorder_stop` happy path, drag-reorder DOM assertion (Playwright `dragTo`)

## Phase 2 — App mode + map

### 2.1 App mode toggle

A new pill-style thumb toggle added to the toolbar at [ag-ui-shell.component.html](../../../examples/ag-ui/angular/src/app/shell/ag-ui-shell.component.html), positioned adjacent to the existing Mode segmented control (the two are conceptually linked — App-mode locks Mode to `sidebar`).
- Label: "App mode"
- On-icon: `map`; Off-icon: none
- Persistence: same `PalettePersistenceService` pattern already used for theme + colorScheme; new key `appMode: boolean`
- Default: **off**
- Build-time key gating: if `GOOGLE_MAPS_API_KEY` is missing at build, the toggle renders disabled with a tooltip `"Set GOOGLE_MAPS_API_KEY to enable"`

When App mode is ON, the Mode segmented control's non-`sidebar` buttons are disabled (greyed) with a tooltip `"Sidebar mode while App mode is on"`.

### 2.2 Layout shift

When ON, the `.ag-ui-shell__body` is replaced by `.ag-ui-shell__app-body`:

```
┌── toolbar (App mode: ●ON   Sidebar | Model | Effort | Gen UI | Theme | ☾) ──┐
├─────────────────────────────────────────────────────────────────────────────┤
│                                                          ┌───────────────┐  │
│  ┌── Trip itinerary ── 5 stops ──── ⋀ ─┐                 │               │  │
│  │  (Phase-1 panel here, as overlay)   │                 │   chat        │  │
│  │  Day 1 · 3 stops                    │                 │   sidebar     │  │
│  │  ① Louvre                           │                 │   (right edge,│  │
│  │  ② Eiffel Tower                     │     [MAP]       │   chat input  │  │
│  │  Day 2 · 1 stop                     │                 │   at bottom)  │  │
│  │  ① Musée d'Orsay                    │                 │               │  │
│  └─────────────────────────────────────┘                 │               │  │
│                                                          │               │  │
│                                                          └───────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

- Map fills the full `__app-body` area
- `<chat-sidebar [pushContent]="true" [open]="true">` renders on the right; the map's effective width is `100% - var(--ngaf-chat-sidebar-width-drawer)`
- The Phase-1 panel renders as a floating overlay card pinned top-left, `width: min(360px, 36vw)`, `max-height: calc(100vh - 120px)`, scrollable
- Overlay has a collapse button (`expand_less` / `expand_more`) that minimizes it to its head row (`Trip itinerary · 5 stops`)
- Overlay `pointer-events: auto`; map clicks behind the overlay pass through to the map (negative space around the overlay)

### 2.3 Map canvas

New `MapCanvasComponent` using `@angular/google-maps`:
- `<google-map>` with a custom **dark `MapTypeStyle`** — muted greys, deep blue water, subtle highlighted roads. Style array defined inline in `map-canvas.component.ts`.
- Initial view: fit-to-bounds of all current stops with `lat/lng`, falling back to Paris (`48.8566, 2.3522`) at zoom 12 if no stops have coords.
- Per-stop `<map-marker>` keyed by stop `id`, marker color from a small palette indexed by `day` (8 hues, cycles past 8).
- Per-day `<map-polyline>` connecting that day's stops in array-index order. Polyline color matches the day's marker color, weight 3, opacity 0.7.
- `<map-info-window>` opens on marker click. Contents: place name (bold), note (muted, if present), a Remove button calling `store.remove(id, { source: 'user' })`.

### 2.4 Geocoding

New `GeocodingService` (`apps/ag-ui/angular/src/app/geocoding.service.ts` or co-located with the map canvas):
- Wraps `google.maps.Geocoder.geocode({ address })`
- Returns `{ lat: number, lng: number } | null`
- Debounce: 250ms per page-load to avoid bursts on rapid agent calls
- Catches all errors → returns `null` (Maps outage degrades to "no pins")

Wiring: in [client-tools.ts](../../../examples/ag-ui/angular/src/app/client-tools.ts), the `add_stop` and `move_stop` handlers `await` geocoding before writing to the store, then call `store.add(day, place, note, { lat, lng })`. If geocoding returns `null`, they still call `store.add` but with no coords. The store accepts optional coords.

### 2.5 Data shape extension

```ts
interface ItineraryStop {
  id: string;
  day: number;
  place: string;
  note?: string;
  lat?: number;
  lng?: number;
}
```

Seed stops get hardcoded Paris coords so the initial demo always has pins:
- Louvre: `48.8606, 2.3376`
- Eiffel Tower: `48.8584, 2.2945`
- Musée d'Orsay: `48.8600, 2.3266`

### 2.6 Map ↔ overlay interactions

Coupled via two new signals on `ItineraryStore` (the existing shared seam between the panel and the map):
- `focusedStopId: Signal<string | null>` — set by either side; consumed by both
- The existing `recentlyChangedId` from Phase 1 is reused for the row-highlight visual

Behaviors:
- Click a marker → map sets `focusedStopId = id`; the overlay scrolls the matching row into view and re-uses the `--pulse` class for a 1-shot ring highlight
- Click a row in the overlay → overlay sets `focusedStopId = id`; the map effect pans to that stop's coords and opens its info window
- Drag-reorder in the overlay → polyline redraws to match the new order; marker positions are unchanged (no animation); the relevant day's polyline rebuilds reactively from the new array order

### 2.7 Key safety & cost

- Single `GOOGLE_MAPS_API_KEY` covers Maps JS + Geocoding
- HTTP-referrer restrictions in Google Cloud Console: `examples.threadplane.ai/*`, `*.threadplane.ai/*`, `localhost/*`
- Build-time injection: the example app's build reads `GOOGLE_MAPS_API_KEY` from the root `.env` (mechanism — Angular `environment.ts` substitution vs Vite `define` — resolved in the implementation plan; the spec requires only that the key reach the bundle for the demo origin and be absent in CI builds)
- Free-tier headroom: Maps JS 28k loads/mo, Geocoding 40k requests/mo (per Google Maps Platform pricing as of 2026). Adequate for a demo with referrer restrictions.

### 2.8 Testing

- Unit: `GeocodingService` with a stubbed `google.maps.Geocoder` — happy path, failure path, debounce
- Unit: `MapCanvasComponent` polyline rebuilds when array order changes
- Unit: App-mode signal flip toggles `.ag-ui-shell__body` ↔ `.ag-ui-shell__app-body`
- E2E (CI, no key): App-mode toggle is reachable and disabled (no key); body class does not change on click
- Manual smoke before release (per the project's live-LLM smoke gate): App-mode ON with real key — pins render, polyline draws, drag-reorder updates polyline, agent says "add Louvre to Day 2" and the new pin appears
- Manual smoke: `add_stop("Fictional Place 12345", 1)` — row adds, no pin, no console error

## New dependencies

Added to [examples/ag-ui/angular/package.json](../../../examples/ag-ui/angular/package.json):
- `@angular/cdk` — Phase 1, drag-drop module only (tree-shakable import)
- `@angular/google-maps` — Phase 2

Both are first-party Angular packages versioned in lockstep with the Angular major already in use; no version churn risk.

## Risks

- **Stolen API key.** Mitigated by referrer restrictions; Google enforces them server-side. A leaked key cannot run from another origin.
- **Geocoding mismatches.** The agent says `add_stop("Cafe", 1)` and Google picks an arbitrary "Cafe". Acceptable — the row still adds; the user can remove/correct.
- **CI cannot reach live Google Maps.** Phase 2 E2E suite skips map assertions; manual smoke gate before merge / release.
- **`@angular/cdk` bundle weight.** Drag-drop entry point only; tree-shaken. Acceptable.
- **Toolbar real-estate.** Adding App-mode pushes the toolbar to ~8 controls. Mitigated by placing App-mode adjacent to Mode (visually linked) and using a compact pill thumb.
- **Sidebar `pushContent` interaction.** Under App mode the map needs to know about the sidebar's width to size correctly. Resolved by reading `--ngaf-chat-sidebar-width-drawer` in the App-mode CSS.

## Verification gates

**Phase 1 done = "ready for Phase 2" when:**
- Panel renders with `--ngaf-chat-*` tokens against light + dark themes
- Drag-reorder works in mouse + keyboard, within and across days
- `recentlyChangedId` pulse fires on agent edits (manual: "move Eiffel Tower to Day 2")
- Empty-state suggestion chips submit the agent
- `itinerary-store.spec.ts` and `itinerary-client-tools.spec.ts` extended and green
- PR shipped and merged before Phase 2 work begins

**Phase 2 done = "ready to release" when:**
- App-mode toggle persists across reloads
- Toggle disabled gracefully when key missing at build
- Map loads with custom dark style; pins + per-day polyline render
- Click-marker → info-window; click-row → re-center
- Overlay collapses + expands; drag-reorder inside overlay still works; polyline updates after reorder
- Geocoding failure path verified manually (e.g., `add_stop("Fictional Place 12345", 1)`)
- Smoke against the live AG-UI runtime with App mode ON

## Open items intentionally left for the plan

- Exact build-time env injection mechanism for the API key (Angular `environment.ts` substitution vs Vite-style `define`)
- Dark map style array values (a JSON blob; tune visually during implementation)
- Day-color palette exact hex values (8 distinguishable hues)
- Whether to reuse the chat library's `chat-welcome-suggestion` component for the empty-state chips (preferred if exported) or mimic its styling locally
