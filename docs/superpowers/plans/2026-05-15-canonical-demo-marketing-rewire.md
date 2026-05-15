# Phase 5 — Marketing Rewire Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace "See it live" CTAs on the marketing site with "Try the demo →" pointing at `demo.cacheplane.ai`, and capture two new canonical-demo screenshots for the Hero collage. Keep "See each feature in action" CTAs pointed at the cockpit.

**Architecture:** Edits to seven files in `apps/website/src/` plus two new WebP assets in `apps/website/public/screenshots/`. The screenshots are captured live from `https://demo.cacheplane.ai` via the existing Chrome MCP tool, converted to WebP at quality 85, and saved before the file edits begin. The component edits are independent of each other and can be reviewed individually.

**Tech Stack:** Next.js, React, TypeScript, Chrome MCP (for screenshot capture), `sharp` or `cwebp` (for PNG→WebP conversion).

**Reference spec:** `docs/superpowers/specs/2026-05-15-canonical-demo-marketing-rewire-design.md`

---

## Background for the implementer

This phase is purely a marketing-site refresh — no backend changes, no runtime behavior changes. The proxy + rate-limit + CORS + body-cap shipped in Phases 1–4 already protect `demo.cacheplane.ai`; this phase just routes traffic to it.

The plan's first task (screenshot capture) is **operator-driven** — it uses Chrome MCP tools that aren't available inside a subagent invocation. The controller (the human or top-level Claude session) captures the screenshots before dispatching the implementer for tasks 2–8.

**Funnel decision documented for the implementer:**

The existing `FinalCTA` component renders a primary "Get started" → `/docs` and a secondary "See it live" → cockpit. After this phase, the defaults become primary "Try the demo →" → demo and secondary "See each feature in action →" → cockpit. The "Get started" docs CTA still appears prominently in `Hero.tsx` (line ~57), so the docs path stays visible — just not at the bottom-of-page closer.

---

### Task 1: Capture canonical-demo screenshots (OPERATOR-DRIVEN, not a subagent task)

**Files:**
- Create: `apps/website/public/screenshots/canonical-demo-welcome.webp`
- Create: `apps/website/public/screenshots/canonical-demo-conversation.webp`

**Context:** Chrome MCP tools (`mcp__Claude_in_Chrome__*`) aren't accessible from inside a subagent. The controller runs this task interactively, then commits the two new WebP files and hands the rest of the plan to the implementer.

The conversation screenshot uses a prompt that produces a heading + fenced code block + table (markdown showcase): `Write a short markdown response that includes a heading, a fenced code block in javascript with a console.log, and a 2-row table.`

---

- [ ] **Step 1: Resize Chrome window**

```
mcp__Claude_in_Chrome__resize_window { width: 1600, height: 1000, tabId: <demo tab> }
```

- [ ] **Step 2: Navigate to the demo**

```
mcp__Claude_in_Chrome__navigate { url: "https://demo.cacheplane.ai", tabId: <demo tab> }
```

Then `computer { action: 'wait', duration: 3, tabId }` to let the welcome state settle.

- [ ] **Step 3: Screenshot welcome state**

```
mcp__Claude_in_Chrome__computer {
  action: 'screenshot',
  save_to_disk: true,
  tabId: <demo tab>
}
```

Note the returned `path` field — that's the temp PNG location.

- [ ] **Step 4: Send the markdown prompt**

Type the prompt into the input field (find it via `find` tool, then `left_click` + `type`):

```
Write a short markdown response that includes a heading, a fenced code block in javascript with a console.log, and a 2-row table.
```

Click the send button. Wait 10 seconds for the response to fully render.

- [ ] **Step 5: Screenshot mid-conversation**

```
mcp__Claude_in_Chrome__computer {
  action: 'screenshot',
  save_to_disk: true,
  tabId: <demo tab>
}
```

- [ ] **Step 6: Convert both PNGs to WebP**

Pick whichever is available:

