# Homepage rebuild: category, live hero demo, install dialog

**Date:** 2026-09-02
**Status:** Approved design, awaiting implementation plan
**Surface:** `apps/website` homepage (`/`), plus a new `/hero` route in `examples/chat`
**Brief:** "Rebuild threadplane.ai for Developer Awareness and Activation" (September 2, 2026). This spec is the first of five sub-projects; comparison pages, README and npm alignment, the measurement baseline program, and the content program are deferred to their own specs.

## 1. Goal

A senior Angular engineer landing on threadplane.ai should, without interpretation:

- read the exact category (open-source Angular AI agent UI framework) in the first viewport;
- see the real product running, not a screenshot, and be able to take control of it;
- understand from one button what "install" means and what happens after they click it;
- reach a first success (a rendered `<chat>`) with no server, no LLM, and no account;
- find the LangGraph and AG-UI paths as the second step, not the first.

The page optimizes for comprehension, quickstart entry, and activation. Not for GitHub stars, decorative novelty, or enterprise lead capture.

## 2. Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Scope | Rebuild the top of the page; refine and reorder the bottom. FeatureBlocks, DemoShowcase, YesWall, ProofStrip, PilotBlock, HomeFAQ, FinalCTA keep their components, CSS, specs, and analytics ids. |
| Hero layout | Stacked and centered: eyebrow, H1, one sentence, one primary button, one text link, then the demo at full width. Nothing else in the first viewport. |
| H1 | "The AI agent UI framework for Angular." |
| Hero demo | A recorded real LangGraph run replayed through the real Threadplane components with a scripted cursor. Takeover swaps to the live LangGraph backend on a new thread. |
| Takeover gesture | Visible "Take control" pill, plus any pointer-down or focus inside the surface. |
| Primary CTA | "Install Threadplane" opens an install dialog. The dialog's quickstart link and the final CTA land on a new "Try without a backend" docs page. |
| No-backend path | Shipped in this release. A new docs page, verified from a clean `ng new` app before launch. |
| Yes Wall | Eight questions shown (two per group), in-place expand to all sixteen. No new route. |
| Runtime parity | Its own section below the hero, not merged into it. |
| Branch base | `origin/main`. The old brainstorm branch carries one stray, superseded commit and is not used. |

## 3. Page architecture

Order is fixed. Component names are indicative; reuse existing primitives (`Section`, `Container`, `Eyebrow`, `Button`, `BrowserFrame`, `DemoModal`, `FeatureBlock`, `MediumSwitcher`, `HighlightedCode`) before adding any.

| # | Section | Component | Change |
|---|---|---|---|
| 1 | Hero | `Hero` + new `HeroDemo` + new `InstallDialog` | Rewrite |
| 2 | Compatibility boundary | `LogoRibbon` | Rewrite into three labeled groups |
| 3 | Runtime parity | new `RuntimeParity` | New; replaces `StackDiagramSection` on the homepage (the component stays for other pages) |
| 4 | Three-step mechanism | new `ThreeSteps` | New; replaces `HomeConceptGrid` on the homepage |
| 5 | Capability proof | `FeatureBlock` x5 | Re-copy Stream, Persist (was Ship), Approve, Render; add Test |
| 6 | Live Cockpit proof | `DemoShowcase` | Move down; one scenario |
| 7 | Coding-agent quickstart | new `CodingAgentQuickstart` | New |
| 8 | Production readiness | `YesWall` | Move down; compress with expand |
| 9 | Why Threadplane | new `ScopeTable` | New, static |
| 10 | Trust | `ProofStrip`, `Promises`, `WhitePaperBlock` | Keep |
| 11 | Enterprise | `PilotBlock` | Keep, new heading and copy |
| 12 | FAQ | `HomeFAQ` | Rewrite questions |
| 13 | Final CTA, articles | `FinalCTA`, `RecentArticles` | Rewrite copy |

