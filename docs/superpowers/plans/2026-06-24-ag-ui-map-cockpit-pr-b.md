# AG-UI Map Cockpit Polish (PR-B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Frame the App-mode map to the actual itinerary stops (fit-to-bounds) and migrate off the deprecated `google.maps.Marker` to `AdvancedMarkerElement` with a cloud-based dark map style, in `examples/ag-ui/angular`.

**Architecture:** Layers on top of the already-open crash-fix PR #736 (loader-gated `<google-map>`). A pure `computeBounds` helper (unit-tested) feeds a fit-to-bounds effect in `MapCanvasComponent`. Advanced markers require a map `mapId`, which disables inline JSON styles — so the dark theme moves to a Google Cloud map style wired through the existing `inject-env.mjs` + `generated-keys` env mechanism, with a `DEMO_MAP_ID` fallback so a fresh clone still runs (light map).

**Tech Stack:** Angular 21 (signals, `effect`, `computed`, `viewChild`/`viewChildren`, OnPush), `@angular/google-maps` (`GoogleMap`, `MapAdvancedMarker`, `MapInfoWindow`, `MapPolyline`), vitest, live Chrome-MCP smoke.

---

## Prerequisite

**PR #736 must be merged (or this work branched off `origin/worktree-ag-ui-app-mode-mapfix`).** `main` lacks the `GoogleMapsLoader` + `@if (loader.loaded())` gate this plan assumes. Verify before Task 1:

```bash
git grep -l "GoogleMapsLoader" examples/ag-ui/angular/src/app/map-canvas.component.ts
# Expect: a match. If none, rebase this branch onto #736's head first.
```

## File Structure

- **Create** `examples/ag-ui/angular/src/app/map-bounds.ts` — pure `computeBounds(stops) → Bounds | null`. One job: bounds geometry. No Angular, no `google.maps`.
- **Create** `examples/ag-ui/angular/src/app/map-bounds.spec.ts` — vitest for the helper.
- **Modify** `examples/ag-ui/angular/src/app/map-canvas.component.ts` — fit-to-bounds effect; `MapMarker` → `MapAdvancedMarker`; `mapId`; `markerViews` computed (day-colored `<div>` pins); delete `DARK_STYLE`/`markerOptions`.
- **Modify** `examples/ag-ui/angular/src/app/google-maps-loader.ts` — add `marker` to the Maps `libraries` param.
- **Modify** `examples/ag-ui/angular/src/environments/generated-keys.ts` — add `googleMapsMapId: ''` to the committed stub.
- **Modify** `examples/ag-ui/angular/scripts/inject-env.mjs` — emit `googleMapsMapId` from `GOOGLE_MAPS_MAP_ID`.
- **Modify** `examples/ag-ui/angular/src/environments/environment.ts` and `environment.development.ts` — expose `googleMapsMapId`.
- **Modify** `examples/ag-ui/angular/README.md` — document `GOOGLE_MAPS_MAP_ID` + `DEMO_MAP_ID` fallback.

---

### Task 1: Pure `computeBounds` helper (TDD)

**Files:**
- Create: `examples/ag-ui/angular/src/app/map-bounds.ts`
- Test: `examples/ag-ui/angular/src/app/map-bounds.spec.ts`

- [ ] **Step 1: Write the failing test**

```ts
// examples/ag-ui/angular/src/app/map-bounds.spec.ts
// SPDX-License-Identifier: MIT
import { describe, it, expect } from 'vitest';
import { computeBounds } from './map-bounds';

describe('computeBounds', () => {
  it('returns null for an empty list', () => {
    expect(computeBounds([])).toBeNull();
  });

  it('returns null when no stop has coordinates', () => {
    expect(computeBounds([{ lat: null, lng: null }, { lat: undefined, lng: undefined }])).toBeNull();
  });

  it('returns a degenerate box for a single stop', () => {
    expect(computeBounds([{ lat: 48.86, lng: 2.35 }])).toEqual({
      north: 48.86, south: 48.86, east: 2.35, west: 2.35,
    });
  });

  it('returns min/max extents for multiple stops', () => {
    const b = computeBounds([
      { lat: 48.86, lng: 2.35 },
      { lat: 48.80, lng: 2.40 },
      { lat: 48.90, lng: 2.30 },
    ]);
    expect(b).toEqual({ north: 48.90, south: 48.80, east: 2.40, west: 2.30 });
  });

  it('ignores stops missing coordinates', () => {
    const b = computeBounds([
      { lat: 48.86, lng: 2.35 },
      { lat: null, lng: null },
      { lat: 48.90, lng: 2.40 },
    ]);
    expect(b).toEqual({ north: 48.90, south: 48.86, east: 2.40, west: 2.35 });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx nx test examples-ag-ui-angular --skip-nx-cache -- -t computeBounds`
