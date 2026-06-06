# A2UI v1 Consistency Sweep — Design

**Date:** 2026-06-05
**Status:** Draft for review
**Scope:** Remove the remaining live `v0.9` A2UI references so the repo presents Threadplane's A2UI support as **v1** explicitly and consistently — marketing copy, source-comment citations (+ the generated chat API docs), and the GTM messaging rule. Google-protocol citations stay accurate; historical records are untouched.

## Goal

The code, cockpit example, and library docs already use `version: 'v1'`. What
remains are stray `v0.9` strings in **marketing copy**, two **source-comment
citations** (which flow into a generated API-docs JSON), and an obsolete **GTM
messaging rule**. This sweep aligns all of those on v1.

## Policy (decided)

- **Threadplane's A2UI support is `v1`.** Where we state our support level, say
  "A2UI v1".
- **Name Google's protocol without a version number** where we claim
  compatibility (no "Google A2UI v1" — Google has no v1; no "v0.9-compatible"
  either, going forward).
- **Cite Google accurately:** real links to Google's spec (e.g.
  `a2ui.org/specification/v0.9-a2ui/`) stay as-is — that page really is v0.9.
- **Don't rewrite history:** `CHANGELOG.md` and `docs/superpowers/plans|specs/*`
  keep their `v0.9` references (accurate records of past work). Third-party
  `.venv` is never touched.

## Changes

### 1. Marketing copy

`apps/website/src/app/render/page.tsx`:
- Pill (≈ line 63): `Google A2UI v0.9-compatible` → `Google A2UI`.
- Bullet (≈ line 76): `Google A2UI v0.9-compatible protocol` → `Google A2UI protocol`.
- Supporting card (≈ line 82): `{ title: 'A2UI v0.9-compatible', description: 'Google protocol.' }`
  → `{ title: 'A2UI v1', description: 'Google A2UI protocol.' }`.

`apps/website/src/app/page.tsx`:
- Bullet (≈ line 73): `A2UI v0.9-compatible protocol + Vercel json-render adapter`
  → `A2UI v1 + Vercel json-render adapter`.

### 2. Source-comment citations (version-agnostic)

`libs/chat/src/lib/compositions/chat/chat.component.ts` (≈ line 371):
- `per the A2UI v0.9 spec` → `per the A2UI spec`.

`libs/chat/src/lib/a2ui/action-label.ts` (≈ line 7):
- `Per the A2UI v0.9 spec, action messages flow…` → `Per the A2UI spec, action messages flow…`.
- **Leave line ~32 unchanged** — `https://a2ui.org/specification/v0.9-a2ui/` is a
  real Google spec URL (accurate citation).

### 3. Regenerate the chat API docs

`apps/website/content/docs/chat/api/api-docs.json` embeds the
`chat.component.ts` HumanMessageContent JSDoc (currently contains "per the A2UI
v0.9 spec"). After editing the source comment, regenerate via
`apps/website/scripts/generate-api-docs.ts` (the project's api-docs generator).
Verify the resulting diff is limited to the changed sentence (no unrelated
drift). **Fallback:** if regeneration pulls in unrelated changes, instead edit
only that one description string in the JSON to `per the A2UI spec` so source and
generated docs stay in sync.

### 4. GTM messaging rule

`docs/gtm/messaging.md` (≈ line 37):
- Replace `"A2UI v1" → **"A2UI v0.9-compatible"** until v1 is verified.` with a
  rule stating: present Threadplane's A2UI support as **"A2UI v1"**; note
  Google-protocol compatibility *without* a version number (don't claim a Google
  "v1", don't say "v0.9-compatible").

## Testing & verification

- **Type/lint:** `eslint` the changed `.ts`/`.tsx` files; `tsc --noEmit` shows no
  new errors in them (comment-only + string-literal changes — low risk).
- **No stray live v0.9:** after the change,
  `grep -rnI -e "v0\.9" libs/chat/src apps/website/src apps/website/content/docs/chat/api docs/gtm | grep -v spec`
  returns only the legitimate Google spec URL in `action-label.ts:32` (and
  nothing in marketing / gtm / api-docs).
- **Pages render:** `/render` and `/` (home) return HTTP 200 and show the new
  wording; `/docs/chat/...` api page still renders.
- **Build sanity:** the website still type-checks/builds (the marketing pages are
  server components; string changes only).

## Out of scope

- Historical `CHANGELOG.md` / `docs/superpowers/plans|specs/*` (kept accurate to
  when the work shipped).
- The cockpit example **envelope-name** staleness (`createSurface` etc. in
  `cockpit/chat/a2ui/python/prompts|docs`) — that's a wrong-*format* issue, not a
  version string, and a separate follow-up. (The version strings there are
  already `v1`.)
- Any change to the actual `version: 'v1'` value or A2UI behavior — this is a
  wording/consistency sweep only.
