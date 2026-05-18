---
workstream: marketing-meta
status: approved
owner: brian
phase: 0
spec: docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md
parent: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md
supersedes: docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md#spec-6
---

# Marketing Meta (Design)

> Umbrella spec for the agentic marketing pipeline. Defines the `marketing/` directory, the five composable subsystems inside it, the interfaces between them, the sequencing, and the cross-cutting concerns (secrets, triggers, voice). No implementation lands here — each subsystem gets its own spec.

## 1. Goal

Stand up `marketing/` as a composable, agentic pipeline that turns source content (blog posts, releases, manual prompts, schedules) into multi-channel posts (X, LinkedIn, Dev.to, Reddit), with Cowork as the human approval surface and PostHog as the feedback loop. Replaces ad-hoc launches with a continuous motion.

This spec **supersedes Spec 6 (`community-launch`)** in the GTM meta. The marketing pipeline subsumes one-shot launch artifacts into the ongoing system. A short note in the GTM meta points here.

## 2. Context

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`. The GTM meta defines analytics, ICP, messaging, and the developer/enterprise CTA fork. This spec consumes those decisions; it does not redesign them.
- Cowork is a Claude skill surface (per `cowork/gtm/SKILL.md`), not a SaaS. The `/marketing` skill is a Claude skill that reads/writes structured files in `marketing/cowork/`.
- The PostHog `marketing:*` namespace already exists. This spec extends it with `marketing:social_*` events when the metrics subsystem ships.
- Voice + messaging come from this repo only: `docs/gtm/voice.md`, `docs/gtm/messaging.md`, `docs/gtm/icp.md`. No machine-local paths in any checked-in code.
- Existing repo conventions:
  - Scope: `@ngaf/*` for all internal + published packages. Privacy via `"private": true` in `package.json`.
  - Specs at `docs/superpowers/specs/<workstream>/YYYY-MM-DD-<topic>-design.md`.
  - Date-prefixed filenames everywhere (blog content, specs, plans).

## 3. Scope

**In scope (deliverables of this meta — see §10):**

- This spec.
- `marketing/README.md` — directory charter.
- Migration: `cowork/` → `marketing/cowork/`.
- `marketing/.env.example` — placeholder env vars for each channel.
- `docs/gtm/voice.md` — Brian's voice + tone reference, synthesized from his blog corpus.
- Skeleton `package.json` for each of the 5 internal packages, marked `"private": true`. Empty `index.ts`. Nx sees the workspace shape.
- A note in `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` pointing at this umbrella as the supersede for Spec 6.

**Out of scope (each is its own follow-up spec — see §6):**

- Brand asset rendering implementation.
- Channel adapter implementations (X, LinkedIn, Dev.to, Reddit).
- The drafting agent.
- The `/marketing` Cowork skill body.
- Metrics ingestion code.
- Replacing the existing `marketing:*` analytics events (the existing namespace stays; the metrics spec extends it).

## 4. Directory layout

```
marketing/
├── README.md                  # charter + index of sub-specs
├── .env.example               # placeholder secrets per channel
├── assets/                    # @ngaf/marketing-assets (sub-spec 1)
│   ├── package.json           #   "private": true
│   └── src/index.ts           #   empty in this spec
├── channels/                  # @ngaf/marketing-channels (sub-spec 2)
│   ├── package.json
│   └── src/index.ts
├── agent/                     # @ngaf/marketing-agent (sub-spec 3)
│   ├── package.json
│   └── src/index.ts
├── cowork/                    # Claude skills (migrated from /cowork)
│   ├── README.md              #   manual install instructions (updated path)
│   ├── gtm/
│   │   └── SKILL.md           #   existing GTM skill, content unchanged
│   ├── marketing/
│   │   └── SKILL.md           #   stub in this spec; body in sub-spec 4
│   ├── inbox/                 #   .gitkeep — drafts await review here
│   ├── outbox/                #   .gitkeep — approved + posted drafts
│   └── archive/               #   .gitkeep — rejected or expired
└── metrics/                   # @ngaf/marketing-metrics (sub-spec 5)
    ├── package.json
    └── src/index.ts
```

## 5. Subsystem charters + interfaces

Each subsystem is independent, composable, and has one clear job. The interfaces below are the contract — implementation can change behind them.

### 5.1 `@ngaf/marketing-assets` — Brand asset system

**Charter.** Renders branded social images (1200×630, 1200×1200, 1080×1080) from typed input. Single source of truth for visual tokens, motifs, typography. Built on Next.js `ImageResponse` so it shares runtime with the website's blog OG cards. Each template is a named TSX function under `assets/templates/`.

**Interface.**

```ts
import type { Buffer } from 'node:buffer';

export interface CardInput {
  template: 'x-announcement' | 'blog-og' | 'release' | 'linkedin-square' | string;
  title: string;
  subtitle?: string;
  tag?: string;
  author?: { name: string; role?: string };
}

export interface RenderedCard {
  png: Buffer;
  width: number;
  height: number;
  contentType: 'image/png';
}

export function renderCard(input: CardInput): Promise<RenderedCard>;
```

**Reuse.** The website's existing `/blog/[slug]/opengraph-image.tsx` and `/opengraph-image.tsx` migrate to call `renderCard()` once this package ships. Migration is a sub-spec deliverable, not in this meta.

### 5.2 `@ngaf/marketing-channels` — Channel adapters

**Charter.** One adapter per channel. Identical interface. Encapsulates auth, post, read metrics. Initial channels: X, LinkedIn, Dev.to, Reddit. Adding channels = adding adapter files.

**Interface.**

```ts
export type ChannelId = 'x' | 'linkedin' | 'devto' | 'reddit';

export interface Draft {
  channel: ChannelId;
  text: string;                   // channel-native (X = 280, LinkedIn = 3000, etc.)
  media?: { png: Buffer; alt: string }[];
  threadParts?: string[];         // for X threads — successive tweets
  link?: { url: string; previewTitle?: string };
  scheduledAt?: string;           // ISO; null = post now
}

export interface PostResult {
  channel: ChannelId;
  postId: string;
  url: string;
  postedAt: string;               // ISO
}

export interface PostMetrics {
  postId: string;
  impressions?: number;
  clicks?: number;
  replies?: number;
  shares?: number;
  fetchedAt: string;
}

export interface ChannelAdapter {
  readonly id: ChannelId;
  post(draft: Draft): Promise<PostResult>;
  metrics(postId: string): Promise<PostMetrics>;
}

export function getAdapter(id: ChannelId): ChannelAdapter;
```

**Dry-run.** Every adapter accepts `DRY_RUN=1` env var. In dry-run, `post()` returns a synthetic `PostResult` with `postId: 'dry-<uuid>'` and writes the draft to `marketing/cowork/outbox/` without hitting any API. Used by CI + safe local development.

### 5.3 `@ngaf/marketing-agent` — Content-drafting agent

**Charter.** LangGraph (JS SDK) agent that takes a `Trigger` + source context and emits N channel drafts. Reads `docs/gtm/voice.md`, `messaging.md`, `icp.md` for tone + claims. Writes output to `marketing/cowork/inbox/<id>.json`.

**Interface.**

```ts
export type Trigger =
  | { kind: 'blog-merge'; slug: string }
  | { kind: 'release'; tag: string }
  | { kind: 'cowork-prompt'; topic: string; freeform?: string }
  | { kind: 'cadence'; window: 'weekly' };

export interface DraftBundle {
  id: string;                     // YYYY-MM-DD-<short-slug>
  trigger: Trigger;
  drafts: Draft[];                // one per target channel
  source: { url?: string; title?: string; excerpt?: string };
  createdAt: string;
}

export function draft(trigger: Trigger): Promise<DraftBundle>;
```

**CLI.** `pnpm marketing draft --trigger=<kind> [args]`. Same entry point for git-action and cron invocations.

### 5.4 `marketing/cowork/marketing/SKILL.md` — Human approval surface

**Charter.** Claude skill that reads `inbox/<id>.json`, presents drafts in the conversation, lets the user edit/approve/reject. On approval, dispatches to channel adapters and moves the bundle to `outbox/<id>.json` with post results. On reject, moves to `archive/<id>.json`.

**Interface.** Skill markdown + file conventions (`inbox/`, `outbox/`, `archive/`). The `DraftBundle` JSON shape (defined in 5.3) is the single source-of-truth for what flows through.

### 5.5 `@ngaf/marketing-metrics` — Metrics ingestion

**Charter.** Reads `marketing/cowork/outbox/*.json`, calls each adapter's `metrics(postId)`, and emits PostHog events in the `marketing:*` namespace.

**Interface.**

```ts
export function run(opts?: { sinceHours?: number }): Promise<{ posts: number; eventsEmitted: number }>;
```

**CLI.** `pnpm marketing metrics --since-hours=24`. Cron-invoked daily. Stateless — re-reading the same outbox just re-emits the same events (PostHog's distinct-id-based dedup handles idempotency for impression deltas; this spec doesn't try to be smarter).

**New analytics events** (added in metrics sub-spec, not here):

- `marketing:social_impression` — props: `channel`, `post_id`, `count`
- `marketing:social_click` — props: `channel`, `post_id`, `destination_url`
- `marketing:draft_approved` — props: `channel`, `post_id`, `latency_seconds`
- `marketing:draft_rejected` — props: `channel`, `reason`

## 6. Sub-spec sequencing

```
[0] marketing-meta (this)
        │
        ▼
  [migrate cowork/ → marketing/cowork/]
        │
        ▼
[1] brand-assets ─────────┐
                          ▼
[2] channel-adapters ─▶ [3] content-agent ─▶ [4] cowork-loop ─▶ [5] metrics-ingest
```

| # | Sub-spec | Depends on | Exit |
|--:|----------|------------|------|
| 0 | marketing-meta (this) | — | This spec merged; `cowork/` migrated; voice.md committed; skeleton packages exist |
| 1 | brand-assets | 0 | `@ngaf/marketing-assets` builds; `renderCard()` produces PNGs for 2+ templates; website blog-OG route migrated to call it |
| 2 | channel-adapters | 0 | All 4 adapters implement `ChannelAdapter`; secrets loading works; dry-run post round-trip green for each channel |
| 3 | content-agent | 1, 2 | Agent produces channel-shaped drafts from a blog-merge trigger; output lands in `marketing/cowork/inbox/` |
| 4 | cowork-loop | 3 | `/marketing` skill installed; full draft→approve→post round-trip works end-to-end for one channel (X) |
| 5 | metrics-ingest | 4 | One full post's metrics flow back into PostHog `marketing:social_impression` + `social_click` |

**Critical path:** 0 → 2 → 3 → 4. Assets (1) is parallel to channels (2). Metrics (5) is a tail.

**v1 channel cut.** Adapter sub-spec can ship with X first and add the other 3 incrementally — each is a small follow-up commit, not a re-spec. X first matches Brian's existing audience and the most concrete launch target.

## 7. Cross-cutting concerns

### 7.1 Secrets

Channel API tokens live in `.env` at repo root (already gitignored). Each adapter reads its own keys via `process.env`:

```
X_API_KEY=
X_API_SECRET=
X_ACCESS_TOKEN=
X_ACCESS_SECRET=
LINKEDIN_ACCESS_TOKEN=
LINKEDIN_AUTHOR_URN=
DEVTO_API_KEY=
REDDIT_CLIENT_ID=
REDDIT_CLIENT_SECRET=
REDDIT_USERNAME=
REDDIT_PASSWORD=
```

`marketing/.env.example` lists every required key with a one-line comment. For production cron, secrets come from the host (GitHub Actions secrets — exact configuration is in the cowork-loop or metrics sub-spec, not here).

### 7.2 Triggers

Three trigger sources, one entry point (`pnpm marketing draft`):

1. **Source-content merge** — A new blog post or release tag lands on main. GitHub Action runs `pnpm marketing draft --trigger=blog-merge --slug=<slug>`. Action file ships in sub-spec 3.
2. **Manual Cowork prompt** — `/marketing draft <topic>` in Claude. The skill writes a small trigger file and invokes the CLI.
3. **Scheduled cadence** — GitHub Actions cron, weekly. `pnpm marketing draft --trigger=cadence --window=weekly`.

All converge on the same `draft()` entry point in `@ngaf/marketing-agent`.

### 7.3 File conventions

```
marketing/cowork/
  inbox/<id>.json       # drafts awaiting review (agent writes, skill reads)
  outbox/<id>.json      # approved + posted (skill writes, includes PostResult[])
  archive/<id>.json     # rejected or expired (skill writes)
```

`<id>` is `YYYY-MM-DD-<short-slug>` — date-prefixed, like blog posts. The JSON shape is `DraftBundle` (defined in 5.3). One JSON file per pipeline run, regardless of how many channels it produced drafts for.

### 7.4 Voice + messaging source-of-truth

The agent reads three files **in this repo only**:

- `docs/gtm/voice.md` — Brian's tone, phrasing, structural quirks (NEW in this spec)
- `docs/gtm/messaging.md` — positioning, claims, no-go phrases (existing)
- `docs/gtm/icp.md` — audience (existing)

Zero references to `~/repos/brianflove/*` or any machine-local path in checked-in code or specs. Reproducible on CI.

`voice.md` is synthesized once from Brian's blog corpus by a one-shot subagent task and committed to this repo. Subsequent voice tuning happens by editing `voice.md` directly.

## 8. Architecture

```
   ┌─────────────┐   trigger    ┌─────────────┐   reads   ┌──────────────┐
   │ GH Action / │ ───────────▶ │  agent      │ ────────▶ │ voice.md     │
   │ cron / CLI  │              │ (draft())   │           │ messaging.md │
   └─────────────┘              └──────┬──────┘           │ icp.md       │
                                       │ writes           └──────────────┘
                                       ▼
                                ┌─────────────┐
                                │ inbox/<id>  │
                                │   .json     │
                                └──────┬──────┘
                                       │ /marketing skill reads
                                       ▼
                                ┌─────────────┐
                                │  Cowork     │ ── user approves / edits / rejects
                                │  (Claude)   │
                                └──────┬──────┘
                                       │ on approve: dispatch adapters
                                       ▼
                          ┌───────────────────────┐
                          │  channel adapters     │
                          │  X · LI · Dev · Rdt   │
                          └──────┬────────────────┘
                                 │ writes
                                 ▼
                          ┌─────────────┐
                          │ outbox/<id> │
                          │   .json     │
                          └──────┬──────┘
                                 │ metrics CLI reads (cron)
                                 ▼
                          ┌─────────────┐
                          │ PostHog     │
                          │ marketing:* │
                          └─────────────┘
```

Asset rendering hangs off the agent (drafts include an asset spec; the agent calls `renderCard()` and embeds the PNG bytes in `Draft.media`).

## 9. Risks + non-goals

| # | Risk | Mitigation | Owner |
|--:|------|------------|-------|
| 1 | Channel APIs change underneath us (esp. X) | One adapter file per channel; each is small enough to rewrite in a day | Sub-spec 2 |
| 2 | Auto-posting goes off the rails | Every dispatch is gated by Cowork approval; no auto-post path in v1 | Sub-spec 4 |
| 3 | Voice file ages out of date | One-line drafting checklist at bottom of `voice.md`; revisit quarterly | This spec (subagent) |
| 4 | Metrics get noisy or wrong | Single namespace + draft_id correlation makes it easy to filter; v1 doesn't try to be smarter than that | Sub-spec 5 |
| 5 | The agent over-produces channel-specific drafts that all sound the same | Channel-specific prompts per adapter; voice.md provides shape, channel adapter prompts provide format | Sub-spec 3 |

**Non-goals (v1):**

- Multi-author voice (only Brian).
- Multi-tenant (single Cacheplane).
- Engagement automation (replies, DMs, comment threads). Out of scope and likely permanently.
- A web UI for approvals — Cowork is the UI.
- Analytics dashboards specific to social. Existing developer-funnel + marketing dashboards consume the new events; no new dashboard JSON in v1.

## 10. Deliverables (of this meta-spec)

- ☐ This spec at `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
- ☐ `marketing/README.md` — directory charter, links to sub-specs, install/run quickstart
- ☐ Migrate `cowork/` → `marketing/cowork/` (single `git mv` + README path update + `cowork/{inbox,outbox,archive}/.gitkeep`)
- ☐ `marketing/.env.example` — placeholder env var names for each channel
- ☐ `docs/gtm/voice.md` — Brian's voice + tone reference (synthesized by subagent)
- ☐ Skeleton `package.json` + `src/index.ts` for: `@ngaf/marketing-assets`, `@ngaf/marketing-channels`, `@ngaf/marketing-agent`, `@ngaf/marketing-metrics`. All `"private": true`. Each exports an empty interface so Nx + tsconfig paths resolve.
- ☐ Each skeleton package has a `project.json` so `nx graph` sees it.
- ☐ Note appended to `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md` pointing at this umbrella as the supersede for Spec 6.

## 11. References

- Parent: `docs/superpowers/specs/gtm/2026-05-13-gtm-meta-design.md`
- Existing Cowork skill: `cowork/gtm/SKILL.md` (to be moved)
- Existing analytics: `apps/website/src/lib/analytics/events.ts`, `docs/gtm/taxonomy.md`
- Blog seed post (first content this pipeline will syndicate): `apps/website/content/blog/2026-05-17-build-a-streaming-chat-ui-in-angular-with-langgraph.mdx`
