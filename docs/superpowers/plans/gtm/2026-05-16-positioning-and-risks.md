# Spec 2 — Positioning & Risks Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the locked Direction-A hero, the `/contact` enterprise CTA destination, four risk-cleanup copy sweeps, and CTA tracking that makes the two-track funnel measurable in PostHog.

**Architecture:** Drop-in rewrites of existing landing-surface React components plus new components for the contact route. `getGitHubStars()` uses Next.js ISR (24h) for the trust-signal pill. `/api/leads` validation loosens to email-only; Spec 1E's qualification gate stays in place. Three full-repo copy sweeps run per-file with `git grep -l` + targeted edits — never `replace_all`.

**Tech Stack:** Next.js 16 (App Router); React server + client components; `@ngaf/design-tokens` for typography/colors; Vitest with jsdom for unit tests (`npx vitest run` from `apps/website/`); existing `track(...)` analytics wrapper in `apps/website/src/lib/analytics/client.ts`.

---

## Context for the implementer

- **Spec:** `docs/superpowers/specs/gtm/2026-05-16-positioning-and-risks-design.md` — read §§3–9 before starting.
- **Locked content lives in `docs/gtm/messaging.md`** — hero copy, contact-page copy. Render the literal words. If the layout crowds, reflow lines but don't rewrite.
- **Substring-overlap rule** (per the repo's "Chat" memory note): never `replace_all` for the three sweeps. Use `git grep -l <phrase>` to enumerate files, then per-file review for each replacement. "Angular Agent Framework" is a unique phrase but the discipline matters.
- **Sweep exclusions** (always skip):
  - `CHANGELOG.md`, anything under `release-notes/`, anything under `docs/superpowers/specs/` and `docs/superpowers/plans/` (historical record / spec lock state)
  - `docs/gtm/reports/` (weekly snapshots, immutable)
- **Website has no `nx run website:test` target.** Run vitest directly: `cd apps/website && npx vitest run <path>`. The cockpit and telemetry projects have nx test targets and are unaffected by this spec.
- **TDD discipline:** write test → run-see-fail → implement → run-see-pass → commit on every code-producing task. Sweep tasks are "git grep → per-file edit → verify build" instead.
- **Commit format:** conventional commits, one task = one commit.
- **Worktree branch:** `gtm-spec-2-positioning-and-risks` (already created from `origin/main`, currently at the spec commit `fe049849`).

## File structure (locked)

```
NEW
├── apps/website/src/app/contact/page.tsx                    # Phase 2
├── apps/website/src/components/contact/ContactForm.tsx      # Phase 2 ('use client')
├── apps/website/src/components/contact/GitHubStarsPill.tsx  # Phase 2 (server component)
├── apps/website/src/components/contact/AltChannelRow.tsx    # Phase 2
├── apps/website/src/components/contact/SlaCard.tsx          # Phase 2
├── apps/website/src/components/pricing/CompatibilityMatrix.tsx  # Phase 3
├── apps/website/src/lib/github.ts                            # Phase 2
├── apps/website/src/lib/github.spec.ts                       # Phase 2
├── apps/website/src/components/landing/Hero.spec.tsx        # Phase 1
├── apps/website/src/components/contact/ContactForm.spec.tsx # Phase 2
├── apps/website/src/components/contact/GitHubStarsPill.spec.tsx # Phase 2
├── apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx # Phase 3

MODIFIED
├── apps/website/src/lib/analytics/events.ts                 # Phase 1 — CtaId union + AnalyticsProperties.cta_id type
├── apps/website/src/components/landing/Hero.tsx             # Phase 1 — full content + 'use client'
├── apps/website/src/app/pricing/page.tsx                    # Phase 3 — replace "All Angular versions" with <CompatibilityMatrix />
├── apps/website/src/app/api/leads/route.ts                  # Phase 4 — require email only
├── apps/website/emails/lead-notification.ts                 # Phase 4 — handle missing name (subject + body)
├── docs/gtm/messaging.md                                    # Phase 4 — Contact §Fields line
├── ~10–20 files                                             # Phase 0 — three sweeps, per-file review
```

---

## Phase 0 — Three risk-cleanup copy sweeps

These are mechanical per-file edits. Use `git grep -l <phrase>` to enumerate. **Never `replace_all` — every file is reviewed individually.** Common exclusion patterns: `:!CHANGELOG.md :!release-notes/* :!docs/superpowers/specs/* :!docs/superpowers/plans/* :!docs/gtm/reports/*`.

### Task 0.1: Category sweep — "Angular Agent Framework" → "Agent UI for Angular"

**Approach:** find all files, classify each as (a) page copy/metadata sweep target, (b) skip (historical/spec/release), (c) edge case (component identifier, OG image). Edit per-file. Build verifies.

- [ ] **Step 1: Enumerate occurrences (read-only)**

```bash
git grep -l "Angular Agent Framework" -- ':!CHANGELOG.md' ':!release-notes/*' ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*' ':!docs/gtm/reports/*'
```

Expected output: ~15-25 files across `apps/website/src`, `apps/website/content`, `apps/website/scripts`, `apps/website/emails`, `apps/website/public`, `apps/cockpit/src/app/layout.tsx`, `apps/cockpit/src/app/opengraph-image.tsx`, `libs/*/README.md`, `README.md`, `gtm.md`, and `apps/website/e2e/website.spec.ts`.

- [ ] **Step 2: For each file, edit the human-readable copy occurrences**

Replacement rules:
- Page titles, metadata, OG alt text, headlines, descriptions: `"Angular Agent Framework"` → `"Agent UI for Angular"`.
- Sentences where the phrase reads as a category/product name: same replacement.
- Identifier / variable name occurrences (e.g., `AGENT_FRAMEWORK_PACKAGE_NAME`): **DO NOT change**. These are program identifiers, not copy. There are none in the current repo, but verify per-file.
- `gtm.md` line 15 ("Do not use: 'Angular Agent Framework'") — leave the substring there because the surrounding text is documenting the don't-use list. If the framing reads oddly post-sweep, rephrase the line; don't excise the phrase.
- `apps/website/e2e/website.spec.ts` — if the test asserts the phrase, update the assertion. PR #358 moved differentiator assertions to stable ids, but landing tests may still check page title text. Update assertions.

- [ ] **Step 3: Verify builds**

```bash
npx nx run website:build
npx nx run cockpit:build
```

Expected: green.

- [ ] **Step 4: Verify the phrase is gone from the swept surfaces**

```bash
git grep "Angular Agent Framework" -- ':!CHANGELOG.md' ':!release-notes/*' ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*' ':!docs/gtm/reports/*'
```

Expected: zero matches OR only the documented don't-use mention in gtm.md (acceptable).

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(gtm): category sweep — "Angular Agent Framework" → "Agent UI for Angular"

Per-file review across page titles, OG metadata, hero eyebrow, email
templates, README files, gtm.md, and llms.txt routes. CHANGELOG.md,
release-notes, and superpowers spec/plan history excluded.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 0.2: A2UI v0.9 sweep — "A2UI v1" → "A2UI v0.9-compatible"

- [ ] **Step 1: Enumerate**

```bash
git grep -l 'A2UI v1\b' -- ':!CHANGELOG.md' ':!release-notes/*' ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*' ':!docs/gtm/reports/*'
```

Known matches (from inspection): `apps/website/src/app/render/page.tsx` (3 occurrences), `apps/website/src/app/page.tsx` (1), `libs/chat/README.md` (1), `libs/render/README.md` (1+), `libs/chat/src/lib/compositions/chat/chat.component.ts` (1 — in a comment), `libs/chat/src/lib/streaming/content-classifier.spec.ts` (2 — in test descriptions referring to the protocol envelope keys).

- [ ] **Step 2: Per-file review and replace**

Replacement rules:
- User-facing copy ("Google A2UI v1", "A2UI v1 protocol"): `"A2UI v1"` → `"A2UI v0.9-compatible"`.
- Code comments documenting the protocol envelope (e.g., `// A2UI v1 envelope keys (canonical Google shape).`): change to `// A2UI v0.9 envelope keys (canonical Google shape).` — these reference the actual on-the-wire spec version, not the marketing claim.
- Test descriptions ("parses A2UI v1 messages"): change to `"parses A2UI v0.9 messages"` for the same reason.
- The bare token `"v1"` is too short for a safe global edit; only edit where it appears as `"A2UI v1"`.

- [ ] **Step 3: Verify**

```bash
npx nx run website:build
npx nx run-many -t test -p chat,render
git grep 'A2UI v1\b' -- ':!CHANGELOG.md' ':!release-notes/*' ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*' ':!docs/gtm/reports/*'
```

Expected: builds green, tests green, zero `A2UI v1` matches.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(gtm): A2UI sweep — "A2UI v1" → "A2UI v0.9-compatible"

Per-file review. User-facing copy uses "v0.9-compatible"; code comments
and test descriptions referencing the on-the-wire envelope use plain
"A2UI v0.9". Tightens claims until v1 is verified.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 0.3: Telemetry phrasing sweep — "No telemetry" → "App telemetry off by default"

- [ ] **Step 1: Enumerate**

```bash
git grep -E -l "No telemetry|no telemetry" -- ':!CHANGELOG.md' ':!release-notes/*' ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*' ':!docs/gtm/reports/*' ':!libs/telemetry/*'
```

(The `libs/telemetry/*` exclusion is deliberate — the trust contract README and source comments use the canonical phrasing already; don't churn them.)

Known surfaces likely to hit: hero proof row (current Hero.tsx still says "No telemetry" or similar), pricing page copy, footer, marketing collateral.

- [ ] **Step 2: Per-file review and replace**

Replacement rules:
- Marketing copy bullets / pills: `"No telemetry"` → `"App telemetry off by default"`. When the surrounding context already says "no app/runtime telemetry", change to the canonical phrase.
- When the sweep target is in a structured pill/list with a hyperlink slot, link to `libs/telemetry/README.md` (relative path) where possible.
- Code comments that say `"No telemetry is emitted unless..."` describe a runtime behavior, not a marketing claim — leave them. Example: `libs/langgraph/src/lib/agent.types.ts:259`. Skip these.

- [ ] **Step 3: Verify**

```bash
npx nx run website:build
git grep -E "No telemetry|no telemetry" -- ':!CHANGELOG.md' ':!release-notes/*' ':!docs/superpowers/specs/*' ':!docs/superpowers/plans/*' ':!docs/gtm/reports/*' ':!libs/telemetry/*'
```

Expected: only the code-comment occurrences remain (acceptable).

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "$(cat <<'EOF'
chore(gtm): telemetry phrasing sweep — "App telemetry off by default"

Replaces marketing claims of "No telemetry" with the precise phrasing
from libs/telemetry/README.md trust contract. Code comments describing
runtime behavior are left as-is (they correctly describe the silent
default, not a marketing claim).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 1 — Hero rewrite + CTA tracking

### Task 1.1: Add `CtaId` union + tighten `AnalyticsProperties.cta_id`

**File:** `apps/website/src/lib/analytics/events.ts`

- [ ] **Step 1: Add the union below the existing types**

Open `apps/website/src/lib/analytics/events.ts`. Find the existing `AnalyticsSurface` union (around line 24). Append after it:

```typescript
export type CtaId =
  | 'hero_install'
  | 'hero_talk_to_engineers';
```

- [ ] **Step 2: Tighten `AnalyticsProperties.cta_id`**

In the same file, find the `AnalyticsProperties` type. Change:

```typescript
cta_id?: string;
```

to:

```typescript
cta_id?: CtaId;
```

If `cta_id?` is currently typed as `string` (no separate line — it's covered by the index signature `[key: string]: ...`), add an explicit `cta_id?: CtaId;` line before the index signature so it takes precedence.

- [ ] **Step 3: Build to surface existing callers**

```bash
npx nx run website:build
```

If a callsite uses `cta_id` with a string literal not in the union, the build will fail. **Fix each callsite by either adding the literal to `CtaId` OR removing/fixing the call** — the goal is for every emitted `cta_id` to be a known, documented identifier.

Expected callsites (verify with `grep -rn "cta_id:" apps/website/src --include="*.tsx" --include="*.ts" | grep -v ".spec."`): probably the `AnnouncementToast`, `Footer`, and `client.ts` `track(...)` wrappers if any of them stamp a cta_id. Add their literal values to `CtaId` if they're stable, or remove the property if not.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/lib/analytics/events.ts apps/website/src/components apps/website/src/lib
git commit -m "$(cat <<'EOF'
feat(website): typed CtaId union + tightened AnalyticsProperties.cta_id

Locks the cta_id property to a known union so misspellings or
inconsistent slicing in PostHog get caught at build time. Initial
members: hero_install (developer track), hero_talk_to_engineers
(enterprise track). Existing callers update to use union members.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 1.2: TDD — Hero.spec.tsx for both CTAs

**File:** `apps/website/src/components/landing/Hero.spec.tsx` (NEW)

- [ ] **Step 1: Write the failing test**

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const writeTextMock = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock('../../lib/analytics/client', () => ({
  track: trackMock,
}));

beforeEach(() => {
  trackMock.mockClear();
  writeTextMock.mockClear();
  Object.assign(navigator, { clipboard: { writeText: writeTextMock } });
});

describe('Hero', () => {
  it('renders the locked H1 and subhead', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    expect(screen.getByRole('heading', { level: 1 }).textContent)
      .toMatch(/Ship production agent UIs in Angular\./);
    expect(screen.getByText(/Signal-native chat, threads, interrupts/)).toBeTruthy();
  });

  it('primary CTA copies the install command and fires cta_id=hero_install', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    const btn = screen.getByRole('button', { name: /Install @ngaf\/chat/i });
    fireEvent.click(btn);
    expect(writeTextMock).toHaveBeenCalledWith('npm install @ngaf/chat');
    expect(trackMock).toHaveBeenCalledWith('marketing:cta_click', expect.objectContaining({
      cta_id: 'hero_install',
      track: 'developer',
      surface: 'home',
    }));
  });

  it('secondary CTA links to /contact and fires cta_id=hero_talk_to_engineers', async () => {
    const { Hero } = await import('./Hero');
    render(<Hero />);
    const link = screen.getByRole('link', { name: /Talk to our engineers/i });
    expect(link.getAttribute('href')).toBe('/contact?source=home_hero&track=enterprise');
    fireEvent.click(link);
    expect(trackMock).toHaveBeenCalledWith('marketing:cta_click', expect.objectContaining({
      cta_id: 'hero_talk_to_engineers',
      track: 'enterprise',
      surface: 'home',
    }));
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run src/components/landing/Hero.spec.tsx
```

Expected: fails (Hero still has the old copy + old CTAs).

- [ ] **Step 3: NO COMMIT** — Task 1.3 implements.

### Task 1.3: Implement Hero rewrite

**File:** `apps/website/src/components/landing/Hero.tsx` (MODIFIED — full content replacement of the left column; right column collage unchanged)

- [ ] **Step 1: Replace Hero.tsx**

```typescript
'use client';

import { useCallback, useState } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { Button } from '../ui/Button';
import { BrowserFrame } from '../ui/BrowserFrame';
import { Pill } from '../ui/Pill';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';

const INSTALL_COMMAND = 'npm install @ngaf/chat';
const COPY_FEEDBACK_MS = 1500;

function PrimaryInstallButton() {
  const [copied, setCopied] = useState(false);

  const onClick = useCallback(async () => {
    track(analyticsEvents.marketingCtaClick, {
      cta_id: 'hero_install',
      track: 'developer',
      surface: 'home',
    });
    try {
      await navigator.clipboard?.writeText(INSTALL_COMMAND);
      setCopied(true);
      setTimeout(() => setCopied(false), COPY_FEEDBACK_MS);
    } catch {
      // Silent fail. Event still fires; users can copy from the docs page.
    }
  }, []);

  return (
    <Button variant="primary" size="lg" onClick={onClick}>
      {copied ? 'Copied ✓' : 'Install @ngaf/chat'}
    </Button>
  );
}

function SecondaryTalkButton() {
  const onClick = useCallback(() => {
    track(analyticsEvents.marketingCtaClick, {
      cta_id: 'hero_talk_to_engineers',
      track: 'enterprise',
      surface: 'home',
    });
  }, []);

  return (
    <Button
      variant="ghost"
      size="lg"
      href="/contact?source=home_hero&track=enterprise"
      onClick={onClick}
    >
      Talk to our engineers
    </Button>
  );
}

export function Hero() {
  return (
    <Section surface="canvas" ariaLabelledBy="hero-heading">
      <Container>
        <div
          className="hero-grid"
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: 64,
            alignItems: 'center',
          }}
        >
          {/* Left column */}
          <div>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Agent UI for Angular · MIT
            </Eyebrow>
            <h1
              id="hero-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                fontWeight: 700,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 24,
                letterSpacing: '-0.02em',
              }}
            >
              Ship production agent UIs in Angular.
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                marginBottom: 32,
                maxWidth: '54ch',
              }}
            >
              Signal-native chat, threads, interrupts, tool progress, and generative UI for LangGraph, AG-UI, and A2UI. MIT-licensed, self-hostable, app telemetry off by default, no React rewrite.
            </p>
            <div style={{ display: 'flex', gap: 12, marginBottom: 24, flexWrap: 'wrap' }}>
              <PrimaryInstallButton />
              <SecondaryTalkButton />
            </div>
            <div
              style={{
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
                marginBottom: 12,
              }}
            >
              <Pill variant="accent">MIT</Pill>
              <Pill variant="neutral">Angular-native Signals</Pill>
              <Pill variant="neutral">LangGraph + AG-UI</Pill>
              <Pill variant="neutral">A2UI-compatible</Pill>
              <Pill variant="neutral">Self-hostable</Pill>
              <Pill variant="neutral">App telemetry off by default</Pill>
            </div>
            <p
              style={{
                margin: 0,
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textMuted,
                fontStyle: 'italic',
                maxWidth: '60ch',
              }}
            >
              Not another backend agent runtime. Keep LangGraph, Genkit, Mastra, CrewAI, or your own service. Cacheplane solves the Angular UI layer.
            </p>
          </div>

          {/* Right column — KEEP existing layered collage exactly as-is. Re-paste from
              the prior version of this file (BrowserFrame x 2 with screenshots + code). */}
          <div style={{ position: 'relative', minHeight: 420 }} aria-hidden="true">
            {/* ...preserve the collage block from the prior Hero.tsx... */}
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

**Important:** the right-column collage in the prior `Hero.tsx` is 70+ lines of `<BrowserFrame>` markup. Preserve it verbatim. Don't re-author it.

- [ ] **Step 2: Run the spec from Task 1.2 — see pass**

```bash
cd apps/website && npx vitest run src/components/landing/Hero.spec.tsx
```

Expected: 3 tests passing.

- [ ] **Step 3: Run the full landing test suite + build**

```bash
cd apps/website && npx vitest run src/components/landing
npx nx run website:build
```

Expected: green. Pre-existing failures unrelated to Hero (e2e under wrong runner, open-in-cockpit JSX) may persist — not in scope.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx apps/website/src/components/landing/Hero.spec.tsx
git commit -m "$(cat <<'EOF'
feat(website): hero rewrite per Spec 2 — Direction A copy + tracked CTAs

- H1: "Ship production agent UIs in Angular."
- Subhead per docs/gtm/messaging.md
- Primary CTA: copies "npm install @ngaf/chat", fires cta_id=hero_install
  (track=developer)
- Secondary CTA: links to /contact?source=home_hero&track=enterprise,
  fires cta_id=hero_talk_to_engineers (track=enterprise)
- Eyebrow updated to "Agent UI for Angular · MIT"
- Proof pills + subline match the locked copy

Three tests cover both CTAs (event payload + clipboard write + link href).

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 2 — `/contact` route + supporting components

### Task 2.1: `getGitHubStars` helper + spec

**Files:** `apps/website/src/lib/github.ts` (NEW), `apps/website/src/lib/github.spec.ts` (NEW)

- [ ] **Step 1: Write the failing test**

Create `apps/website/src/lib/github.spec.ts`:

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { getGitHubStars } from './github';

const fetchMock = vi.hoisted(() => vi.fn());

beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

describe('getGitHubStars', () => {
  it('returns the stargazers_count on 2xx', async () => {
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => ({ stargazers_count: 1234 }),
    });
    const stars = await getGitHubStars('cacheplane/angular-agent-framework');
    expect(stars).toBe(1234);
    expect(fetchMock).toHaveBeenCalledWith(
      'https://api.github.com/repos/cacheplane/angular-agent-framework',
      expect.objectContaining({
        next: { revalidate: 86400 },
      }),
    );
  });

  it('returns null on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, json: async () => ({}) });
    expect(await getGitHubStars('owner/repo')).toBeNull();
  });

  it('returns null when fetch throws', async () => {
    fetchMock.mockRejectedValue(new Error('network'));
    expect(await getGitHubStars('owner/repo')).toBeNull();
  });

  it('returns null when payload lacks stargazers_count', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });
    expect(await getGitHubStars('owner/repo')).toBeNull();
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run src/lib/github.spec.ts
```

Expected: fails (`Cannot find module './github'`).

- [ ] **Step 3: Implement**

Create `apps/website/src/lib/github.ts`:

```typescript
// SPDX-License-Identifier: MIT
export async function getGitHubStars(
  repo = 'cacheplane/angular-agent-framework',
): Promise<number | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      next: { revalidate: 86400 },
      headers: { Accept: 'application/vnd.github+json' },
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { stargazers_count?: number };
    return typeof data.stargazers_count === 'number' ? data.stargazers_count : null;
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run, see pass**

