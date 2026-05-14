# PostHog dashboards-as-code

> Spec: [analytics-foundation-1a-dashboards-as-code](../../docs/superpowers/specs/gtm/2026-05-14-analytics-foundation-1a-dashboards-as-code-design.md).

PostHog is configured via a Public-API-driven sync script — not through the PostHog UI. Every dashboard, insight, and cohort the GTM motion depends on is a JSON file in this directory. The sync tool reconciles JSON ↔ PostHog. Git is the source of truth.

## Directory layout

```
tools/posthog/
├── project.json                    # Nx project (posthog-tools)
├── env.ts                          # zod-validated env parsing
├── client.ts                       # openapi-fetch wrapper
├── schema.ts                       # zod schemas for local JSON
├── sync.ts                         # CLI: plan / apply / writeback
├── report.ts                       # CLI: pull insights → markdown
├── *.spec.ts                       # tests
├── types/posthog-api.gen.ts        # generated from PostHog OpenAPI spec
├── scripts/generate-types.ts       # regenerate the above
├── dashboards/*.json               # one JSON per dashboard
├── insights/*.json                 # reusable insight specs
└── cohorts/                        # currently empty; populated post-1A
```

## CLI

All commands wrap `nx run posthog-tools:*`. Root-package aliases:

```bash
npm run posthog:sync       # → nx run posthog-tools:sync:plan
npm run posthog:apply      # → nx run posthog-tools:sync:apply
npm run posthog:report     # → nx run posthog-tools:report
npm run posthog:generate-types  # → regenerate types/posthog-api.gen.ts
```

Direct Nx invocations work too:

```bash
nx run posthog-tools:sync:plan
nx run posthog-tools:sync:apply
nx run posthog-tools:sync:apply --args="--delete-orphans"
nx run posthog-tools:test
nx run posthog-tools:lint
```

## Auth

Requires a **Personal API Key** with `dashboard:write`, `insight:write`, `cohort:write`, `project:read` scopes. Create one at https://us.posthog.com/me/settings#personal-api-keys.

Env vars (see `.env.example` at repo root):

| Variable | Purpose |
|----------|---------|
| `POSTHOG_PERSONAL_API_KEY` | Personal API Key (Bearer) |
| `POSTHOG_HOST` | `https://us.i.posthog.com` (default) or your region |
| `POSTHOG_PROJECT_ID` | Numeric project id (visible in PostHog URL) |

**CI** uses the same key (write-scoped) for `--plan` only. **Production hardening TODO:** create a read-only Personal API Key for CI and add it as `POSTHOG_PERSONAL_API_KEY_READONLY` in GitHub Actions secrets. Local development continues using the write-scoped key for `--apply` and `--report`.

## JSON contract

```jsonc
// tools/posthog/dashboards/developer-funnel.json
{
  "slug": "developer-funnel",                  // local id, stable across syncs
  "posthog_id": null,                           // assigned on first sync; do not edit
  "name": "GTM · Developer funnel",
  "description": "Pageview → install → cockpit activation.",
  "tags": ["gtm", "developer-track"],
  "tiles": [
    { "insight": "pageviews-by-landing" },
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
    { "event": "cockpit:transport_connected" }
  ]
}
```

Event names must match [`docs/gtm/taxonomy.md`](../../docs/gtm/taxonomy.md). The `taxonomy.spec.ts` test enforces this on every CI run.

## Sync semantics

- **`--plan`** — diff against PostHog, no writes. Outputs `[create] [update] [orphan]` per artifact. CI runs this on every PR that affects `posthog-tools`.
- **`--apply`** — idempotent upsert via PATCH. Re-running with no JSON change is a no-op (PostHog dedupes).
- **`--apply --delete-orphans`** — explicit deletion of remote artifacts that have no local JSON. Never automatic.
- **`posthog_id` writeback** — first successful create writes the assigned PostHog id back into the JSON. Commit the writeback as `chore(posthog): writeback ids for <slugs>`.

## Renaming an artifact

To rename without losing the PostHog id:

1. Edit the `slug` field in the JSON, keeping `posthog_id` unchanged.
2. **Do not move the file** — the file path is the slug source.
3. `npm run posthog:sync` will detect this as an update, not a create + orphan.

## Regenerating types

PostHog publishes their full Public API as OpenAPI 3 at `https://us.posthog.com/api/schema/`. We commit the generated TypeScript types to avoid network calls at build time. Refresh quarterly:

```bash
npm run posthog:generate-types
```

Review the diff carefully — field renames in PostHog's API will surface here.

## Why dashboards-as-code

- `git blame` answers "who changed this metric and why."
- No clicking through the PostHog UI ("api/cli-first" actually delivers).
- Reproducible on a fresh PostHog project for staging/test envs.
- Reviewable in PRs like any other change.
- `taxonomy.spec.ts` prevents dashboards from referencing events the taxonomy doesn't document.

## See also

- [gtm.md](../../gtm.md) — durable strategy
- [docs/gtm/taxonomy.md](../../docs/gtm/taxonomy.md) — event names
- [cowork/gtm/SKILL.md](../../cowork/gtm/SKILL.md) — operates this CLI weekly
