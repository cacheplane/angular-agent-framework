# marketing/

Internal publishing tools and operator materials for Threadplane. Growth owns contacts, authorization, observations, and lifecycle outcomes; these tools render assets and publish operator-approved content. See the [Growth architecture and operations guide](../docs/growth/README.md) for ownership and commands.

## Structure

```
marketing/
├── assets/      # @threadplane-internal/marketing-assets    — branded image rendering
├── channels/    # @threadplane-internal/marketing-channels  — X and Dev.to adapters
└── cowork/      # GTM operator skill and retained campaign drafts/assets
```

Both packages are internal (`"private": true`) and are not published to npm. There is no autonomous drafting agent, feedback worker, or campaign scheduler in this directory. LinkedIn and Reddit drafts remain available for manual publishing.

## Operator workflow

Use [assets](assets/README.md) to render cards and [channels](channels/README.md) to publish approved drafts. Set `DRY_RUN=1` to write simulated posts to `tmp/marketing/dry-runs/` relative to the working directory. Set `MARKETING_DRY_RUN_DIR` to choose a different relative or absolute directory.

The [GTM skill](cowork/README.md) documents reporting and triage. PostHog measurement lives in `tools/posthog/`; Growth lifecycle state remains in Growth. Historical marketing specs under `docs/superpowers/` describe earlier proposals, not current runtime components.

## Voice + messaging source-of-truth

- `docs/gtm/voice.md` — Brian's tone, phrasing, structural quirks
- `docs/gtm/messaging.md` — positioning, claims, no-go phrases
- `docs/gtm/icp.md` — audience

All in this repo. No machine-local paths in checked-in code.
