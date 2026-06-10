# Homepage Demo — Expand-to-Modal on Launch

**Date:** 2026-06-07
**Status:** Design / spec
**Scope:** `apps/website` homepage `DemoShowcase`. No library/backend changes.

---

## Goal

When a visitor clicks **"Launch live demo"** on the homepage demo section, open the live interactive demo in a **large modal/lightbox** instead of swapping a small inline iframe. This gives a genuinely usable chat surface (near-viewport size, perfect 16:10) without reflowing the page.

## Problem

`DemoShowcase` today is video-first: an inline `BrowserFrame` (~720px wide, capped by the section's `maxWidth: 760`) plays a looping clip with a "Launch live demo ▶" overlay. Clicking it swaps the video for a live `<iframe>` **at that same cramped ~720px frame** — too small to actually chat in.

## Approved decisions (from brainstorming)

- **Modal/lightbox** (not inline grow, not OS fullscreen).
- **Open animation:** fade backdrop + scale-in (0.96→1); respect `prefers-reduced-motion`.
- **Footer "Open the full demo ↗"** link: **keep it** (links to the active runtime's standalone site).
- Tabs (LangGraph | AG-UI) live **inside** the modal so the runtime can be switched while open.
- Mobile (<640px): the modal becomes a full-screen sheet (ratio relaxed).

---

## Architecture

Split the modal into its own focused, testable component; `DemoShowcase` keeps owning the section + which tab is active and just toggles modal open state.

### Files
- **New:** `apps/website/src/components/landing/DemoModal.tsx` — the overlay (`'use client'`).
- **Modify:** `apps/website/src/components/landing/DemoShowcase.tsx` — the inline frame stays *always* the looping video; the launch overlay opens the modal; render `<DemoModal>` when open.

### State
`DemoShowcase` already has `active: TabKey`. Replace the `launched: Set<TabKey>` (inline-swap) state with `modalOpen: boolean`.
- `launch()` → `setModalOpen(true)` (records analytics).
- The modal reads the **same** `active` tab and `setActive` — switching tabs in the modal switches the runtime in place (and the inline section's tab, kept in sync). Each tab's `<iframe src>` is the live demo `href` (`media.href`).
- Closing sets `modalOpen=false`. The inline frame remains the looping video, so the section still looks alive afterward.

### `DemoModal` interface

```ts
interface DemoModalProps {
  open: boolean;
  onClose: () => void;
  tabs: { key: TabKey; tabLabel: string; url: string; href: string }[];
  active: TabKey;
  onActive: (key: TabKey) => void;
}
```

Renders nothing when `!open`. When open:
- A fixed full-viewport **backdrop** (`rgba(16,18,32,.55)`), `z-index` above the navbar.
- A centered **frame** reusing the `BrowserFrame` look: header row (window dots · tabs · faux URL = active `url` · `×`), an `<iframe src={activeHref}>` body at **16:10**, and a footer (`Esc or click outside to close · MIT · no signup` left; `Open the full demo ↗` right → active `href`, `target=_blank`).
- `role="dialog"`, `aria-modal="true"`, `aria-label="Live demo"`.

### Sizing (the "full width, keep ratio" requirement)

Frame width = `min(96vw, calc(90vh * 16 / 10))`; height = `width * 10 / 16`. So it fills whichever axis is tighter while holding a perfect 16:10; the backdrop absorbs the rest. No letterboxing inside the iframe.

**Mobile (`max-width: 640px`):** frame becomes `width: 100vw; height: 100dvh;` (full-screen sheet); the 16:10 constraint is dropped (`aspect-ratio` removed / overridden) because 16:10 at phone width is unusably short. Header + footer stay; the iframe fills the remaining height.

### Open/close behavior & a11y
- **Open animation:** backdrop opacity 0→1 and frame `transform: scale(.96)→scale(1)` over ~160ms ease-out. Under `prefers-reduced-motion: reduce`, skip the scale (instant or opacity-only).
- **Close triggers:** `×` button, `Escape` key, click on the backdrop (not the frame).
- **Focus:** on open, move focus into the modal (the `×` button); trap Tab within the modal; on close, return focus to the launch button. (A small local focus-trap; no new dependency.)
- **Scroll lock:** set `document.body.style.overflow = 'hidden'` while open; restore on close.
- **Lazy mount:** the `<iframe>` mounts only when `open` (no demo network/cost until launch).

### Analytics
- On launch: `trackCtaClick`/`trackExternalLinkClick`-style event, surface `home_demo`, `cta_id: home_demo_launch_${key}` (`langgraph`/`ag_ui`).
- On "Open the full demo ↗": `trackExternalLinkClick(href, { surface: 'home_demo', cta_id: 'home_demo_full_${key}', ... })`.
- (Reuse the `AnalyticsSurface`/`CtaId` types; `home_demo_${string}` is already an accepted `CtaId` pattern.)

## Error handling / edge cases
- iframe loads the demo's own origin (allowed by its proxy) — no special handling; the demo site owns its errors.
- Tab switch while open swaps `src` (re-loads the other runtime) — acceptable; a brief load is fine.
- Closing mid-conversation simply unmounts the iframe (no persistence expected for a marketing demo).
- Multiple rapid open/close: idempotent via the boolean; scroll-lock/focus cleanup in a single effect's teardown.

## Testing
Website is Next.js; gate locally on `nx lint website` (full build runs in CI). Add a Playwright spec (`apps/website/e2e/`) if the harness supports the homepage:
- Click "Launch live demo" → a `[role="dialog"]` appears.
- `Escape` closes it; focus returns to the launch button.
- Switching the in-modal tab updates the active runtime (assert the faux URL / iframe `src`).
- Backdrop click closes; frame click does not.

If the homepage isn't covered by the current e2e harness, rely on `nx lint` + `nx build` + manual verification, and note it.

## Non-Goals (YAGNI)
- No morph/shared-element transition (explicitly deferred).
- No deep-linking / URL state for the open modal.
- No OS Fullscreen API.
- No change to the paired demo CTA buttons below the section, the navbar dropdown, or the videos.

---

## Decomposition (for the plan)
1. `DemoModal` component (backdrop, frame, tabs, iframe, footer, sizing, a11y: focus-trap + Esc + scroll-lock + reduced-motion).
2. Wire into `DemoShowcase`: swap `launched` → `modalOpen`; overlay opens modal; keep inline frame as video; pass `active`/`setActive`; analytics.
3. Mobile full-screen-sheet styles.
4. (Optional) Playwright e2e for open/close/tab-switch/focus-return.