```
# If cwebp is installed (often via libwebp):
cwebp -q 85 <welcome-temp.png> -o apps/website/public/screenshots/canonical-demo-welcome.webp
cwebp -q 85 <conversation-temp.png> -o apps/website/public/screenshots/canonical-demo-conversation.webp

# Or via sharp + a one-shot node script if cwebp isn't on the path:
npx -y sharp-cli@^4 --input <welcome-temp.png> --output apps/website/public/screenshots/canonical-demo-welcome.webp --quality 85
npx -y sharp-cli@^4 --input <conversation-temp.png> --output apps/website/public/screenshots/canonical-demo-conversation.webp --quality 85
```

- [ ] **Step 7: Verify sizes**

```
ls -lh apps/website/public/screenshots/canonical-demo-{welcome,conversation}.webp
```

Each should be ≤ 200 KB. If either is larger, drop quality to 80 and reconvert.

- [ ] **Step 8: Commit screenshots**

```bash
git add apps/website/public/screenshots/canonical-demo-welcome.webp \
        apps/website/public/screenshots/canonical-demo-conversation.webp
git commit -m "feat(website): capture canonical-demo screenshots (welcome + conversation)

For the Phase 5 marketing rewire. Welcome shot shows the empty-state
landing UI; conversation shot showcases markdown rendering (heading,
fenced code block, table). Both 1600x1000, WebP quality 85.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Hero.tsx — swap primary CTA + collage screenshot

**Files:**
- Modify: `apps/website/src/components/landing/Hero.tsx`

**Context:** Three changes in one file. The primary CTA href, the BrowserFrame URL label, and the collage screenshot's `src` + `alt` text. Lines 62, 79, and 85 in the current file.

---

- [ ] **Step 1: Update primary CTA href + label**

Find the block in `apps/website/src/components/landing/Hero.tsx` (around lines 57–67) that reads:

```tsx
              <Button
                variant="ghost"
                size="lg"
                href="https://cockpit.cacheplane.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                See it live →
              </Button>
```

Replace `href` and inner text:

```tsx
              <Button
                variant="ghost"
                size="lg"
                href="https://demo.cacheplane.ai"
                target="_blank"
                rel="noopener noreferrer"
              >
                Try the demo →
              </Button>
```

- [ ] **Step 2: Update BrowserFrame URL label**

Find the block (around lines 78–89):

```tsx
            <BrowserFrame
              url="cockpit.cacheplane.ai"
              rotate={-3}
              elevation="lg"
              style={{ position: 'absolute', top: 0, left: 0, width: '92%' }}
            >
              <img
                src="/screenshots/cockpit-code.webp"
                alt="Cockpit reference app showing the Angular streaming component source"
                style={{ display: 'block', width: '100%', height: 'auto' }}
                loading="lazy"
                decoding="async"
              />
            </BrowserFrame>
```

Replace `url`, `src`, and `alt`:

```tsx
            <BrowserFrame
              url="demo.cacheplane.ai"
              rotate={-3}
              elevation="lg"
              style={{ position: 'absolute', top: 0, left: 0, width: '92%' }}
            >
              <img
                src="/screenshots/canonical-demo-conversation.webp"
                alt="Canonical demo — streaming chat rendering a markdown response with code block and table"
                style={{ display: 'block', width: '100%', height: 'auto' }}
                loading="lazy"
                decoding="async"
              />
            </BrowserFrame>