`StackDiagramSection` and `HomeConceptGrid` are unmounted from `page.tsx` only. They are not deleted in this release.

## 4. Hero

### 4.1 Copy

All strings live in `apps/website/src/lib/positioning.ts` (see section 9).

- Eyebrow: `Open-source · Angular · LangGraph & AG-UI`
- H1: `The AI agent UI framework for Angular.`
- Subhead: `Chat, threads, approvals, and generative UI on Signals and DI. Your backend stays where it is.`
- Primary button: `Install Threadplane` (opens the install dialog)
- Text link: `See it running in Cockpit →` (cockpit.threadplane.ai)
- Small line under the demo: `MIT · Angular 20–22 · no account, no cloud` (values derived, see 9.2)

The "six months" line, the capability chip row, the enterprise button, the hidden clipboard action, and the screenshot are removed from the hero. The enterprise CTA and its `hero_talk_to_engineers` id move unchanged to the enterprise section.

### 4.2 HeroDemo (website side)

A client component that owns a small state machine:

```
poster → mounting → ready → (takeover | replay)*
poster → fallback      (frame never reports ready within 8s, or postMessage origin mismatch)
poster → playRequested (mobile or reduced-motion: user pressed "Play walkthrough") → mounting
```

- **Poster** is server-rendered: a webp of the first replay frame inside `BrowserFrame`, explicit width and height, `fetchpriority="high"`, not lazy. It is the LCP element.
- **Mounting** happens after hydration when all hold: the hero is intersecting, viewport width ≥ 768px, `prefers-reduced-motion` is not `reduce`. Otherwise the poster shows a "Play walkthrough" button and mounting waits for the click.
- The iframe (`https://demo.threadplane.ai/hero`) is absolutely positioned over the poster with `opacity: 0` until the frame posts `ready`, then crossfades. `title` is "Threadplane live demo". No layout shift: the poster's box is the iframe's box.
- **Fallback** keeps the poster and shows "Open the live demo →" linking to demo.threadplane.ai. A backend or CDN outage never blanks the hero.
- The website sends `{ type: 'tplane-hero', visible: boolean }` on intersection changes so the frame can pause and resume the script. The frame sends `{ type: 'tplane-hero', state: 'ready' | 'scripted' | 'paused' | 'live' | 'replay' }`. Both sides check `event.origin` against an allowlist; nothing else crosses the boundary.
- Analytics: `hero_demo_takeover` and `hero_demo_replay` fire once per state transition from the frame's messages. `hero_live_demo` fires on the Cockpit link.

**Documented exception to the brief:** an iframe exists in the first viewport. It is never the LCP, never loads before hydration, never loads on mobile or under reduced motion without a click, and has a poster fallback.

### 4.3 The `/hero` route (examples/chat side)

A new top-level lazy route `/hero` with its own `HeroMode` component. It is deliberately **not** hosted under `DemoShell`: the shell's `provideAgent` uses module-scope thread state and a palette, neither of which the hero wants. `HeroMode` provides two agents at component level through two `AgentRef`s:

- **Replay agent**: `provideAgent(HERO_REPLAY_REF, () => ({ assistantId: 'hero-replay', transport: inject(HeroReplayTransport) }))`.
- **Live agent**: `provideAgent(HERO_LIVE_REF, () => ({ apiUrl: environment.langGraphApiUrl, assistantId: environment.assistantId, threadId, onThreadId }))`, the same backend the canonical demo uses.

`HeroMode` binds `<chat [agent]="activeAgent()">` and `<chat-interrupt-panel [agent]="activeAgent()">`; `activeAgent` is a signal that starts on the replay agent and switches to the live agent on takeover. `ChatComponent.agent` is a signal input and every internal read goes through it, so the swap is a plain input change.

