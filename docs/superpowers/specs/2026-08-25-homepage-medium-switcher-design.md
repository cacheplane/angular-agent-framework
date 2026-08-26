# Homepage medium switcher — design

**Date:** 2026-08-25
**Status:** Phase 1 shipped (PR #831). Phase 2 revised 2026-08-26 — see `?featured=`.

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
  live?: { featured: string; mode?: 'embed' | 'popup' | 'sidebar' };
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
| Stream | `langgraph-demo` (exists) | streaming snippet | a markdown-streaming suggestion |
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

## `?featured=` in examples/chat

**Revised 2026-08-26.** The original design called for a free-text `?prompt=`
that prefills the composer. Researching it before implementation showed two
problems:

1. `ChatComponent` has no draft input, so prefilling the composer means adding a
   public input to `@threadplane/chat` — a commercially licensed published
   package. That is a semver-relevant API addition requiring an api-docs
   regeneration, for the sake of a marketing page.
2. Free text in a URL means any link can display arbitrary attacker-chosen text
   inside the Threadplane demo UI. The original design worried about
   auto-execution but not about defacement.

The demo already has the mechanism needed. `welcome-suggestions` renders a
featured chip plus a "More prompts" dropdown, and `suggestionsForAppMode()`
decides which suggestion is featured. A **keyed** `?featured=<id>` param
selecting from that curated list gets the same outcome:

- No library change — the work is contained in `examples/chat`.
- Never auto-sends: the chip still requires a click.
- A link cannot inject text, because unknown ids fall back to the default
  featured suggestion rather than rendering what the URL says.
- Reuses UI that already exists and is already tested.

The cost is that a live tab can only open on a curated scenario. For a marketing
surface that is a feature, not a limitation.

Each `SectionMedia.live` therefore carries a suggestion id, and the live tab
frames `https://demo.threadplane.ai/embed?featured=<id>`. The demo sets no
`X-Frame-Options` or frame-ancestors CSP, and `DemoModal` already frames it, so
embedding works.

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
- Data: every section declares at least one medium; every live entry names a
  suggestion id that actually exists; every video URL resolves through `DEMO_CDN`.
- `?featured=`: a known id features that suggestion; an UNKNOWN id falls back to
  the default rather than rendering the URL's text — the important assertion,
  since the failure mode being designed out is a link that controls the page.
  And selecting a suggestion still requires a click: **no run starts on load**.

## Delivery

Three PRs, so none is unreviewable and nothing waits on a recording session.

1. ✅ SHIPPED (PR #831). `MediumSwitcher` + Stream and Approve, video and code
   tabs. No live tab yet.
2. `?featured=` in `examples/chat`, then the live tab and the Render/Ship
   switchers with code tabs.
3. The Render and Ship recordings, added as video tabs once produced.

## Open questions

None blocking. The two recordings are mechanical: write a `.record.ts`, run it
against aimock, encode, upload — the path used for `hitl-demo`, documented in
`apps/website/scripts/upload-demo-media.md`.
