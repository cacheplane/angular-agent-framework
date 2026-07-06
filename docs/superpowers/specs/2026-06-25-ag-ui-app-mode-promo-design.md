# AG-UI App-mode promo hero — design

**Date:** 2026-06-25
**Status:** Approved (pending spec review)
**Branch:** `worktree-ag-ui-app-mode-mapfix` (PR #736 line of work)

## Context

The canonical AG-UI demo (`examples/ag-ui/angular`) has two layouts: plain
chat modes (embed/popup/sidebar) and an "App mode" map cockpit (full-bleed
Google Map + floating itinerary overlay + chat sidebar), toggled from the
toolbar. The itinerary panel is now App-mode-only (see PR #736 commit
`a8c2209d`).

When the user is in **sidebar mode with App mode off**, the area to the left
of the chat panel (`.sidebar-mode__background`, projected into
`<chat-sidebar>`'s default content slot) currently shows only a placeholder
line: "Use the launcher (right edge) to dismiss or re-open the chat panel."
That space is wasted. We want it to **market the App-mode cockpit and the
Threadplane primitives that power it**, with a primary CTA to turn App mode on.

## Goal

Replace the placeholder hint with a polished, preview-led marketing hero that:
1. Shows what App mode looks like (a real Paris map backdrop).
2. Credits the Threadplane framework capabilities the demo exercises.
3. Provides a single primary CTA that enables App mode and drops the user into
   the cockpit.

This is a demo-selling surface, not a travel feature — the pills advertise the
**framework**, not the trip app.

## Placement & component

- New standalone component `AppModePromoComponent`
  (`examples/ag-ui/angular/src/app/modes/app-mode-promo.component.ts`),
  `ChangeDetectionStrategy.OnPush`. Sits beside `sidebar-mode.component.ts` and
  `welcome-suggestions.ts`.
- **Isolated contract — no direct shell coupling:**
  - Input `hasMapsKey: boolean` — whether `GOOGLE_MAPS_API_KEY` is configured.
  - Output `enable: void` (EventEmitter) — emitted when the CTA is clicked.
- `SidebarMode` renders it in place of the `.sidebar-mode__hint` paragraph,
  under the **same gate** already present:

  ```html
  @if (shell.appMode() !== 'on') {
    <app-mode-promo
      [hasMapsKey]="shell.hasMapsKey"
      (enable)="shell.onAppModeChange('on')"
    />
  }
  ```

  `shell.hasMapsKey` and `shell.onAppModeChange` already exist on `AgUiShell`.

## Visual design

A centered, bounded "poster" card — not a full-bleed page fill — vertically
centered in the existing `place-items: center` background. Max-width ~780px,
aspect ratio ~16:10.

**Layers (back to front):**
1. **Map backdrop** — the committed static screenshot (light Google Maps of
   Paris) via an `<img>` with `object-fit: cover` so it fills the card at any
   size ("resize to fit"). The map is clean (no baked-in pins); the poster sells
   via the caption, not drawn overlays. (Optional future enhancement: layer a
   few stylized seed pins/route over the map — out of scope for v1.)
2. **Caption panel** — anchored to the bottom, full width of the card, **flat
   solid dark** fill (`rgba(8,15,28,0.96)`, no gradient — gradients flash during
   render) with a 0.5px top border. Sits over the light map for strong contrast.
   Contains, top to bottom:
   - Eyebrow chip: "Built with Threadplane" (map/stack icon), framing the pills
     as framework features.
   - Headline (~20px/500, light): "See your trip come alive on a live map".
   - Subcopy (one line, muted): "A map cockpit where the agent edits your
     itinerary in real time."
   - Feature pills (wrap): **Client tools**, **Generative UI**,
     **Human-in-the-loop**, **Shared state** — each a small pill with a Material
     Symbols icon. These name the actual `@threadplane/*` primitives the demo
     uses (`client-tools.ts`: `action`/`view`/`ask` client tools, A2UI catalog,
     confirm-to-resume, shared signals `ItineraryStore`).
   - Primary CTA button: "Enable app mode" (map icon + arrow).

**Theme:** the caption panel is intentionally always-dark and the map image
always-light, so the poster reads consistently in both light and dark demo
themes (like a photo with a dark caption bar); the surrounding background area
keeps its themed tokens. Hardcode the dark caption surface and its light text
since they overlay the fixed-light map image. The CTA accent should still map
to the demo's `--ngaf-chat-primary` / `--ngaf-chat-on-primary` tokens so the
primary action matches the rest of the UI.

## Static image asset

- **Path:** `examples/ag-ui/angular/public/app-mode-preview.webp` (the `public/`
  dir is served at root per `project.json` assets glob → referenced as
  `/app-mode-preview.webp`).
- **Source:** user-provided screenshot of a Paris Google Map (saved first as
  `public/app-mode-preview-raw.png`).
- **Processing:** resize/crop to the poster aspect and export an optimized
  `.webp` locally with `sips` (macOS, no external API). Target ~1600×1000 (2×),
  budget < 300 KB.
- **Placeholder:** until the real asset is processed, commit a lightweight
  stand-in at the same path so the build, unit tests, and e2e stay green.
- `<img alt>`: "Preview of the App-mode map cockpit".

## Behavior

- **CTA click** → emits `enable` → `shell.onAppModeChange('on')` → App mode on,
  routed to the cockpit. The reload-route fix (PR #736 commit `d165937f`)
  guarantees a reload restores the cockpit rather than bouncing to embed.
- **No-key fallback:** when `hasMapsKey` is false, the CTA is `disabled` with a
  small note "Set `GOOGLE_MAPS_API_KEY` to enable" (mirrors the toolbar toggle's
  disabled+title behavior). The hero still renders so the capability is still
  marketed.
- **Responsive:** the caption row uses `flex-wrap`; when the chat panel pushes
  the area narrow, the CTA drops below the copy. The poster `max-width` prevents
  over-stretching on very wide viewports.

## Accessibility & motion

- CTA is a real `<button>`; disabled state uses `disabled` + `title`.
- `<img>` has descriptive `alt`.
- Subtle mount fade/rise animation, gated behind
  `@media (prefers-reduced-motion: reduce)` (no motion when reduced).
- Caption text meets contrast over the dark panel (light text on
  `rgba(8,15,28,0.96)`).

## Testing

- **Unit (`app-mode-promo.component.spec.ts`):**
  - Renders the headline, four pills, and the CTA.
  - Clicking the CTA emits `enable`.
  - When `hasMapsKey` is false, the CTA is disabled and the key note shows.
- **e2e:** in plain sidebar mode the promo is visible with an enabled CTA;
  clicking it enters App mode (map + itinerary overlay present). The
  `itinerary-client-tools` spec already runs with `?appmode=on`, so it is
  unaffected. Check the `examples/chat` twin and any toolbar/initial-render spec
  for a stale assertion on the old `.sidebar-mode__hint` copy and update it.

## Out of scope (v1)

- Drawn pin/route overlays on the map image (future enhancement).
- Animated/looping cockpit preview (rejected — static image chosen).
- Marketing copy A/B variants.
- Changing the plain embed/popup layouts (only the sidebar-mode background).
