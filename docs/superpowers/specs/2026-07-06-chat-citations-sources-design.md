# Chat Citations & Sources — Visual & Interaction Design

**Date:** 2026-07-06
**Library:** `@threadplane/chat` (`libs/chat`)
**Status:** Design approved, ready for implementation plan

## Problem

The citation/sources infrastructure in `@threadplane/chat` is fully built structurally
but has **zero visual treatment**. Inline citation markers render as raw
`<sup>[1]</sup>` (browser-default), and the Sources panel is an unstyled `<ul>` of
unstyled cards. This is not prod-ready: markers don't read as affordances, there is no
provenance-inspection interaction, and nothing is cohesive or extensible.

This design treats citations as an **end-to-end provenance/trust/navigation system**
(per the ChatGPT reference model), scoped to what our data model supports today plus
clean extension points — not a decorative link list.

## Goals

- Inline markers that read as **distinct-but-quiet** affordances, focusable and grouped.
- A **lightweight-by-default, deep-on-demand** interaction: hover/tap reveals a
  provenance **preview card**.
- A redesigned, **collapsible Sources panel** that scales from 2 to 20+ sources and
  shares one visual language with the preview card.
- Everything driven by new `--tplane-chat-citation-*` **design tokens** (light/dark for
  free), browser-safe, no third-party network calls.
- Full **accessibility** (keyboard, screen reader, contrast, reduced-motion) and
  **mobile parity** (tap replaces hover).

## Non-Goals (YAGNI)

- **No "cited vs. other relevant links" split** — every entry in `citations[]` is cited.
- **No hardcoded source-type taxonomy** — source type is an optional, extensible slot.
- **No auto-fetched favicons** — privacy/CSP hazard (see Decision 1).
- **No click-to-scroll marker↔panel sync** — the panel-entry anchor exists as an
  extension point but scroll-sync is deferred.

## Approved Visual Decisions

Validated interactively via mockups (see `.superpowers/brainstorm/`):

| Piece | Decision |
| --- | --- |
| Inline marker | **Numbered pill** — small rounded chip on the baseline (`1`), accent tint + border on hover. Groups as adjacent pills (`1` `2`). |
| Preview card | **Explicit-action + freshness** layout — favicon/monogram + domain + source-type header, title, snippet, footer with **"Open source"** action and a date/freshness slot. |
| Sources panel | **Detail cards** under a collapsible **"Sources · N"** header (stacked-favicon preview + chevron). Each card: index, favicon/monogram, domain, source-type, title, one-line snippet. |

## Key Decisions (non-visual)

### Decision 1 — Favicons: never auto-fetch
Rendering a favicon by hitting a third-party service (e.g. `google.com/s2/favicons`)
leaks citation URLs to that service and commonly violates enterprise **CSP**. Instead:

1. If the provider supplies an icon (`Citation.iconUrl`, may be a `data:` URI), render it.
2. Otherwise render a **monogram** — the domain's first letter on a deterministic
   color derived from the domain string (stable per-source, no network).

Consumers who want real favicons can pass `iconUrl` from their own resolver. This keeps
the library browser-safe (consistent with the "no leaking metadata / browser-safe"
constraints already in place).

### Decision 2 — Domain & source-type are derived, not required
- **Domain/publisher**: `new URL(url).hostname` with a leading `www.` stripped. Purely
  local. When there is no URL, the domain line is omitted.
- **Source type**: defaults to inferring `'web'` from an `http(s)` URL. A badge/glyph
  renders from an optional `Citation.sourceType` string (open string, not an enum — so
  `'file'`, `'app'`, `'memory'`, or custom slot in without a code change).

### Decision 3 — Interaction adapts to pointer type
Branch on `matchMedia('(hover: hover) and (pointer: fine)')`:

- **Desktop (hover/fine):** hover **or keyboard focus** → preview card appears anchored
  to the marker. **Click navigates** to the source directly (new tab). The card also
  carries an explicit "Open source" control.
- **Touch (hover: none):** **tap → preview card** (never a surprise navigation). The
  card's "Open source" performs the navigation.

This matches the reference's "hover is desktop-first, tap-equivalent on touch" and its
"clear distinction between previewing and opening."

### Decision 4 — Panel default state: expanded
The Sources panel renders **expanded** by default (provenance stays visible) and is
collapsible via its header. State is component-local, not persisted.

### Decision 5 — Marker states (graceful degradation)
The existing three resolver states map to three visual states:

| State | Markup | Behavior |
| --- | --- | --- |
| **Resolved + URL** | `<a>` pill | hover/focus → preview; click opens source. |
| **Resolved, no URL** | `<button>` pill | hover/focus/tap → preview (title/snippet only, **no** "Open source" footer). |
| **Unresolved** | muted/dashed `<span>` pill, non-interactive | native `title="No source available"`; not focusable (nothing to do). |

## Data Model

`Citation` (`libs/chat/src/lib/agent/citation.ts`) gains **optional, backward-compatible**
typed fields (all optional → non-breaking; requires `npm run generate-api-docs`):

```ts
export interface Citation {
  id: string;
  index: number;          // 1-based display order (existing)
  title?: string;         // existing
  url?: string;           // existing
  snippet?: string;       // existing
  extra?: Record<string, unknown>;  // existing

  // NEW — all optional, all derivable-with-fallback:
  sourceType?: string;    // 'web' (default-inferred) | 'file' | 'app' | 'memory' | custom
  iconUrl?: string;       // provider-supplied favicon/logo (may be data: URI); no auto-fetch
  publishedAt?: string | number | Date;  // freshness slot for the card footer
}
```

Nothing becomes required; existing providers/bridges (`bridge-citations-state.ts`) keep
working untouched. Derivation helpers fill display gaps.

## Architecture

