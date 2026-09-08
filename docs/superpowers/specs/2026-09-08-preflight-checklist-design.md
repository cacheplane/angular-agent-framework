# The proof band becomes a preflight checklist

**Date:** 2026-09-08
**Status:** Approved, ready for planning
**Branch:** `blove/reliability-dark-redesign`
**Supersedes:** the pitch-ladder device in `2026-09-08-reliability-scope-redesign-design.md` §4.4

## 1. Why

Pilots run checklists. The homepage's dark proof band argues that Threadplane is trustworthy, but it argues it as a set of scores — which is a certificate, not a preflight. A preflight lists what *you* verify before you go, and its most useful half is the part still outstanding.

Recasting the band as a checklist does three things at once: it gives the aviation frame something structural to do rather than decorative, it states the product boundary as work you still own rather than as a feature, and it forces every claim to be checkable.

## 2. Shape

Two columns, no group headers, no footer.

**Threadplane** — 11 ticked rows, each linking to the doc page that proves it.
**Yours** — 8 unticked rows, phrased in the docs' own words.

Beneath, without a divider, an **Airworthiness** block: 8 rows where the response *is* the figure, each linking to its source.

Each row is `[box] [challenge] · · · · · [response]`. Responses are outcomes you could verify, never feature names: `SURVIVES RELOAD`, not "persistence".

The boxes tick in sequence on scroll-into-view, ~180ms apart, Threadplane column then Airworthiness. The **Yours boxes never fill** — that is the argument, not an oversight.

### 2.1 The rows

**Threadplane**

| Challenge | Response | Proof |
| --- | --- | --- |
| A run fails | RETRY, BUILT IN | `/docs/chat/guides/error-handling` |
| Tool calls | LIVE STATUS CARDS | `/docs/chat/components/chat-tool-call-card` |
| Durable threads | SURVIVE RESTARTS | `/docs/langgraph/guides/persistence` |
| Reader scrolls up | STREAM STAYS PUT | `/docs/chat/components/chat` |
| Model output | SANITIZED, 26 NODES | `/docs/chat/guides/markdown` |
| Shared link | URL IS THE TRUTH | `/docs/chat/guides/thread-routing` |
| Your design system | CSS VARS, NO !IMPORTANT | `/docs/chat/guides/theming` |
| Your tests | RUN WITHOUT A MODEL | `/docs/chat/getting-started/try-without-a-backend` |
| Swapping backend | ONE IMPORT CHANGES | `/docs/choosing-an-adapter` |
| Model drift | CHECKED WEEKLY, LIVE | `.github/workflows/aimock-drift.yml` on GitHub |
| Debug panel | TREE-SHAKEN OUT | `/docs/chat/components/chat-debug` |

**Yours**

| Challenge | Response |
| --- | --- |
| Agent endpoint | BEHIND YOUR PROXY |
| API keys | NEVER IN THE BUNDLE |
| Thread IDs | SERVER-GENERATED |
| CORS | YOURS TO CONFIGURE |
| Interrupt panel | YOU COMPOSE IT |
| Resume payload | YOURS TO CHOOSE |
| Runs | TRACED |
| Regressions | EVALUATED |

**Airworthiness**

| Challenge | Response | Source |
| --- | --- | --- |
| Framework rank | #8 OF 119 | hvtracker.net categories |
| OpenSSF Scorecard | 8.2 / 10 | scorecard.dev |
| Supply-chain grade | 84.8 HVTRUST | hvtracker.net/agents |
| Angular support | 20–22 CI-TESTED | npmjs.com |
| Release provenance | SIGNED · OIDC · SLSA | npmjs.com |
| Cloud | NONE · SELF-HOSTED | `/privacy` |
| Signup | NONE · npm i | `/docs/chat/getting-started/installation` |
| VC board | NONE | `/about` |

## 3. Every claim is sourced, and three were wrong

The section's existing aside says "not self-reported". A checklist makes that harder, not easier, so the rows were verified against the docs rather than written from memory. Three items that appeared in earlier drafts came out:

- **"Destructive actions — HELD FOR APPROVAL"** was false. `<chat>` does not render the interrupt panel: *"Interrupt UI is not part of it — compose `<chat-interrupt-panel>` yourself."* It became two Yours rows, which is the stronger claim anyway.
- **"Errors & retry"** had been held back as unverified. It is the opposite — `<chat>` renders `<chat-error>` with per-kind copy and a Retry button with zero configuration, across five classified error kinds. It is now the first row.
- **Keyboard & screen reader** stays off the list. Four components document accessibility; there is no overview page, no audit, no conformance claim. Reduced motion is genuinely implemented with a WCAG citation but only in code, so there is nothing to link. A tick would overclaim.

**Durable threads is LangGraph-only.** `persistence.mdx` says conversations survive "page refreshes, browser restarts, and server deployments", and also that event-stream adapters like `@threadplane/ag-ui` "typically cannot offer it". The row links to the LangGraph page so a reader lands on that context; the tick itself does not carry the caveat.

**The drift check is advisory.** `aimock-drift.yml` runs weekly against the live provider and is explicitly "never a merge gate". `CHECKED WEEKLY, LIVE` states frequency without implying it blocks releases.

## 4. What this replaces

- The **pitch ladder** from the previous spec. The checklist is the aviation device now; two would be one too many.
- The four **proof cells** as figures-with-captions. They become Airworthiness rows.
- The three **receipts** as a prose block. Provenance becomes a row; **runtimes** and **content telemetry** are dropped.

The **masthead**, **eyebrow**, **heading** and the **Vx/Vy aside** all stay. `#proof`, `#proof-heading` and `data-surface="dark"` are unchanged, so `e2e/website.spec.ts` stays green untouched.

## 5. Known, accepted

Recorded so they read as decisions rather than oversights:

- **Cloud and Signup duplicate the masthead**, which reads `MIT · ANGULAR 20–22 · NO ACCOUNT · NO CLOUD` about 200px above. Shipping as-is; the cleaner fix later is for the masthead to shed those and keep MIT.
- **The "no content telemetry" claim leaves the homepage.** It was a real differentiator for enterprise readers and now appears nowhere on the page.
- **The receipts' detail sentences are cut** — for example provenance's "npm attestations from OIDC trusted publishing, and a SLSA file on each release". A row cannot carry it.
- **Nine more STRONG items were available and did not fit**: multiple threads, subagents, generative UI, four layouts, the adapter conformance suite, dark mode, lifecycle timestamps, scriptable fake-agent events, MIT with no runtime key. The constraint is column length, not availability.

## 6. Accessibility

- The boxes are drawn `<span>`s, not `<input type="checkbox">`. Nothing here is a form control and none of it is interactive; presenting it as a form would mislead assistive tech into offering to toggle it.
- Ticked rows are `<a>`; Yours rows are `<div>` with no link, because no page proves that you set a cost ceiling.
- The animation is decorative. Under `prefers-reduced-motion: reduce` every tick applies at once with no transition.
- The tick sequence must not be the only signal that a row is ticked — the response colour changes too, so the state survives a user who never sees the animation.

## 7. Verification

- `npx nx test website`, `npx nx lint website`, `npx nx build website` — the CI commands.
- `npx nx e2e website`, with `#proof` assertions passing **unchanged**.
- Every `href` in the section resolves — including the two off-site registry links and the GitHub workflow link. A checklist whose proof 404s is worse than no checklist.
- Measured in a browser, not eyeballed: every box in a column shares one left edge, every response shares one right edge, and the row count matches the spec.
- At 390px the columns stack and the rows stay on one line each.