```

- [ ] **Step 3: Sanity check the rest of the file**

```
grep -n "cockpit\.cacheplane\.ai" apps/website/src/components/landing/Hero.tsx
```

Expected: zero matches.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx
git commit -m "feat(website): Hero CTA + browser-frame routes to canonical demo

Primary 'See it live' button becomes 'Try the demo →' pointing at
demo.cacheplane.ai. The layered-collage BrowserFrame swaps its URL
label to demo.cacheplane.ai and its screenshot to the new
canonical-demo-conversation.webp (markdown response with code +
table). The other two collage images are unaffected.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: FinalCTA.tsx — swap defaults

**Files:**
- Modify: `apps/website/src/components/landing/FinalCTA.tsx`

**Context:** Two `const` defaults need updating (lines 19–20 in the current file). The component shape (`<FinalCTA />` consumers, primary/secondary props) is unchanged — only the default values.

---

- [ ] **Step 1: Update the DEFAULT_PRIMARY and DEFAULT_SECONDARY**

In `apps/website/src/components/landing/FinalCTA.tsx`, find lines 19–20:

```tsx
const DEFAULT_PRIMARY = { label: 'Get started', href: '/docs' };
const DEFAULT_SECONDARY = { label: 'See it live →', href: 'https://cockpit.cacheplane.ai', external: true };
```

Replace with:

```tsx
const DEFAULT_PRIMARY = { label: 'Try the demo →', href: 'https://demo.cacheplane.ai', external: true };
const DEFAULT_SECONDARY = { label: 'See each feature in action →', href: 'https://cockpit.cacheplane.ai', external: true };
```

Then update the `primary` prop type in the interface (line 12) to allow the optional `external` flag:

```tsx
  primary?: { label: string; href: string; external?: boolean };
```

And update the render to honor it (around line 70). Find:

```tsx
            <Button variant="primary" size="lg" href={primary.href}>
              {primary.label}
            </Button>
```

Replace with:

```tsx
            <Button
              variant="primary"
              size="lg"
              href={primary.href}
              {...((primary as { external?: boolean }).external ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
            >
              {primary.label}
            </Button>
```

Also update the JSDoc comment on the `primary?` prop (around line 11):

```tsx
  /** Primary CTA. Defaults to "Try the demo →" → demo.cacheplane.ai. */
```

And `secondary?` (around line 13):

```tsx
  /** Optional secondary CTA. Defaults to "See each feature in action →" → cockpit. */
```

- [ ] **Step 2: Sanity check**

```
grep -n "cockpit\|demo\.cacheplane" apps/website/src/components/landing/FinalCTA.tsx
```

Expected: 1 cockpit reference (the DEFAULT_SECONDARY) and 1 demo reference (the DEFAULT_PRIMARY). Plus JSDoc mentions.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/FinalCTA.tsx
git commit -m "feat(website): FinalCTA defaults reroute to canonical demo + cockpit deep dive

Primary CTA becomes 'Try the demo →' (demo.cacheplane.ai).
Secondary CTA becomes 'See each feature in action →' (cockpit.cacheplane.ai).

The existing 'Get started' → /docs CTA stays prominent in the Hero
(top of the page); the FinalCTA's bottom-of-page closer now drives
the two external surfaces that prove the framework works.

Adds optional 'external' flag support to the primary prop so
external defaults can open in a new tab.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: ProofStrip.tsx — update the "Reference app" entry

**Files:**
- Modify: `apps/website/src/components/landing/ProofStrip.tsx`

**Context:** Two-line change to the SIGNALS array entry (lines 25–29).

---

- [ ] **Step 1: Update the signal**

In `apps/website/src/components/landing/ProofStrip.tsx`, find the `Reference app` entry (around lines 25–29):

```tsx
  {
    label: 'Reference app',
    value: 'cockpit.cacheplane.ai',
    href: 'https://cockpit.cacheplane.ai',
  },
```

Replace with:

```tsx
  {
    label: 'Try it live',
    value: 'demo.cacheplane.ai',
    href: 'https://demo.cacheplane.ai',
  },
```

The label change ("Reference app" → "Try it live") is intentional — "Reference app" implied cockpit's role; "Try it live" speaks to the canonical demo's role.

- [ ] **Step 2: Sanity check**

```
grep -n "cockpit\.cacheplane\.ai" apps/website/src/components/landing/ProofStrip.tsx
```

Expected: zero matches.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/ProofStrip.tsx
git commit -m "feat(website): ProofStrip swaps 'Reference app' to 'Try it live' (demo)

Updates the signal label + value + href to point at
demo.cacheplane.ai. Cockpit stays referenced elsewhere (Nav,
Footer, deep-dive pages); the ProofStrip's job is to surface
proof-of-life — the canonical demo IS the live proof.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: LiveCockpitFrame → LiveDemoFrame rename

**Files:**
- Rename: `apps/website/src/components/landing/LiveCockpitFrame.tsx` → `LiveDemoFrame.tsx`
- Modify: renamed file (iframe src, BrowserFrame url, title, function name, internal labels)
- Modify: `apps/website/src/app/page.tsx` (import + JSX usage)

**Context:** The component is `'use client'`, uses an IntersectionObserver for lazy-loading the iframe, and currently iframes cockpit.cacheplane.ai. Two consumers in the repo: the file itself and `page.tsx` (only used in the "Ship" feature block as the visual). Use `git mv` to preserve history.

---

- [ ] **Step 1: Rename the file with git mv**

```bash
git mv apps/website/src/components/landing/LiveCockpitFrame.tsx \
       apps/website/src/components/landing/LiveDemoFrame.tsx
```

- [ ] **Step 2: Update the renamed file**

Replace the contents of `apps/website/src/components/landing/LiveDemoFrame.tsx` with:

```tsx
'use client';
import { useEffect, useRef, useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { BrowserFrame } from '../ui/BrowserFrame';

export function LiveDemoFrame() {
  const ref = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    if (!ref.current || shouldLoad) return;
    const el = ref.current;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setShouldLoad(true);
            observer.disconnect();
            return;
          }
        }
      },
      { rootMargin: '200px' },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [shouldLoad]);

  return (
    <div ref={ref}>
      <BrowserFrame url="demo.cacheplane.ai" elevation="lg">
        {shouldLoad ? (
          <iframe
            src="https://demo.cacheplane.ai"
            title="Canonical demo — @ngaf/chat running against the shared LangGraph backend"
            loading="lazy"
            style={{
              width: '100%',
              height: 480,
              border: 'none',
              display: 'block',
            }}
          />
        ) : (
          <div
            style={{
              height: 480,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: tokens.surfaces.surfaceTinted,
              color: tokens.colors.textMuted,
              fontFamily: tokens.typography.fontMono,
              fontSize: 13,
            }}
          >
            Loading demo…
          </div>
        )}
      </BrowserFrame>
    </div>
  );
}
```

- [ ] **Step 3: Update the import + usage in page.tsx**

In `apps/website/src/app/page.tsx`, find line 6:

```tsx
import { LiveCockpitFrame } from '../components/landing/LiveCockpitFrame';
```

Replace with:

```tsx
import { LiveDemoFrame } from '../components/landing/LiveDemoFrame';
```

Then find line 106:

```tsx
        visual={<LiveCockpitFrame />}
