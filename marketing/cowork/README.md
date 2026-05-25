# Threadplane GTM — Cowork skill

A single Claude Cowork skill that operates Threadplane's GTM motion: weekly PostHog snapshots, lead triage, workstream scaffolding, and "where are we?" status questions.

The skill is **project-local**. It isn't published to a marketplace. Install steps are manual and one-time per machine.

## What's in this directory

```
marketing/cowork/
├── README.md           # This file.
├── gtm/
│   └── SKILL.md        # The GTM Cowork skill.
├── marketing/
│   └── SKILL.md        # The marketing pipeline Cowork skill (stub; body in sub-spec 4).
├── inbox/              # Drafts awaiting review.
├── outbox/             # Approved + posted drafts.
└── archive/            # Rejected or expired drafts.
```

## Install (one-time per machine)

The skill ships as `marketing/cowork/gtm/SKILL.md`. To make it loadable by Cowork / Claude Code on your machine, register it as a user-level skill:

```bash
mkdir -p ~/.claude/skills/gtm
cp marketing/cowork/gtm/SKILL.md ~/.claude/skills/gtm/SKILL.md
```

Or symlink it so edits in this repo flow through immediately:

```bash
mkdir -p ~/.claude/skills/gtm
ln -sf "$(pwd)/marketing/cowork/gtm/SKILL.md" ~/.claude/skills/gtm/SKILL.md
```

Verify: open a Claude Code session in this repo and type `/gtm`. The skill should load and announce its responsibilities.

## Invoke

- `/gtm` — drops into the GTM operator. Examples of what to ask:
  - *"Run the weekly snapshot procedure."*
  - *"Triage these inbound leads against the qualified-lead definition."*
  - *"Scaffold a new workstream spec for `posthog-experiments`."*
  - *"Where are we on comparison pages?"*

## Schedule (optional, one-time per machine)

Cowork has no in-repo scheduling primitive. To run the weekly snapshot automatically every Monday at 9am, create a routine once per machine:

```bash
/schedule create weekly-snapshot 'every Monday 9am' /gtm "run the weekly snapshot procedure"
```

The routine itself lives at the user/runtime layer; it is not committed to the repo. The instruction to create it lives here.

## Update

Edit `marketing/cowork/gtm/SKILL.md` in this repo. If you symlinked, the change is live immediately. If you copied, re-run the `cp` command after committing.

## Why one skill, not a plugin

- **One file to grok** — anyone reading the repo can see what GTM operations look like.
- **No plugin packaging ceremony** until the motion proves out and we want to ship it as `@threadplane/gtm-plugin` for other Angular agent startups to adopt.
- **No per-workstream subagents** until context bleed proves to be a problem. Splitting later is a one-day refactor.

## See also

- [gtm.md](../gtm.md) — durable strategy
- [docs/gtm/](../docs/gtm/) — operational docs (ICP, messaging, taxonomy)
- [docs/superpowers/specs/gtm/](../docs/superpowers/specs/gtm/) — per-workstream design specs
- [tools/posthog/README.md](../tools/posthog/README.md) — dashboards-as-code conventions
- [libs/telemetry/README.md](../libs/telemetry/README.md) — telemetry trust contract
