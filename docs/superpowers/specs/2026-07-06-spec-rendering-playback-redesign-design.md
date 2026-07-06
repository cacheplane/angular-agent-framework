# Spec-Rendering Playback Redesign

**Date:** 2026-07-06
**Status:** Approved design, ready for planning
**Capability:** `cockpit/render/spec-rendering`

## Problem

The spec-rendering example's playback UI renders as unstyled text on the live
site (`examples.threadplane.ai/render/spec-rendering`, embedded at
`cockpit.threadplane.ai/render/core-capabilities/spec-rendering/overview`).

Root cause, confirmed via Chrome MCP: **the example's UI is styled entirely with
Tailwind utility classes in component templates, but Tailwind generates zero
utility rules for the embedded example builds.** Measured `tailwindRuleCount: 0`
across every embedded example; spec-picker buttons compute to browser defaults
(`padding: 0`, `border-radius: 0`, `font-size: 16px`). The shared
`@import "tailwindcss"` lives inside `@threadplane/example-layouts/theme.css`
(resolved from `node_modules`), and Tailwind v4 automatic source-detection never
scans the consuming app's templates — so it emits base + design-token variables
but no utilities. This has never worked; most examples don't notice because
their visible UI comes from pre-styled *library* components
(`@threadplane/chat`, `example-layouts`), whereas spec-rendering hand-rolls its
entire playback UI with utilities.

## Approach

**Self-contained redesign (chosen over "fix the Tailwind build").** Rebuild the
spec-rendering playback UI — and the shared transport timeline it uses — with
**encapsulated Angular component styles** driven by the real `--ds-*` design
tokens. Angular always compiles component `styles:`, independent of Tailwind, so
this is guaranteed to render both standalone and embedded, in light and dark
themes. No Tailwind utility classes remain in the touched files.

This is also a design upgrade: the same proven structure (spec tabs → split
render/JSON → transport footer) polished into a "spec player."

### Why not fix the Tailwind build

Fixing source-detection would restore all ~31 example components at once, but
it's shared-infra churn affecting every example plus a bundle-size concern, and
it leaves the design quality untouched. The self-contained path is lower-risk,
higher-quality for this example, and each render example is meant to stand
alone anyway.

## Design tokens & palette

All surfaces, text, borders, radii, shadows, and fonts reference **theme-aware
`--ds-*` tokens** (installed on `<html>` by `installEmbeddedTheme()`, present
standalone and embedded, and flipped by the cockpit host's `tplane:theme`
messages). **No hardcoded canvas/surface/text colors** — the mockup used literal
values only for fidelity.

Accent = **render-green**, in two roles to hold contrast on the near-black
canvas:

- `var(--ds-render-green)` (`#1a7a40`, theme-invariant) — **solid fills**: active
  tab, play button, scrubber base. Light text/icons on top.
- A local derived **brighter green** `#35b06a` — anything sitting **directly on
  dark**: status pulse, badge text, "Streaming…" label, JSON accents, scrubber
  highlight, active-speed text. Defined as a local CSS custom property
  (e.g. `--sr-green-bright`) inside the component styles, **not** a new global
  design token (avoids design-tokens infra changes). If it later proves broadly
  useful it can be promoted to a token.

Reference values (dark): canvas `rgb(17,17,17)`, surface `rgb(28,28,28)`,
surface-tinted `rgb(44,44,44)`, surface-dim `rgb(10,10,10)`, border
`rgb(45,45,45)`, text primary/secondary/muted `245/200/160`. Radii
sm6/md10/lg14/full. Mono = `--ds-font-mono`.

## Scope

**In scope**

1. `cockpit/render/spec-rendering/angular/src/app/spec-rendering.component.ts` —
   rewrite template + add encapsulated `styles:`. Keep using the shared
   `ExampleSplitLayoutComponent` frame; restyle only the slot *content*.
2. The four inline demo components in that file — `DemoText`, `DemoHeading`,
   `DemoBadge`, `DemoCard` — convert Tailwind classes to encapsulated styles,
   preserving skeleton-loading behavior.
3. `cockpit/render/shared/streaming-timeline.component.ts` — **restyle in place**
   with encapsulated styles (render-green). This fixes the transport for all 6
   render examples that import it; keep all mouse/touch drag-seek logic intact.
4. New JSON syntax-highlighter utility (local to spec-rendering) + unit tests.
5. `cockpit/render/spec-rendering/angular/src/styles.css` — trim now-unused
   global skeleton CSS if it moves into components; keep design-token wiring.

**Out of scope**

- The Tailwind build fix (deliberately not pursued).
- `StreamingSimulator` (shared, pure logic, no CSS) — unchanged, still imported.
- The other 5 render examples' bespoke content (they inherit only the restyled
  transport; their own panes remain as-is for a later pass).
- `example-layouts`, `design-tokens`, and any global/theme infrastructure.