```

Replace with:

```tsx
        visual={<LiveDemoFrame />}
```

- [ ] **Step 4: Sanity check there are no stragglers**

```
grep -rn "LiveCockpitFrame" apps/website/src/
```

Expected: zero matches.

```
grep -n "cockpit\.cacheplane\.ai" apps/website/src/components/landing/LiveDemoFrame.tsx
```

Expected: zero matches.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/landing/LiveDemoFrame.tsx \
        apps/website/src/app/page.tsx
git commit -m "feat(website): rename LiveCockpitFrame → LiveDemoFrame, iframe canonical demo

The 'Ship' feature block's visual previously iframed
cockpit.cacheplane.ai (which renders the cockpit docs shell — not
visually compelling). Switch to demo.cacheplane.ai, which renders
the actual chat surface. Same lazy-load IntersectionObserver
pattern; only the iframe src + BrowserFrame label + title text
change.

Renames the file + symbol with git mv so history is preserved.
Updates the single consumer in app/page.tsx.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Nav.tsx — add Demo link

**Files:**
- Modify: `apps/website/src/components/shared/Nav.tsx`

**Context:** The `links` array (currently lines 11–18 in the file based on the spec) holds the top-nav entries. Insert a "Demo" entry before "Examples" so the demo is the first external destination users see.

---

- [ ] **Step 1: Insert the Demo entry**

In `apps/website/src/components/shared/Nav.tsx`, find the `links` array:

```tsx
const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Solutions', href: '/solutions', external: false },
  { label: 'API', href: '/docs/agent/api/agent', external: false },
  { label: 'Examples', href: 'https://cockpit.cacheplane.ai', external: true },
  { label: 'Pricing', href: '/pricing', external: false },
];
```

Insert a Demo entry immediately before the Examples entry:

```tsx
const links = [
  { label: 'Pilot to Prod', href: '/pilot-to-prod', external: false },
  { label: 'Docs', href: '/docs', external: false },
  { label: 'Solutions', href: '/solutions', external: false },
  { label: 'API', href: '/docs/agent/api/agent', external: false },
  { label: 'Demo', href: 'https://demo.cacheplane.ai', external: true },
  { label: 'Examples', href: 'https://cockpit.cacheplane.ai', external: true },
  { label: 'Pricing', href: '/pricing', external: false },
];
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/shared/Nav.tsx
git commit -m "feat(website): Nav adds 'Demo' link before 'Examples'