```bash
cd apps/website && npx vitest run src/lib/github.spec.ts
```

Expected: 4 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/lib/github.ts apps/website/src/lib/github.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): getGitHubStars helper with ISR + silent-fail fallback

Server-only helper that fetches repo stargazer count via Next.js fetch
with 24h revalidate. Returns null on any failure (non-2xx, network
error, missing field) so callers can render a graceful fallback.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.2: `GitHubStarsPill` component + spec

**Files:** `apps/website/src/components/contact/GitHubStarsPill.tsx` (NEW), `apps/website/src/components/contact/GitHubStarsPill.spec.tsx` (NEW)

- [ ] **Step 1: Write the failing test**

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

vi.mock('../../lib/github', () => ({
  getGitHubStars: vi.fn(),
}));

import { getGitHubStars } from '../../lib/github';
import { GitHubStarsPill } from './GitHubStarsPill';

describe('GitHubStarsPill', () => {
  it('renders with star count when fetch succeeds', async () => {
    (getGitHubStars as ReturnType<typeof vi.fn>).mockResolvedValue(1234);
    const el = await GitHubStarsPill();
    const { container } = render(el);
    expect(container.textContent).toMatch(/1,234/);
    expect(container.querySelector('a')?.getAttribute('href'))
      .toBe('https://github.com/cacheplane/angular-agent-framework');
  });

  it('renders fallback when fetch returns null', async () => {
    (getGitHubStars as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const el = await GitHubStarsPill();
    const { container } = render(el);
    expect(container.textContent).toMatch(/GitHub/);
    expect(container.textContent).not.toMatch(/\d/);
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run src/components/contact/GitHubStarsPill.spec.tsx
```

- [ ] **Step 3: Implement**

```typescript
// SPDX-License-Identifier: MIT
import { Pill } from '../ui/Pill';
import { getGitHubStars } from '../../lib/github';

const REPO = 'cacheplane/angular-agent-framework';
const REPO_URL = `https://github.com/${REPO}`;

export async function GitHubStarsPill() {
  const stars = await getGitHubStars(REPO);
  const label = stars != null ? `★ ${stars.toLocaleString()} on GitHub` : 'GitHub';
  return (
    <a
      href={REPO_URL}
      target="_blank"
      rel="noopener noreferrer"
      style={{ textDecoration: 'none' }}
    >
      <Pill variant="neutral">{label}</Pill>
    </a>
  );
}
```

- [ ] **Step 4: Run, see pass + commit**

```bash
cd apps/website && npx vitest run src/components/contact/GitHubStarsPill.spec.tsx
```

Expected: 2 tests passing.

```bash
git add apps/website/src/components/contact/GitHubStarsPill.tsx apps/website/src/components/contact/GitHubStarsPill.spec.tsx
git commit -m "$(cat <<'EOF'
feat(website): GitHubStarsPill server component with ISR-backed star count

Renders "★ <n> on GitHub" when the fetch succeeds; falls back to a
plain "GitHub" pill on null. Links to the repo regardless. ISR via
the getGitHubStars helper means at most one fetch per 24h.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.3: `ContactForm` component + spec

**Files:** `apps/website/src/components/contact/ContactForm.tsx` (NEW), `apps/website/src/components/contact/ContactForm.spec.tsx` (NEW)

- [ ] **Step 1: Write the failing test**

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';

const trackMock = vi.hoisted(() => vi.fn());
const fetchMock = vi.hoisted(() => vi.fn());

vi.mock('../../lib/analytics/client', () => ({ track: trackMock }));

vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams('?source=home_hero&track=enterprise'),
}));

beforeEach(() => {
  trackMock.mockClear();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  Object.defineProperty(document, 'referrer', {
    value: 'https://cacheplane.ai/pricing',
    configurable: true,
  });
});

describe('ContactForm', () => {
  it('submits with email only and fires lead_form_submit + lead_form_success', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { ContactForm } = await import('./ContactForm');
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/email/i), {
      target: { value: 'jane@acme.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body.email).toBe('jane@acme.com');
    expect(body.source_page).toBe('home_hero');
    expect(body.track).toBe('enterprise');
    expect(body.referrer_host).toBe('cacheplane.ai');

    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_submit',
      expect.objectContaining({ surface: 'contact' }),
    );
    expect(trackMock).toHaveBeenCalledWith(
      'marketing:lead_form_success',
      expect.objectContaining({ surface: 'contact' }),
    );
  });

  it('submits with all optional fields populated', async () => {
    fetchMock.mockResolvedValue({ ok: true });
    const { ContactForm } = await import('./ContactForm');
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Jane Smith' } });
    fireEvent.change(screen.getByLabelText(/company/i), { target: { value: 'Acme' } });
    fireEvent.change(screen.getByLabelText(/message/i), { target: { value: 'Hi' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const body = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(body).toMatchObject({
      email: 'jane@acme.com',
      name: 'Jane Smith',
      company: 'Acme',
      message: 'Hi',
    });
  });

  it('fires lead_form_fail on non-2xx', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 500 });
    const { ContactForm } = await import('./ContactForm');
    render(<ContactForm />);

    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: 'jane@acme.com' } });
    fireEvent.click(screen.getByRole('button', { name: /send/i }));

    await waitFor(() =>
      expect(trackMock).toHaveBeenCalledWith(
        'marketing:lead_form_fail',
        expect.objectContaining({ surface: 'contact' }),
      ),
    );
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run src/components/contact/ContactForm.spec.tsx
```

- [ ] **Step 3: Implement**

```typescript
// SPDX-License-Identifier: MIT
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { tokens } from '@ngaf/design-tokens';
import { Button } from '../ui/Button';
import { track } from '../../lib/analytics/client';
import { analyticsEvents } from '../../lib/analytics/events';

type Status = 'idle' | 'sending' | 'sent' | 'error';

function sanitizeReferrerHost(): string | undefined {
  if (typeof document === 'undefined' || !document.referrer) return undefined;
  try {
    return new URL(document.referrer).hostname;
  } catch {
    return undefined;
  }
}

export function ContactForm() {
  const params = useSearchParams();
  const [status, setStatus] = useState<Status>('idle');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [company, setCompany] = useState('');
  const [message, setMessage] = useState('');

  const sourcePage = params.get('source') ?? 'contact_direct';
  const trackParam = (params.get('track') ?? 'enterprise') as string;
  const ctaId = params.get('cta_id') ?? undefined;
  const paper = params.get('paper') ?? undefined;

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!email) return;
    setStatus('sending');
    track(analyticsEvents.marketingLeadFormSubmit, {
      surface: 'contact',
      source_section: 'contact-form',
    });
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          name: name || undefined,
          company: company || undefined,
          message: message || undefined,
          source_page: sourcePage,
          track: trackParam,
          cta_id: ctaId,
          paper,
          referrer_host: sanitizeReferrerHost(),
        }),
      });
      if (res.ok) {
        track(analyticsEvents.marketingLeadFormSuccess, {
          surface: 'contact',
          source_section: 'contact-form',
        });
        setStatus('sent');
      } else {
        track(analyticsEvents.marketingLeadFormFail, {
          surface: 'contact',
          source_section: 'contact-form',
          error_reason: 'api_error',
        });
        setStatus('error');
      }
    } catch {
      track(analyticsEvents.marketingLeadFormFail, {
        surface: 'contact',
        source_section: 'contact-form',
        error_reason: 'network_error',
      });
      setStatus('error');
    }
  }

  if (status === 'sent') {
    return (
      <div role="status" style={{ color: tokens.colors.textPrimary, padding: 24 }}>
        Thanks. We&apos;ll be in touch within one business day.
      </div>
    );
  }

  const inputStyle: React.CSSProperties = {
    display: 'block',
    width: '100%',
    padding: '10px 12px',
    fontSize: tokens.typography.body.size,
    fontFamily: tokens.typography.body.family,
    color: tokens.colors.textPrimary,
    background: tokens.surfaces.surface,
    border: `1px solid ${tokens.surfaces.border}`,
    borderRadius: 6,
    marginTop: 4,
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16, maxWidth: 480 }}>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Email
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Name <span style={{ color: tokens.colors.textMuted }}>(optional)</span>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Company <span style={{ color: tokens.colors.textMuted }}>(optional)</span>
        <input
          type="text"
          value={company}
          onChange={(e) => setCompany(e.target.value)}
          style={inputStyle}
        />
      </label>
      <label style={{ fontSize: tokens.typography.body.size, color: tokens.colors.textPrimary }}>
        Message <span style={{ color: tokens.colors.textMuted }}>(optional)</span>
        <textarea
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="What are you shipping?"
          style={{ ...inputStyle, resize: 'vertical' }}
        />
      </label>
      <Button variant="primary" size="lg" type="submit" disabled={status === 'sending'}>
        {status === 'sending' ? 'Sending…' : 'Send'}
      </Button>
      {status === 'error' && (
        <div role="alert" style={{ color: tokens.colors.danger ?? '#c00' }}>
          Something went wrong. Please try again or email us directly.
        </div>
      )}
    </form>
  );
}
```

- [ ] **Step 4: Run, see pass**

```bash
cd apps/website && npx vitest run src/components/contact/ContactForm.spec.tsx
```

Expected: 3 tests passing.

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/components/contact/ContactForm.tsx apps/website/src/components/contact/ContactForm.spec.tsx
git commit -m "$(cat <<'EOF'
feat(website): ContactForm — email required, name/company/message optional

POSTs to /api/leads with hidden attribution fields (source_page, track,
cta_id, paper, referrer_host) populated from URL params + document
.referrer. Fires marketing:lead_form_submit / _success / _fail with
surface=contact. Inline success state; no redirect.

Three unit tests cover email-only submit, full-fields submit, failure path.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.4: `SlaCard` + `AltChannelRow` static components

**Files:** `apps/website/src/components/contact/SlaCard.tsx` (NEW), `apps/website/src/components/contact/AltChannelRow.tsx` (NEW)

- [ ] **Step 1: Create SlaCard.tsx**

```typescript
// SPDX-License-Identifier: MIT
import { tokens } from '@ngaf/design-tokens';
import { Card } from '../ui/Card';

