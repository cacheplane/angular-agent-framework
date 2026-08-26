# Homepage medium switcher — design

**Date:** 2026-08-25
**Status:** approved, not yet implemented

## Problem

The homepage proves things unevenly. Of five visuals, `DemoShowcase` is a tabbed
video with a live-demo modal, the new `#approve` block is a video, and Stream,
Render, and Ship are **static screenshots**. The page also displays **no code at
all** — `HighlightedCode` exists and is used on the library landing pages
(`/langgraph`, `/render`, `/chat`), but nothing on the homepage shows a line of
it, which is a strange gap for a developer framework.

Different readers want different evidence. A video proves the thing is real, code
proves it is small, and a live demo proves it is not staged. Today each section
picks one and the reader gets no choice.

## Goal

Let a single homepage section offer the same claim as video, as code, and as a
live embed, so a skimming buyer and a skeptical developer can each get the proof
they came for — and so the homepage gains a code surface where it matters.

## Non-goals

- Rebuilding `DemoShowcase`. Its tabs are *runtimes* (LangGraph, AG-UI), not
  mediums. Mixing the two axes weakens the "One chat UI. Two runtimes. Same
  code." comparison that section exists to make.
- Any change to `FeatureBlock`. The switcher drops into its existing `visual`
  slot.

## Component

`MediumSwitcher`, a client component (tab state), rendered into
`FeatureBlock`'s `visual` slot.

```ts
interface SectionMedia {
  video?: DemoClip;              // from lib/demo-media.ts
  code?: SolutionCode[];         // reuse the solutions type
  live?: { prompt: string; mode?: 'embed' | 'popup' | 'sidebar' };
}
```

Every medium is optional, and that is load-bearing:

- **One medium renders bare, with no tablist.** Chrome around a single option is
  noise.
- Sections gain tabs as media is produced, rather than blocking the whole feature
  on a recording that does not exist yet.

Tab order is fixed — video, code, live — so the control does not reshuffle
between sections.

## The constraint that shapes the implementation

The homepage today autoplays **one** video. Four switchers could mean four
autoplaying videos plus four iframes, on a page that already runs thirteen
sections. That is the main technical risk in this design.

**Only the active pane mounts.** Inactive videos are not in the DOM. The live
iframe mounts only once its tab is selected, never on page load. First paint
therefore stays at one video — Stream's, since `video` is the default tab —
and poster images carry the visual weight of unselected panes.

This is a correctness requirement, not an optimization. A reviewer should reject
an implementation that renders all three panes and toggles them with CSS.

## Content

Four sections × three mediums = twelve panes.

| Section | Video | Code | Live prompt |
| --- | --- | --- | --- |
| Stream | `langgraph-demo` (exists) | streaming snippet | stream a long answer |
| Render | **needs recording** — generative UI | `views()` + `<chat [views]>` | chart request |
| Ship | **needs recording** — reload restores the thread | `error()` / `status()` / `reload()` | any prompt, then reload |
| Approve | `hitl-demo` (exists) | `interrupt()` / `submit({ resume })` | the backups approval scenario |

Ship was initially judged to have no watchable moment. That was wrong:
**durability is watchable.** Reloading the page and seeing the thread restore,
or killing the backend and seeing the error boundary offer a retry, is exactly
Ship's claim and is recordable deterministically.

Every code pane must be a working snippet against the published API, sourced
from the docs rather than written from memory. The same rule
`solutions-data.ts` already enforces applies here.

## `?prompt=` in examples/chat

The demo app supports `/embed/:threadId`, `/popup/:threadId`,
`/sidebar/:threadId` and an `?appmode=` flag, but has no way to open on a given
scenario. Without one, every section's live tab is the same empty demo under a
different heading — the find-and-replace pattern `solutions-data.ts` exists to
prevent, and the weakest tab in every section.

Add `?prompt=` to `examples/chat`, which **prefills the composer and never
auto-sends**. Auto-executing text from a URL would let any link run something on
a visitor's behalf; prefilling keeps a human in the loop, which is the framework's
own argument.

Rejected alternative: deep-linking pre-seeded threads via `/embed/:threadId`.
It needs no app change, but the seeded threads must survive in production
storage, and a checkpoint wipe would silently empty every live tab on the
homepage with no failing test anywhere.

## Accessibility

Real `tablist` / `tab` / `tabpanel` roles with `aria-selected`,
`aria-controls`, and arrow-key navigation — not the button-only pattern
`DemoShowcase` uses today. Videos stay `muted` + `playsInline` with an
`aria-label`; they carry no audio and no narration, so captions would have
nothing to caption.

## Analytics

Medium switches go through the existing `trackCtaClick` path, so which proof
readers actually reach for is measurable rather than assumed.

## Testing

- `MediumSwitcher`: tab roles and `aria-selected`; arrow-key movement; a single
  medium renders bare with no tablist; **only the active pane is in the DOM**;
  the live iframe is absent until its tab is selected.
- Data: every section declares at least one medium; every live prompt is
  non-empty; every video URL resolves through `DEMO_CDN`.
- `?prompt=`: the composer is prefilled and **no run starts** — the important
  assertion, since the failure mode is a URL that executes.

## Delivery

Two PRs, so neither is unreviewable and half ships without waiting on
recordings.

1. `MediumSwitcher` + Stream and Approve (their videos already exist), with code
   and video tabs. No live tab yet.
2. `?prompt=` in `examples/chat`, the Render and Ship recordings, and the live
   tab across all four sections.

## Open questions

None blocking. The two recordings are mechanical: write a `.record.ts`, run it
against aimock, encode, upload — the path used for `hitl-demo`, documented in
`apps/website/scripts/upload-demo-media.md`.
