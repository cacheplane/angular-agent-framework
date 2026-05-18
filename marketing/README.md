# marketing/

Agentic marketing pipeline. Five composable subsystems that turn source content (blog posts, releases, prompts, schedules) into multi-channel posts (X, LinkedIn, Dev.to, Reddit), with Cowork as the human approval surface and PostHog as the feedback loop.

## Structure

```
marketing/
├── assets/      # @ngaf/marketing-assets    — branded image rendering
├── channels/    # @ngaf/marketing-channels  — X, LinkedIn, Dev.to, Reddit adapters
├── agent/       # @ngaf/marketing-agent     — LangGraph drafting agent
├── cowork/      # Claude skills (/gtm, /marketing) + inbox/outbox/archive
└── metrics/     # @ngaf/marketing-metrics   — feedback ingestion → PostHog
```

All four packages are internal (`"private": true`). They are NOT published to npm.

## Specs

- Meta (this umbrella): `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md`
- Sub-specs (when written):
  - `brand-assets` — `docs/superpowers/specs/marketing/<date>-brand-assets-design.md`
  - `channel-adapters` — `docs/superpowers/specs/marketing/<date>-channel-adapters-design.md`
  - `content-agent` — `docs/superpowers/specs/marketing/<date>-content-agent-design.md`
  - `cowork-loop` — `docs/superpowers/specs/marketing/<date>-cowork-loop-design.md`
  - `metrics-ingest` — `docs/superpowers/specs/marketing/<date>-metrics-ingest-design.md`

## Voice + messaging source-of-truth

- `docs/gtm/voice.md` — Brian's tone, phrasing, structural quirks
- `docs/gtm/messaging.md` — positioning, claims, no-go phrases
- `docs/gtm/icp.md` — audience

All in this repo. No machine-local paths in checked-in code.

## Status

This directory was scaffolded by the marketing-meta spec. Subsystems are skeletons. Implementation lands as each sub-spec ships.