Demo (demo.cacheplane.ai) is the primary 'try it' entry point;
Examples (cockpit.cacheplane.ai) is the 'see each feature in
action' deep dive. Both links are external.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 7: Footer.tsx — add Demo link

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx`

**Context:** The Resources column has an existing `<a href="https://cockpit.cacheplane.ai">Examples</a>` (around line 178). Insert a parallel Demo anchor immediately before it. Use the same `trackExternalLinkClick` analytics pattern.

---

- [ ] **Step 1: Insert the Demo anchor**

In `apps/website/src/components/shared/Footer.tsx`, find the Examples anchor block (lines 178–187):

```tsx
            <a href="https://cockpit.cacheplane.ai" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onClick={() => trackExternalLinkClick('https://cockpit.cacheplane.ai', {
                surface: 'footer',
                cta_id: 'footer_examples',
                cta_text: 'Examples',
              })}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Examples
            </a>
```

Insert a parallel Demo anchor immediately before it:

```tsx
            <a href="https://demo.cacheplane.ai" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onClick={() => trackExternalLinkClick('https://demo.cacheplane.ai', {
                surface: 'footer',
                cta_id: 'footer_demo',
                cta_text: 'Demo',
              })}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Demo
            </a>
            <a href="https://cockpit.cacheplane.ai" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onClick={() => trackExternalLinkClick('https://cockpit.cacheplane.ai', {
                surface: 'footer',
                cta_id: 'footer_examples',
                cta_text: 'Examples',
              })}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Examples
            </a>
```

- [ ] **Step 2: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "feat(website): Footer adds 'Demo' link before 'Examples'

Mirrors the Nav addition. Same external-link analytics pattern
(trackExternalLinkClick) with a new footer_demo cta_id.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>"
```

---

### Task 8: Build verification + PR

**Files:** None modified.

**Context:** Production build of the website catches any broken imports after the rename. Run before pushing the PR.

---

- [ ] **Step 1: Run the production build**

```
npx nx build website --configuration=production
```

Expected: succeeds. Any leftover `LiveCockpitFrame` import surfaces here as a build error.

- [ ] **Step 2: Final grep sanity**

```
grep -rn "cockpit\.cacheplane\.ai" apps/website/src/ | grep -v "FinalCTA\|HomeFAQ\|chat/page\|pilot-to-prod/page\|dev/primitives\|page\.tsx" | head -20
```

