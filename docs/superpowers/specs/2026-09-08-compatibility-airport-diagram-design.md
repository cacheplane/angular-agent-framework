# Compatibility becomes an airport diagram

Date: 2026-09-08
Status: approved, ready for a plan
Component: `apps/website/src/components/landing/Compatibility.tsx`

## 1. Why

The compatibility band was split out of the dark proof band in #1067 and kept the
old treatment: three hairline-separated groups, twelve integrations as 14px names
beside 17px logos, a footer link and a disclaimer. Too many rules, too much prose,
nothing big enough to see, and the one section on the homepage that never got the
ATC/aviation theme.

The job of the section is narrow: a visitor recognises a mark from their own stack
and concludes that Threadplane works with it. Nothing else in the section earns
its space.

Two facts from `/docs/choosing-an-adapter` shape the redesign:

- There are exactly **two** adapters. `@threadplane/langgraph` for LangGraph
  Platform; `@threadplane/ag-ui` for every AG-UI backend (CrewAI, Mastra,
  Microsoft Agent Framework, AG2, Pydantic AI, AWS Strands). The old three
  equal-weight groups flattened that.
- **Threadplane never talks to a model provider.** The adapters call your
  LangGraph or AG-UI endpoint; the model call happens server-side in your agent.
  So the five provider marks were never an integration claim, and rendering them
  at the same weight as LangGraph said otherwise.

## 2. What it becomes

An FAA-style airport diagram, full-bleed on aviation yellow. The chart vocabulary
carries the argument, so the group labels and the aside paragraph are deleted
rather than reworded:

| Chart element | What it is |
| --- | --- |
| Main terminal, solid ink | `<chat>` — Threadplane |
| Concourse A, hatched | `@threadplane/langgraph` |
| Concourse B, hatched | `@threadplane/ag-ui` |
| Gates A1, B1–B6 | the seven runtimes, each at a white stand |
| Outside the neat line | the five model providers |

### 2.1 Surface

`surface` flips `tinted` → `signal` (full-bleed `--color-signal` `#FFAF00`), an
existing token-mapped section surface.

This is what lets every mark render **bare, with no chip**: Anthropic's is
`#181818`, CrewAI's and Pydantic's `#111827`, LangGraph's `#1C3C3C`, Bedrock's
`#252f3e` — all dark marks drawn for a light ground, and aviation yellow is a
light ground. It was the invisibility of these same marks on the dark band that
forced the split in #1067.

Page rhythm becomes yellow hero → dark preflight → yellow plate → architecture.

### 2.2 The plate

A single SVG, `viewBox="0 0 1000 536"`.

- **Neat line** at `8,8,984,444` with graticule ticks every 88 (x) and 84 (y).
  The frame does **not** rotate.
- **Airfield group rotated −3.5°** about `(500, 230)`. Nothing on a real plate is
  axis-aligned, and this is the single cheapest signal that it is a chart rather
  than a flowchart. Extents are held to x 56–944, y 58–419 so no rotated corner
  crosses the neat line.
- **Runways** 09L-27R (y 58, h 11) and 09R-27L (y 408, h 11): solid ink bars with
  knocked-out yellow designators.
- **Taxiways** N (y 100), S (y 386), E (x 930), each with a yellow letter disc.
- **Main terminal** `56,190 → 188,288`, solid `#0A0A0A`, carrying the `PlaneMark`
  glyph at 27px in yellow, `<chat>` in Archivo Black 20, and `MAIN TERMINAL` in
  mono. Its contents counter-rotate so they sit upright.
- **Concourses** A (`204,190 → 432,224`) and B (`204,254 → 900,288`): 45° hatch
  fill, ink outline, a yellow knockout label box, and the package name below it.
- **Connectors** at y 206 and y 270 from the terminal's east face.
- **Stands**: 38px white boxes, ink hairline, rx 3, each with an ink gate-number
  tab welded to its top-left corner. Gate A1 at x 318; B1–B6 at 268, 380, 492,
  604, 716, 828. Each stand and its label counter-rotate about the stand centre.
- **Aprons**: dashed hairline outlines behind each gate row.
- **Chart furniture**: scale bar and north arrow live in the **margin below the
  neat line**, not on the field. They were drawn over runway 09R first.

Two values carry the whole meaning and no legend explains it: **white is somebody
else's, ink is ours.**

### 2.3 Gate table

| Gate | Mark | Name | Size |
| --- | --- | --- | --- |
| A1 | `/logos/langgraph.svg` | LANGGRAPH | 21 |
| B1 | `/logos/ag-ui.svg` | AG-UI | 19 |
| B2 | `/logos/runtimes/crewai.svg` | CREWAI | 22 |
| B3 | `/logos/runtimes/mastra.svg` | MASTRA | 16 |
| B4 | `/logos/runtimes/pydantic.svg` | PYDANTIC AI | 21 |
| B5 | `/logos/runtimes/microsoft.svg` | MS AGENT FWK | 19 |
| B6 | `/logos/providers/bedrock.svg` | AWS STRANDS | 12 × 20 |

`MS AGENT FWK` is an abbreviation the 38px stand forces. It is the plate's
label only: `Gate.long` carries `MICROSOFT AGENT FRAMEWORK` and the HTML stack
renders `long ?? name`, so the phone list and every screen reader get the whole
name — the one the band this replaced used.

