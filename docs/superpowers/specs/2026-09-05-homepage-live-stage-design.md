# Homepage live stage: one real run, scrubbed by scroll

**Date:** 2026-09-05
**Status:** Design approved in brainstorming; awaiting spec review.
**Surface:** `apps/website` (homepage), `examples/chat/angular` (a new `/stage` route and a seekable replay), `libs/langgraph` (only if the seek needs an adapter hook).
**Supersedes:** the homepage section order in `2026-09-02-homepage-rebuild-design.md` §3 and §6–7. The hero, the install dialog, and the single-source content rules in that spec stand.

## 1. Why

The homepage has twenty blocks and no argument. "Two runtimes, same code" is told four times; the install path three times; "try without a backend" five times; nine of twelve FAQ answers restate a section above them. The five capability sections are the strongest content on the page and they are five identical layouts, which reads as a list. Nothing below the hero is alive. The reliability evidence, the page's best proof for a 0.0.x library, is a strip. The final-mile argument, the page's reason to exist, sits fourteenth.

The audit that established this is in the brainstorming transcript; the numbers above were counted on the live page on 2026-09-05.

## 2. Decisions

| Decision | Choice |
|---|---|
| Page grammar | Live surface (scroll-craft's term): a real product surface rises into the frame and the argument stacks beneath it. Chaptered acts were the alternative and lost because four separate animations would still read as four sections. |
| The stage | The real Angular demo app in an iframe, real `<chat>` on the left and the real `<chat-debug>` devtools on the right. Not a website-side facsimile. |
| What drives it | Scroll. The parent page maps scroll progress to recorded time and the iframe applies a recorded run up to that time. The wheel is a scrubber over a real run. |
| The recording | A live capture through the existing `HeroRecordingTransport`, one longer scripted run covering four beats. Not an aimock fixture: aimock replays are near-atomic and carry no token stream. |
| The one peak | The interrupt. The scrubber holds at the pause for a fixed stretch of scroll while only the copy rail advances; scrolling past the threshold is the approval. |
| Runtime parity | Dropped from the homepage as a section. It lives in the hero eyebrow, the works-with logos, the final CTA's swap line, and `/docs/choosing-an-adapter`. |
| Reliability | Kept as its own section directly under the hero (where today's logo ribbon and proof strip sit, merged): today's four sourced cells plus three receipts (signed provenance, three runtimes end to end, no content telemetry and no cloud). |
| Hero | Unchanged. It stays the autoplay teaser; the stage a screen below is "now you drive it". |
| Scroll engine | Vendor scroll-craft's `engine/scrollcraft.js` (MIT, Nate Herk, pinned at commit `0b81622`, 2026-09-04) as an unmodified client module loaded on the homepage only. Do not vendor its CSS; write the few device rules under the website's own style contract. |
| Copy rules | scroll-craft's hard rules that concern honesty are adopted (no invented numbers, no scroll cues, no counters, no dead scroll, one peak, a resolving ending). Its typographic taste rules are not: this site's voice doc governs, including its em dashes, and section eyebrows remain a website design element. |

## 3. Page architecture

Eight blocks between the header and the footer, in this order.

1. **Hero.** As shipped in #1011. The replayed LangGraph run with live takeover.
2. **Reliability.** Heading and eyebrow as today ("Reliable to the core", "Audited, scored, published. Not self-reported — every number links to its source."). The four cells stay: rank, OpenSSF Scorecard, live HVTrust grade, Angular majors. A second line of three receipts in the same grammar: *Signed provenance on every release* (npm provenance attestations and the SLSA file on each GitHub release), *Three runtimes exercised end to end* (LangGraph, AG-UI, Mastra; links to the portability matrix), *No content telemetry, no cloud* (links to the telemetry README). The works-with logos become this section's footer line with a "Choose an adapter →" link. `LogoRibbon` and `ProofStrip` merge into one component.
3. **The final mile.** The launch narrative's line as the heading: "Angular teams are building agents. The last mile is still messy." The existing `ScopeTable` beneath it, unchanged.
4. **The stage.** One pinned act, about six viewport-heights of scroll, described in §4–6.
5. **Prove it without a backend.** The current `FinalCTA` absorbs the Test section's three rows (`provideFakeAgent()`, scripted tool calls and interrupts, same UI code in test and production) above its existing headline and buttons. One install moment on the page.
6. **For teams.** `PilotBlock` and `WhitePaperBlock` merge: the four phases, the field report, one email form. The footer's newsletter form is removed; the field report form is the page's one form.
7. **FAQ.** Four questions: is Threadplane a backend agent framework; can I use my existing component library; does generated UI execute arbitrary code; does Threadplane require a hosted service. The other eight move to `/docs` where they already have homes, and the adapter-difference answer moves to the adapter guide.
8. **Recent articles.** Unchanged.

Removed: `RuntimeParity`, `ThreeSteps`, `DemoShowcase`, `CodingAgentQuickstart`, the standalone Test `FeatureBlock`, eight FAQ entries, the footer newsletter form. `CodingAgentQuickstart`'s content moves to a docs page linked from the final CTA caption; `AGENTS.md` and `llms-full.txt` stay where they are.

The five `FeatureBlock`s and the `MediumSwitcher` remain as components for the solutions and docs pages; the homepage stops using them.

## 4. The stage

### 4.1 Layout

A `<section data-sc-act="pin" data-sc-span="6">` whose sticky stage holds two columns on desktop: the iframe (about 60% width) and the narrative rail (about 40%). The rail's beats are `data-sc-cue` blocks keyed to the act's progress, using the greet form for the first beat and a closing two-value window on the last, per the engine's cue contract. The iframe is the ground the pinned stage needs before its progress leaves zero: it shows the recording's first frame the moment it is mounted.

### 4.2 The `/stage` route

A new route in `examples/chat/angular`, sibling to `/hero`. It renders `<chat [agent]="agent" [views]="demoViews()">` and `<chat-debug [agent]="agent" dock="right" [defaultOpen]="true" launcher="none">` side by side, with the interrupt panel above the chat exactly as `/hero` does. The agent is a replay agent over a new `StageReplayTransport`. There is no live mode and no takeover; a "Open the live demo" link in the frame's bar goes to the demo.

### 4.3 The protocol

The parent already speaks to the hero iframe with `{ type: 'tplane-hero', visible }`. The stage adds one message each way.

- Parent → iframe, on every animation frame while the act is on screen and the value changed: `{ type: 'tplane-stage', t }` where `t` is recorded milliseconds from the start of the run, computed from the act's `--sc-p` through the beat map (§5.2). Origin-checked both ways with the same allowlist the hero uses.
- Iframe → parent, whenever the applied state changes: `{ type: 'tplane-stage', applied: <event index>, phase: 'stream' | 'persist' | 'pause' | 'resume' | 'render' }`. The parent writes `applied` and `phase` into `data-sc-verify-state` on the stage element, which is what lets the verification harness see a bespoke stage (§8).

### 4.4 The seekable replay

`StageReplayTransport` loads the committed recording and exposes `seek(t)`. Forward seeks apply every event with `tMs <= t` that has not yet been applied, in order, in one synchronous batch per frame. Backward seeks reset the agent (`switchThread(null)` plus a transport reset) and fast-forward to `t` in the same batch. Rewinds are throttled to one per frame and coalesced, so a fast upward flick costs one reset, not one per wheel notch.

The run is a single `stream()` per turn in the recording, exactly as the hero's recording is. The transport concatenates the runs into one timeline: run boundaries are the beat boundaries, and the resume turn begins where the pause ends.

The Persist beat's leave-and-return is recorded, not simulated: the script reloads the thread mid-recording, so the recording carries a `getHistory` response and a fresh `values` event. On replay, that moment is a reset-and-restore from the recorded checkpoint values, which is what the product does on a real reload.

### 4.5 The devtools pane

`<chat-debug>`'s Timeline and State inspectors are the product's own. Nothing is added to them for the homepage. The State tab is what an engineer watches: `status()`, the tool calls and their states, the interrupt, the thread id and checkpoint count, `error()`. If the inspectors need a "read-only, driven by replay" affordance it is a prop on the existing component, not a fork.

## 5. The recording

### 5.1 The script

One live capture via `record-hero-live.config.ts`'s pattern, driven by a stage script in the `/stage` route's record mode (`/stage?record=1`), against the real backend, written to `public/stage-replay.json`. Beats, in order, each a real turn:

1. **Stream.** "Use the search tool to find authoritative information about Angular signals, then explain what they are and when to use them." Tokens stream, a `search_documents` call runs and completes, citations attach.
2. **Persist.** The script reloads the thread (the transport records the history fetch and the restored values), then sends "Shorter, please" so a new checkpoint is created, then forks from the previous checkpoint through the agent's branch API (the same call `chat-timeline-slider`'s Fork button makes) so the recording carries a branch.
3. **Approve.** "Clean up our old database backups, anything older than 90 days." `list_backups` renders its table; `delete_backups` pauses. The script accepts; the resume executes the deletion and the audit lands. This is the beat #1011 made real.
4. **Render.** "Show me a contact form with fields for name, email address, subject, and a multi-line message, plus a Send button." The A2UI surface streams and mounts.

The recording is committed like `hero-replay.json`, validated by `stage-replay.fixture.spec.ts`: four beats in order, a `getHistory` in beat 2 with a branch, `list_backups` then `delete_backups` with the interrupt inside the tool in beat 3, a resume answer under 1,400 characters, an A2UI payload in beat 4, no API keys. Its prose is never edited; take several takes and commit a complete one.

### 5.2 The beat map

Scroll progress maps to recorded time per beat, not uniformly. Each beat owns a share of the act's span, with easing so a beat's copy lands on its settle. The map is data in one file, `stage-beats.ts`, and the recording's own timestamps define the boundaries, so the rail's cue windows are derived from the same numbers and cannot drift from the recording.

| Beat | Share of span | Recorded time → scroll | Rail copy (from positioning.ts) |
|---|---|---|---|
| Stream | 1.3vh | linear | "The UI stays reactive through tokens, tools, errors, and state changes." + the three Stream rows |
| Persist | 1.2vh | linear, with the reload settled at the beat's midpoint | "A user can leave, return, inspect history, and continue." + the three Persist rows |
| Approve | 2.4vh | §6 | "Irreversible work pauses for a human decision." + the three Approve rows |
| Render | 1.1vh | linear, last 15% held on the mounted form | "Agent output becomes components from your design system." + the three Render rows |

The act's last cue holds, so the stage ends on the mounted form and the completed devtools state rather than fading before the next section.

### 5.3 The feeling curve

Written per scroll-craft's method, before the beats were assigned.

| Beat | Feeling | What causes it |
|---|---|---|
| Stream | Recognition | A chat they have built before, except the devtools beside it shows the state as signals, updating under their hand |
| Persist | Confidence | The transcript goes blank and comes back from a checkpoint; the timeline grows a branch |
| (silence) | Attention | The cleanup prompt is sent and the table lists what would go; the devtools shows `delete_backups` running. Nothing else moves. |
| Approve | Tension, then resolve | The panel appears and the wheel stops doing anything to the run. Then they scroll past the line, and it executes |
| Render | Delight | Structured output becomes a form made of the app's own components |

**The peak, as a visitor would tell it:** "You scroll and the agent lists what it wants to delete, and then it just stops. Scrolling does nothing. You have to decide, and when you do, it actually deletes them."

**Tell-someone sentence:** "It's the site where the agent won't delete anything until you scroll past the line."

## 6. The peak

The Approve beat's span is the largest on the page by a visible margin, and the silence before it is authored: the stretch from sending the cleanup prompt to the panel appearing carries no rail copy beyond the beat heading.

Within the beat, scroll maps to time in three ranges:

- **0–35%:** the prompt, the `list_backups` call, the table. Time advances linearly.
- **35–70%:** the hold. Recorded time is pinned at the interrupt. The panel is rendered by the real `<chat-interrupt-panel>`; its buttons are visible and inert (`pointer-events: none` on the panel inside `/stage`). The devtools State tab shows the interrupt. The rail advances through "The pause is a checkpoint, not a modal", "The run is frozen in durable state. Scroll all you like; nothing happens until someone decides", and "Keep scrolling to approve". The stage sets `data-sc-verify-hold="true"` for this range so the harness reads it as an authored hold rather than dead scroll.
- **70–100%:** the threshold and the resume. Crossing 70% dispatches the recorded resume; time advances through the deletion and the audit. Scrolling back above 70% rewinds to the hold: the recording rewinds, the checkpoint is still there, and the copy says so.

The threshold is a scroll position, not a click. This was chosen over live buttons because it never breaks the scroll flow, needs no skip affordance, and does not leave a pin holding indefinitely for keyboard and screen-reader users.

## 7. Smoothness

- **One playhead.** The parent computes the target `t` from `--sc-p` each frame; the engine's lerp (0.18 per frame, 1.0 under reduced motion) is what turns wheel jitter into a glide. The stage applies `t` on its own animation frame inside the iframe; the parent never waits on it.
- **Batched application.** All events up to `t` apply in one synchronous pass before change detection runs once. The recording's ~2,000 events across four beats apply in well under a frame when batched; the hero's replay already proves the per-event cost.
- **No layout on the scroll thread.** The parent's scroll handler writes one custom property and posts one message. Everything that paints is inside the iframe or is a CSS cue driven by `--sc-p`.
- **Rewind budget.** A reset-and-fast-forward is bounded by the event count up to `t`; snapshot checkpoints every 200 events keep worst-case rewinds under a frame. Measured, not assumed: the stage spec asserts a full rewind from the end completes under 16 ms in the unit environment.
- **Monotonic mapping.** Time never moves backward while scroll moves forward. The beat map is a piecewise monotonic function and a spec pins that.

## 8. Fallbacks and verification

- **Below 1024px, or `prefers-reduced-motion: reduce`:** the act does not pin. The four beats render as four stacked stills (chat plus devtools), captured by a Playwright recorder from `/stage` at each beat's settle, the same way the hero posters are made. Each still carries its beat's rail copy beneath it. Under reduced motion on desktop the same stills are used; nothing scrubs.
- **No JavaScript, or the recording fails to load:** the stills.
- **The iframe never loads before hydration, never on mobile, and never under reduced motion** — the same rules the hero's spec set for its iframe, for the same performance reasons.
- **Verification harness.** scroll-craft's `shoot.mjs` runs against `next start` in the website e2e: six positions per act, dead-scroll detection through `data-sc-verify-state`, cues that never reach full opacity, and per-line contrast on the composited frame, at desktop, 390px, and reduced motion. Its contact sheet is an artifact of the run. The one authored hold is declared through `data-sc-verify-hold`, so a green run means every other screen of scroll changes something.
- **Accessibility.** The rail is real markup in reading order; the iframe has a title and the stills have alt text describing the beat's state. The stage is skippable with one Tab, and `--sc-p`-driven cues never hide content that is not also present in the rail's DOM.

## 9. Analytics and success

Events: `home_stage_enter`, `home_stage_beat` with the beat name on first entry to each beat, `home_stage_threshold` on the first crossing, `home_stage_complete` on reaching the end, plus the existing CTA click events. The win condition, read from the existing funnel: a higher share of homepage sessions reaching the final CTA and a higher install-click rate than the current page, compared over two weeks after shipping against the two weeks before.

## 10. Testing

- **Website (Vitest):** the beat map is monotonic and its boundaries equal the recording's run boundaries; the stage publisher posts `t` only when it changes and only while the act is on screen; the still fallback renders four beats with their copy; the merged Reliability section renders four cells and three receipts with hrefs; the FAQ has four entries; the public-copy contract scan passes with the new rail copy in `positioning.ts`.
- **Demo (Vitest):** `StageReplayTransport.seek` forward applies exactly the events up to `t`; backward resets and restores; a seek inside the hold range does not advance past the interrupt; the threshold dispatches the resume once; a full rewind completes under the budget.
- **Recording spec:** as in §5.1.
- **e2e:** the homepage stage reaches each beat under headless scrolling and the `data-sc-verify-state` signature changes between positions; `shoot.mjs` reports no dead scroll outside the declared hold and no contrast failure; the `/stage` route renders the interrupt panel inert.

## 11. Out of scope

Replacing the hero; any change to the demo's live mode or the live takeover; the docs pages that receive the moved FAQ entries and the coding-agent prompt (a follow-up with its own links); a website-side scroll engine of our own (the vendored engine is used as is; if it proves unfit, replacing it is a separate decision); the solutions pages, which keep `FeatureBlock` and `MediumSwitcher`.

## 12. Open risks

- **Iframe cost at 60 fps.** One `postMessage` per changed frame is cheap; the risk is change detection inside the iframe on a large batch. The mitigation is the batched apply and the snapshot ring. If measurement shows a frame budget miss on a mid-range laptop, the fallback is to apply on every second frame while the lerp keeps the motion smooth.
- **Recording fragility.** Four turns against a live model means more takes to get a complete recording. The fixture spec rejects incomplete takes; the script must never edit prose.
- **`chat-debug` layout inside a 60%-width frame.** The panel is designed to dock beside a full-width chat; a narrow stage may need it docked at the bottom on smaller desktop widths. Decide at implementation with a measurement, not a guess.

## 13. Delivery

Three plans, each shippable on its own and each leaving the homepage working.

1. **Restructure.** The cuts and merges of §3 with the existing components: Reliability with its receipts and logo footer, the final mile promoted, the folded final CTA, the merged teams block, the four-question FAQ, the moved FAQ entries and coding-agent prompt landing in docs. No stage yet; the four capability `FeatureBlock`s stay in place until plan 3 replaces them. Measurable on its own against §9.
2. **The stage in the demo app.** The `/stage` route, `StageReplayTransport` with seek, the record mode and script, the committed `stage-replay.json` and its fixture spec, the still recorder. Verifiable in isolation by driving `/stage?t=` from a query parameter before the website exists.
3. **The stage on the homepage.** The vendored engine, the pinned act and rail, the protocol, the beat map, the fallbacks, `shoot.mjs` in e2e, analytics. Replaces the four `FeatureBlock`s.

