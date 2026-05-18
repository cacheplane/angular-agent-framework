---
name: marketing
description: |
  Cacheplane marketing pipeline operator. Reads `marketing/cowork/inbox/*.json`
  draft bundles, presents them for review in conversation, supports
  edit/approve/reject decisions, and dispatches approved drafts to channel
  adapters. Invoke when "drafts are waiting" or when the user wants to
  produce a thread/post for X, LinkedIn, Dev.to, or Reddit.
status: stub
---

# Marketing Cowork skill — STUB

Implementation lands in the cowork-loop sub-spec
(`docs/superpowers/specs/marketing/<date>-cowork-loop-design.md`).

This file exists so the directory shape and skill name are reserved.
Do NOT invoke this skill until the cowork-loop sub-spec is merged.

## Expected file conventions (preview)

- `marketing/cowork/inbox/<id>.json` — drafts awaiting review (agent writes)
- `marketing/cowork/outbox/<id>.json` — approved + posted (skill writes)
- `marketing/cowork/archive/<id>.json` — rejected or expired (skill writes)

`<id>` is `YYYY-MM-DD-<short-slug>`.

## Expected DraftBundle shape (preview)

See `docs/superpowers/specs/marketing/2026-05-17-marketing-meta-design.md` §5.3.