Expected: FAIL — `Cannot find module './map-bounds'`.

- [ ] **Step 3: Write minimal implementation**

```ts
// examples/ag-ui/angular/src/app/map-bounds.ts
// SPDX-License-Identifier: MIT

/** A geographic bounding box (LatLngBoundsLiteral-compatible). */
export interface Bounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

/** Smallest box containing every stop that has coordinates, or null if none do. */
export function computeBounds(
  stops: ReadonlyArray<{ lat?: number | null; lng?: number | null }>,
): Bounds | null {
  let north = -Infinity, south = Infinity, east = -Infinity, west = Infinity;
  let found = false;
  for (const s of stops) {
    if (s.lat == null || s.lng == null) continue;
    found = true;
    north = Math.max(north, s.lat);
    south = Math.min(south, s.lat);
    east = Math.max(east, s.lng);
    west = Math.min(west, s.lng);
  }
  return found ? { north, south, east, west } : null;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx nx test examples-ag-ui-angular --skip-nx-cache -- -t computeBounds`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/angular/src/app/map-bounds.ts examples/ag-ui/angular/src/app/map-bounds.spec.ts
git commit -m "feat(ag-ui): pure computeBounds helper for map fit-to-bounds"
```

---

### Task 2: Fit-to-bounds effect in `MapCanvasComponent`

**Files:**
- Modify: `examples/ag-ui/angular/src/app/map-canvas.component.ts`

This adds a `viewChild(GoogleMap)` and an effect that frames the map. It does NOT yet touch markers (Task 5).

- [ ] **Step 1: Import `GoogleMap`, `computeBounds`, and add the viewChild**

In the existing `@angular/google-maps` import, ensure `GoogleMap` is imported (it already is). Add at the top of the class body, near the other `viewChild`/`viewChildren` declarations:

```ts
import { computeBounds } from './map-bounds';
```

```ts
  private readonly googleMap = viewChild(GoogleMap);
```

- [ ] **Step 2: Add the fit-to-bounds effect in the constructor**

Append inside the existing `constructor()` (after the focus effect):

```ts
    // Frame the map to all stops on structural change (add/remove/geocode).
    // Reads googleMap() so it re-runs once the map mounts behind the loader gate.
    // Keyed on stopsWithCoords() only — NOT focus — so panning to a focused stop
    // and reframing to all stops never fight (they fire on different signals).
    effect(() => {
      const map = this.googleMap();
      const stops = this.stopsWithCoords();
      if (!map) return; // <google-map> is behind @if (loader.loaded()) — not mounted yet
      if (stops.length === 0) {
        this.center.set(PARIS_CENTER);
        this.zoom.set(12);
        return;
      }
      if (stops.length === 1) {
        this.center.set({ lat: stops[0].lat!, lng: stops[0].lng! });
        this.zoom.set(13);
        return;
      }
      const b = computeBounds(stops);
      if (b) map.fitBounds(b, 48); // ≥2 stops: fitBounds overrides center/zoom imperatively
    });
```

Note: the `≥2` path calls `fitBounds` imperatively and does NOT write `center`/`zoom`, so the bound `[center]`/`[zoom]` inputs don't re-push and override it. The `0`/`1` paths use the signals (which the template binds), so the map follows them.

- [ ] **Step 3: Build the example to verify it compiles**

Run: `node examples/ag-ui/angular/scripts/inject-env.mjs && npx nx build examples-ag-ui-angular --skip-nx-cache`
Expected: build succeeds. (If the build wrote an empty key, re-run `inject-env.mjs` with `GOOGLE_MAPS_API_KEY` exported — see Verification notes.)

- [ ] **Step 4: Run the example unit tests**

Run: `npx nx test examples-ag-ui-angular --skip-nx-cache`
Expected: PASS (existing tests + Task 1's still green; no map rendering under jsdom).

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/angular/src/app/map-canvas.component.ts
git commit -m "feat(ag-ui): fit map to stops on structural change (fit-to-bounds)"
```

---

### Task 3: Plumb `GOOGLE_MAPS_MAP_ID` through the env mechanism