Small, isolated, independently testable units:

### 1. `citation-display.ts` (new, pure helpers)
No Angular, no DOM, fully unit-testable:
- `deriveDomain(url?): string | null` — hostname minus `www.`.
- `deriveSourceType(c: Citation): string` — `c.sourceType` ?? infer `'web'` from URL.
- `deriveMonogram(c: Citation): string` — first letter of domain/title, uppercased.
- `monogramHue(seed: string): number` — deterministic hash → hue for the monogram chip.
- `formatPublished(v): string | null` — freshness label; null when absent/invalid.

### 2. `MarkdownCitationReferenceComponent` (updated)
`libs/chat/src/lib/markdown/views/markdown-citation-reference.component.ts`
- Renders the **pill** (replaces `<sup>[n]</sup>`) in the three states above.
- Is the overlay **origin** (`chatOverlayOrigin`) and hosts an
  `<ng-template chatConnectedOverlay>` wrapping `<chat-citation-preview>`.
- Owns local `open` state; opens on hover(120ms)/focus (desktop) or tap (touch);
  closes on leave(≈200ms grace)/blur/Escape/outside-click/Tab (wires **both**
  `(chatOverlayOutsideClick)` and `(chatOverlayDetach)` per the directive contract).
- A11y: resolved+URL is an `<a aria-label="Source {index}: {title} ({domain}),
  opens in new tab">`; the preview is supplementary (its data is in the label + the
  accessible panel below), so no focus trap and no interactive-in-tooltip problem.

### 3. `ChatCitationPreviewComponent` (new, presentational)
`libs/chat/src/lib/primitives/chat-citations/chat-citation-preview.component.ts`
- Input: `citation: Citation`. Renders favicon/monogram, domain, source-type, title,
  snippet, footer ("Open source" + freshness). "Open source" hidden when no URL.
- **Self-contained encapsulated styles** — applies correctly when portaled into the
  body-level overlay pane (moved nodes keep their `_ngcontent` attributes; same pattern
  as `chat-select`'s portaled menu). `panelClass` (`chat-citation-preview-pane`) is used
  only for pane-level concerns.

### 4. `ChatCitationsComponent` (updated)
`libs/chat/src/lib/primitives/chat-citations/chat-citations.component.ts`
- Collapsible header: **"Sources"** label, count badge, stacked-favicon preview,
  chevron. `expanded` signal (default `true`); header is a `<button aria-expanded>`
  controlling the list region.
- List of `ChatCitationsCardComponent` unchanged in wiring (custom-template override via
  `ChatCitationCardTemplateDirective` preserved).

### 5. `ChatCitationsCardComponent` (updated)
`libs/chat/src/lib/primitives/chat-citations/chat-citations-card.component.ts`
- Detail-card layout: index badge, favicon/monogram + domain + source-type row, title
  (links out when URL present), one-line snippet clamp. Whole card opens the source.

### 6. Tokens & styles
- **`chat-tokens.ts`**: add a `--tplane-chat-citation-*` group (light + dark), e.g.
  `--tplane-chat-citation-accent`, `--tplane-chat-citation-accent-soft`,
  `--tplane-chat-citation-marker-bg`, `--tplane-chat-citation-marker-border`,
  `--tplane-chat-citation-marker-fg`, `--tplane-chat-citation-radius`. Defaults derive
  from existing surfaces/`--a2ui-primary`; consumers override via `:root`.
- **`chat-citations.styles.ts`** (new): exported string consts —
  `CHAT_CITATION_MARKER_STYLES`, `CHAT_CITATION_PREVIEW_STYLES`,
  `CHAT_CITATIONS_PANEL_STYLES` — imported into the respective components'
  `styles: [CHAT_HOST_TOKENS, …]` arrays (established pattern).

## Accessibility

- Markers keyboard-focusable; hover-only info also available on focus (desktop) and tap
  (touch). Preview never traps focus.
- Marker `aria-label` fully describes the source; source-type conveyed by text/glyph,
  **not color alone**.
- Panel header is a real `<button aria-expanded>` toggling an identified region.
- Contrast meets WCAG AA in both themes (token choices verified against surfaces).
- Motion (card fade/scale) respects `prefers-reduced-motion` via existing infra.
- Touch targets ≥ the pill's interactive box; pills resist line-wrap glitches.

## Failure / Edge States

- **Unresolved citation** → muted dashed pill, "No source available"; panel omits it.
- **No URL** → preview shows title/snippet, no "Open source"; card title is plain text.
- **Missing snippet / date / icon** → those rows collapse; monogram replaces favicon.
- **Long source lists** → panel scrolls with the message; header count communicates size;
  collapse tucks it away.
- **SSR** → overlay/preview are client-only (directive already guards `defaultView`);
  markers and panel render statically server-side.

## Testing Strategy

- **Unit (pure)**: `citation-display.ts` helpers — domain stripping, type inference,
  monogram/hue determinism, date formatting/fallbacks.
- **Component**: marker renders correct state/markup per resolver result; preview
  populates from a `Citation`; panel collapse toggles `aria-expanded` + region.
- **Interaction (real browser, not aimock replay)**: hover/focus opens preview, click
  navigates, Escape/outside/Tab close, pointer-type branch (emulate `hover: none`).
  Host-class/encapsulation behaviors need a real browser to catch (per prior learnings).
- Verify **both** `examples/chat` and `examples/ag-ui` e2e twins if shared copy changes.

## Rollout Notes

- Public surface change (new optional `Citation` fields, new exported
  `ChatCitationPreviewComponent`) → run `npm run generate-api-docs` and commit.
- Patch-only version bump; release requires a pushed tag (dry-run first).
- Lint gate is on errors, not warnings; aliased overlay inputs already carry the
  documented eslint-disable pattern to mirror.
