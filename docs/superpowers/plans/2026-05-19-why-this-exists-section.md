# "Why this exists" section redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 4-card "Why this exists" section in `apps/website/src/components/landing/Differentiator.tsx` with a 10-row production-readiness checklist that dramatizes the demos→production gap.

**Architecture:** Single React Server Component rewrite. No new files except a co-located spec test. Section keeps its position on the landing page; only its internal content + layout change. Pulls data from a local `PRODUCTION_ROWS` array; renders each row as a flex layout `[check icon] [bold need] [muted description] [mono primitive]` with hairline dividers. Footer "Pilot to Prod" link is a tracked CTA.

**Tech Stack:** Next.js 16 (Turbopack), React 19, TypeScript, `@ngaf/design-tokens`, Vitest (`vite.config.mts`), React Testing Library (project already uses `@testing-library/react` per existing landing specs), `apps/website/src/lib/analytics/client.ts` (`trackCtaClick`).

**Reference:** Spec at `docs/superpowers/specs/2026-05-19-why-this-exists-section-design.md`.

---

## File map

- **Modify:** `apps/website/src/components/landing/Differentiator.tsx`
  - Drop existing `CARDS` array, drop 4-card grid.
  - Add `PRODUCTION_ROWS` array (10 entries).
  - Add inline `CheckIcon` SVG component.
  - Update headline + subhead + add footer link with `trackCtaClick`.
  - Convert from server component (currently no `'use client'`) to client component — needed because `trackCtaClick` runs on click.
- **Create:** `apps/website/src/components/landing/Differentiator.spec.tsx`
  - Vitest + React Testing Library.
  - Asserts headline text, all 10 rows render with need/description/primitive, footer link points to `/pilot-to-prod`, click fires `trackCtaClick`.

No changes to `positioning.ts`, `Nav.tsx`, `Hero.tsx`, `Section.tsx`, `Container.tsx`, `Eyebrow.tsx`, or any analytics events file (event shape is generic `trackCtaClick`, no new event type needed).

---

## Task 1: Update Differentiator.tsx — content & structure

**Files:**
- Modify: `apps/website/src/components/landing/Differentiator.tsx`

- [ ] **Step 1: Replace the file contents**

Overwrite `apps/website/src/components/landing/Differentiator.tsx` with:

```tsx
'use client';

import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';
import { trackCtaClick } from '../../lib/analytics/client';

interface ProductionRow {
  need: string;
  description: string;
  primitive: string;
}

const PRODUCTION_ROWS: ProductionRow[] = [
  {
    need: 'Durable threads',
    description: 'Persist across reloads, resume, branch, replay.',
    primitive: 'threadId signal + durable transports',
  },
  {
    need: 'Resumable interrupts',
    description: 'Human-in-the-loop pause, resume token, retry, cancel.',
    primitive: 'interrupt(), resume()',
  },
  {
    need: 'Tool calls as events',
    description: 'Stream progress, structured args, surfaced errors.',
    primitive: 'tool events on agent()',
  },
  {
    need: 'Streaming state as signals',
    description: 'messages(), status(), error() — not promises.',
    primitive: 'signal-native agent()',
  },
  {
    need: 'Generative UI on your design system',
    description: 'Vercel json-render + Google A2UI rendered into your Angular components.',
    primitive: '@ngaf/render',
  },
  {
    need: 'Recoverable errors',
    description: 'Retry, reload, error boundaries, fallback content.',
    primitive: 'error(), reload()',
  },
  {
    need: 'Backend portability',
    description: 'LangGraph today; AG-UI / Mastra / CrewAI / your own tomorrow — same UI.',
    primitive: 'runtime adapters behind one contract',
  },
  {
    need: 'Angular-native',
    description: 'DI, signals, RxJS interop — no React rewrite.',
    primitive: 'built on Angular primitives, not ported',
  },
  {
    need: 'Observability hooks',
    description: 'Tracing seams; app telemetry off by default.',
    primitive: 'event hooks, opt-in only',
  },
  {
    need: 'MIT + self-hosted',
    description: 'Own the primitives long-term, no vendor lock-in.',
    primitive: 'MIT-licensed, no runtime SaaS dependency',
  },
];

function CheckIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 16 16"
      fill="none"
      stroke={tokens.colors.accent}
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      style={{ flexShrink: 0, marginTop: 4 }}
    >
      <path d="M3 8.5l3.5 3.5L13 5" />
    </svg>
  );
}

export function Differentiator() {
  return (
    <Section
      surface="canvas"
      ariaLabelledBy="differentiator-heading"
      style={{ paddingTop: 72 }}
    >
      <Container>
        <div style={{ maxWidth: 1020, margin: '0 auto 44px', textAlign: 'center' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Why this exists</Eyebrow>
          <h2
            id="differentiator-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 20,
              letterSpacing: '-0.015em',
            }}
          >
            Everything an Angular agent needs once the demo works.
          </h2>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 auto',
              maxWidth: 760,
            }}
          >
            A streaming chat tutorial takes an hour. Shipping a real agent — durable, interruptible, observable, on your design system — takes most teams six months. NGAF gives the Angular surface that the rest of the stack assumes you&apos;ve already built.
          </p>
        </div>

        <ul
          style={{
            listStyle: 'none',
            padding: 0,
            margin: '0 auto',
            maxWidth: 980,
            borderTop: `1px solid ${tokens.surfaces.border}`,
          }}
        >
          {PRODUCTION_ROWS.map((row) => (
            <li
              key={row.need}
              className="why-row"
              style={{
                display: 'flex',
                alignItems: 'flex-start',
                gap: 16,
                padding: '18px 8px',
                borderBottom: `1px solid ${tokens.surfaces.border}`,
              }}
            >
              <CheckIcon />
              <div
                className="why-row__body"
                style={{
                  flex: 1,
                  display: 'flex',
                  gap: 16,
                  alignItems: 'baseline',
                  flexWrap: 'wrap',
                }}
              >
                <div style={{ flex: '1 1 360px', minWidth: 0 }}>
                  <span
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      fontWeight: 600,
                      color: tokens.colors.textPrimary,
                      marginRight: 8,
                    }}
                  >
                    {row.need}
                  </span>
                  <span
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: tokens.typography.body.size,
                      lineHeight: tokens.typography.body.line,
                      color: tokens.colors.textSecondary,
                    }}
                  >
                    {row.description}
                  </span>
                </div>
                <code
                  style={{
                    fontFamily: tokens.typography.fontMono,
                    fontSize: 13,
                    color: tokens.colors.textMuted,
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: '100%',
                  }}
                >
                  {row.primitive}
                </code>
              </div>
            </li>
          ))}
        </ul>

        <p
          style={{
            margin: '24px auto 0',
            maxWidth: 980,
            textAlign: 'center',
            fontFamily: tokens.typography.body.family,
            fontSize: tokens.typography.body.size,
            lineHeight: tokens.typography.body.line,
            color: tokens.colors.textMuted,
          }}
        >
          Want help walking these on your codebase?{' '}
          <a
            href="/pilot-to-prod"
            onClick={() =>
              trackCtaClick({
                surface: 'home',
                destination_url: '/pilot-to-prod',
                cta_id: 'home_why_pilot_to_prod',
                cta_text: 'Pilot to Prod',
              })
            }
            style={{ color: tokens.colors.accent, textDecoration: 'none', fontWeight: 600 }}
          >
            Pilot to Prod →
          </a>
        </p>

        <style>{`
          @media (max-width: 640px) {
            .why-row__body {
              flex-direction: column !important;
              gap: 6px !important;
            }
          }
        `}</style>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Type-check the file**

Run: `npx nx typecheck website 2>&1 | tail -20`
Expected: no errors referencing `Differentiator.tsx`. (Other unrelated typecheck output is fine; just confirm the file isn't in the error list.)

If the project has no `typecheck` target, run: `npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i differentiator || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Visual check in dev server**

The website-dev preview server should already be running (port 3000). If not, start it via the harness preview tool.

Use `preview_eval` to reload, then `preview_resize` to 1280×820, then `preview_screenshot`. Verify:
- Eyebrow "Why this exists" visible.
- Headline reads exactly "Everything an Angular agent needs once the demo works."
- 10 rows render, each with a check icon, bold need, muted description, mono primitive on the right.
- Footer line "Want help walking these on your codebase? Pilot to Prod →" appears below the list.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/Differentiator.tsx
git commit -m "$(cat <<'EOF'
feat(website): rewrite "Why this exists" section as production-readiness checklist

Replaces the 4-card differentiator grid with a 10-row checklist that dramatizes
the demos→production gap. Each row pairs a production need with the concrete
NGAF primitive that covers it. Footer hands off to /pilot-to-prod.

See docs/superpowers/specs/2026-05-19-why-this-exists-section-design.md.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Add Differentiator.spec.tsx

**Files:**
- Create: `apps/website/src/components/landing/Differentiator.spec.tsx`

- [ ] **Step 1: Confirm sibling test convention**

Run: `ls apps/website/src/components/landing/*.spec.tsx 2>/dev/null | head -3`
Expected output may be empty (no landing specs yet) — that's fine; the test framework wiring still applies workspace-wide.

Run: `grep -l "@testing-library/react" apps/website/package.json apps/website/vite.config.mts 2>/dev/null`
Expected: at least one match (RTL is already a dep).

If RTL is *not* present, stop and add it before continuing:
```bash
npx nx run website:install --pkg=@testing-library/react --dev
```
Expected: clean install. Then continue.

- [ ] **Step 2: Write the failing test file**