export function SlaCard() {
  return (
    <Card style={{ padding: 20, maxWidth: 480 }}>
      <p
        style={{
          margin: 0,
          color: tokens.colors.textPrimary,
          fontSize: tokens.typography.body.size,
          fontFamily: tokens.typography.body.family,
          lineHeight: tokens.typography.body.line,
        }}
      >
        Brian or someone on the team replies personally — from a real inbox, not <code>noreply@</code>. We read every message.
      </p>
    </Card>
  );
}
```

If `Card` doesn't exist in `apps/website/src/components/ui/Card.tsx`, substitute a plain `<div>` styled with `border: 1px solid var(--border)` and a small radius. Check first.

- [ ] **Step 2: Create AltChannelRow.tsx**

```typescript
// SPDX-License-Identifier: MIT
import { tokens } from '@ngaf/design-tokens';

const linkStyle: React.CSSProperties = {
  color: tokens.colors.accent,
  textDecoration: 'none',
  fontSize: tokens.typography.body.size,
  fontFamily: tokens.typography.body.family,
};

export function AltChannelRow() {
  return (
    <p style={{ display: 'flex', gap: 16, alignItems: 'center', flexWrap: 'wrap', margin: 0 }}>
      <a href="/docs" style={linkStyle}>docs</a>
      <span style={{ color: tokens.colors.textMuted }}>·</span>
      <a href="https://github.com/cacheplane/angular-agent-framework/issues" style={linkStyle}>GitHub issues</a>
      <span style={{ color: tokens.colors.textMuted }}>·</span>
      <a href="https://discord.gg/cacheplane" style={linkStyle}>Discord</a>
    </p>
  );
}
```

If the Discord URL is unknown, leave it as `https://discord.gg/cacheplane` and the operator can adjust post-merge.

