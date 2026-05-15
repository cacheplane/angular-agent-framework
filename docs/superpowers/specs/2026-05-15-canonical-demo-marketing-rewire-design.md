# Phase 5 — Marketing Rewire — Design

**Status:** Approved
**Date:** 2026-05-15
**Goal:** Route marketing-site visitors who want to "try it" to the canonical demo at `demo.cacheplane.ai`, replacing the current "See it live" CTAs that point at `cockpit.cacheplane.ai`. Capture two new canonical-demo screenshots and place them in the Hero collage. Keep "See each feature in action" pointed at the cockpit.

## Why now

Phases 1–4 made `demo.cacheplane.ai` reachable, wallet-safe (rate-limit + body cap + CORS allowlist), and verified live. This phase drives the actual marketing traffic that justifies the deployment work.

## Decisions locked during brainstorming

| Decision | Choice |
|---|---|
| Scope | Full sweep — Hero + FinalCTA + ProofStrip + LiveDemoFrame (renamed from LiveCockpitFrame) + Nav "Demo" link + Footer "Demo" link |
| Distinguishing copy | "Try the demo →" → demo; "See each feature in action →" → cockpit |
| Screenshots to capture | Two — welcome state + mid-conversation with markdown response |
| Hero collage layering | Two of three slots become canonical-demo shots; third remains (genui-surface or code-editor) |
| `chat/page.tsx`, `pilot-to-prod/page.tsx`, `dev/primitives/page.tsx`, `HomeFAQ.tsx`, `page.tsx:44/76` cockpit refs | OUT of scope — these are deep-dive contexts; stay cockpit |
| New `/demo` route on marketing site | OUT of scope; demo lives at its own subdomain |

## Architecture

Three categories of `apps/website/src/` edits plus two new image assets.

### 1. Primary "Try the demo" surfaces

Replace `https://cockpit.cacheplane.ai` with `https://demo.cacheplane.ai` and update label + browser-frame URL in three components:

- **`apps/website/src/components/landing/Hero.tsx`** (lines 62 + 79 + 85)
  - Primary CTA href → demo
  - `BrowserFrame url` label → `demo.cacheplane.ai`
  - Collage screenshot `src` → `/screenshots/canonical-demo-conversation.webp` (the markdown-rich shot)
- **`apps/website/src/components/landing/FinalCTA.tsx`** (line 20)
  - `DEFAULT_SECONDARY = { label: 'See each feature in action →', href: 'https://cockpit.cacheplane.ai', external: true }` stays
  - Add `DEFAULT_PRIMARY = { label: 'Try the demo →', href: 'https://demo.cacheplane.ai', external: true }` as the new primary CTA
  - Update the FinalCTA component to render both with distinct visual weights
- **`apps/website/src/components/landing/ProofStrip.tsx`** (lines 27–28)
  - "Live" proof: `value: 'demo.cacheplane.ai'`, `href: 'https://demo.cacheplane.ai'`

### 2. Production-patterns iframe — rename component

- **`apps/website/src/components/landing/LiveCockpitFrame.tsx`** → `LiveDemoFrame.tsx`
  - Update `<iframe src>` to `https://demo.cacheplane.ai`
  - Update `<BrowserFrame url>` to `demo.cacheplane.ai`
  - Update internal alt text and aria-label
  - Update file's own header comment + JSDoc
- **`apps/website/src/app/page.tsx`** (line 6 + 106)
  - Import name `LiveCockpitFrame` → `LiveDemoFrame`
  - Component usage `<LiveCockpitFrame />` → `<LiveDemoFrame />`

The old `LiveCockpitFrame.tsx` file is renamed (git mv), not duplicated. There are no other consumers.

### 3. Nav + Footer "Demo" link

- **`apps/website/src/components/shared/Nav.tsx`** (line 16, the `LINKS` array)
  - Insert `{ label: 'Demo', href: 'https://demo.cacheplane.ai', external: true }` BEFORE the existing "Examples" entry. Demo is the primary entry point — earlier in reading order.
- **`apps/website/src/components/shared/Footer.tsx`** (around line 178)
  - Add a parallel "Demo" anchor near the existing "Examples" anchor in the Resources/Product column. Same analytics-tracking pattern.

## Screenshot capture pipeline

Captured via the existing Chrome MCP integration. Sequence:

1. `mcp__Claude_in_Chrome__resize_window` to 1600×1000 (typical Hero collage proportions).
2. `mcp__Claude_in_Chrome__navigate` to `https://demo.cacheplane.ai`.
3. Wait ~3 seconds for sidenav + welcome to render.
4. `mcp__Claude_in_Chrome__computer { action: 'screenshot', save_to_disk: true }` → temp PNG, capture path from response.
5. Type the markdown prompt into the input, click send.
6. Wait ~10 seconds for the response (heading + fenced code block + table) to fully render.
7. Screenshot again → second temp PNG.
8. Convert both PNG → WebP at quality 85 via `cwebp` or `sharp` CLI (whichever is available; if neither is, install `sharp` as a dev dep).
9. Move converted files to:
   - `apps/website/public/screenshots/canonical-demo-welcome.webp`
   - `apps/website/public/screenshots/canonical-demo-conversation.webp`
10. Target file size: ≤ 200 KB each. WebP quality 85 typically lands at 80–150 KB for 1600px images.

The existing `cockpit-code.webp` stays on disk — there are still references elsewhere (e.g., `dev/primitives/page.tsx`, `pilot-to-prod/page.tsx`) we don't touch in this phase.

## Hero collage swap detail

`Hero.tsx` currently renders three layered images in a collage:
- `cockpit-code.webp` (line 85) — replaced with `canonical-demo-conversation.webp` (richest single shot)

The other two images in the collage stay (genui-surface, code-editor-snippet) — they're not cockpit-specific.

The `canonical-demo-welcome.webp` is captured AND saved to public/screenshots, but used elsewhere — primarily in the `LiveDemoFrame` fallback (if the iframe fails to load) and as a reference asset. We're not adding a fourth image to the Hero collage; the design constraint was "swap one, keep the collage shape."

## Data flow

No runtime changes — every edit is build-time content. The Next.js build picks up the new images at static-asset paths, the renamed component is re-imported, and the rewired CTAs point at the new subdomain.

## Error handling

No new runtime branches. CORS, body cap, and rate-limit (already shipped in Phases 3–4) handle traffic the new CTAs send. If `demo.cacheplane.ai` is unreachable, the CTAs return browser-default network errors — not our concern here.

## Testing

### Pre-merge

1. **Grep verification.** After all edits:
   ```
   grep -rn "cockpit\.cacheplane\.ai" apps/website/src/ | wc -l
   ```
   Should return roughly 7 — only the intentional remaining refs (chat page, pilot-to-prod, dev/primitives, FAQ text, page.tsx:44, page.tsx:76, plus FinalCTA's "See each feature in action").

2. **No leftover `LiveCockpitFrame` symbol:**
   ```
   grep -rn "LiveCockpitFrame" apps/website/src/
   ```
   Should return zero matches.

3. **Production build:** `npx nx build website` succeeds. Catches broken imports after rename.

4. **WebP files exist and are reasonable size:**
   ```
   ls -lh apps/website/public/screenshots/canonical-demo-{welcome,conversation}.webp
   ```
   Each ≤ 200 KB.

### Post-merge (manual, after Vercel deploys to cacheplane.ai)

- Hero "Try the demo →" CTA navigates to `demo.cacheplane.ai`.
- Hero collage shows the new screenshot.
- FinalCTA has both CTAs visible; primary points to demo, secondary to cockpit.
- ProofStrip "demo.cacheplane.ai" entry is clickable.
- Production-patterns section iframe renders the chat surface (not cockpit shell).
- Nav has both "Demo" and "Examples" entries.
- Footer has both links.
- The `cockpit-code.webp` reference in `dev/primitives/page.tsx` etc. still works (file still on disk).

## Out of scope

- Replacing the second + third Hero collage images.
- New `/demo` route on the marketing site.
- A/B testing the CTA copy.
- Analytics event renaming (existing `trackExternalLinkClick` calls keep firing; they parameterize the URL).
- Removing `cockpit-code.webp` from disk.
- The `cockpit.cacheplane.ai` references in deep-dive pages (`chat/page.tsx`, `pilot-to-prod/page.tsx`, etc.) — keep cockpit there.

## References

- Phase 4 PR #324 (shipped CORS allowlist + body cap)
- Master canonical-demo spec: `docs/superpowers/specs/2026-05-13-canonical-demo-deploy-design.md` — Phase 5 section
- `apps/website/src/components/ui/BrowserFrame.tsx` — the URL-bar component used in Hero + collage frames
- `apps/website/src/components/landing/Hero.tsx` lines 62, 79, 85 — current cockpit refs
- `apps/website/src/components/landing/FinalCTA.tsx` line 20 — current `DEFAULT_SECONDARY`
- `apps/website/src/components/landing/ProofStrip.tsx` lines 27–28 — current proof
- `apps/website/src/components/landing/LiveCockpitFrame.tsx` — entire file
- `apps/website/src/app/page.tsx` lines 6, 106 — import + usage
- `apps/website/src/components/shared/Nav.tsx` line 16 — LINKS array
- `apps/website/src/components/shared/Footer.tsx` line 178 — existing cockpit link