- **HeroReplayTransport** (injectable) implements the LangGraph adapter's `AgentTransport`. It loads `public/hero-replay.json` once (served at `/hero-replay.json`, so the recording never enters the initial bundle), then answers each `stream()` call with the next recorded run in order, pacing events by their recorded gaps clamped to a 30 ms floor and a 600 ms ceiling, and stopping on the abort signal. `reset()` rewinds to the first run. `createQueuedRun`, `cancelRun`, `getHistory` are no-ops like `FakeStreamTransport`; `joinStream` yields nothing.
- **The recording** is three runs from one scripted session against the aimock-backed backend (deterministic, no API key): the destructive-cleanup prompt that pauses on `request_approval`, the resume run after Accept, and the contact-form prompt that renders an A2UI surface. A `HeroRecordingTransport` wraps `FetchStreamTransport`, stamps each event with milliseconds since the run started, and exposes the runs on `window.__heroRecording`. It is active only when `/hero?record=1` is opened in a non-production build. A Playwright `.record.ts` script drives it and writes the fixture. A spec asserts the fixture has three runs and contains an interrupt event and an A2UI payload.
- **Script runner** is a small class with an injected host interface and clock so it is unit-testable: wait for visible, show the cursor at the composer, type the first prompt character by character (40 ms), click Send, wait for `interrupt()` to be set, move the cursor to Accept (600 ms) and press it, wait for the run to finish, type the second prompt, send, wait for the run to finish, hold, then restart on a fresh replay (`switchThread(null)` on the replay agent plus `reset()` on the transport). It pauses on `visible: false` or `document.hidden` and resumes where it stopped. Under `prefers-reduced-motion` typing is instant and the cursor jumps. Typing and sending go through the real composer DOM (`textarea[aria-label="Type a message"]` and the Send button) because the composer has no public draft API; Accept goes through the same `onInterruptAction('accept')` path a user click takes.
- **Status pill** in the frame's top bar: `Replaying a recorded LangGraph run` while scripted; `Live · LangGraph · new thread` after takeover. This is the honesty marker and is never hidden.
- **Takeover.** Triggered by the "Take control" pill, `pointerdown` anywhere on the surface, or `focusin` on any control inside it. It stops the runner, hides the cursor, and swaps `activeAgent` to the live agent, whose thread is new and empty. A banner above the composer reads "You are live on a new LangGraph thread. The walkthrough was a recording." and the existing welcome suggestion chips render. A "Replay walkthrough" link returns to the replay agent and restarts the script. (Brainstorm mockups showed the replayed transcript dimmed under the live one; `<chat>` renders one agent's transcript, so the banner replaces the dimmed transcript.)
- **Bridge.** The frame posts `{ type: 'tplane-hero', state }` to `window.parent` and accepts `{ type: 'tplane-hero', visible }` only from an allowlisted parent origin (threadplane.ai, www.threadplane.ai, localhost:3000, 127.0.0.1:4308).
- The live agent uses the demo's existing LangGraph config and telemetry. Nothing new is configured for the backend.

### 4.4 InstallDialog

Opened by "Install Threadplane". Reuses `DemoModal`'s focus trap, escape handling, and scroll lock through a shared modal primitive extracted from `DemoModal` (the extraction is the only refactor permitted in this release).

Content, top to bottom:

1. Title `Install Threadplane`, subtitle `Three steps to a running <chat> in your Angular app. No account, no key.`
2. Step 1 `Pick how you want to start`: segmented control `Try without a backend` (default) / `LangGraph` / `AG-UI`, each with a one-line description.
3. Step 2 `Run this in your Angular project`: the install command for the selected variant in a code block with a copy button and visible "Copied" feedback. A caption names the peer dependencies the command adds.
4. Step 3 `Add the provider and the component`: a six-line snippet for the selected variant (provider line plus `injectAgent()` and `<chat [agent]="agent" />`).
5. Footer: `Open the full quickstart →` (the variant's docs page) and `Copy install command`.

Analytics: `hero_install` keeps its id and gains `adapter: 'fake' | 'langgraph' | 'ag_ui'`; `hero_install_open` fires when the dialog opens; `hero_quickstart` fires on the footer link with the same `adapter` property. No copied text is sent.

Keyboard: the segmented control is a `radiogroup` operable with arrows; the dialog is `aria-modal` with `aria-labelledby`.

## 5. Compatibility boundary

`LogoRibbon` becomes three rows under the heading `Keep your agent stack. Standardize the Angular surface.` and the line `Threadplane adapts LangGraph and AG-UI into one signal-shaped Agent contract. Your model provider stays behind the backend you already operate.`

| Row label | Entries | Source of truth |
|---|---|---|
| Direct Threadplane adapters | LangGraph, AG-UI | `libs/langgraph`, `libs/ag-ui` |
| Backends reachable through AG-UI | Only runtimes with a cockpit or `runtimes/` example on main at implementation time | `cockpit/ag-ui/*`, runtime manifest |
| Model providers, behind your backend | OpenAI, Anthropic, Gemini, Bedrock | existing logo assets |

Logos are `aria-hidden`; names are visible text. No row is titled or styled as customer proof.

## 6. Runtime parity, three steps, capability proof

**RuntimeParity.** Heading `One Angular UI. Two runtime adapters. The same contract.` A LangGraph / AG-UI toggle (`radiogroup`) above two panes. Left pane, "What changes": the app config with the adapter import and provider line highlighted; only these lines differ between toggles. Right pane, "What does not": the component with `injectAgent()` and `<chat [agent]="agent" />`, rendered once and visually pinned with a "same in both" badge. Below: `@threadplane/chat consumes Agent, not LangGraphAgent or an AG-UI client. Swap the adapter without rewriting the Angular component tree.` and the qualification `Not every backend emits every capability; see the adapter guide.` CTA `Choose an adapter` → `/docs/choosing-an-adapter`. Both panes are server-highlighted with `HighlightedCode`; the toggle switches pre-rendered panes, so no client highlighting. Event `home_runtime_parity_toggle` with `adapter`.

**ThreeSteps.** Heading `From agent endpoint to Angular UI in three steps.` Steps: Choose an adapter, Inject signal-shaped state, Render the experience you own. Each has one sentence and one code fragment taken from the same `positioning.ts` snippets the dialog and parity section use.

**Capability proof.** Five `FeatureBlock`s, existing component and existing `MediumSwitcher` panes:

| Block | Outcome | Mechanism | Qualification |
|---|---|---|---|
| Stream | The UI stays reactive through tokens, tools, errors, and state changes. | `messages()`, `status()`, `error()`, `isLoading()`, tool progress | |
| Persist | A user can leave, return, inspect history, and continue. | thread selection, history, branch/replay, backend checkpoints | Durability comes from the connected runtime and persistence layer. |
| Approve | Irreversible work pauses for a human decision. | `interrupt()`, `<chat-interrupt-panel>`, `submit({ resume })`, checkpoint | |
| Render | Agent output becomes components from your design system. | registry, schema validation, readiness gate, per-component fallback, json-render and A2UI | Constrained structured output; no arbitrary generated code runs. |
| Test | Verify UI behavior without a model or backend. | `provideFakeAgent()`, `mockLangGraphAgent`, fixtures | |

Persist reuses the Ship block's panes. Test has a code pane only. Each block keeps one guide link and one live or inspectable example.

## 7. Coding-agent quickstart, Yes Wall, scope table, enterprise, FAQ, final CTA

**CodingAgentQuickstart.** Heading `Give your coding agent the Angular agent UI playbook.` The brief's seven-step prompt rendered from `positioning.ts` in a code block with copy. Links: `Copy setup prompt`, `Read AGENTS.md` (`/AGENTS.md`), `Open the full agent reference` (`/llms-full.txt`), `Start the human quickstart`. Event `home_coding_agent_prompt`; prompt text never enters analytics.

**YesWall.** Data unchanged. Renders the first two questions of each group; a button `See all 16 production-readiness questions` (count computed from data) expands the rest in place with `aria-expanded` and `aria-controls`. Event `home_production_readiness_expand`. The aside copy is regenerated from the count. Questions whose answer depends on the backend keep their existing qualification in the API pairing.

**ScopeTable.** Heading `Why Threadplane`. The brief's four-row table (raw stream SDK, backend agent framework, generative-UI renderer, React-first agent UI) as a static, responsive table that scrolls horizontally inside its own container on narrow widths. No competitor is named.

**PilotBlock.** Heading `Shipping inside a large Angular platform?`, the brief's copy, CTA `Talk to an engineer` with the existing `hero_talk_to_engineers` id and the existing direct-response promise only if `docs/gtm` still states it.

**HomeFAQ.** The brief's twelve questions. Each answer is one to three sentences, literal, with one docs link, and qualified where a capability depends on the backend. No FAQ structured data.

**FinalCTA.** Heading `Prove the Angular UI before you connect the backend.` Subhead `Start with a fake agent, render a real Threadplane surface, then swap in LangGraph or AG-UI when the integration is ready.` Primary `Start the quickstart` → the no-backend page; secondary `Run live examples`. A small `Talk to an engineer` link stays adjacent.

## 8. The "Try without a backend" docs page

New MDX page `apps/website/content/docs/chat/getting-started/try-without-a-backend.mdx`, linked from the chat and both adapter getting-started sidebars.

Sections: what you get (a real `<chat>`, no server, no key); install (`@threadplane/chat` plus one adapter, since `provideFakeAgent` ships in the adapter packages); provide `provideFakeAgent({ tokens })` in `app.config.ts`; the component with `injectAgent()`; run it; a focused test with `provideFakeAgent` in `TestBed`; "Connect a real adapter" with links to both adapter quickstarts and the runtime-parity explanation.

Verification gate before launch: the page is followed verbatim on a clean `ng new` project with the published packages, and the run is recorded in the implementation plan with package versions.

## 9. Single-source content

### 9.1 `positioning.ts`

Owns: hero strings, install variants, code snippets, coding-agent prompt, trust facts.

```ts
export type InstallVariant = 'fake' | 'langgraph' | 'ag_ui';
export interface InstallOption {
  readonly key: InstallVariant;
  readonly label: string;
  readonly description: string;
  readonly command: string;          // full npm install line
  readonly providerSnippet: string;  // app.config.ts fragment
  readonly quickstartHref: string;
}
export const INSTALL_OPTIONS: readonly InstallOption[];
export const COMPONENT_SNIPPET: string; // injectAgent + <chat>, shared by dialog, parity, three steps
export const CODING_AGENT_PROMPT: string;
```

`PRIMARY_TAGLINE`, `LONG_SUBHEAD`, and `HERO_SUBHEAD` are replaced by the new strings; `HERO_CAPABILITIES` is removed once nothing imports it. `POSITIONING_PROOF_POINTS` stays for the OG image and keywords.

### 9.2 Derived trust facts

The Angular range comes from the existing `WEBSITE_SUPPORTED_ANGULAR_MAJORS` in `apps/website/src/components/pricing/angular-support.mjs`, which `angular-support-copy.spec.ts` already verifies against `libs/langgraph/package.json`. A `formatAngularRange()` helper renders it as `Angular 20–22`. The license word in the trust line is asserted by a spec against `libs/chat/package.json`'s `license` field. No component types a version.

### 9.3 Drift guards

- A spec asserts every `@threadplane/*` package in `INSTALL_OPTIONS[*].command` exists under `libs/*/package.json` and every other package is a declared peer of one of them.
- A spec asserts `COMPONENT_SNIPPET` and each `providerSnippet` compile-parse as TypeScript.
- The docs page's install command is the same `INSTALL_OPTIONS` entry rendered through an existing MDX component, not retyped.

## 10. Metadata and structured data

- Title `Threadplane — Angular AI Agent UI Framework`; description `Open-source Angular AI agent UI framework for LangGraph and AG-UI: chat, durable threads, human approvals, and generative UI with Signals and DI.`; OG title aligned; canonical unchanged.
- Existing structured data (Organization, WebSite, SoftwareSourceCode, breadcrumbs) keeps its ids; only the description string changes. No FAQ, rating, offer, or review markup is added.
- `llms.txt`, `llms-full.txt`, `AGENTS.md`, and the sitemap are untouched except that the new docs page appears in the docs sitemap through the existing generator.

## 11. Analytics

Stable family `marketing:cta_click`. Ids added to the events constants, their tests, and `docs/gtm/taxonomy.md`:

| cta_id | Properties | Fires on |
|---|---|---|
| `hero_install` (kept) | `adapter` | copy in the dialog |
| `hero_install_open` | | dialog open |
| `hero_quickstart` | `adapter` | dialog footer link, final CTA primary |
| `hero_live_demo` | | hero text link, final CTA secondary |
| `hero_demo_takeover` | | frame reports `live` |
| `hero_demo_replay` | | frame reports `replay` |
| `hero_demo_play` | | "Play walkthrough" pressed |
| `home_runtime_parity_toggle` | `adapter` | parity toggle |
| `home_coding_agent_prompt` | | prompt copied |
| `home_production_readiness_expand` | | Yes Wall expanded |
| `home_adapter_guide` | | parity CTA |

Never sent: copied commands, prompt text, chat input, endpoint URLs.

## 12. Performance and accessibility

- LCP is the server-rendered poster; hero copy and the dialog's initial markup are server-rendered. The iframe, syntax-highlighted panes below the fold, and DemoShowcase media load lazily.
- No layout shift on tab or toggle changes: parity and dialog panes are pre-rendered and shown with the same box; the poster and iframe share a box.
- One `h1`; sections keep `aria-labelledby`; all toggles are `radiogroup`s; the dialog traps focus; the Yes Wall expander is a real button; reduced motion disables the cursor animation and typing delay; logos are `aria-hidden`.
- The examples/chat production bundle budget and the website bundle budget gates are unchanged and must pass.

## 13. Testing

**Website (Vitest):** `HeroDemo` state machine (poster, mount gating by width and reduced motion, ready crossfade, fallback timeout, origin check, play button), `InstallDialog` (variant switch, copy, events with `adapter`), `RuntimeParity` (toggle switches only the config pane), `YesWall` (8 shown, expand to all, count from data), `LogoRibbon` (three labeled groups, logos hidden), drift specs from section 9.

**examples/chat (Vitest):** `ReplayTransport` (timing with fake clock, abort), script runner (visible gating, pause and resume, takeover stops it), `HeroMode` (agent signal swap, divider and status pill, replay resets), fixture shape spec.

**E2E:** website Playwright: hero CTAs reach their destinations, dialog is keyboard-operable and the copied text equals the visible command, poster renders before the frame, mobile shows the play button. examples/chat Playwright: `/hero` runs the replay to the interrupt, takeover shows the live pill and a new thread, replay restarts. Both twin suites (chat and ag-ui) are updated where shared copy changed.

**Manual gate before merge:** clean-app run of the no-backend page; Lighthouse desktop and mobile on the homepage compared with a baseline captured from production before the branch is deployed; screenshots at 1440, 768, and 390; claim audit table (license, Angular range, package names, adapter list, AG-UI backend names, persistence wording, telemetry defaults, self-hosting, no-account statements) with a source file for each.

## 14. Out of scope and deferred

Comparison pages, product-page title changes, README and npm description alignment, OG image redesign, a public skill file, the content program, GSC and PostHog baseline reviews, and deleting `StackDiagramSection` and `HomeConceptGrid`. Each is a separate spec.
