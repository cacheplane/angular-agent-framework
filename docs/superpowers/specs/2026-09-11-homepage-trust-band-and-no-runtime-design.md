# The trust band shrinks, and a No-runtime band lands after the architecture diagram

**Date:** 2026-09-11
**Status:** Approved in conversation, awaiting written review
**Branch:** `blove/homepage-trust-no-runtime`
**Supersedes:** the two-column checklist in `2026-09-08-preflight-checklist-design.md` §2 (the Airworthiness block survives; the Threadplane and Yours columns do not)

## 1. Why

Two homepage changes, argued together because they trade against each other.

**The preflight checklist is too long.** Twenty-seven rows at 33px, roughly 1,100px of dark band on desktop, and the section's job was to communicate final-mile completeness and trust. The Threadplane column had become a feature list, and the Yours column, the part that made the section honest, only made sense beside it. Both come out. What stays is the only part of the band that is not self-reported: the third-party scores.

**The site never says "no runtime."** Threadplane's adapters call your LangGraph or AG-UI server from the browser. There is no Threadplane server between the two, no key to obtain, no dev-only flag to reach for, and no licence tier to unlock production. Other agent UI kits in the same space ship a "runtime" of their own, and the research behind this spec (recorded in the session notes, not in the repo, because competitors are never named in tracked files) established the shape of the claim we can make honestly:

- One widely used kit documents its runtime as "the backend layer that connects your frontend application to your AI agents" and the recommended way to use it. Its free path to a direct AG-UI connection is a prop whose name ends in `unsafe_dev_only`, documented as "intended for development and prototyping" and "not officially supported." Its production-sanctioned direct path is labelled part of a paid Enterprise tier. Without its runtime, its own comparison table lists auth as yours, its middleware as "Not available," routing as manual, and threads as unavailable.
- A newer kit's client now speaks AG-UI directly and can target any AG-UI server, but its agent loop, server tools, approval pause and resume, client-tool round trip, structured-output enforcement, persistence and resume, and MCP support all live in its server call. Its own migration guide says whether a foreign server invokes client tools "depends on its tool-calling logic."

So the honest claim is **"no runtime, and nothing degrades,"** not "nobody else can do this." The band makes the first claim and stays silent on the second.

**What the words mean here.** "Runtime" means a server component shipped by the UI vendor that sits between the browser and your agent. It does not mean your agent's own runtime, which the architecture diagram directly above already labels as yours. `@threadplane/middleware` is not a runtime in this sense: it runs inside your LangGraph graph, binding browser-declared tools onto your model and routing client-tool turns back to the browser. Nothing of ours handles the request in flight.

## 2. Section 1: the trust band

`components/landing/Reliability.tsx` keeps its id `#proof`, its `dark` surface, the masthead line, the watermark, the eyebrow **Climb performance**, and the heading **Audited, scored, published.** with id `proof-heading`. The spine e2e in `e2e/website.spec.ts` stays green without edits.

### 2.1 What comes out

- `PREFLIGHT_OURS` (11 rows) and `PREFLIGHT_YOURS` (8 rows), their column headings, the two-column grid, and the `.preflight-cols` / `.preflight-yours` CSS.
- The three self-reported Airworthiness rows: Cloud, Signup, VC board. The masthead 200px above already says "no account, no cloud," the FAQ says no hosted service, and the About page carries the rest.
- The spec assertion that pinned the Yours column length, and the checklist spec's "claims nothing in the Yours column" case.

### 2.2 What stays

A single list of five rows, one column, every row linked to its source, in this order:

| Challenge | Response | Source |
| --- | --- | --- |
| Framework rank | #11 OF 122 (live value on 2026-09-11; drifts) | hvtracker.net categories |
| OpenSSF Scorecard | 8.3 / 10 (live value on 2026-09-11; drifts) | scorecard.dev |
| Supply-chain grade | live HVTrust badge | hvtracker.net/agents |
| Angular support | 20–22 CI-TESTED (derived) | npmjs.com |
| Release provenance | SIGNED · OIDC · SLSA | npmjs.com |

