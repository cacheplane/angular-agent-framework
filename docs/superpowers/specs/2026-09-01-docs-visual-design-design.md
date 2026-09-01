# Docs visual design: callouts, diagram kit, and the diagram audit

**Date:** 2026-09-01
**Status:** Approved for planning
**Scope:** apps/website — docs MDX components, docs content, and a marketing follow-up

## Motivation

Two visual problems on the docs side, one gap on the marketing side:

1. The MDX callout is a left-border box with a solid mono-letter icon circle — it
   does not speak the visual language the docs sidebar landed on (panels,
   tinted chips, mono uppercase labels, hairline borders).
2. Architecture explanations ("How it fits") are ascii diagrams inside
   ```` ```text ```` fences. They are load-bearing content rendered in the
   least polished form on the page.
3. No marketing page uses a single architecture graphic; the two existing
   diagram components are docs-only.

Decisions below were made interactively (visual companion session,
`.superpowers/brainstorm/76640-1788300865`): callout direction **B — header
band**; diagram style **B — SVG schematic on dot grid**; production approach
**A — diagram kit**; docs scope **B — replace ascii + every intro gets a
diagram**; marketing scope **1+2 — homepage master diagram + adapter pages**.

## 1. Callout redesign (header band)

`components/docs/mdx/Callout.tsx` keeps its public API unchanged:
`type?: 'tip' | 'warning' | 'info' | 'danger'`, `title?: string`, `children`.

Visual spec (all presentation in `src/styles/docs.css`):

- **Card:** 1px solid `--color-border`, `--radius-md`, `--color-surface`
  background, `overflow: hidden`. No left accent border.
- **Header band:** a full-width strip, tone-tinted background at ~6% opacity,
  hairline bottom border, containing an outline SVG icon (stroke style, ~14px)
  and the title, both in the tone's text color. Padding ~8px 14px.
- **Body:** plain surface below the band, Inter 15px / 1.6,
  `--color-text-secondary`, padding ~12px 14px.
- **Title fallback:** when `title` is omitted, the band renders the kind name
  ("Note", "Tip", "Warning", "Danger") so it is never empty. `info` renders as
  "Note".
- **Icons:** outline SVGs replacing the solid letter circles — info: circled i,
  tip: check-circle, warning: triangle-alert, danger: octagon/circle-x. Inline
  `<svg>` in the component (stroke `currentColor`), sized by CSS.
- **Tones:** one CSS custom property pair per tone on the callout root
  (`--callout-tone`, `--callout-tone-surface`), set by `[data-tone]` rules,
  instead of today's per-tone hex repeated across icon/border rules. Values:
  info `--color-accent`; tip `#1a7a40`; warning `#D4850F` with band text
  darkened to `#B26D06` for contrast on the tint; danger `--color-angular-red`.

The existing `data-mdx="callout"` / `data-tone` attribute contract stays, so
content and tests keep working.

## 2. Diagram kit

New directory `src/components/docs/diagrams/` containing SVG primitives and
per-diagram compositions. All styling via classes in `docs.css` — the
inline-style lint guard applies; geometry (x/y/w/h, path `d`) is SVG
attributes, which are fine.

### Primitives

- **`DiagramFrame`** — the outer `<figure>` + responsive `<svg viewBox>`:
  rounded dot-grid ground (`<pattern>` of 1px `--color-border` dots), shared
  arrowhead `<marker>` definition, `width: 100%` with `overflow-x: auto` on
  the figure for narrow viewports, optional `caption` prop rendering a
  `<figcaption>`. Takes `viewBox` dims from props.
- **`DiagramNode`** — rounded rect (`rx` = radius token) with up to three text
  lines: eyebrow (JetBrains Mono, 9px, uppercase, letter-spaced,
  `--color-text-muted`), title (JetBrains Mono, ~13px, bold,
  `--color-text-primary`), meta (Inter, ~10.5px, `--color-text-muted`).
  Props: `x, y, w, h, eyebrow?, title, meta?, tone?: 'neutral' | 'accent' |
  'dim'`. Accent tone: `--color-accent-surface` fill, `--color-accent-border`
  stroke, accent eyebrow. Dim tone: `--color-surface-dim` fill (backends).