**Files:**
- Modify: `examples/ag-ui/angular/src/environments/generated-keys.ts`
- Modify: `examples/ag-ui/angular/scripts/inject-env.mjs`
- Modify: `examples/ag-ui/angular/src/environments/environment.ts`
- Modify: `examples/ag-ui/angular/src/environments/environment.development.ts`

- [ ] **Step 1: Add `googleMapsMapId` to the committed stub**

Replace the `GENERATED_KEYS` object in `examples/ag-ui/angular/src/environments/generated-keys.ts`:

```ts
export const GENERATED_KEYS = {
  googleMaps: '',
  googleMapsMapId: '',
} as const;
```

- [ ] **Step 2: Emit `googleMapsMapId` from `inject-env.mjs`**

In `examples/ag-ui/angular/scripts/inject-env.mjs`, after the existing `const key = ...` line add:

```js
const mapId = env.GOOGLE_MAPS_MAP_ID ?? '';
```

Replace the `contents` template literal's body with:

```js
const contents = `// SPDX-License-Identifier: MIT
// AUTO-GENERATED by scripts/inject-env.mjs. Do not edit by hand.
export const GENERATED_KEYS = {
  googleMaps: ${JSON.stringify(key)},
  googleMapsMapId: ${JSON.stringify(mapId)},
} as const;
`;
```

And update the final log line:

```js
console.log(`[inject-env] wrote generated-keys.local.ts (key length: ${key.length}, mapId: ${mapId ? 'set' : 'unset'})`);
```

- [ ] **Step 3: Expose `googleMapsMapId` on both environments**

In BOTH `examples/ag-ui/angular/src/environments/environment.ts` and `environment.development.ts`, add a `googleMapsMapId` field alongside `googleMapsApiKey`. For example, environment.ts becomes:

```ts
import { GENERATED_KEYS } from './generated-keys';

export const environment = {
  production: true,
  googleMapsApiKey: GENERATED_KEYS.googleMaps,
  googleMapsMapId: GENERATED_KEYS.googleMapsMapId,
};
```

Apply the identical `googleMapsMapId` line to `environment.development.ts` (keep its existing `production` value).

- [ ] **Step 4: Regenerate + typecheck**

Run: `node examples/ag-ui/angular/scripts/inject-env.mjs && npx nx build examples-ag-ui-angular --skip-nx-cache`
Expected: build succeeds; `generated-keys.local.ts` now contains `googleMapsMapId`.

- [ ] **Step 5: Commit**

```bash
git add examples/ag-ui/angular/src/environments/generated-keys.ts examples/ag-ui/angular/scripts/inject-env.mjs examples/ag-ui/angular/src/environments/environment.ts examples/ag-ui/angular/src/environments/environment.development.ts
git commit -m "feat(ag-ui): plumb GOOGLE_MAPS_MAP_ID through the env mechanism"
```

---

### Task 4: Load the Maps `marker` library

**Files:**
- Modify: `examples/ag-ui/angular/src/app/google-maps-loader.ts`

`AdvancedMarkerElement` lives in the `marker` library; the loader currently requests only `geocoding`.

- [ ] **Step 1: Add `marker` to the libraries param**

In `examples/ag-ui/angular/src/app/google-maps-loader.ts`, change the script `src` line:

```ts
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=geocoding,marker`;
```

- [ ] **Step 2: Build to verify it compiles**

Run: `npx nx build examples-ag-ui-angular --skip-nx-cache`
Expected: build succeeds (string-only change).

- [ ] **Step 3: Commit**

```bash
git add examples/ag-ui/angular/src/app/google-maps-loader.ts
git commit -m "feat(ag-ui): load Maps marker library for advanced markers"
```

---

### Task 5: Migrate `MapMarker` → `MapAdvancedMarker` + cloud dark style

**Files:**
- Modify: `examples/ag-ui/angular/src/app/map-canvas.component.ts`

- [ ] **Step 1: Swap the import and component `imports`**

Change the `@angular/google-maps` import to use `MapAdvancedMarker` instead of `MapMarker`:

```ts
import { GoogleMap, MapInfoWindow, MapAdvancedMarker, MapPolyline } from '@angular/google-maps';
```

And in the `@Component({ imports: [...] })` array, replace `MapMarker` with `MapAdvancedMarker`.

Add the `environment` import if not present:

```ts
import { environment } from '../environments/environment';
```

- [ ] **Step 2: Replace `mapOptions` (delete `DARK_STYLE`, add `mapId`) and delete the `DARK_STYLE` constant**

Delete the entire `const DARK_STYLE: google.maps.MapTypeStyle[] = [ ... ];` block at the top of the file.

Replace the `mapOptions` field:

```ts
  // A mapId is REQUIRED for advanced markers; a mapId map ignores inline JSON
  // `styles`, so the dark theme is a cloud-based map style tied to this id.
  // DEMO_MAP_ID lets a fresh clone run (light map) with no Console setup.
  protected readonly mapId = environment.googleMapsMapId || 'DEMO_MAP_ID';
  protected readonly mapOptions: google.maps.MapOptions = {
    mapId: this.mapId,
    disableDefaultUI: true,
    zoomControl: true,
    clickableIcons: false,
  };
