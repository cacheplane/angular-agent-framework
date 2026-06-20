# a2ui Icon — render real Material Symbols (not the name as text) — Design

**Status:** Approved direction (2026-06-20, brainstormed).

## Problem
The a2ui catalog `Icon` component (`libs/chat/src/lib/a2ui/catalog/icon.component.ts`) renders the icon **name as literal text** — a spec with `Icon { name: "trending_up" }` shows the string "trending_up" instead of a glyph.

## Alignment
The canonical A2UI protocol/renderer uses **Material Symbols**: the Icon `name` is a Material Symbols identifier (`check`, `trending_up`, `star`, …), rendered via the Material Symbols font where the name is a *ligature*. Aligning the Angular renderer means doing the same — render the name through the Material Symbols Outlined font.

## Decisions (settled via brainstorm)
- **Render Material Symbols** (protocol-aligned) — the component outputs the name into a `material-symbols-outlined`-classed span so the font renders the glyph. `currentColor` (theme-aware, matches the repo's inline-SVG convention); size via `font-size`.
- **Demos load the font; document for consumers.** `@threadplane/chat` does **not** inject any CDN `<link>` at runtime. The a2ui demo apps load the Material Symbols Outlined stylesheet in their `index.html`; the lib README documents the requirement (standard for icon fonts).
- **No backend prompt change.** The LLM keeps emitting Material Symbols names. Valid names render; unknown / not-yet-loaded names fall back gracefully (browser default) — acceptable per the "keep open, rely on fallback" choice.

## Changes

### 1. `libs/chat/src/lib/a2ui/catalog/icon.component.ts`
- Add `material-symbols-outlined` to the span's class list (alongside `a2ui-icon`); keep rendering `{{ effectiveName() }}` (the ligature). The global Material Symbols stylesheet (loaded by the host) styles `.material-symbols-outlined`; the component's own `.a2ui-icon` style sets `color: currentColor`, line-height, and the `font-size` from `size()` (default 1.125rem). Render nothing when there is no name.
- Keep all existing inputs (`name`/`icon` alias, `size`, framework inputs) unchanged.

### 2. Demo apps — load the font
Add to the `<head>` of each a2ui demo's `index.html`:
```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200" />
```
Files: `examples/chat/angular/src/index.html`, `examples/ag-ui/angular/src/index.html`, `cockpit/chat/a2ui/angular/src/index.html`, `cockpit/ag-ui/a2ui/angular/src/index.html`.

### 3. Docs
- `libs/chat/README.md` (and/or the a2ui getting-started doc): a short "Icons" note — the a2ui `Icon` component renders Material Symbols; include the Material Symbols Outlined stylesheet in your app's `<head>` for glyphs to render; names are Material Symbols identifiers.

### 4. Tests
- `icon.component.spec.ts`: assert the rendered span carries the `material-symbols-outlined` class and the icon name as text content (the ligature), and applies `font-size` from `size`. (Glyph rendering itself needs the font + a browser; covered by the visual smoke.)

## Verification
- `nx run-many -t test lint build --projects=chat` — green.
- Build the 4 a2ui demo apps — green.
- **Visual smoke**: serve one a2ui demo (e.g. cockpit/ag-ui/a2ui or examples/chat a2ui mode) and confirm a spec with icons renders **glyphs** (not the raw names); screenshot. (Live LLM optional — a static spec/fixture with an `Icon` suffices.)
- PR + auto-merge + watcher.

## Risks
- **FOUC / fallback:** before the font loads, the ligature text shows briefly; for an unknown name the browser shows tofu/nothing. Acceptable per the agreed fallback behavior; the `a2ui-icon` style can `overflow:hidden`/fixed-box to limit layout shift.
- **No e2e text assertions on icon names** were found, so switching to glyphs won't break existing e2e.
- Library stays CDN-free; only demos add the font link.
