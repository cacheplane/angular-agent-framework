# Campaign Spec — "Graded A for Trust"

> GTM distribution plan for the HVTrust Grade A announcement. Source content: the blog post
> `apps/website/content/blog/2026-06-24-threadplane-earns-grade-a-hvtrust.mdx`.
> Voice/messaging source of truth: `docs/gtm/voice.md`, `docs/gtm/messaging.md`, `docs/gtm/icp.md`.
> Tracking taxonomy: `docs/gtm/taxonomy.md`.

## 1. Objective & KPIs

Primary objective: **awareness that converts to adoption.** The blog post itself names adoption as
our weakest trust signal, so the campaign turns that candor into the ask.

| KPI | Baseline (Day 0) | Window | Source |
| --- | --- | --- | --- |
| GitHub stars | 99 | 14 days | github.com/cacheplane/angular-agent-framework |
| npm weekly downloads (`@threadplane/*`) | snapshot Day 0 | 14 days | npmjs + `ngaf:postinstall` (PostHog) |
| Referral sessions → blog + listing | 0 | 14 days | PostHog `$pageview` UTMs, `marketing:external_link_click` |
| Earned mentions | 0 | 14 days | manual (HN, Reddit, reposts, newsletters) |

**Measurement method:** snapshot stars + npm weekly downloads on Day 0 and Day 14. Every outbound
link carries `utm_campaign=grade-a-trust`. Honest caveat: stars/downloads are noisy and attribution
is fuzzy — read directionally.

## 2. Core narrative & guardrails

**The shareable paradox:** Threadplane ranks #7 of 75 agent frameworks on trust — above CrewAI,
AutoGen, and LangChain — with 99 stars against their tens of thousands. Independently graded, and we
name our own weak spot. This hook is credible (third-party) *and* earns the adoption ask.

**Guardrails:**
- **Do not claim "first OSSF product" or "first MIT-licensed framework."** Unprovable superlative;
  violates messaging.md's Avoid list and voice.md's no-hype rule. Use "OSSF-first / security-first
  posture." Decision (2026-06-24): the "first" framing is dropped entirely.
- Keep HVTracker's "not a safety endorsement" caveat visible on long-form channels — it is what makes
  the grade credible.
- Brian's voice on every post (voice.md): one thought per line, contractions, opinions flagged, no
  "blazing/game-changing/revolutionary."
- No logo walls, no progressive lead forms (messaging.md).

## 3. Assets (build once, reuse)

- [x] Blog post — `2026-06-24-threadplane-earns-grade-a-hvtrust.mdx`.
- [ ] HVTrust badge in repo README — `[![HVTrust](https://hvtracker.net/badge/threadplane.svg)](https://hvtracker.net/agents/threadplane)`.
- [ ] Repo "Website" field → `threadplane.ai` (backlink fix; HVTracker scrapes repo metadata).
- [ ] One branded social/OG card — leaderboard + "Grade A · 82.8" — via `marketing/assets`. Reused on X, LinkedIn, blog OG.
- [x] Canonical UTM link set (§6).

## 4. Channel plan & sequencing (~2-week drip)

| Day | Channel | Track | Angle | Mechanism |
| --- | --- | --- | --- | --- |
| 0 | Blog publish | both | Full story | Merge + deploy |
| 0 | X thread (Brian) | developer | The 99-stars-vs-trust paradox + card | Adapter (DRY_RUN → post) |
| 0 | LinkedIn (Brian) | enterprise | "Code you didn't write" supply-chain framing | Manual paste |
| 2 | Dev.to | developer | Full post, `canonicalUrl` → blog | Adapter (DRY_RUN → post) |
| 2 | Discord | developer | Casual honest breakdown | Manual |
| 4 | Hacker News (Brian) | developer | Technical supply-chain framing, NOT "look at our grade" | Manual |
| 4 | r/Angular + LangChain/AG-UI communities | developer | Value-first lesson, grade as evidence | Manual |
| 6–7 | Newsletter pitches (Angular Weekly, etc.) | developer | Short pitch + link | Manual |
| 7 | X follow-up (Brian) | developer | Amplify earned discussion / re-drive adoption ask | Adapter |
| 8–14 | Monitor, reply, repost top performer | — | — | — |

## 5. Per-channel angle briefs

- **X thread:** hook = paradox + card; middle = what HVTrust measures / why agent frameworks are
  higher-stakes / the honest weak signal; close = links + "help us close the gap."
- **LinkedIn:** architect voice; the verifiable credentials (MIT, signed commits, provenance); one CTA
  to the listing.
- **HN:** neutral technical title; Brian posts and stays in comments; honest caveat up front.
- **Reddit:** lead with the supply-chain lesson, grade as proof; respect r/angular self-promo norms.
- **Discord/newsletter:** short, warm, linked.

## 6. Tracking — canonical UTM link set

Blog slug: `threadplane-earns-grade-a-hvtrust`. Base: `https://threadplane.ai/blog/threadplane-earns-grade-a-hvtrust`.

| Channel | utm_source | utm_medium | Link |
| --- | --- | --- | --- |
| X | `x` | `social` | `…?utm_source=x&utm_medium=social&utm_campaign=grade-a-trust` |
| LinkedIn | `linkedin` | `social` | `…?utm_source=linkedin&utm_medium=social&utm_campaign=grade-a-trust` |
| Dev.to | `devto` | `referral` | canonicalUrl = bare blog URL (no UTM on canonical) |
| Hacker News | `hackernews` | `community` | `…?utm_source=hackernews&utm_medium=community&utm_campaign=grade-a-trust` |
| Reddit | `reddit` | `community` | `…?utm_source=reddit&utm_medium=community&utm_campaign=grade-a-trust` |
| Discord | `discord` | `community` | `…?utm_source=discord&utm_medium=community&utm_campaign=grade-a-trust` |
| Newsletter | `newsletter` | `referral` | `…?utm_source=newsletter&utm_medium=referral&utm_campaign=grade-a-trust` |

External targets (no PostHog UTM benefit, link plainly): listing
`https://hvtracker.net/agents/threadplane/`, leaderboard
`https://hvtracker.net/categories/agent-frameworks/`.

## 7. Execution mechanics

- Each social draft → `marketing/cowork/inbox/2026-06-24-grade-a-<channel>.json`, matching the `Draft`
  interface (`marketing/channels/src/types.ts`). Human-readable `_meta` keys carry campaign context.
- **X + Dev.to:** `DRY_RUN=1` smoke first → review → real post via adapter.
- **LinkedIn / Reddit / HN / Discord / newsletter:** adapters not built → ready-to-paste copy, posted
  by hand.
- Brian approves every draft before anything ships.

## 8. Risks

- HN promo backlash → technical framing, real human, honest caveat.
- Reddit self-promo rules → value-first, not headline-first.
- "First" overclaim → cut (see §2).
- Vanity-metric trap → stars aren't revenue; chosen because the goal is adoption and the post owns it.
  Enterprise leads are a watched secondary, not the goal.

## 9. Out of scope / follow-ups

- Building the LinkedIn + Reddit channel adapters (manual is fine for one campaign).
- Wiring the `/marketing` Cowork dispatch loop (still a stub).