```

- [ ] **Step 3: Add a `markerViews` computed that builds day-colored pin elements once per structural change**

Add near `stopsWithCoords`:

```ts
  /** One marker view per coord'd stop. The pin `<div>` is built here (not in a
   *  template method) so it is recreated only when stops change — not on every
   *  change-detection pass (e.g. focus pans), which would cause flicker. */
  protected readonly markerViews = computed(() =>
    this.stopsWithCoords().map((s) => ({
      id: s.id,
      stop: s,
      position: { lat: s.lat!, lng: s.lng! },
      content: this.makePin(s.day),
    })),
  );

  private makePin(day: number): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText =
      'width:16px;height:16px;border-radius:50%;border:2px solid #fff;' +
      `box-shadow:0 1px 3px rgba(0,0,0,.4);background:${DAY_COLORS[(day - 1) % DAY_COLORS.length]};`;
    return el;
  }
```

- [ ] **Step 4: Update the template markers + delete `markerOptions`**

Replace the marker `@for` block in the template:

```html
      @for (m of markerViews(); track m.id) {
        <map-advanced-marker
          #marker
          [position]="m.position"
          [content]="m.content"
          [title]="m.stop.place"
          (mapClick)="onMarkerClick(m.stop)"
        />
      }
```

Delete the `markerOptions(s)` method entirely (advanced markers use `content`, not `MarkerOptions`).

- [ ] **Step 5: Point the focus effect's marker lookup at `MapAdvancedMarker`**

Change the `viewChildren` declaration:

```ts
  private readonly markers = viewChildren(MapAdvancedMarker);
```

The existing focus effect's `const marker = this.markers()[idx];` and `win.open(marker)` are unchanged — `MapInfoWindow.open` accepts a `MapAdvancedMarker` anchor. Note the focus effect indexes by `stopsWithCoords()` position, which matches `markerViews()` order (both derive from `stopsWithCoords()`), so the index stays correct.

- [ ] **Step 6: Build to verify it compiles**

Run: `node examples/ag-ui/angular/scripts/inject-env.mjs && npx nx build examples-ag-ui-angular --skip-nx-cache`
Expected: build succeeds. No reference to `DARK_STYLE`, `markerOptions`, or `MapMarker` remains:

```bash
git grep -nE "DARK_STYLE|markerOptions|MapMarker\b" examples/ag-ui/angular/src/app/map-canvas.component.ts
# Expect: no output.
```

- [ ] **Step 7: Lint + unit tests**

Run: `npx nx run-many -t lint test -p examples-ag-ui-angular --skip-nx-cache`
Expected: both PASS.

- [ ] **Step 8: Commit**

```bash
git add examples/ag-ui/angular/src/app/map-canvas.component.ts
git commit -m "feat(ag-ui): migrate to AdvancedMarkerElement + cloud dark map style"
```

---

### Task 6: Document the Map ID env var

**Files:**
- Modify: `examples/ag-ui/angular/README.md`

- [ ] **Step 1: Add a Map ID subsection**

Find the section documenting `GOOGLE_MAPS_API_KEY` in `examples/ag-ui/angular/README.md` and add directly after it:

```markdown
### Dark map theme (optional)

App mode renders a Google Map. Advanced markers require a **Map ID**, and a
map with a Map ID takes its styling from a **cloud-based map style** (the inline
JSON dark theme no longer applies). To get the dark theme:

