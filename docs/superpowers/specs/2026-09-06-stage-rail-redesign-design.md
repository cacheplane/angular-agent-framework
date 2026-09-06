# Stage rail redesign: a completeness ledger

**Date:** 2026-09-06
**Status:** Design approved in brainstorming; awaiting spec review.
**Surface:** `apps/website` only: `src/lib/positioning.ts`, `src/components/landing/StageAct.tsx`, `StageStills.tsx`, `src/styles/landing.css`, a build-time script under `src/lib/`, and `e2e/home-stage.spec.ts`.
**Builds on:** `2026-09-05-homepage-live-stage-design.md` (the stage, the beat map, the hold, the protocol, the harness). Nothing in the frame, the recording, the beat map, the threshold, or analytics changes.

## 1. Why

The right column of the homepage stage is busy, text-heavy, and carries no takeaway. At the Approve beat it renders six text levels (eyebrow, serif headline, body paragraph, three claim/API rows, a link, three hold sentences), about 75 words per beat and 300 across the act, beside a frame that is itself full of text. The copy restates what the frame shows ("The proposal renders in your UI" while the proposal renders 400px to the left), one hold line duplicates a row above it, and nothing in the column is visual, so the crossfade between beats reads as "the paragraph changed". The four CTAs point away from the page at the moment the visitor is meant to scroll toward the peak.

## 2. Decisions

| Decision | Choice |
|---|---|
| What the whole scroller says | To a developer: Threadplane is feature complete for the final mile; do a spike and install it. The chat on the left is the user's journey; the rail is the developer's ledger of what ships. |
| What each beat says | One capability claim, no body copy: tool calls and citations as signals; durable threads, no license; interrupts and approvals, built in; generative UI on A2UI and json-render. |
| Beat one | Reframed, not replaced. Streaming alone is table stakes; the recorded first turn already runs a `search_documents` tool call and attaches citations, so the claim is tool calls and citations. Subagents as a beat is a separate follow-up that needs a graph change and a re-record. Memory is a runtime feature, not a Threadplane surface. Testing already owns the section below the stage. |
| Rail anatomy | A four-segment bar with beat labels on top, doubling as act navigation; a round check, one serif claim, one quiet docs link, one monospace proof line per beat. |
| Proof | Read from `stage-replay.json` at build time, never typed. A number that cannot be derived is omitted, not estimated. |
| The hold | The check, the claim, and one line: "Keep scrolling to approve." The three hold sentences are removed. |
| The ending | The four claims as a checked ledger with their docs links, then "Feature complete for the final mile.", the install command, "Spike it this week", and the trust line. |
| Third parties | The page names the standards (A2UI, json-render). Vendor names stay on the render page the link opens. No competitor names anywhere. |
| Copy rules | scroll-craft's hard rules stand: no invented numbers, one peak, the single sanctioned scroll cue ("Keep scrolling to approve"). |

## 3. The rail

### 3.1 Segment bar

Four segments across the top of the rail, each a label in small caps (Tools, Persist, Approve, Render) over a 3px bar. State comes from act progress: a beat whose window has been passed is done (green bar, full-opacity label), the current beat is live (white bar), the rest are dim. Each segment is an anchor that scrolls the page to that beat's start (`beatWindows()[i].from` mapped to the act's travel), with `behavior: 'smooth'` unless reduced motion (which never reaches the act). The bar replaces the eyebrow.

The segment states are driven by the same publisher tick that computes `t`: it writes `data-beat-state="done|now|todo"` on each segment when the state changes, so no React state per frame.

### 3.2 Beat block

One block per beat, stacked in the same grid cell so the engine crossfades them with `data-sc-cue` exactly as today:

- A 22px round check to the left. Hollow while the beat is playing; filled green once act progress passes the beat's settle (the beat window's end for Tools and Persist, the threshold for Approve, the render tail for Render). The fill is a class toggled by the publisher (`data-checked`), not a cue.
- The claim, serif, one line at 1440 wide, no body text beneath.
- A docs link under the claim in 12px at half opacity with a trailing arrow. One per beat: `/docs/chat/components/chat-tool-calls`, `/docs/langgraph/guides/persistence`, `/docs/langgraph/guides/interrupts`, `/render`. Rail links keep `tabIndex={-1}` (the cues hide them by opacity; the same links are in the stills and the ledger).
- The proof line, monospace 12px green, derived from the recording (§4).

### 3.3 The hold

Within the approve hold range the beat block stays; the proof line is replaced by "Keep scrolling to approve." as a cue with the hold's window. No other hold copy exists. The "Open the live demo →" link under the frame stays where it is.

### 3.4 The ending

