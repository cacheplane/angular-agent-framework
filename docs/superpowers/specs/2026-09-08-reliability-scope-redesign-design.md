# Reliability as a scope band, and compatibility as its own section

**Date:** 2026-09-08
**Status:** Approved, ready for planning
**Branch:** `blove/reliability-dark-redesign`

## 1. Goal

The homepage's dark Reliability band came out of the ATC retheme visually broken in three specific ways. Fix those, give the section a genuine aviation frame rather than a decorative one, and move the works-with logos into a compatibility section of their own.

## 2. What is actually wrong

Measured on the live page, not inferred.

**The logos are invisible.** `.reliability-logo` sets only `width`, `height` and `object-fit` — no colour treatment at all — so each mark keeps whatever fill its own SVG ships with. Anthropic's is `#181818` on a `#15253E` ground. Google's is the only one that reads, because it is full-colour, which makes it the loudest thing in a band meant to be quiet.

**The cards are a different dark from the ground.** Introduced by #1058. `[data-surface="dark"] .proof-strip-cell` overrides the cell's `background-image` but not its `background`, which stays `var(--color-surface)` — neutral `rgb(28,28,28)` — while the section's ground moved to scope navy. Two unrelated darks with no hierarchy between them.

**The hero strip and the section are the same navy, 78px apart.** The strip sits at document y 1072, the hero block ends at 1180, and the dark section begins at 1180. The strip was designed to *close* the yellow block; it cannot, while a larger band of the same colour starts a moment later.

A fourth problem is editorial rather than visual: the section was carrying four background layers (grid-less ground, a 150–300px `Proof` watermark, card chrome, and a logo ribbon) plus two separate arguments — "we are trustworthy" and "we are compatible with things". It was too busy, and the two arguments were competing.

## 3. The frame: Vx and Vy

Vx is best *angle* of climb — most altitude per unit of ground distance, flown to clear an obstacle. Vy is best *rate* — most altitude per unit of time, which is what actually gets you to altitude. Vx has the steeper deck angle, so it looks more impressive, and leaves you lower ten minutes later.

That is the section's argument: other approaches may look steeper today; we are optimising for rate of climb, and publishing the numbers that say so.

The frame lands in the **aside line**, not the heading. The heading stays "Audited, scored, published."

```
eyebrow:  Climb performance
heading:  Audited, scored, published.
aside:    Vx clears today's obstacle; Vy gets you to altitude.
          Not self-reported — every number links to its source.
```

Rejected: rewriting the heading around the climb frame (strongest, but rebuilds an argument that is working and touches the copy guard and three specs), and a plotted climb chart (a real altitude-against-time plate with deck-angle glyphs — accurate, and too much drawing for a section whose problem was busy-ness).

## 4. The Reliability section

### 4.1 The strip becomes the masthead

`.hero-strip` moves out of `Hero.tsx` and becomes the dark section's top edge, so the page reads yellow → strip → scope, contiguous. One navy moment instead of two. This is where the ATC app puts its frequency bar: at the boundary, not floating inside a block.

`HERO_TRUST_LINE` stays in `positioning.ts` — it is still the same words — but is rendered by the Reliability section. `Hero.spec.tsx` asserts `.hero-trust` textContent and will need to follow it.

### 4.2 The surfaces stop fighting

Fix the cause rather than the card. The website's `[data-ui="section"][data-surface="dark"]` scope re-points its surface tokens to the navy family. That scope is website-local — `dark.ts` stays neutral because `@threadplane/chat` and the cockpit consume it, and a navy ground there would seam against embedded chat — so this is safe, and it corrects every element in the band rather than one class.

| | now | becomes |
| --- | --- | --- |
| section ground | `#1b2e4d → #15253e` | `#0B1622 → #0F1C2E` |
| `--color-surface` | `rgb(28,28,28)` | `#15253E` |
| `--color-surface-tinted` | `rgb(44,44,44)` | `#1B2E4D` |
| `--color-border` | `rgb(45,45,45)` | `rgba(255,255,255,.12)` |
| `--color-border-strong` | `rgb(60,60,60)` | `rgba(255,255,255,.20)` |

The ground gets *darker* and the surfaces get *lighter*, which is the hierarchy that was missing.

### 4.3 The numbers lose their card chrome

`.proof-strip-cell` currently carries a background, a gradient, a border, a radius, a 1px top highlight and two shadows. On a plate, figures sit on the ground under a rule. The cells become plain: figure, caption, source link, no box.

One of the four cells is not a figure: the HVTrust cell renders a live external badge image from `hvtracker.net`. It keeps the badge — it is a grey-and-green pill that already reads on dark — and simply loses the box around it like the others.

This is most of the busy-ness fix, and it is why §4.2's surface re-point matters less than it appears — with the boxes gone there is little left to mismatch. The re-point still lands, because other elements in the band use those tokens.

### 4.4 One device: a pitch ladder

Between the aside and the figures, a single inline SVG: the pitch ladder and amber waterline of an attitude indicator, nose above the horizon. It is a divider that happens to mean something, and it pays off "attitude and pitch" literally.