1. In the [Google Cloud Console](https://console.cloud.google.com/google/maps-apis/studio/maps), create a **vector Map ID** and a **dark map style**, and associate them.
2. Add the id to your root `.env`:

   ```
   GOOGLE_MAPS_MAP_ID=your_map_id_here
   ```

Without `GOOGLE_MAPS_MAP_ID`, the demo falls back to Google's `DEMO_MAP_ID` and
renders a **light** map (markers and routes still work).
```

- [ ] **Step 2: Commit**

```bash
git add examples/ag-ui/angular/README.md
git commit -m "docs(ag-ui): document GOOGLE_MAPS_MAP_ID + DEMO_MAP_ID fallback"
```

---

### Task 7: Full verification + live map smoke

**Files:** none (verification only)

- [ ] **Step 1: Static gates**

Run: `npx nx run-many -t lint test build -p examples-ag-ui-angular --skip-nx-cache`
Expected: all green. If the build wrote an empty key (Nx caches `inject-env`), re-run:
`GOOGLE_MAPS_API_KEY="$(grep '^GOOGLE_MAPS_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2- | tr -d '"')" node examples/ag-ui/angular/scripts/inject-env.mjs`

- [ ] **Step 2: Serve with the real key (controller-run, not in this worktree's empty .env)**

The real `.env` is at the MAIN checkout, not this worktree. Export the key, regenerate, then serve:

```bash
export GOOGLE_MAPS_API_KEY="$(grep '^GOOGLE_MAPS_API_KEY=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2- | tr -d '"')"
export GOOGLE_MAPS_MAP_ID="$(grep '^GOOGLE_MAPS_MAP_ID=' /Users/blove/repos/angular-agent-framework/.env | cut -d= -f2- | tr -d '"')"
node examples/ag-ui/angular/scripts/inject-env.mjs
# then serve the example (see the example's serve target / runbook)
```

- [ ] **Step 3: Live Chrome-MCP smoke checklist** (probe DOM via `javascript_tool`, NOT screenshots — the WebGL canvas times out; wait for HMR idle):
  - Toggle App mode → map renders, **day-colored dot markers** present (one per coord'd stop).
  - **Fit-to-bounds:** on load the viewport frames all stops (not hardcoded Paris). Add a stop via chat/composer → map reframes to include it. Remove all but one → centers on the single stop. Remove all → falls back to Paris.
  - Click a marker → info window opens with place + Remove.
  - Click a sidebar row → map pans to that stop (focus still works).
  - **Dark theme:** appears only if `GOOGLE_MAPS_MAP_ID` is set to a real cloud-styled Map ID; with `DEMO_MAP_ID` the map is light (expected). Console is clean (no "Namespace google not found", no marker-library errors).

- [ ] **Step 4: Record the smoke result**

Write a short pass/fail record to `docs/superpowers/specs/2026-06-24-ag-ui-map-cockpit-pr-b-live-smoke.md` (scenarios + outcomes), mirroring the Phase-1/Phase-2 smoke records.

- [ ] **Step 5: Open the PR**

```bash
git push -u origin <pr-b-branch>
gh pr create --base main --title "feat(ag-ui): fit-to-bounds + AdvancedMarker migration (map cockpit polish)" --body "<summary + smoke results + note: dark theme requires a configured GOOGLE_MAPS_MAP_ID>"
```

---

## Self-Review

**Spec coverage:**
- Fit-to-bounds (0/1/≥2 fallbacks, no-op-while-gated, pan-on-focus preserved) → Tasks 1–2. ✓
- `computeBounds` pure helper + unit test → Task 1. ✓
- AdvancedMarker migration, `mapId`, flat day-colored dot pins, delete `DARK_STYLE` → Task 5. ✓
- `marker` library load → Task 4. ✓
- `GOOGLE_MAPS_MAP_ID` env via `inject-env.mjs` + generated-keys, `DEMO_MAP_ID` fallback → Task 3 + Task 5 Step 2. ✓
- README note → Task 6. ✓
- Unit (helper) + live smoke, dark theme gated on Console setup → Task 7. ✓
- Grey-map = environmental, out of scope → not a task (correct). ✓

**Placeholder scan:** none — every code step has concrete code; the only `<...>` placeholders are the PR branch name and PR body in Task 7 Step 5 (intentional, controller-supplied at open time).

**Type consistency:** `Bounds {north,south,east,west}` (Task 1) is consumed by `map.fitBounds(b, 48)` (Task 2) as a `LatLngBoundsLiteral` — field names match. `markerViews` items `{id, stop, position, content}` (Task 5 Step 3) match the template bindings (Task 5 Step 4). `googleMapsMapId` is spelled identically in generated-keys, inject-env output, both environments, and `environment.googleMapsMapId` reads. `makePin(day)`/`DAY_COLORS` indexing matches the existing `polylineOptions` convention.
