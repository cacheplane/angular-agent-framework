# AG-UI Itinerary — Broader Acceptance Run — Follow-up Skeleton

> **Status: NOT YET ACTIONABLE.** This is a skeleton capturing the broader acceptance surface for the itinerary redesign so deferred items aren't lost. It is NOT a runnable checklist. When this work is scheduled, run `superpowers:writing-plans` against this skeleton to expand each section into bite-sized, executable steps.

**Why this doc exists:** The tight pre-merge smoke (`2026-06-22-ag-ui-itinerary-phase-1-live-smoke.md`) deliberately covers only the streaming-shape regressions aimock can't catch. The Phase 1 code reviews surfaced several deferred polish items and broader concerns that have no other home. This is that home.

**Relationship to other docs:**
- Spec: `../specs/2026-06-22-ag-ui-itinerary-redesign-design.md`
- Phase 1 plan: `2026-06-22-ag-ui-itinerary-phase-1-productize.md`
- Phase 1 smoke: `2026-06-22-ag-ui-itinerary-phase-1-live-smoke.md`
- Phase 2 plan: `2026-06-22-ag-ui-itinerary-phase-2-app-mode-map.md` (App mode + map — much of this skeleton should be re-run after Phase 2 lands)

---

## 1. Theme matrix

**Intent:** Drive all 4 theme options (default-dark, default-light, material-dark, material-light) × the light/dark scheme toggle; assert the panel's `--ngaf-chat-*` tokens resolve to legible values in each. Catches a missing token fallback that only shows in one theme (e.g. an unset `--ngaf-chat-surface-alt` rendering transparent on material-light).

**Status:** not yet actionable.

---

## 2. Persistence across reload

**Intent:** Add and reorder several stops, hard-reload the page, assert localStorage rehydrates the exact stop order. The `reorder` ordering is array-slot-based with no explicit `order` field, so the round-trip through `JSON.stringify`/`parse` must preserve sequence. Also verify the `ag-ui-demo:itinerary` storage key survives a reload in both App-mode-off and (post-Phase-2) App-mode-on.

**Status:** not yet actionable.

---

## 3. Overflow menu + outside-click

**Intent:** The P1.4 code review flagged that the overflow menu has no outside-click-to-close handler and no Esc/arrow-key navigation. Acceptance run documents the current behavior and decides whether it warrants a fix (likely a small `@HostListener('document:click')` or a CDK overlay migration).

**Origin:** P1.4 code-quality review.
**Status:** not yet actionable.

---

## 4. Mobile viewport

**Intent:** `resize_window` to ~390px width; assert the `@media (max-width: 900px)` path stacks the panel above the chat (full-width, capped height, border-bottom instead of border-right). Verify drag-to-reorder still works with touch-style pointer events at mobile width. Post-Phase-2: verify the App-mode floating overlay degrades sensibly on a phone (it may need to become a bottom sheet).

**Status:** not yet actionable.

---

## 5. Empty-state accessibility

**Intent:** The P1.8 review flagged that `role="status"` on the whole empty-state container produces a verbose SR announcement ("Your trip is empty Ask the agent… Plan a Paris weekend Add a Day 1 stop"). Acceptance run captures the screen-reader experience and decides scope — likely scope `role="status"` to the title alone, or swap to `aria-label` on the container and drop live-region semantics (the empty state on mount isn't really a status *change*).

**Origin:** P1.8 code-quality review.
**Status:** not yet actionable.

---

## 6. Reduced-motion

**Intent:** Emulate `prefers-reduced-motion: reduce`; assert the agent-edit pulse animation is suppressed (the guard landed in P1.7). Verify no other decorative motion (CDK drag transitions are functional feedback and may stay).

**Origin:** P1.7 code-quality review (guard added; this verifies it).
**Status:** not yet actionable.

---

## 7. Interrupt panel path (clear_day ask tool)

**Intent:** Drive the `clear_day` ask tool to the interrupt/approval panel; verify Confirm clears the day and Cancel leaves state completely untouched (no partial mutation). Verify the four-action interrupt vocabulary (accept/edit/respond/ignore) behaves on this tool. This overlaps with smoke Scenario 6 but goes deeper on the cancel-leaves-state-untouched invariant.

**Status:** not yet actionable.

---

## Deferred engineering items (not acceptance scenarios, but homed here)

These came out of Phase 1 reviews / verification and aren't user-facing acceptance checks — they're code-health follow-ups. Listed so they aren't lost:

- **`styles.css` token cleanup** — `examples/ag-ui/angular/src/styles.css` still references `--a2ui-primary*` (×7) and `--tp-border` (×1) on `.ag-ui-demo__header`, outside Phase 1's panel/shell scope. A 2-line follow-up could finish the token migration. (Origin: P1.10 verification.)
- **`tsconfig.app.json` setup errors** — pre-existing `declarationMap`-without-`composite` and missing project-ref `composite: true` warnings surface on `tsc --noEmit`. Orthogonal to the itinerary work; worth a separate cleanup PR. (Origin: P1.10 verification.)
- **Bundle budget** — the example's initial bundle (~1.35 MB) sits well above the 500 KB warning budget (under the 1.5 MB error budget). Pre-existing; if a future phase wants headroom, lazy-load the A2UI / markdown chunks. (Origin: P1.10 verification.)
- **Composer autofocus on re-mount** — the per-day add composer's native `autofocus` won't re-fire when the `@if` re-mounts the input (second+ open). A focus directive would fix it. (Origin: P1.4 code-quality review.)
- **`.itin__remove` keyboard reveal** — the remove button is `opacity:0` until row hover; a keyboard user tabbing onto it sees nothing. Add `.itin__stop:focus-within .itin__remove { opacity: .7 }`. (Origin: P1.4 / P1.6 reviews; the drag handle got its `:focus-visible` reveal in P1.7 but the remove button did not.)