- `aria-hidden="true"` — it carries no information a screen reader needs; the words carry the argument.
- Hairline strokes at `rgba(255,255,255,.30)`, waterline in `--color-signal`.
- No animation. Static.

Rejected: a radar grid with a rotating or static sweep (three background layers competing with the watermark), and instrument-style field labels on every figure (`RANK`, `SCORE`, `GRADE`, `SUPPORT` — good, but it adds back chrome we just removed).

### 4.5 The watermark

`Reliability.spec.tsx` guards that `.proof-strip-watermark` exists, is `aria-hidden`, carries `data-watermark-text="Proof"`, and renders no text content. It stays, unchanged. It is already amber, and with the grid and sweep rejected it is no longer competing with anything.

## 5. The compatibility section

The works-with row leaves Reliability entirely and becomes its own section, placed in `page.tsx` between `<Reliability />` and `<EnterpriseArchitecture />` — it answers "what does it plug into" immediately after the trust argument and immediately before the diagram showing where it sits.

The section takes `id="compatibility"` and `surface="tinted"`, matching the pattern of its neighbours (`#architecture`, `#teams`), so in-page anchors and any future e2e have something stable to address.

**Light ground.** This is the decision that makes the logos work: they are dark marks drawn for light backgrounds. On white they need no treatment at all.

**This retires the filter fix.** An earlier draft of this design normalised every mark with `filter: brightness(0) invert(1)`. Once the row is on a light section there are no logos left on dark, so the filter is unnecessary and there is nothing to guard. Fewer moving parts. (The HVTrust badge stays in the dark band, but it is a grey-and-green pill that already reads there.)

**Grouped, not a flat run.** The marks currently sit in one row where a model provider is adjacent to a protocol as though they were the same kind of thing. Grouped, and with every integration named:

- **Model providers** — OpenAI, Anthropic, Gemini, Bedrock, Azure OpenAI
- **Agent runtimes** — Mastra, CrewAI, Pydantic AI, Microsoft Agent Framework, AWS Strands
- **Protocols** — LangGraph, AG-UI

Grouping is the actual information, and it lets a name-only entry read as normal rather than as a broken image.

**No hidden count.** An earlier draft closed the runtimes group with a "+ 4 more" badge. Grouping is what killed it rather than housing it: the badge could only render inside one group, and the hidden entries did not all belong to that group — Azure OpenAI is a model provider, so "+ N more runtimes" could not be stated honestly under any count. All of the previously hidden marks already existed on disk, so naming the full twelve costs nothing and removes a number that only stayed correct if an editor remembered to decrement it.

**The compatibility claim becomes visible.** Today it lives only as `alt=""` / `aria-hidden` plus a spec comment: `Reliability.spec.tsx` guards that no wording implies these companies are customers. On its own section the claim can be stated in words — "Compatibility, not endorsement — no company here is claimed as a customer" — which is a stronger guarantee than a hidden attribute. The existing guard moves with the component and keeps asserting the attributes.

`RIBBON_ITEMS` and the `AdapterGuideLink` usage move out of `Reliability.tsx` into the new component; the items land as `COMPATIBILITY_GROUPS`. `RIBBON_MORE_COUNT` does not move — per "No hidden count" above, it is deleted.

## 6. Guards this touches

Each of these pins something this design deliberately changes, and must be updated as part of the work — not worked around:

- `apps/website/e2e/website.spec.ts` asserts `#proof-heading` is visible and `#proof[data-surface="dark"]` exists. Both survive: the id, the heading and the dark surface are all unchanged. **This should stay green untouched**; if it goes red, something has drifted that was not meant to.
- `Reliability.spec.tsx` — "carries the works-with line as a compatibility claim with an adapter link" and "orders cells, receipts, then the works-with line" both assert a row that is leaving. They move to the new component's spec, rewritten for the grouped structure.
- `Reliability.spec.tsx` — the watermark, dark-band, id and heading assertions stay exactly as they are.
- `Hero.spec.tsx` asserts `.hero-trust` textContent; the trust line moves to the Reliability masthead.
- `style-contracts.spec.ts` — **checked: it pins nothing on `.proof-strip-cell` or any `.reliability-*` class**, so removing the card chrome breaks no style contract. Noted so the next person does not re-derive it.

## 7. Out of scope

- `dark.ts` and the cockpit's neutral dark surfaces. The divergence is deliberate and documented in `ui.css`.
- The small second `[data-surface="dark"]` band further down the homepage (97px, in the stage area). It inherits the §4.2 token change and should be looked at during verification, but is not redesigned here.
- The `.arch-flow-log-source` badge contrast issue in the docs, already tracked separately.

## 8. Verification

- `npx nx test website` and `npx nx lint website` — the CI commands, not `vitest --root`.
- `npx nx e2e website` — in particular `website.spec.ts`'s `#proof` assertions, which should pass unchanged.
- In the browser at desktop and 390px: confirm every logo in the new section is legible, that the yellow → strip → scope seam has no sliver of yellow between the strip and the band, and that the figures read against the ground with the card chrome gone.
- Contrast sampled from the rendered page, not from this document.