Rank and score drift. Re-verify both against the live pages on touch, never round up. The badge stays a live `<img>` with real alt text. The Angular range stays derived from `WEBSITE_SUPPORTED_ANGULAR_MAJORS`, and the mutation-style guard that proves it is derived stays.

The data module `lib/preflight-checklist.ts` shrinks to the one export, `AIRWORTHINESS`, and its header comment is rewritten for the new shape. The renderer `PreflightChecklist.tsx` keeps the tick sequence, the IntersectionObserver trigger, and the reduced-motion path, now over five rows. The list keeps a visible label so it is named for assistive tech; the label text becomes **Airworthiness** as before, and the `.preflight-cols + .preflight-col-head` spacing rule is deleted with the columns.

The aside beneath the heading is rewritten because Vx/Vy framed a two-column climb: **"Not self-reported. Every figure links to the body that published it."**

Height on desktop drops from roughly 1,100px to roughly 450px.

### 2.3 Guards

- `preflight-checklist.spec.ts`: five rows, every row linked, human-readable sources only, live badge, derived Angular range. The length assertion stays, because a row added without a source is the failure mode this list exists to prevent.
- `PreflightChecklist.spec.tsx`: one row per data row, every row an `<a>`, no form controls, one labelled list, badge alt text, safe external links.
- `Reliability.spec.tsx`: masthead first, id and surface, eyebrow and heading, no customer-claim vocabulary, and the new aside text.

## 3. Section 2: the No-runtime band

A new `components/landing/NoRuntimeBand.tsx`, inserted in `app/page.tsx` between `<EnterpriseArchitecture />` and `<OpenSourceStrip />`. Section id `no-runtime`, heading id `no-runtime-heading`, surface `dark`.

### 3.1 Layout

The split chosen in the visual companion. Two columns on desktop, copy left and diagram right, vertically centred against each other.

**Left column**

- Eyebrow, in the Fork-us eyebrow treatment (mono, 11px, 0.18em, signal yellow): **Cleared direct**. Controller phraseology for a clearance straight to a fix, skipping the intermediate ones. Texture, like "Squawk 1200": the headline carries the meaning.
- Headline, in the Fork-us display treatment (Archivo Black, clamp 56px to 116px, line-height 0.9): **No runtime.**
- One supporting sentence, 17px, max-width around 480px: **"Your users reach your LangGraph or AG-UI server from your Angular app. Nothing of ours in between: no cloud, no key, no dev-only flag."**
- One text link in signal yellow, no button: **How it is wired →** to `/docs/choosing-an-adapter`, the page that already states the adapters talk to your server directly. Tracked with a new `CtaId` member `home_no_runtime_docs`, `track: 'developer'`, `surface: 'home'`.

No licence chip and no button, so the band stays lighter than Fork-us and the two dark bands do not read as one.

**Right column: two vertical flows**, side by side, each under a mono column label:

| The usual | Threadplane |
| --- | --- |
| Your users | Your users |
| ↓ grey | ↓ yellow, taller |
| Their runtime (dashed border, muted, struck through) | Your agent (yellow border) |
| ↓ grey | |
| Your agent (yellow border) | |

Nodes are mono, uppercase, 12px, bordered boxes with a fixed min-width so the two columns align. "Your users" echoes the first column label of the architecture diagram directly above. The ghost node is the only dashed, struck-through element on the page, which is what makes it read as "not here."

The diagram is plain HTML and CSS, not SVG: three boxes and two arrows do not need the diagram kit, and HTML keeps the text selectable and the nodes measurable with `getBoundingClientRect`.

**The runway stripe** runs along the foot of the band, the same 46px-on-92px marking as Fork-us, so the two dark bands rhyme.

**Under 820px** the columns stack: copy first, then the two flows side by side beneath it. **Under 480px** the flows themselves stack, "The usual" above "Threadplane." Node text never wraps.

### 3.2 Accessibility

- The section is labelled by its heading. The flow diagram is one `<figure>` with a `<figcaption>` that reads the same two flows in prose, visually hidden: **"The usual path runs from your users through the vendor's runtime to your agent. With Threadplane your users reach your agent directly."** The arrows and the strikethrough are decorative (`aria-hidden`).
- The struck-through node keeps the word visible; the strikethrough is not the only signal, the dashed border and muted colour carry it too.
- No motion.

