# AG-UI Map Cockpit Polish — Design

**Status:** Approved (brainstorm), pending spec review
**Date:** 2026-06-24
**Area:** `examples/ag-ui/angular` — App-mode Google Map cockpit (Phase 2 follow-up)
**Related:** Phase 1 [#729], Phase 2 [#732]; PR-A = crash fix [#736] (open); redesign spec `2026-06-22-ag-ui-itinerary-redesign-design.md`

## Goal

Close the Phase-2 map cockpit's deferred polish: frame the map to the actual stops (fit-to-bounds), migrate off the deprecated `google.maps.Marker` to `AdvancedMarkerElement` (with a cloud-based dark map style), and land the already-built but unmerged blank-page-on-reload crash fix.

## Context established during brainstorming

Three findings reshaped the scope:

1. **The "grey base map" is NOT a code bug.** Prior debugging root-caused it as Google Maps **tile-quota throttling** from heavy cumulative reloads in one session (tile requests returning `transferSize: 0`). It renders dark in a fresh session. Fit-to-bounds was explicitly ruled out as the cause. **No code change addresses grey — there is nothing to fix there.**

2. **A real dev-mode crash fix is built but unmerged.** Branch `worktree-ag-ui-app-mode-mapfix`, commit `189d04b9` (base = `fb0c49f7`, 2 unrelated commits behind main, rebases clean). `<google-map>` throws in its constructor when `window.google` is absent (a `ngDevMode`-gated throw at `@angular/google-maps` `google-maps.mjs:136`); on a fresh reload with App-mode persisted, the async Maps script loses the bootstrap race and the throw aborts the shell render → blank page (no console error; zoneless swallows it). #732's smoke missed it because it only toggled App-mode at runtime, never reloaded with it persisted. The fix: a `GoogleMapsLoader` service owning the script injection (exposes a `loaded` signal), with `<google-map>` gated behind `@if (loader.loaded())`. It touches 3 files (`app.config.ts`, new `google-maps-loader.ts`, `map-canvas.component.ts`), is lint-clean with 42 tests passing.

3. **The marker migration forces a styling tradeoff (decided: cloud style).** `AdvancedMarkerElement` *requires* a map `mapId`, and a map with a `mapId` **ignores the inline JSON `styles` array** — styling moves to a cloud-based map style tied to that `mapId`. We chose to migrate and move the dark theme to a Google Cloud Console map style (future-proof), accepting a one-time console-config dependency, with a `DEMO_MAP_ID` fallback so a fresh clone still runs (light map) without setup.

## Scope: two sequential PRs

The crash fix and the map-polish work both heavily rewrite `map-canvas.component.ts`, so they are split to keep diffs clean and land the finished fix without gating it behind new work.

### PR-A — Land the crash fix — **already open as [#736]**

This is the already-built, already-rebased crash-fix branch `worktree-ag-ui-app-mode-mapfix` (commit `189d04b9` + follow-ups), now open as **[#736]** against `main`. No new code is authored here; PR-B simply waits on / branches off it.

- **Files (7):** `app.config.ts`, `google-maps-loader.ts` (new), `map-canvas.component.ts` (wraps `<google-map>` in `@if (loader.loaded())`, injects `GoogleMapsLoader`, keeps `MapMarker`/`DARK_STYLE`/`markerOptions`), plus the companion fixes — `modes/sidebar-mode.component.ts` (forces `/sidebar` on App-mode reload, previously redirected to `/embed` and covered the map), `e2e/itinerary-client-tools.spec.ts`, and `shell/ag-ui-shell.component.{css,html}` cleanup.
- **Scope boundary confirmed:** #736 does **not** touch fit-to-bounds or AdvancedMarker — those are entirely PR-B. The grey-map base is left open in #736's body ("tracked separately"); this spec treats it as environmental tile-quota throttling and out of scope.
- **Verify (already done on the branch):** `nx lint`/`test`/`build` for `examples-ag-ui-angular` green (42 tests); live smoke — reload with App-mode persisted renders the shell (no blank page) and lands on `/sidebar`.

### PR-B — Fit-to-bounds + AdvancedMarker migration + cloud dark style

Built on top of PR-A's loader-gated map. **Branches off [#736]'s head (or off `main` once #736 merges) — never off current `main`, which lacks the loader gate.** PR-B deletes the exact `DARK_STYLE` / `markerOptions` / `[options]` / `[center]` lines #736 carries; because it layers *on top of* #736 this is a clean sequential edit, not a merge conflict.

#### Fit-to-bounds

- New effect keyed on `stopsWithCoords()` (structural changes: add/remove/geocode) builds a `google.maps.LatLngBounds` and calls `GoogleMap.fitBounds(bounds, padding≈48px)`. `GoogleMap` obtained via `viewChild(GoogleMap)`. **Because `<google-map>` is behind PR-A's `@if (loader.loaded())` gate, the `viewChild` is `undefined` until the map loads — the effect must no-op when it is absent** (mirrors the existing focus effect's `marker && win` guards).
- **Edge cases:** 0 stops → fall back to `PARIS_CENTER` + default zoom; 1 stop → `panTo` + fixed city zoom (~13) (avoids `fitBounds` single-point over-zoom); ≥2 → `fitBounds` with padding.
- **Coexistence with focus:** the existing focus effect (row/marker click → pan + open info window, keyed on `focusedStopId`) is unchanged. Fit-to-bounds fires only on the structural signal, so the two never fight: clicking a stop pans to it; adding a stop reframes to all.
- **Testability:** extract a pure helper `computeBounds(stops) → { north, south, east, west } | null` (jsdom-safe geometry) with a unit test. The `fitBounds` *call* is live-smoke verified.
- The `center()`/`zoom()` signals remain only for the 0/1-stop fallback path.

#### AdvancedMarker migration

- Swap `MapMarker` → `MapAdvancedMarker` (`@angular/google-maps`, confirmed available at the installed version; Angular core 21.1.6).
- Add `[mapId]="mapId"` to `<google-map>` (required for advanced markers).
- **Pin styling (decided: flat colored dots):** each marker's `content` is a styled `<div>` circle built imperatively — `background: DAY_COLORS[(day-1) % n]`, white border — returned by a `pinContent(s)` method. `DAY_COLORS` stays in-repo (marker styling, not map styling). This preserves the current dot aesthetic rather than switching to a teardrop `PinElement`.
- **Delete `DARK_STYLE` and `styles: DARK_STYLE`** from `mapOptions` — a `mapId` map ignores inline styles (dead code).
- InfoWindow: `MapInfoWindow.open(marker)` still works (`MapAdvancedMarker` is a valid anchor). The focus effect's index-based marker lookup is unchanged.

#### Cloud dark style + mapId (external seam)

User-performed Console steps (cannot be automated):
1. In Google Cloud Console: create a **Map ID** (vector), create/import a **dark map style**, associate them.
2. Provide the Map ID via the **existing** `generated-keys.local.ts` + `scripts/inject-env.mjs` mechanism — add a `GOOGLE_MAPS_MAP_ID` env var alongside `GOOGLE_MAPS_API_KEY` (both gitignored, `fileReplacements`-injected). Add it to the `.env` at the main checkout.

**Fallback:** if no `GOOGLE_MAPS_MAP_ID` is configured, use Google's `DEMO_MAP_ID` so the demo runs (light style, advanced markers work) for a fresh cloner. Documented in the example README: a custom Map ID enables the dark theme.

**Verification consequence:** all code is authorable + lint/build/smoke-able now, but the **dark-theme visual check is gated on the user's Console setup + env var**. Until then the map renders light with correct dark-dot pins.

## Testing & verification

- **Unit (vitest):** `computeBounds()` pure helper; existing `geocoding.service.spec.ts` retained; PR-A's 42 tests carry over.
- **No jsdom map rendering** (Maps API needs a real browser) → marker content, `mapId`, `fitBounds` calls, and the dark theme are verified by **live Chrome-MCP smoke** (established pattern), with known gotchas: re-run `scripts/inject-env.mjs` (with `GOOGLE_MAPS_API_KEY` exported) after any `nx build` (the Nx-cached `inject-env` target can write an empty key); probe DOM via `javascript_tool` not screenshots (WebGL canvas times out); wait for HMR idle. The worktree root has no `.env` — the real one is at the main checkout.
- **Live smoke checklist:**
  - *PR-A:* reload with App-mode persisted → shell renders (no blank page), lands on `/sidebar`.
  - *PR-B:* day-colored dot markers render; fit-to-bounds frames all stops on load and reframes on add/remove; single-stop centers; info window opens on marker click; row-click still pans; dark theme appears once the Map ID is configured (`DEMO_MAP_ID` = light until then).

## Error handling

- **No `GOOGLE_MAPS_MAP_ID`** → `DEMO_MAP_ID` fallback (light map; advanced markers still function).
- **Geocoding failure** (existing `GeocodingService`) → the stop stays coord-less and is already filtered from `stopsWithCoords()`, so markers + bounds skip it gracefully (no change needed).

## Out of scope

- Grey-map "fix" (environmental, not code).
- Dark-style array fine-tuning (the array is deleted; styling moves to cloud).
- Mobile/a11y polish and `styles.css` token cleanup (homed in the Phase-2 acceptance-followup doc).
- Any change to the chat library or other examples.