- **`DiagramEdge`** — orthogonal `<path>` (`d` supplied by the composition),
  1.2px `--color-text-muted` stroke, optional arrowhead via the shared marker.
- **`DiagramPill`** — rounded-full label chip placed on/along an edge:
  JetBrains Mono ~10px, `--color-accent-surface` fill, `--color-accent-border`
  stroke, `--color-accent` text. Used for contract/protocol labels
  ("Agent contract · signals", "SSE").

Every fill/stroke/text color references `var(--color-*)` tokens so a future
dark theme needs no diagram changes.

### Compositions

One React component per diagram, hand-placed coordinates, registered in
`MdxRenderer.tsx`'s components map. Naming: `<Lib>HowItFits` for intro
diagrams; concept diagrams named for their page.

The existing HTML `AgUiArchDiagram` is replaced by its kit equivalent
(and removed) so the site has one schematic language. The animated
`ArchFlowDiagram` stays — it is a live event-flow demo, not a schematic.

## 3. Docs audit

### Replace (ascii diagram → kit diagram)

| Page | Diagram |
| --- | --- |
| `ag-ui/getting-started/introduction.mdx` | chat → contract → two adapters → backends (the brainstorm mock) |
| `ag-ui/concepts/architecture.mdx` | vertical pipeline: component → contract → toAgent() → AbstractAgent → backend |
| `langgraph/concepts/agent-contract.mdx` | fan-in: LangGraph Platform / AG-UI backend / custom adapter → Agent → chat |
| `render/concepts/json-render-vs-a2ui.mdx` | three-package role split (render / a2ui / chat) |
| `chat/a2ui/overview.mdx` (first fence only) | A2UI content pipeline: classifier → parser → surface store → surface component |

### Add ("How it fits" section + kit diagram to intros lacking one)

`langgraph`, `chat`, `a2ui`, `render`, `middleware`, `telemetry`, `runtimes`
getting-started introductions. Each shows where that library sits relative to
the Agent contract and its neighbors, in the same schematic language. Section
heading: `## How it fits`, matching the ag-ui intro.

### Keep as text fences (not diagrams)

Log output, error output, JSONL payloads, bare URLs, and the A2UI message-type
list — everything else found in the fence audit stays untouched.

## 4. Marketing follow-up (same arc, after docs land)

- **Homepage:** a master stack diagram — Angular app → chat/render primitives
  → Agent-contract seam → adapters → runtime fan-out (LangGraph Platform,
  AG-UI runtimes) — as a new landing section component using the kit with a
  marketing size variant (larger type/nodes via a `scale` or CSS variant
  class, same primitives).
- **`/langgraph` and `/ag-ui`:** per-adapter schematic section, the
  marketing-scaled sibling of that library's docs "How it fits" diagram.

Placement within each page (which section slot, surrounding copy) is decided
at implementation time with the existing FeatureBlock rhythm; the spec
constraint is only: kit-rendered, token-styled, no new bespoke diagram
language.

## 5. Testing

- Callout spec: renders band title fallback per tone when `title` omitted;
  `data-tone` maps to the right class hooks; body children render.
- Kit primitive specs: `DiagramFrame` renders caption and viewBox;
  `DiagramNode` renders eyebrow/title/meta and tone attributes;
  edge/pill render.
- Each registered MDX diagram component mounts without error (one smoke spec
  iterating the registered diagram map).
- `nx test website`, `nx lint website` (inline-style guard), and a production
  build stay green.

## Out of scope

- Concept-page diagrams beyond "How it fits" (event mapping, interrupt
  lifecycle, checkpoint sync) — a later arc, same kit.
- `/pilot-to-prod` timeline, `/chat` anatomy, `/render` pipeline graphics —
  new diagram species, later arcs.
- Any dark-mode work for the website docs (tokens are referenced so it is
  free later).
- Auto-layout or spec-driven diagram generation.