Create `apps/website/src/components/landing/Differentiator.spec.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { Differentiator } from './Differentiator';

vi.mock('../../lib/analytics/client', () => ({
  trackCtaClick: vi.fn(),
  trackExternalLinkClick: vi.fn(),
}));

import { trackCtaClick } from '../../lib/analytics/client';

const EXPECTED_NEEDS = [
  'Durable threads',
  'Resumable interrupts',
  'Tool calls as events',
  'Streaming state as signals',
  'Generative UI on your design system',
  'Recoverable errors',
  'Backend portability',
  'Angular-native',
  'Observability hooks',
  'MIT + self-hosted',
];

describe('Differentiator', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the section headline', () => {
    render(<Differentiator />);
    expect(
      screen.getByRole('heading', {
        level: 2,
        name: 'Everything an Angular agent needs once the demo works.',
      }),
    ).toBeTruthy();
  });

  it('renders all 10 production-readiness rows', () => {
    render(<Differentiator />);
    for (const need of EXPECTED_NEEDS) {
      expect(screen.getByText(need)).toBeTruthy();
    }
  });

  it('renders the @ngaf/render primitive for the generative UI row', () => {
    render(<Differentiator />);
    expect(screen.getByText('@ngaf/render')).toBeTruthy();
  });

  it('links the footer CTA to /pilot-to-prod', () => {
    render(<Differentiator />);
    const link = screen.getByRole('link', { name: /Pilot to Prod/ });
    expect(link.getAttribute('href')).toBe('/pilot-to-prod');
  });

  it('fires the home_why_pilot_to_prod CTA event when the footer link is clicked', () => {
    render(<Differentiator />);
    const link = screen.getByRole('link', { name: /Pilot to Prod/ });
    fireEvent.click(link);
    expect(trackCtaClick).toHaveBeenCalledWith({
      surface: 'home',
      destination_url: '/pilot-to-prod',
      cta_id: 'home_why_pilot_to_prod',
      cta_text: 'Pilot to Prod',
    });
  });
});
```

- [ ] **Step 3: Run the test — verify it passes**

Run: `npx nx test website -- --run Differentiator 2>&1 | tail -30`

Expected: 5 passing tests under `Differentiator`. Exit code 0.

If a test fails with "trackCtaClick is not a function" or similar — the mock path is wrong; double-check the import path matches what `Differentiator.tsx` uses (`../../lib/analytics/client`).

If a test fails with "cannot find @testing-library/react" — RTL isn't installed; add it per Step 1's fallback.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/landing/Differentiator.spec.tsx
git commit -m "$(cat <<'EOF'
test(website): cover Differentiator rows, headline, and pilot-to-prod CTA

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Verification pass

**Files:** none (verification only)

- [ ] **Step 1: Run the website test suite**

Run: `npx nx test website 2>&1 | tail -20`
Expected: all tests pass. If a pre-existing failure surfaces unrelated to `Differentiator`, leave it — note it in the PR description but do not fix it as part of this plan.

- [ ] **Step 2: Confirm the page still renders end-to-end**

With the website-dev preview server running on port 3000, navigate to `/`. Use `preview_snapshot` and confirm:
- Section h2 reads "Everything an Angular agent needs once the demo works."
- 10 list items rendered.
- Footer link present and points to `/pilot-to-prod`.

- [ ] **Step 3: Capture a screenshot for the PR**

Resize preview to 1280×820, scroll to the section (it sits below the "Works with your agent stack" matrix), and capture `preview_screenshot`. Save as `/tmp/why-this-exists-after.png` for inclusion in the PR description.

- [ ] **Step 4: Update auto-memory if anything novel surfaced**

If any non-obvious quirk turned up (e.g., the project required a special vitest config flag, or `tokens.colors.accent` had to be swapped for another token), capture it as a feedback memory in `~/.claude/projects/-Users-blove-repos-angular-agent-framework/memory/`.

Otherwise skip.

---

## Self-review

**Spec coverage:**
- Wedge / GTM alignment — captured in commit message + spec reference. ✓
- Eyebrow, headline, subhead — Task 1 Step 1, literal strings match spec. ✓
- 10 rows with need / description / primitive — Task 1 Step 1; Task 2 covers all 10 needs by name. ✓
- Compact rows with check icon, no card grid — Task 1 Step 1 (`<ul>` with hairlines, inline `CheckIcon`). ✓
- Mobile wrap (primitive below description on < 640) — Task 1 Step 1 `@media` block. ✓
- Footer "Pilot to Prod" link + `home_why_pilot_to_prod` CTA event — Task 1 Step 1, Task 2 Step 2 (last test). ✓
- Section position unchanged — file untouched at its callsite (still `Differentiator`). ✓
- Spec file added — Task 2 (acceptance criterion #6 says to add it). ✓
- Lighthouse a11y not regressed — check icon has `aria-hidden`; rest of section uses semantic `<ul>`/`<li>`/`<h2>`/`<a>`. ✓

**Placeholder scan:** no TBD/TODO; every code step contains the full code; every command step contains the literal command and expected output. ✓

**Type consistency:** `ProductionRow` shape defined once; `PRODUCTION_ROWS` consumes it; tests assert against the same `need` strings. `CheckIcon` is local, no external signature. `trackCtaClick` payload shape matches existing usage in `Nav.tsx`. ✓

Plan complete.