Expected: zero matches in the touched components. The intentional remaining refs (chat/page.tsx, pilot-to-prod/page.tsx, dev/primitives/page.tsx, HomeFAQ.tsx, page.tsx:44 + page.tsx:76, FinalCTA's secondary) won't appear because they're filtered.

```
grep -rn "LiveCockpitFrame" apps/website/src/
```

Expected: zero matches.

```
ls -lh apps/website/public/screenshots/canonical-demo-{welcome,conversation}.webp
```

Expected: both files exist, each ≤ 200 KB.

- [ ] **Step 3: Push + open PR**

```bash
git push -u origin claude/canonical-demo-marketing-rewire
gh pr create --title "feat(website): Phase 5 — marketing rewire to canonical demo" --body "$(cat <<'EOF'
## Summary

Routes marketing-site visitors to the canonical demo at \`demo.cacheplane.ai\`. Full sweep of the homepage CTAs + nav + footer. Keeps "See each feature in action" deep dives pointed at \`cockpit.cacheplane.ai\`.

## Changes

- **Hero**: "See it live →" → "Try the demo →" (demo). Browser-frame collage image swaps to a new canonical-demo screenshot showing markdown rendering.
- **FinalCTA**: primary default becomes "Try the demo →" (demo); secondary default becomes "See each feature in action →" (cockpit). The "Get started" docs CTA stays in the Hero.
- **ProofStrip**: "Reference app" signal becomes "Try it live" pointing at demo.
- **LiveCockpitFrame → LiveDemoFrame**: file renamed with \`git mv\`; iframe now loads demo.cacheplane.ai (the actual chat surface, more visually compelling than the cockpit docs shell).
- **Nav + Footer**: new "Demo" link added before the existing "Examples" link.
- **Screenshots**: two new WebP captures of demo.cacheplane.ai (welcome + mid-conversation with markdown response). Welcome shot captured for completeness; conversation shot replaces the cockpit-code shot in the Hero collage.

## Spec & Plan

- \`docs/superpowers/specs/2026-05-15-canonical-demo-marketing-rewire-design.md\`
- \`docs/superpowers/plans/2026-05-15-canonical-demo-marketing-rewire.md\`

## Test plan

- [x] Production build of website succeeds
- [x] grep confirms no remaining cockpit refs in touched files
- [x] grep confirms no LiveCockpitFrame stragglers
- [x] Both WebP files committed, ≤ 200 KB each
- [ ] Post-merge browser smoke at cacheplane.ai:
  - Hero "Try the demo →" navigates to demo.cacheplane.ai
  - Hero collage shows the new canonical-demo screenshot
  - FinalCTA renders both CTAs with primary → demo, secondary → cockpit
  - ProofStrip "Try it live" entry visible + clickable
  - Production-patterns iframe (Ship section) renders the chat surface
  - Nav + Footer both show new "Demo" link

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 4: Wait for CI green, merge**

Once all checks pass (Library, Website, Cockpit jobs):

```bash
gh pr merge <PR_NUMBER> --squash
```

The Vercel deploy of `apps/website` updates `cacheplane.ai` within ~3 min.

- [ ] **Step 5: Post-merge browser smoke**

After Vercel deploys, open `https://cacheplane.ai` and walk through the test plan items from the PR body.

- [ ] **Step 6: Clean up worktree + branch**

```bash
git worktree remove .claude/worktrees/canonical-demo-marketing-rewire --force
git branch -D claude/canonical-demo-marketing-rewire
```

---

## Self-review notes

- **Spec coverage:** every spec section maps to a task. Hero (line 62 + 79 + 85) → Task 2. FinalCTA → Task 3. ProofStrip → Task 4. LiveCockpitFrame rename → Task 5. Nav → Task 6. Footer → Task 7. Screenshots → Task 1. Build verification + PR + verify → Task 8.
- **No placeholders:** every code block is final content the implementer pastes verbatim.
- **Type consistency:** `LiveDemoFrame` symbol used identically across the renamed file and its single consumer in `page.tsx`. `canonical-demo-welcome.webp` and `canonical-demo-conversation.webp` file paths consistent across Task 1 and Task 2.
- **Task 1 is operator-driven, not subagent-dispatchable.** Subagents can't use Chrome MCP. The controller (top-level Claude) runs Task 1 interactively, commits, then dispatches the implementer for Tasks 2–7. Task 8 (PR + verify) is controller work too.
- **Funnel impact flagged:** Task 3's commit message and the plan's Background section call out that the FinalCTA defaults change displaces the "Get started" → /docs default. The Hero still has "Get started" prominently.
