# Citation Source-Type Visual Language — Design

**Date:** 2026-07-07
**Library:** `@threadplane/chat` (`libs/chat`) plus the ag-ui bridge
**Status:** Design approved, ready for implementation plan

## Problem

The citations UI already renders inline numbered markers, a hover/tap provenance
preview card, and a collapsible Sources panel. `Citation.sourceType` is already
modeled as an extensible string, but the UI only renders it as a plain text label.
That makes web, file, app, memory, and custom provenance look interchangeable.

We need a small visual language for source types that improves recognition without
making citation markers noisy or turning the panel into a taxonomy UI.

## Goals

- Give canonical source types a distinct glyph and subtle tint across the preview
  card and Sources panel.
- Keep source-type logic centralized in pure display helpers so Angular components
  do not duplicate branching.
- Preserve the current privacy/CSP rule: no auto-fetched favicons or external icon
  assets.
- Keep `sourceType` extensible: unknown/custom strings render gracefully.
- Fix the ag-ui STATE bridge so `sourceType`, `iconUrl`, and `publishedAt` survive
  normalization.
- Cover the behavior in unit tests and the chat/ag-ui citation e2e twins.

## Non-Goals

- No custom source-type icon registry in this pass.
- No long hardcoded taxonomy beyond a small canonical set.
- No type glyphs inside inline citation markers for v1.
- No new network calls, CDN icons, icon font, or asset pipeline.
- No click-to-scroll marker-to-panel synchronization.

## Approved Visual Direction

The chosen direction is **subtle type badges**:

- Inline citation markers remain number-only pills.
- Preview and panel rows render a small type icon and a compact text badge.
- Type color is present but restrained: enough to distinguish file/app/memory, not
  enough to compete with message content.
- The Sources header favicon stack may use type icons when that is the selected
  source visual.

This keeps prose readable while making provenance type visible where users inspect
source details.

## Canonical Source Types

Support these canonical visual types:

| Type | Label | Icon intent | Visual role |
| --- | --- | --- | --- |
| `web` | `Web` | globe/link/document-web glyph | Browser or URL-backed source. |
| `file` | `File` | document glyph | Local/uploaded/project file. |
| `app` | `App` | app/window glyph | External app or integration result. |
| `memory` | `Memory` | memory/spark/brain-like abstract glyph | Persisted assistant or workspace memory. |
| `generic` | capitalized custom label, or no label for unknown | generic source/card glyph | Unknown or custom source type. |

`sourceType` remains a free-form string. The helper normalizes case and whitespace
for matching, but does not reject custom values. A literal `sourceType: 'generic'`
is treated as a generic visual type with label `Generic`; missing type with no URL
is still `unknown` and has no label. Because `generic` is a recognized visual type,
literal `sourceType: 'generic'` returns `isKnown: true`; custom strings that fall
back to the generic icon return `isKnown: false`.

## Display Helper Contract

Extend `libs/chat/src/lib/agent/citation-display.ts` with a pure helper, likely:

```ts
export type CitationTypeIcon = 'web' | 'file' | 'app' | 'memory' | 'generic';

export interface CitationTypeMeta {
  type: string;
  label: string | null;
  icon: CitationTypeIcon;
  tone: CitationTypeIcon;
  isKnown: boolean;
}

export function citationTypeMeta(citation: Citation): CitationTypeMeta;
```

Expected behavior:

- `sourceType: 'file'` returns label `File`, icon `file`, tone `file`.
- Missing `sourceType` with a URL returns `Web`, icon `web`, tone `web`.
- Missing `sourceType` without a URL returns `label: null`, icon `generic`,
  tone `generic`, `isKnown: false`.
- Custom values such as `company-knowledge` render a readable label such as
  `Company knowledge`, generic icon, generic tone, `isKnown: false`.

Existing helpers such as `deriveSourceType()` and `citationTypeLabel()` can remain
for compatibility, but components should use the richer meta helper for new visual
behavior.

## Source Visual Precedence

Use one helper-backed rule wherever the source visual slot appears:

1. If `Citation.iconUrl` is present, render the provider-supplied image.
2. Else if `citationTypeMeta(c).icon` is a known non-web type, render that type icon.
3. Else if the source is custom/unknown, render the generic type icon.
4. Else render the existing monogram fallback for web sources.

Rationale: favicons/logos supplied by the provider are the most specific visual.
Non-web types benefit from a stable semantic icon. Web sources without a favicon
still read better as domain monograms, preserving the current behavior.

## Icons

Icons are inline SVG, owned by the component templates or a small shared template
helper. They must be browser-safe and CSP-clean:

- No external assets.
- No icon font.
- No runtime SVG injection from user data.
- Icons use `currentColor` so component styles can drive the tone.
- Icons are `aria-hidden="true"` because the adjacent label carries meaning.

The implementation should avoid adding a dependency for five simple glyphs.

## Color Tokens

Add token defaults under the existing `--tplane-chat-citation-*` namespace. The
exact names can be refined in implementation, but the shape should support:

- type foreground
- type soft background
- type border

For example:

