# PostHog dashboards-as-code

> Skeleton. Implementation lands in Spec 1 (`analytics-foundation`).
> The convention is locked here so contributors authoring dashboards know the shape.

## What this directory is

PostHog is configured via a Public-API-driven sync script — not through the PostHog UI. Every dashboard, insight, cohort, and funnel that GTM relies on is a JSON file in this directory. The sync script reconciles JSON ↔ PostHog. Git is the source of truth.

## Directory layout

```
tools/posthog/
├── sync.ts                       # Idempotent upsert. (Spec 1 implements.)
├── report.ts                     # Weekly markdown export. (Spec 1 implements.)
├── schema/
│   ├── dashboard.json            # JSON Schema for dashboards/*.json
│   ├── insight.json              # JSON Schema for insights/*.json
│   └── cohort.json               # JSON Schema for cohorts/*.json
├── dashboards/                   # One JSON per dashboard
│   ├── developer-funnel.json
│   ├── enterprise-funnel.json
│   ├── activation-six-signals.json
│   ├── content-intent.json
│   └── package-telemetry.json
├── insights/                     # Reusable insight specs referenced by dashboards
└── cohorts/                      # Cohort specs (e.g. "Activated developers")
```

## JSON contract

Each artifact is declarative content + a server-assigned `posthog_id` (written back after first sync).

```jsonc
// tools/posthog/dashboards/developer-funnel.json
{
  "$schema": "../schema/dashboard.json",
  "slug": "developer-funnel",                  // local id, stable across syncs
  "posthog_id": null,                          // assigned by sync; do not edit
  "name": "GTM · Developer funnel",
  "description": "Pageview → install → cockpit activation. Source: gtm.md §4.",
  "tags": ["gtm", "developer-track", "phase-1"],
  "tiles": [
    { "insight": "pageviews-by-landing" },
    { "insight": "install-command-clicks" },
    { "insight": "cockpit-recipe-completion" },
    { "insight": "six-signal-activation-funnel" }
  ]
}
```

```jsonc
// tools/posthog/insights/six-signal-activation-funnel.json
{
  "slug": "six-signal-activation-funnel",
  "posthog_id": null,
  "kind": "funnel",
  "window_minutes": 30,
  "steps": [
    { "event": "cockpit:install_command_copied" },
    { "event": "cockpit:transport_connected" },
    { "event": "cockpit:chat_first_message" },
    { "event": "cockpit:thread_persisted" },
    { "event": "cockpit:interrupt_handled" },
    { "event": "cockpit:generative_component_rendered" }
  ]
}
```

The funnel's six steps are the canonical "six signals." `cockpit:recipe_start` and `cockpit:six_signals_complete` exist as diagnostic events (session entry and "all six completed within window") but are not funnel steps.

Event names must match `docs/gtm/taxonomy.md`. CI guards reject dashboards that reference unknown events.

## CLI

```bash
npm run posthog:sync -- --plan     # Diff against PostHog, no writes.
                                    # Outputs [create] [update] [no-op] [orphan] per artifact.
                                    # CI runs this on every PR.

npm run posthog:sync -- --apply    # Idempotent upsert.
                                    # Re-running with no JSON change = no-op.

npm run posthog:sync -- --apply --delete-orphans
                                    # Explicit, manual. Deletes PostHog artifacts
                                    # that have no matching JSON. Never auto.

npm run posthog:report             # Pull insights → write docs/gtm/reports/<date>-weekly.md.
```

Also exposed as Nx targets on a synthetic `gtm` project (`tools/gtm/project.json`).

## Sync semantics

- **Plan vs. apply.** `--plan` mutates nothing; `--apply` upserts.
- **Idempotent.** Re-applying with no JSON change is a no-op.
- **Orphan handling.** Items in PostHog with no JSON are reported on every plan/apply but never auto-deleted. Use `--apply --delete-orphans` to drop them, or commit a tombstone JSON.
- **`posthog_id` writeback.** After first apply, the sync script writes the assigned id back into each JSON. Commit the writeback as a follow-up.
- **Missing API key in CI.** Sync skips with a warning, not a failure — so contributor PRs without secrets pass.

## Adding a new dashboard

1. Create `tools/posthog/dashboards/<slug>.json` following the contract above.
2. Reference insights by `slug` only. Define them in `insights/<slug>.json` if they don't exist.
3. Run `npm run posthog:sync -- --plan` locally.
4. Commit the JSON and open a PR.
5. After merge, run `npm run posthog:sync -- --apply` (or wait for the deploy hook — TBD in Spec 1).
6. Commit the `posthog_id` writeback.

## Why dashboards-as-code

- **`git blame` answers "who changed this metric and why."**
- **No clicking through the PostHog UI** = "api/cli-first agentic GTM" actually delivers.
- **Reproducible on a fresh PostHog project** for staging/test envs.
- **Reviewable in PRs** like any other change.