**Sizes are per-mark and non-negotiable.** One shared `height` reads wrong: Mastra
is wide and heavy, Anthropic is a narrow wedge, Microsoft is a dense square. These
belong in the geometry module beside the src, not as a CSS rule.

**B6 is the only width-sized mark.** `bedrock.svg` is the AWS wordmark at 1.67:1,
so it takes an explicit `w` and every other mark takes `s`. Using it for AWS
Strands is honest — Strands is an AWS project, so the mark denotes the actual
thing. The alternative considered and rejected was rendering the word "AWS" in
Archivo Black, which out-weighed every real logo on the plate.

Note the asset appears twice in the band: gate B6, and Bedrock in the margin.

### 2.4 Off airport

Below the neat line, at 20px:

> `OFF AIRPORT — BEHIND YOUR BACKEND. THREADPLANE NEVER TALKS TO THEM.`
> OpenAI · Anthropic · Google · Azure · Bedrock

The neat line is the airport boundary, so marks outside it are outside the
airport. The claim is rendered as geometry rather than asserted in a sentence.

**The wording is "never talks to them", not "never sees it."** Never-*sees* is a
data claim not supported anywhere in the docs, and is the same shape as the three
claims #1067 had to kill. Never-*talks-to* is structural and true.

This band knowingly repeats marks that `EnterpriseArchitecture` renders one
screen below as its `ANY MODEL` strip (`MODEL_STRIP` in
`src/lib/architecture-diagram.ts`, same five marks, caption "your choice"). The
duplication is accepted in exchange for putting the two most recognisable marks
in the set high on the page. Do not "fix" it by editing the architecture
diagram — its geometry is measured by `e2e/home-architecture.spec.ts`.

## 3. Files

Follows `EnterpriseArchitecture` exactly, because that component already solved
this problem shape.

- **`src/lib/airport-diagram.ts`** (new) — every coordinate, the rotation, the
  gate table with per-mark sizes, and the provider list. One module, read by the
  component *and* by both specs. Nothing hand-written twice.
- **`src/components/landing/Compatibility.tsx`** — stays a server component. No
  interactivity, so no `'use client'`. Renders the SVG and the phone stack from
  the same exported data.
- **`src/styles/landing.css`** — the `.compatibility-*` block (currently ~lines
  2007–2075) is replaced.

## 4. Narrow viewports

Copies the `arch-stack` precedent, but at `@media (max-width: 1023px)` rather
than the usual 767px: the SVG figure is hidden and an HTML gate list is shown,
grouped by concourse, driven by the same exported gate table. Never a sideways
scroll.

The wider breakpoint is measured, not a preference. `.ap-svg` is `width: 100%`,
so the 1000-unit plate scales with its container: at a 768px viewport the
container is ~707px and the plate renders at 0.71, putting callsigns at 6.0px and
gate ids at 5.3px. Everything between 768 and ~1000px is a chart nobody can read,
so tablets get the list instead. A `min-width` plus a scrolling container is
ruled out above.

A seven-stand rotated airfield has no 390px form. This is a real share of the
work, not a detail.

## 5. Guards

`Compatibility.spec.tsx` is rewritten. It currently pins three groups, twelve
items and one accessible-named list per group — none of which will exist.

**Must survive, and each has a reason on the record:**

- `id="compatibility"` and `compatibility-heading` — `e2e/website.spec.ts` asserts
  homepage spine order by heading id.
- Every mark `alt="" aria-hidden="true"` beside a visible name.
- `Choose an adapter →` → `/docs/choosing-an-adapter`, keeping the
  `home_adapter_guide` analytics id (`AdapterGuideLink` replaces `className`
  rather than appending, so the new stylesheet must supply its own rule).
- The visible endorsement disclaimer and the `trusted by|customers|our
  clients|powered by` scan.

**New:**

- A unit spec over `airport-diagram.ts`: every stand inside its apron, every
  stand's stub actually meeting its concourse, the rotated field's four corners
  inside the neat line, and the gate table non-empty per concourse.
- An overflow e2e modelled on `home-architecture.spec.ts`: measure every rendered
  `<text>` and `<image>` bbox against the structure that owns it. This session
  found four separate collisions by eye — gate numbers over package labels, a
  taxiway drawn through the main terminal, sub-labels rendering outside a 26px
  concourse, the scale bar on top of runway 09R. Eyes do not scale; that e2e is
  the thing that keeps the geometry honest.

## 6. Decisions recorded, not silently dropped

- **`AL-0059 (FAA)` is cut.** It is an invented reference to a real government
  numbering system on a commercial page.
- **`ELEV 0 · RWY 09/27 · ALL TRAFFIC ACCEPTED` is cut.** Decorative prose in a
  redesign whose whole purpose is shedding it, and "all traffic accepted" edges
  toward a claim. Runway designators stay — they are geometry, not assertions.
- **AG2 is not on the plate.** It is named in `/docs/choosing-an-adapter` but not
  in today's homepage set, and there is no mark for it. Today's set is kept.
- **The band gets taller** than the 634px it replaces, and sits directly above
  `EnterpriseArchitecture` — two large technical figures back to back. Accepted.
- **`TPL` is a real assigned IATA code** (Draughon-Miller Central Texas
  Regional, Temple, TX), borrowed for the fictional `THREADPLANE INTL` because
  the initials fit; it is recorded here rather than left to be discovered, the
  same way `AL-0059` was.
- **The control tower symbol is not built.** It was drawn and offered (T2); T1
  was chosen. Available if the plate later reads as under-furnished.