## Component design

Structure maps onto the existing `ExampleSplitLayoutComponent` slots (header /
primary / 20rem secondary / footer; responsive: stacked on mobile, row ≥768px):

- **`[header]` — spec picker + status.** Segmented pill tabs (`Heading + Text`,
  `Card + Badge`, `Nested Layout`) in a `--ds-surface-dim` track; active tab =
  render-green fill with light text. Right-aligned **"Streaming" status pulse**
  (brighter-green dot with soft glow + label) bound to `simulator.playing()`.
- **`[primary]` — Live Render Output.** Uppercase tracked caption, then the
  rendered spec via `<render-spec>`. The demo components are the visual payload:
  - `DemoCard` — `--ds-surface` panel, `--ds-border`, `--ds-radius-lg`, soft
    shadow; title; children via `<render-element>`; skeleton lines while a child
    hasn't streamed.
  - `DemoBadge` — pill: soft green surface, brighter-green text, green border.
  - `DemoHeading` / `DemoText` — token-colored type; skeleton shimmer while
    empty and loading. Subtle fade-in when content arrives (optional polish).
- **`[secondary]` — Streaming JSON.** `--ds-surface-dim` inset, mono font,
  **syntax-colored** tokens, a blinking brighter-green cursor at the stream head,
  and a footer row: state label (`Streaming…` / `Complete` / `Paused`, green
  when streaming) + percent (muted, tabular).
- **`[footer]` — transport (shared timeline).** Circular render-green play/pause
  (light icon); scrubber track (`--ds-surface-tinted`) with green→brighter-green
  gradient fill + white handle ringed green; char counter (mono, tabular,
  `min-width` to prevent reflow); speed toggles `1x/2x/4x`, active = soft-green.

### JSON syntax highlighter

New pure function, local to spec-rendering (e.g. `json-highlight.ts`):

```
highlightJson(raw: string): JsonToken[]
JsonToken = { text: string; kind: 'key' | 'string' | 'punct' | 'number' | 'literal' | 'plain' }
```

- **Truncation-tolerant** — input is partial streaming JSON that cannot be
  `JSON.parse`'d. Single forward scan; an unterminated trailing string still
  emits as a `string` token.
- **Key vs. string** — a string token is a `key` iff the next non-whitespace
  character after it is `:`. The trailing (possibly unterminated) string has no
  `:` yet → treated as a plain string.
- Numbers `[-0-9.eE+]`, literals `true/false/null` (incl. partial), punctuation
  `{}[]:,`, everything else `plain`.
- Consumed by a `computed()` memoized on `simulator.rawJson()` and rendered as
  `@for` spans with `j-<kind>` classes. Re-tokenizing per tick is O(n) on
  few-hundred-char specs — negligible.

Isolation: one pure function, one input, deterministic output — ideal for TDD.

## Data flow

`StreamingSimulator` (unchanged) exposes signals `rawJson`, `spec`, `position`,
`total`, `playing`, `speed`, `progress` and methods `play/pause/toggle/seek/
setSpeed/setSource`. The component reads `simulator.spec()` into `<render-spec>`
and `simulator.rawJson()` into the highlighter; `loading` = `simulator.playing()`
drives skeletons. The footer timeline takes the simulator as input and calls its
methods. No data-flow changes — this is a presentation-layer redesign.

## Theming & error handling

- **Light/dark**: because all chrome uses `--ds-*` tokens, both themes work; the
  brighter green is theme-invariant and legible on both. Verify by toggling.
- **Empty/paused state**: preserve the current "Press play to start streaming…"
  placeholder, restyled.
- **Malformed/partial JSON**: the highlighter never throws; worst case a token is
  `plain`. No `JSON.parse` on the raw stream.

## Testing & verification

- **Unit (TDD)**: `json-highlight` — key/value disambiguation, numbers, literals,
  punctuation, unterminated trailing string, empty input, whitespace.
- **No Tailwind classes** remain in the three touched component files (grep gate).
- **Visual (Chrome MCP / preview)** against the served example (`/render/
  spec-rendering`): confirm styled render (buttons have padding/radius/fill),
  `tailwindRuleCount` no longer required, skeleton→content transition, scrubber
  drag, speed switch, and **theme flip** (light + dark). Render e2e is manual
  (no LLM / aimock not applicable), so verification is via the running app.
- **Sibling check**: load one other render example (e.g. `element-rendering`) to
  confirm the restyled shared timeline renders correctly there too.

## Success criteria

1. spec-rendering playback UI is fully styled with **zero** reliance on Tailwind
   utilities, standalone and embedded.
2. Render-green player matches the approved mockup; contrast holds on dark.
3. Streaming JSON is syntax-colored and tolerant of partial input.
4. Shared transport timeline is styled (render-green) for all 6 render examples.
5. Light and dark themes both render correctly.