- [ ] **Step 3: Build to confirm**

```bash
npx nx run website:build
```

Expected: green.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/contact/SlaCard.tsx apps/website/src/components/contact/AltChannelRow.tsx
git commit -m "$(cat <<'EOF'
feat(website): SlaCard + AltChannelRow static contact-page subcomponents

Renders the "replies personally from a real inbox" promise and the
docs / GitHub issues / Discord row below the contact form, per the
locked Direction A.v2 spec.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 2.5: `/contact` page composition

**File:** `apps/website/src/app/contact/page.tsx` (NEW)

- [ ] **Step 1: Create the page**

```typescript
// SPDX-License-Identifier: MIT
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { ContactForm } from '../../components/contact/ContactForm';
import { GitHubStarsPill } from '../../components/contact/GitHubStarsPill';
import { SlaCard } from '../../components/contact/SlaCard';
import { AltChannelRow } from '../../components/contact/AltChannelRow';

export const metadata: Metadata = {
  title: 'Talk to an engineer — Cacheplane',
  description: "Tell us what you're shipping. We'll reply within one business day — usually with code, not a calendar invite.",
  openGraph: {
    title: 'Talk to an engineer — Cacheplane',
    description: "Tell us what you're shipping. We'll reply within one business day.",
    type: 'website',
  },
};

export default function ContactPage() {
  return (
    <Section surface="canvas" ariaLabelledBy="contact-heading">
      <Container>
        <div style={{ maxWidth: 720 }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Contact</Eyebrow>
          <h1
            id="contact-heading"
            style={{
              fontFamily: tokens.typography.h1.family,
              fontSize: tokens.typography.h1.size,
              lineHeight: tokens.typography.h1.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 16,
              letterSpacing: '-0.02em',
            }}
          >
            Talk to an engineer.
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: 0,
              marginBottom: 24,
              maxWidth: '60ch',
            }}
          >
            Tell us what you&apos;re shipping. We&apos;ll reply within one business day — usually with code, not a calendar invite.
          </p>
          <div style={{ marginBottom: 24 }}>
            <SlaCard />
          </div>
          <Suspense>
            <ContactForm />
          </Suspense>
          <div style={{ marginTop: 32, display: 'flex', flexDirection: 'column', gap: 16 }}>
            <GitHubStarsPill />
            <AltChannelRow />
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

The `<Suspense>` wrapper is required because `ContactForm` uses `useSearchParams()` which Next.js demands wrap in Suspense.

- [ ] **Step 2: Verify build + manual smoke**

```bash
npx nx run website:build
```

Expected: green. Page reachable at `/contact` and `/contact?source=home_hero&track=enterprise`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/contact/page.tsx
git commit -m "$(cat <<'EOF'
feat(website): /contact route per Direction A.v2

Server-rendered page composing ContactForm, SlaCard, GitHubStarsPill,
and AltChannelRow. Headline + subhead from docs/gtm/messaging.md.
ContactForm wrapped in Suspense for useSearchParams compatibility.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 3 — Pricing CompatibilityMatrix

### Task 3.1: `CompatibilityMatrix` component + spec

**Files:** `apps/website/src/components/pricing/CompatibilityMatrix.tsx` (NEW), `apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx` (NEW)

- [ ] **Step 1: Write the failing test**

```typescript
// SPDX-License-Identifier: MIT
import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CompatibilityMatrix } from './CompatibilityMatrix';

