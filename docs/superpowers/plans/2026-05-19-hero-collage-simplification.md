# Hero Collage Simplification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the two-frame hero collage in `apps/website/src/components/landing/Hero.tsx` with a single `BrowserFrame` containing the generative-UI dashboard at 100% column width, eliminating the `agent.signal()` code window that occludes the dashboard's lower-right quadrant.

**Architecture:** Edit only the right column of the existing `Hero` component. Delete the second `BrowserFrame` (the `<pre>` code snippet). Strip the absolute-positioning wrapper styles (`position: relative`, `minHeight: 420`) and the inline absolute positioning on the remaining frame. Keep all left-column markup, the grid layout, and the responsive `@media` block exactly as-is.

**Tech Stack:** Next.js 16, React 19, TypeScript, `@ngaf/design-tokens`, the project's `BrowserFrame` UI primitive.

**Reference:** Spec at `docs/superpowers/specs/2026-05-19-hero-collage-simplification-design.md`.

---

## File map

- **Modify:** `apps/website/src/components/landing/Hero.tsx`
  - Delete the second `BrowserFrame` (the `agent.signal()` code snippet block).
  - Remove `position: 'relative'`, `minHeight: 420` from the right-column wrapper `<div>`.
  - Remove `position: 'absolute', top: 0, left: 0` from the remaining `BrowserFrame`'s `style`. Change `width: '92%'` to `width: '100%'`.
  - Leave all other JSX, the `@keyframes blink`/`@media` `<style>` block, and the left column untouched.

No other files change.

---

## Task 1: Simplify Hero right column

**Files:**
- Modify: `apps/website/src/components/landing/Hero.tsx`

- [ ] **Step 1: Replace lines 144–193 of `apps/website/src/components/landing/Hero.tsx`**

The current right column block (the JSX comment line `{/* Right column — layered collage ... */}` and the wrapping `<div>` it introduces) ends just before the `</div>` that closes the `.hero-grid`. Replace that entire block — from the comment line through the closing `</div>` of the right-column wrapper, **inclusive** — with the following:

```tsx
          {/* Right column — generative UI dashboard */}
          <div aria-hidden="true">
            <BrowserFrame
              url="demo.threadplane.ai"
              rotate={-3}
              elevation="lg"
              style={{ width: '100%' }}
            >
              <img
                src="/screenshots/canonical-demo-generative-ui.webp"
                alt="Canonical demo — agent renders a live airline operations dashboard with KPI cards, charts, and a disruptions table"
                style={{ display: 'block', width: '100%', height: 'auto' }}
                loading="lazy"
                decoding="async"
              />
            </BrowserFrame>
          </div>
```

The surrounding `.hero-grid` parent `<div>`, the closing `</Container>`, the inline `<style>{...}</style>` block (with `@keyframes blink` and the `@media (max-width: 900px) { .hero-grid { ... } }` rule), and the closing `</Section>` all stay exactly as-is.

- [ ] **Step 2: Verify no stale imports**

Run: `grep -n "fontMono" apps/website/src/components/landing/Hero.tsx`

Expected: no matches. The deleted `<pre>` block used `tokens.typography.fontMono`; after this change the right column no longer references it.

If a match remains, you missed part of the deletion — re-check Step 1.

Run: `grep -n "agent.signal\|provideAgent" apps/website/src/components/landing/Hero.tsx`

Expected: no matches. (These strings only existed inside the deleted `<pre>` block.)

- [ ] **Step 3: Type-check**

Run: `npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i Hero.tsx || echo "ok"`

Expected: `ok`.

- [ ] **Step 4: Visual check on the running dev server**

The website-dev preview server is running on `http://localhost:3000`. Reload the page and confirm:

- The hero right column shows a single `BrowserFrame` with the airline operations dashboard fully visible — KPI cards, line chart, bar chart, and disruptions table all readable.
- No code window appears anywhere in the hero.
- No other element overlaps the dashboard.

(If using `mcp__Claude_Preview__preview_screenshot`, capture at viewport 1280×820 and 375×812.)

- [ ] **Step 5: Run the website unit tests**

Run from `apps/website/`: `npx vitest run 2>&1 | tail -8`

Expected baseline: same as before this change — 53 passing, 2 pre-existing failures in `docs.spec.ts` and `open-in-cockpit.spec.tsx` (both confirmed to fail on `main` too; not caused by this work).

If a previously-passing test in `Hero.spec.*` newly fails because it asserts the presence of the deleted `<pre>` block or the second `BrowserFrame`, update the test to match the new structure. **Note:** at plan-writing time, no `apps/website/src/components/landing/Hero.spec.*` file exists. If it still doesn't exist when you run the tests, you have nothing to update.

- [ ] **Step 6: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx
git commit -m "$(cat <<'EOF'
feat(website): drop hero code window so generative UI screenshot owns the column

The agent.signal() <pre> frame was occluding the dashboard's bar chart and
disruptions table — the densest, most proof-heavy region of the new hero
screenshot. Removes it and resizes the dashboard frame to 100% column width.
provideAgent / agent() still appear in the install CTA, the "Why this exists"
primitive labels, and every install snippet in /docs.

See docs/superpowers/specs/2026-05-19-hero-collage-simplification-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Self-review

**Spec coverage:**
- Drop second `BrowserFrame` — Task 1 Step 1, plus Step 2 grep verifications. ✓
- Remove `position: relative` and `minHeight: 420` from wrapper — Task 1 Step 1 (the replacement `<div>` has no inline style). ✓
- Remove absolute positioning from remaining frame, change width to 100% — Task 1 Step 1. ✓
- Keep grid layout, mobile collapse, left column, image asset, alt text, `aria-hidden` — Task 1 Step 1 leaves all of those untouched. ✓
- Tests stay green — Task 1 Step 5. ✓
- Visual verification at desktop and mobile — Task 1 Step 4. ✓

**Placeholder scan:** no TBD/TODO; every step includes the literal code or command and expected result.

**Type consistency:** the only symbol referenced is `BrowserFrame` (unchanged import), the `url` / `rotate` / `elevation` props (unchanged on the kept frame), and standard JSX. No new types.

Plan complete.
