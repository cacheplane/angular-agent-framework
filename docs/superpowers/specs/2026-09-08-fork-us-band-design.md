# The open-source strip becomes the "Fork us" band

**Date:** 2026-09-08
**Status:** Approved, ready for planning
**Component:** `apps/website/src/components/landing/OpenSourceStrip.tsx`

## 1. Why

The homepage's open-source beat is a 204px strip carrying one 23px sentence: "Yes, this is all free. Don't like something? *Fork us.*" It was built deliberately quiet — its docblock says the point is "there is no catch and no upsell," so it avoids reading as a second pitch.

That restraint is now being spent. The site has an ATC aviation identity (see `2026-09-08-preflight-checklist-design.md` and the aviation-yellow theme), and the open-source offer is one of the strongest things Threadplane has to say. It should be said loudly, in the identity's voice, in as few words as possible.

**This reverses a prior intentional decision.** It is recorded here so a future reader does not "fix" it back.

## 2. Shape

A dark band, left-aligned to the page container, three stacked elements and one aviation device:

```
SQUAWK 1200                    ← mono, amber, 11px, .18em

Fork us.                       ← Archivo Black, clamp(56px, 8.5vw, 116px)

[⚇ Fork on GitHub]   MIT       ← amber button, mono licence beside it

- - - - - - - - - - - - - -    ← runway centreline, full-bleed
```

**Copy.** `OPEN_SOURCE_STRIP` reshapes from `{lead, emphasis, licence, cta}` to:

| Key | Value |
| --- | --- |
| `eyebrow` | `Squawk 1200` |
| `headline` | `Fork us.` |
| `licence` | `MIT` |
| `cta` | `Fork on GitHub` |

`lead` and `emphasis` retire, and the `<em>` goes with them. That matters: the current CSS comment justifies `--font-sans` here on the grounds that the line "carries an italic `<em>`, and Archivo Black has no italic." With the italic gone, the headline takes `--font-display`.

**Squawk 1200** is the US transponder code for VFR flight not receiving ATC services — flying with nobody controlling you. It is the aviation term for "no permission required," which is exactly the offer. It is US-specific (Europe squawks 7000) and a non-pilot will read it as texture rather than meaning; that is accepted, because the headline carries the whole meaning on its own.

**The runway centreline** is the section's one aviation device: a dashed amber rule near the band's bottom edge, spanning the **full section width, not the container's** — it is absolutely positioned against the `Section` and therefore ignores the container gutters, so the marking runs edge to edge like paint on a real runway. That means the element sits outside `<Container>` in the markup, with the `Section` as its positioning context. Pure CSS `repeating-linear-gradient` — 46px dash on a 92px period, 6px tall, `rgba(255, 175, 0, .5)` — not an SVG. The dash rhythm is fixed rather than proportional, so it reads as the same painted marking at every viewport.

## 3. Metrics

| | Today | New |
| --- | --- | --- |
| Band height (1440px) | 204px | ~461px |
| Headline | 23px `--font-sans` | clamp(56px, 8.5vw, 116px) `--font-display` |
| Elements | 1 sentence + pill + outlined button | eyebrow + headline + amber button + licence |

The height comes free: `Section` drops `tight`, so the standard `--spacing-section-y` of `clamp(64px, 8vw, 120px)` applies. **No custom padding override** — the band uses the same rhythm as every other section, which is one less thing to maintain and the reason `tight`'s existing two-attribute override can be deleted outright.

## 4. Accessibility

- `<h2 id="open-source-heading">` keeps its id and becomes **"Fork us."** The section's accessible name goes from a full sentence to two words, which is clearer. The id is pinned by the e2e spine (`website.spec.ts:56`), so that test stays green untouched.
- The eyebrow stays a readable `<p>` rather than `aria-hidden`, matching how `SectionHeader` treats "Climb performance". Hiding text that sighted users can read is worse than letting a screen reader say a term it cannot decode — and the headline immediately after carries the meaning regardless.
- The runway is decorative and carries `aria-hidden="true"`.
- Nothing animates, so there is no reduced-motion branch.

## 5. Known, accepted

Both were raised against rendered mockups and decided deliberately:

- **Two amber CTAs sit ~200px apart.** The amber "Fork on GitHub" lands directly above `TeamsBlock`'s amber "Talk to an engineer," so the fork link draws equal visual weight to the commercial ask. The alternative — an outlined white button — was offered and declined in favour of the louder treatment.
- **The band's lower third is empty:** 84px between the action row and the runway, then 30px below it. Pulling the runway up to the content, and trimming the band, were both offered and declined. The airiness is intentional on a full-stop band.

## 6. Out of scope

- The section **does not move** in `page.tsx`. It stays between `Stage` and `TeamsBlock`.
- `FinalCTA`, which the four library pages still close on, is untouched.
- No repository stats (stars, contributors, activity). They were considered as an "open-source proof band" direction and rejected: more text, against the brief.

## 7. Verification

- `npx nx test website`, `npx nx lint website`, `npx nx build website` — the CI commands.
- `npx nx e2e website`, with the spine assertion passing **unchanged**.
- Measured in a browser, not eyeballed: the headline sits on the container's left edge, level with every other section's left edge; the band clears ~460px at 1440px; the runway spans the full band width.
- At 390px the headline holds one line and the action row does not overflow.