The last cue window (`cueFor('render')`'s closing hold) shows, in place of the render beat block once its check fills:

- The ledger: four rows, each a filled check, the claim, and the docs link right-aligned.
- "Feature complete for the final mile." in the claim style.
- The install row: `npm i @threadplane/chat` in a code chip and "Spike it this week →" linking to the quickstart (`INSTALL_OPTIONS[0].quickstartHref`).
- The trust line from `positioning.ts` (`HERO_TRUST_LINE`) plus "LangGraph and AG-UI".

The render beat block and the ledger are two cues whose windows meet at the render settle, so the swap is a crossfade, not a jump. The ending holds to the end of the act.

## 4. Proof lines

A build-time module `src/lib/stage-proof.ts` reads `examples/chat/angular/public/stage-replay.json` (already on disk in the monorepo; the website's `positioning.spec.ts` pattern of reading repo files applies) and exports `STAGE_PROOF: Record<StageBeat, string>`. Derivations, all counted, none estimated:

| Beat | Proof line | Derived from |
|---|---|---|
| Tools | `N events · 1 tool call · 3 sources` | run 0 event count; tool_call names in run 0; the citations array length in run 0's final state |
| Persist | `reloaded · N checkpoints · forked at step K` | the reload run exists; `histories` snapshot after run 3 length; the fork `checkpointIndex` mapped to the step label the devtools show (history is newest-first; step = length − index) |
| Approve | `1 interrupt pending · checkpoint N of N` | the interrupt in run 4's events; histories after run 4 (or the last snapshot before it) |
| Render | `1 surface · N components · no generated code ran` | the A2UI payload in run 6; component count from the surface's top-level children; the last clause is a stated property of `@threadplane/render`, not a count, and is the only non-derived phrase |

If a derivation finds nothing (a re-record without citations, say), the segment is dropped from the line rather than defaulted. A unit spec pins every derivation against the committed recording and fails if the recording changes shape. The proof strings are passed to `StageAct` and `StageStills` as props from the server page, so the recording is never fetched by the browser.

## 5. Copy

In `positioning.ts`, `STAGE_RAIL` becomes:

| beat | label | claim | docs |
|---|---|---|---|
| tools | Tools | Tool calls and citations as signals. | Tool calls → `/docs/chat/components/chat-tool-calls` |
| persist | Persist | Durable threads, no license. | Persistence → `/docs/langgraph/guides/persistence` |
| approve | Approve | Interrupts and approvals, built in. | Interrupts → `/docs/langgraph/guides/interrupts` |
| render | Render | Generative UI on A2UI and json-render. | @threadplane/render → `/render` |

The beat key stays `stream` in `stage-beats.ts` and the recording (the timeline is unchanged); only the label and claim change. `STAGE_HOLD_LINES` becomes the single line "Keep scrolling to approve". New: `STAGE_CLOSE = { claim: 'Feature complete for the final mile.', install: 'npm i @threadplane/chat', cta: 'Spike it this week' }`. The still alt texts are kept. The removed body copy and rows are not moved anywhere: the docs pages they pointed at already carry them.

## 6. Stills fallback

Each still keeps its picture and gets the new beat block beneath it (check, claim, docs link, proof line). After the fourth still, the ledger and the install row render once. The stills are the page's no-JS and phone form, so the ledger there is the only place a phone visitor sees "feature complete".

## 7. Verification

- **Unit:** `stage-proof.spec.ts` pins each derivation; `positioning.spec.ts` asserts four claims under 40 characters each, one docs href each starting with `/`, and the single hold line; `Stage.spec.tsx` asserts four segments, four checks, the ledger present in the act's DOM, and rail links with `tabIndex=-1`; the style contract asserts the segment bar and check rules exist; the public-copy scan stays green.
- **e2e (`home-stage.spec.ts`):** at 5% the Tools segment is live and its check hollow; at 30% Tools is done and checked; at 68% the hold line is visible and no other hold copy exists; at 100% the ledger has four filled checks and the install row is visible; clicking the Persist segment scrolls the act to the persist beat (`--sc-p` within its window). The live-frame test is unchanged.
- **Harness:** `verify-home.mjs` at desktop must still report no dead scroll and all cues clearing contrast; the ending's ledger is a cue like the others so the harness sees it move.
- **Word count:** a spec asserts the rail's total visible words across the four beats plus the ending stay under 90.

## 8. Out of scope

A subagents beat (needs the demo graph and a re-record; its own spec). Any change to the frame, the beat map, the hold range, the threshold, the recording, analytics events, the stills images, or the mobile dock decision. Re-verifying the phone stills' crop.

## 9. Open risks

- **Segment click vs the engine.** Programmatic `scrollTo` moves the page; the engine reads scroll on its own frame, so the act follows. Smooth scrolling across two viewports may take ~600 ms during which the publisher posts intermediate `t` values and the frame rewinds or fast-forwards; that is the same as a fast wheel flick and within the rewind budget plan 2 measured.
- **Proof numbers drift on re-record.** By design they are recomputed; the unit spec fails on a shape change so the copy is reviewed, not silently changed.