describe('CompatibilityMatrix', () => {
  it('renders four buckets with the conservative content', () => {
    render(<CompatibilityMatrix />);
    expect(screen.getByText(/Supported/)).toBeTruthy();
    expect(screen.getByText(/Angular 20, 21/)).toBeTruthy();
    expect(screen.getByText(/Experimental/)).toBeTruthy();
    expect(screen.getByText(/Planned/)).toBeTruthy();
    expect(screen.getByText(/Angular 22/)).toBeTruthy();
    expect(screen.getByText(/Unsupported/)).toBeTruthy();
    expect(screen.getByText(/≤19/)).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run, see fail**

```bash
cd apps/website && npx vitest run src/components/pricing/CompatibilityMatrix.spec.tsx
```

- [ ] **Step 3: Implement**

```typescript
// SPDX-License-Identifier: MIT
import { tokens } from '@ngaf/design-tokens';

interface Row {
  label: string;
  versions: string;
  tone: 'success' | 'warn' | 'info' | 'muted';
}

const ROWS: ReadonlyArray<Row> = [
  { label: 'Supported',    versions: 'Angular 20, 21', tone: 'success' },
  { label: 'Experimental', versions: '—',              tone: 'warn'    },
  { label: 'Planned',      versions: 'Angular 22',     tone: 'info'    },
  { label: 'Unsupported',  versions: 'Angular ≤19',    tone: 'muted'   },
];

const TONE_COLORS: Record<Row['tone'], string> = {
  success: '#16a34a',
  warn:    '#d97706',
  info:    tokens.colors.accent,
  muted:   tokens.colors.textMuted,
};

export function CompatibilityMatrix() {
  return (
    <div
      style={{
        border: `1px solid ${tokens.surfaces.border}`,
        borderRadius: 8,
        overflow: 'hidden',
      }}
    >
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr style={{ background: tokens.surfaces.surface }}>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                fontSize: tokens.typography.body.size,
                borderBottom: `1px solid ${tokens.surfaces.border}`,
              }}
            >
              Status
            </th>
            <th
              style={{
                textAlign: 'left',
                padding: '12px 16px',
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                fontSize: tokens.typography.body.size,
                borderBottom: `1px solid ${tokens.surfaces.border}`,
              }}
            >
              Angular versions
            </th>
          </tr>
        </thead>
        <tbody>
          {ROWS.map((row) => (
            <tr key={row.label}>
              <td
                style={{
                  padding: '12px 16px',
                  fontSize: tokens.typography.body.size,
                  color: TONE_COLORS[row.tone],
                  fontWeight: 500,
                  borderBottom: `1px solid ${tokens.surfaces.border}`,
                }}
              >
                {row.label}
              </td>
              <td
                style={{
                  padding: '12px 16px',
                  fontSize: tokens.typography.body.size,
                  color: tokens.colors.textSecondary,
                  fontFamily: tokens.typography.fontMono,
                  borderBottom: `1px solid ${tokens.surfaces.border}`,
                }}
              >
                {row.versions}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
```

- [ ] **Step 4: Run, see pass + commit**

```bash
cd apps/website && npx vitest run src/components/pricing/CompatibilityMatrix.spec.tsx
```

Expected: 1 test passing.

```bash
git add apps/website/src/components/pricing/CompatibilityMatrix.tsx apps/website/src/components/pricing/CompatibilityMatrix.spec.tsx
git commit -m "$(cat <<'EOF'
feat(website): CompatibilityMatrix component

Replaces the "All Angular versions" risk claim with a real
supported/experimental/planned/unsupported matrix. Initial content
matches the peer-deps reality: Angular 20, 21 supported; 22 planned;
≤19 unsupported.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 3.2: Wire `CompatibilityMatrix` into `/pricing`

**File:** `apps/website/src/app/pricing/page.tsx` (MODIFIED)

- [ ] **Step 1: Locate the "All Angular versions" claim**

```bash
grep -n "All Angular\|Angular versions" apps/website/src/app/pricing/page.tsx apps/website/src/components/pricing/*.tsx 2>/dev/null
```

Likely match in either `page.tsx` directly or inside `CompareTable.tsx` / `PricingGrid.tsx`. Find the exact text.

- [ ] **Step 2: Replace with `<CompatibilityMatrix />`**

Add the import:

```typescript
import { CompatibilityMatrix } from '../../components/pricing/CompatibilityMatrix';
```

Replace the offending row/cell/paragraph with the matrix. If the claim sits inside a feature-row of a table cell that just says "All Angular versions", swap that cell content for "See compatibility matrix below" and render the matrix as its own labeled subsection above or below the `CompareTable`.

A safe insertion location: a new `<Section>` block between `<CompareTable />` and `<LeadForm />` titled "Compatibility":

```tsx
<Section surface="canvas">
  <Container>
    <Eyebrow style={{ marginBottom: 12 }}>Compatibility</Eyebrow>
    <h2
      style={{
        fontFamily: tokens.typography.h2.family,
        fontSize: tokens.typography.h2.size,
        margin: 0,
        marginBottom: 16,
        color: tokens.colors.textPrimary,
      }}
    >
      Angular version support
    </h2>
    <p
      style={{
        margin: 0,
        marginBottom: 24,
        color: tokens.colors.textSecondary,
        maxWidth: '60ch',
      }}
    >
      We ship against the versions our CI tests. Other versions may work but aren&apos;t guaranteed.
    </p>
    <CompatibilityMatrix />
  </Container>
</Section>
```

- [ ] **Step 3: Build + commit**

```bash
npx nx run website:build
git add apps/website/src/app/pricing/page.tsx
git commit -m "$(cat <<'EOF'
feat(website): wire CompatibilityMatrix into /pricing

Replaces the "All Angular versions" claim with a real matrix. New
"Compatibility" section sits between CompareTable and LeadForm.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 4 — Loosen `/api/leads` + Resend template + messaging.md

### Task 4.1: Loosen `/api/leads` validation + adapt Resend subject

**Files:** `apps/website/src/app/api/leads/route.ts` (MODIFIED), `apps/website/emails/lead-notification.ts` (MODIFIED)

- [ ] **Step 1: Update validation**

In `apps/website/src/app/api/leads/route.ts`, find the validation block:

```typescript
if (!name || !email) {
  return NextResponse.json({ error: 'name and email required' }, { status: 400 });
}
```

Replace with:

```typescript
if (!email) {
  return NextResponse.json({ error: 'email required' }, { status: 400 });
}
```

- [ ] **Step 2: Update the Resend subject construction**

Find the line that builds the subject:

```typescript
subject: `New lead: ${name}${company ? ` at ${company}` : ''}`,
```

Replace with:

```typescript
subject: `New lead: ${name || email}${company ? ` at ${company}` : ''}`,
```

- [ ] **Step 3: Update `emails/lead-notification.ts` to handle missing name**

Read the file. If it renders `<h1>${name}</h1>` or similar, replace with `<h1>${name || 'No name provided'}</h1>` — or surface the email as the fallback identity. The shape of this template varies; pattern-match the prior behavior and make name optional throughout.

- [ ] **Step 4: Verify build**

```bash
npx nx run website:build
```

- [ ] **Step 5: Commit**

```bash
git add apps/website/src/app/api/leads/route.ts apps/website/emails/lead-notification.ts
git commit -m "$(cat <<'EOF'
feat(website): loosen /api/leads validation to email-only

Spec 2's /contact form collects email (required) + name, company,
message (all optional). Pricing's LeadForm continues to send name.
Resend notification subject falls back to email when name is missing.
The lead-notification email template no longer requires name.

Spec 1E's qualified-lead gate is unchanged — still requires non-personal
email + non-empty company. Contact-form leads without a company fire
marketing:lead_form_success but not marketing:lead_qualified, by design.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

### Task 4.2: Update `docs/gtm/messaging.md`

**File:** `docs/gtm/messaging.md` (MODIFIED)

- [ ] **Step 1: Update the Fields line in the Contact page section**

Find:

```
**Fields:** email + free-text body. No stack dropdown, no company size, no "how did you hear."
```

Replace with:

```
**Fields:** email (required) + name, company, message (all optional). No stack dropdown, no company size, no "how did you hear." Optional fields feed enterprise-qualification when present.
```

- [ ] **Step 2: Commit**

```bash
git add docs/gtm/messaging.md
git commit -m "$(cat <<'EOF'
docs(gtm): update Contact page §Fields per Spec 2 implementation

Direction A.v2 originally locked "email + free-text body." During Spec 2
implementation we expanded to email (required) + name, company, message
(all optional) so Spec 1E's captureLeadQualified gate (which requires
company) still works for contact-form submissions.

Co-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>
EOF
)"
```

---

## Phase 5 — Verification

### Task 5.1: Final test + build sweep (no commit)

- [ ] **Step 1: Run tests**

```bash
npx nx run-many -t test -p telemetry,cockpit
cd apps/website && npx vitest run src/components/landing src/components/contact src/components/pricing src/lib/github.spec.ts src/lib/analytics/server.spec.ts
```

Expected: green. Pre-existing e2e + open-in-cockpit failures (unrelated) may persist.

- [ ] **Step 2: Run builds**

```bash
npx nx run-many -t build -p website,cockpit,telemetry
```

Expected: green.

- [ ] **Step 3: Drift guard sanity (no new events; the guard should still pass)**

```bash
npx nx run posthog-tools:test
```

Expected: green. (Spec 2 doesn't introduce new event names — only `cta_id` property values, which the drift guard doesn't scan.)

- [ ] **Step 4: Manual smoke**

Start the website locally:

```bash
nx run website:dev
```

Visit `http://localhost:3000/`:
- Confirm hero shows "Ship production agent UIs in Angular." H1.
- Click `Install @ngaf/chat` — button label flips to "Copied ✓" and clipboard contains `npm install @ngaf/chat`.
- Click `Talk to our engineers` — navigates to `/contact?source=home_hero&track=enterprise`.

Visit `/contact?source=home_hero&track=enterprise`:
- Confirm headline "Talk to an engineer." renders.
- SLA card present.
- Form has 4 fields (email required, others optional).
- GitHub stars pill renders (or fallback to plain "GitHub" pill).
- Alt-channel row visible.

Visit `/pricing`:
- Confirm `<CompatibilityMatrix />` section renders with four rows.

Submit a test lead via `/contact?...` with `email=jane@acme.com, company=Acme` and verify PostHog Live Events shows `marketing:lead_form_submit`, `marketing:lead_form_success`, AND `marketing:lead_qualified` (the last one from Spec 1E's gate passing).

- [ ] **Step 5: Done**

If all checks pass, Spec 2 is implementation-complete. Proceed to PR.

---

## Self-Review

**1. Spec coverage:**

| Spec deliverable | Task |
|---|---|
| Hero rewrite with locked copy + two tracked CTAs + clipboard primary CTA | 1.2 + 1.3 |
| `/contact` route with ContactForm (email required; name/company/message optional) | 2.5 + 2.3 |
| GitHubStarsPill + getGitHubStars ISR + fetch-failure fallback | 2.1 + 2.2 |
| CompatibilityMatrix on /pricing with conservative content | 3.1 + 3.2 |
| Three full-repo sweeps: telemetry phrasing, A2UI v0.9, category sweep | 0.1, 0.2, 0.3 |
| `CtaId` type union exported; `AnalyticsProperties.cta_id` tightened | 1.1 |
| `/api/leads` validates email only | 4.1 |
| Resend subject template handles missing name | 4.1 |
| `docs/gtm/messaging.md` Contact page §Fields updated | 4.2 |
| Hidden attribution fields populated from URL params + referrer | 2.3 (ContactForm impl) |
| Alt-channel row (docs/GitHub issues/Discord) | 2.4 |
| SLA card | 2.4 |
| All affected projects' tests green | 5.1 |

All deliverables covered.

**2. Placeholder scan:** No "TBD", no "fill in details", no "similar to Task N" without showing code. ✓

**3. Type consistency:**

- `CtaId` union members `'hero_install' | 'hero_talk_to_engineers'` — defined in 1.1, used in 1.3 (`cta_id: 'hero_install'` / `'hero_talk_to_engineers'`). ✓
- `track: 'developer' | 'enterprise'` — used in 1.3 (Hero CTAs), 2.3 (ContactForm default), 2.5 (page URL). ✓
- `surface: 'home' | 'contact'` — `'home'` in Hero (1.3), `'contact'` in ContactForm (2.3). Both are members of the existing `AnalyticsSurface` union (`surface?: AnalyticsSurface`). ✓
- `INSTALL_COMMAND = 'npm install @ngaf/chat'` — written in 1.3, asserted in test 1.2. ✓
- `getGitHubStars` signature `(repo?: string) => Promise<number | null>` — same across 2.1 implementation and 2.2 consumer. ✓
- `CompatibilityMatrix` content (Angular 20, 21 / — / 22 / ≤19) consistent across 3.1 spec, 3.1 implementation, and the spec doc §3. ✓