### 3.3 Copy lives in one place

`lib/positioning.ts` gains `NO_RUNTIME_BAND` beside `OPEN_SOURCE_STRIP`: eyebrow, headline, body, link label, link href, the two column labels, the three node labels, and the figure caption. The component reads only from it. `positioning.spec.ts` pins the eyebrow, the headline, the 12-character headline budget from the Fork-us test, the link href, and that the body says "no cloud" and never says "no proxy" (the one wording this spec reversed on purpose).

### 3.4 Copy rules honoured

- No competitor is named anywhere: not in copy, not in comments, not in the spec, not in the plan.
- "No cloud" rather than "no proxy." Putting your agent behind your own proxy is something the docs tell you to do, so "no proxy" would be false. "No cloud" is true and matches the masthead.
- "No dev-only flag" and "no key" are literal descriptions of what Threadplane does not have. They are not claims about anyone else.
- None of the barred patterns in `lib/public-copy-contract.ts` appear. The source scan in `public-copy.spec.ts` covers the new strings automatically.

### 3.5 Guards

- `NoRuntimeBand.spec.tsx`: renders the eyebrow, headline and body from `NO_RUNTIME_BAND`; exactly one `<a>` in the section; the section is `dark` with id `no-runtime`; the figure has a caption; the ghost node exists once and the "Threadplane" flow has no ghost; the runway is a sibling of the container, not inside it, mirroring the Fork-us guard.
- `e2e/website.spec.ts`: the spine array gains `no-runtime-heading` between `architecture-heading` and `open-source-heading`.
- A new `e2e/home-no-runtime.spec.ts`: at 1440px the two flow columns' node boxes share a left edge per column and no node text overflows its box; at 390px the flows stack and every node still fits its box. This follows the measure-not-eyeball rule the architecture e2e set.

## 4. Section 3: one FAQ entry

`HomeFAQ.tsx` gains a fifth item after "Does Threadplane require a hosted service or an account?":

**Q:** Does Threadplane have a runtime I need to deploy?
**A:** No. The adapters call your LangGraph or AG-UI server from the browser. There is no Threadplane server in the request path, no key, and no production tier. Link: **How it is wired** → `/docs/choosing-an-adapter`.

`HomeFAQ.spec.tsx` gains an assertion for the new question and, if it pins the item count, moves it to five. The wording stays inside the public-copy contract.

## 5. Order of the spine after this change

hero → proof (trust band) → compatibility → architecture → **no-runtime** → open-source → stage → teams → FAQ → articles.

Two dark bands now sit back to back. Each dark section paints its own 1px yellow seam at its top edge, and the No-runtime band has no button while Fork-us has one, so the boundary reads. This is a deliberate choice, recorded here so it is not mistaken for an accident. If it reads as one tall block in the browser, the fallback is to drop the runway stripe from the No-runtime band and keep it on Fork-us only.

## 6. Known, accepted

- **The Yours column argument leaves the homepage.** The product boundary (server-generated thread IDs, keys never in the bundle, CORS is yours) is now stated only in the docs. The No-runtime band carries the sharper half of that argument.
- **The homepage loses its list of product capabilities in checklist form.** The Stage section's four beats and the architecture diagram's capability links remain the capability surface.
- **The comparison is implied, never drawn against a named product.** A reader who does not know other kits ship a runtime reads the band as a plain fact about Threadplane, which is fine: it is one.

## 7. Verification

- `npx nx test website`, `npx nx lint website`, `npx nx build website`. Lint and test do not typecheck; only the build does, so the build is not optional.
- `npx nx e2e website` with the spine test, the new No-runtime e2e, and the existing `#proof` assertions passing.
- Every `href` in both sections resolves, including the four off-site registry links.
- Measured, not eyeballed: the trust band's five boxes share one left edge and five responses share one right edge; the No-runtime nodes share edges per column at 1440px and stack cleanly at 390px.
- Rank and Scorecard figures re-read from the live pages on the day of the PR.