```css
--tplane-chat-citation-type-web-fg
--tplane-chat-citation-type-web-bg
--tplane-chat-citation-type-web-border
--tplane-chat-citation-type-file-fg
--tplane-chat-citation-type-file-bg
--tplane-chat-citation-type-file-border
--tplane-chat-citation-type-app-fg
--tplane-chat-citation-type-app-bg
--tplane-chat-citation-type-app-border
--tplane-chat-citation-type-memory-fg
--tplane-chat-citation-type-memory-bg
--tplane-chat-citation-type-memory-border
--tplane-chat-citation-type-generic-fg
--tplane-chat-citation-type-generic-bg
--tplane-chat-citation-type-generic-border
```

All foreground values must meet WCAG AA against their corresponding soft
background and the chat surface in light and dark themes. The palette should stay
understated and avoid a one-note hue family:

- web: existing citation accent blue
- file: restrained green
- app: restrained amber
- memory: restrained violet
- generic: neutral slate

## Component Behavior

### Inline Marker

`MarkdownCitationReferenceComponent` stays number-only. It may carry type data in
the preview it opens, but the pill itself does not show a glyph or per-type color.
This prevents clustered citations from becoming visually noisy inside prose.

### Preview Card

`ChatCitationPreviewComponent` renders:

- provider icon, type icon, generic icon, or web monogram in the leading visual slot
- domain when present
- compact type badge when `citationTypeMeta().label` is non-null
- existing title, snippet, open-source action, and freshness behavior

The badge includes the text label. The icon remains decorative to assist visual
recognition.

### Sources Panel

`ChatCitationsCardComponent` renders the same visual slot and type badge as the
preview card. `ChatCitationsComponent` updates its header stack helper so the first
three sources preview provider icons, type icons, generic icons, or monograms using
the same precedence.

Custom card templates remain unaffected: consumers who provide
`chatCitationCard` keep full control of their rendering.

## ag-ui Bridge

`libs/ag-ui/src/lib/bridge-citations-state.ts` currently normalizes only
`id/index/title/url/snippet/extra`. Extend `normalizeCitation()` to also carry:

- `sourceType`
- `iconUrl`
- `publishedAt`

`publishedAt` should accept the same broad value shapes as `Citation`: string,
number, or `Date` when the value already has that type. Invalid object values should
be omitted rather than coerced.

## Accessibility

- Type meaning is conveyed by text and icon, not color alone.
- Type icons are `aria-hidden="true"`.
- Provider-supplied images remain `alt=""` because the source label/title/domain
  carries the accessible name.
- Marker labels remain focused on source identity and navigation behavior.
- Contrast must pass WCAG AA in light and dark themes.
- Existing reduced-motion handling remains sufficient; new hover/focus transitions
  should use the same short transition pattern and respect the global reduced-motion
  rule.

## Public API

Export the new display helper types/functions from `libs/chat/src/public-api.ts`.
Because this changes the public API docs, run:

```bash
npm run generate-api-docs
```

Commit the regenerated `apps/website/content/docs/chat/api/api-docs.json`.

## Testing

### Unit Tests

`libs/chat/src/lib/agent/citation-display.spec.ts`:

- canonical source types map to expected labels/icons/tones
- missing type plus URL maps to web
- missing type without URL maps to unknown/generic with no label
- custom strings render capitalized, readable labels and generic icon/tone
- existing `citationTypeLabel()` behavior remains compatible

`libs/ag-ui/src/lib/bridge-citations-state.spec.ts`:

- STATE citation entries preserve `sourceType`, `iconUrl`, and `publishedAt`
- string URL shorthand remains unchanged

### Component Tests

`ChatCitationPreviewComponent` and `ChatCitationsCardComponent`:

- provider `iconUrl` renders an image and suppresses fallback visuals
- non-web known type without `iconUrl` renders the type icon and badge
- custom type renders generic icon and custom label
- web without `iconUrl` keeps the monogram behavior

`ChatCitationsComponent`:

- header stack uses the same source visual precedence for non-web citations

### E2E

Update both citation twin specs:

- `examples/chat/angular/e2e/citations.spec.ts`
- `examples/ag-ui/angular/e2e/citations.spec.ts`

At least one fixture citation should be a non-web type, and the tests should assert
that the preview and expanded Sources panel render the source-type icon/badge.

If fixtures or examples need richer source types, update the smallest deterministic
fixture/corpus path that feeds both examples without broad demo churn.

## Verification

Run the smallest relevant checks first, then broaden:

```bash
npx nx test chat
npx nx test ag-ui
npx nx lint chat 2>&1 | grep -cE ' error '
npx nx lint ag-ui 2>&1 | grep -cE ' error '
npx nx build chat
npx nx build ag-ui
npx playwright test --config=examples/chat/angular/e2e/playwright.config.ts citations
npx playwright test --config=examples/ag-ui/angular/e2e/playwright.config.ts citations
```

Also build the relevant example apps before claiming the implementation is green,
because the examples compile library source under different strictness settings.
Name the exact Nx targets in the implementation plan after confirming the current
example project names from `project.json`.

For final visual confidence, serve the chat example and run a real-browser smoke
with only `OPENAI_API_KEY` supplied, not the whole root `.env`.

## Open Implementation Notes

- Keep the implementation DRY: display branching belongs in `citation-display.ts`.
- Keep style additions in `chat-citations.styles.ts` and token defaults in
  `chat-tokens.ts`.
- Do not regenerate broad docs or context files unless the touched public surface
  requires it.
- Do not commit `.superpowers/brainstorm/` companion mockups.
