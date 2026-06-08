# Docs Landing Page Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebuild `/docs` as an evaluator-first "start here" funnel: pick backend (LangGraph/AG-UI) → generative UI (Google A2UI / Vercel json-render) → Chat → supporting libs → search.

**Architecture:** A single Next.js **server component** at `apps/website/src/app/docs/page.tsx`, composed from existing UI primitives (`Section`, `Container`, `Eyebrow`, `Card`, `Pill`) and `@threadplane/design-tokens`. Curated content lives in local typed arrays in the page file (mirroring the existing `POPULAR_TOPICS` pattern). No new dependencies, no client JS. The Playwright e2e at `apps/website/e2e/docs.spec.ts` is updated first (TDD) to assert the new structure.

**Tech Stack:** Next.js (App Router), React server components, TypeScript, `@threadplane/design-tokens`, Playwright.

**Reference spec:** `docs/superpowers/specs/2026-05-29-docs-landing-page-design.md`

---

## File Structure

- **Modify:** `apps/website/src/app/docs/page.tsx` — full rewrite of the landing page component. Single file, one responsibility (the `/docs` index). Content arrays + small in-file `StepLabel` helper + the page component.
- **Modify:** `apps/website/e2e/docs.spec.ts` — replace the "Docs landing page" describe block's assertions. The other describe blocks (slug page, search) are unrelated and stay untouched.

No other files change. `docsConfig`, the sidebar, and routing are out of scope.

---

## Task 1: Update the e2e test for the new landing page (TDD — failing first)

**Files:**
- Modify: `apps/website/e2e/docs.spec.ts:3-20` (the first `test.describe('Docs landing page', ...)` block only)

- [ ] **Step 1: Replace the landing-page test block**

In `apps/website/e2e/docs.spec.ts`, replace the entire first describe block (lines 3–20, `test.describe('Docs landing page', ...)`) with:

```ts
test.describe('Docs landing page', () => {
  test('renders the start-here funnel + search prompt', async ({ page }) => {
    await page.goto('/docs');

    // Hero
    await expect(page.locator('#docs-heading')).toBeVisible();
    await expect(page.locator('#docs-heading')).toContainText('Build AI agent UIs in Angular');

    // Step headings (match on the plain substring to avoid the middle-dot char)
    await expect(page.getByText('Pick your backend').first()).toBeVisible();
    await expect(page.getByText('Generative UI').first()).toBeVisible();
    await expect(page.getByText('Chat UI').first()).toBeVisible();

    // Step 1 — backend quickstart links
    await expect(page.locator('main a[href="/docs/langgraph/getting-started/quickstart"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/ag-ui/getting-started/quickstart"]').first()).toBeVisible();

    // Step 2 — generative UI links
    await expect(page.locator('main a[href="/docs/a2ui/getting-started/introduction"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/render/getting-started/introduction"]').first()).toBeVisible();

    // Step 3 — chat
    await expect(page.locator('main a[href="/docs/chat/getting-started/introduction"]').first()).toBeVisible();

    // Helper links
    await expect(page.locator('main a[href="/docs/choosing-an-adapter"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/render/concepts/json-render-vs-a2ui"]').first()).toBeVisible();

    // Supporting libraries
    await expect(page.locator('main a[href="/docs/licensing/getting-started/introduction"]').first()).toBeVisible();
    await expect(page.locator('main a[href="/docs/telemetry/getting-started/introduction"]').first()).toBeVisible();

    // Search prompt
    await expect(page.getByText('Looking for something specific?').first()).toBeVisible();
  });
});
```

Leave the `Docs slug page` and `Docs search` describe blocks unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts -g "start-here funnel"
```
Expected: FAIL. The current page still says "Learn the framework." and uses `/getting-started/introduction` backend links, so the new assertions (`Build AI agent UIs in Angular`, `quickstart` hrefs, `Pick your backend`) will not be found.

---

## Task 2: Rewrite the docs landing page component

**Files:**
- Modify: `apps/website/src/app/docs/page.tsx` (full rewrite — replace entire file contents)

- [ ] **Step 1: Replace the file with the new implementation**

Replace the entire contents of `apps/website/src/app/docs/page.tsx` with:

```tsx
import type { ReactNode } from 'react';
import Link from 'next/link';
import { tokens } from '@threadplane/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Card } from '../../components/ui/Card';
import { Pill } from '../../components/ui/Pill';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Documentation — Threadplane',
  description:
    'Build AI agent UIs in Angular. Library guides, API reference, and production patterns for Threadplane.',
  pathname: '/docs',
  type: 'website',
});

interface Backend {
  title: string;
  blurb: string;
  install: string;
  href: string;
}

const BACKENDS: Backend[] = [
  {
    title: 'LangGraph',
    blurb: 'For LangChain / LangGraph backends',
    install: 'npm i @threadplane/langgraph',
    href: '/docs/langgraph/getting-started/quickstart',
  },
  {
    title: 'AG-UI',
    blurb: 'CrewAI, Mastra, Pydantic AI, Strands…',
    install: 'npm i @threadplane/ag-ui',
    href: '/docs/ag-ui/getting-started/quickstart',
  },
];

interface GenerativeUi {
  vendor: string;
  title: string;
  blurb: string;
  href: string;
}

const GENERATIVE_UI: GenerativeUi[] = [
  {
    vendor: 'Google',
    title: 'A2UI',
    blurb:
      'Agent-to-UI protocol — the agent streams and updates surfaces over the conversation.',
    href: '/docs/a2ui/getting-started/introduction',
  },
  {
    vendor: 'Vercel',
    title: 'json-render',
    blurb:
      'Render a fixed JSON spec into your own Angular components. You own the schema.',
    href: '/docs/render/getting-started/introduction',
  },
];

interface SupportingLib {
  title: string;
  blurb: string;
  href: string;
}

const SUPPORTING: SupportingLib[] = [
  {
    title: 'Licensing',
    blurb: 'Token verification',
    href: '/docs/licensing/getting-started/introduction',
  },
  {
    title: 'Telemetry',
    blurb: 'Browser & Node events',
    href: '/docs/telemetry/getting-started/introduction',
  },
];

function StepLabel({ id, children }: { id: string; children: ReactNode }) {
  return (
    <h2
      id={id}
      style={{
        fontFamily: tokens.typography.eyebrow.family,
        fontSize: tokens.typography.eyebrow.size,
        fontWeight: tokens.typography.eyebrow.weight,
        letterSpacing: tokens.typography.eyebrow.letterSpacing,
        textTransform: tokens.typography.eyebrow.transform,
        lineHeight: tokens.typography.eyebrow.line,
        color: tokens.colors.textMuted,
        margin: 0,
        marginBottom: 16,
      }}
    >
      {children}
    </h2>
  );
}

const gridStyle = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
  gap: 16,
} as const;

const cardTitleStyle = {
  fontFamily: tokens.typography.h3.family,
  fontSize: 18,
  lineHeight: 1.3,
  fontWeight: 600,
  color: tokens.colors.textPrimary,
  margin: 0,
  marginBottom: 8,
} as const;

const cardBlurbStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: tokens.typography.body.size,
  lineHeight: tokens.typography.body.line,
  color: tokens.colors.textSecondary,
  margin: 0,
} as const;

const ctaStyle = {
  fontFamily: tokens.typography.fontSans,
  fontSize: 14,
  fontWeight: 600,
  color: tokens.colors.accent,
} as const;

const helperStyle = {
  fontFamily: tokens.typography.body.family,
  fontSize: 14,
  color: tokens.colors.textSecondary,
  margin: 0,
  marginTop: 16,
  textAlign: 'center',
} as const;

const helperLinkStyle = {
  color: tokens.colors.accent,
  fontWeight: 600,
} as const;

const forkCardStyle = {
  height: '100%',
  background: tokens.colors.accentSurface,
  border: `1px solid ${tokens.colors.accentBorder}`,
} as const;

export default function DocsLandingPage() {
  return (
    <>
      {/* Hero */}
      <Section surface="canvas" ariaLabelledBy="docs-heading">
        <Container>
          <div style={{ maxWidth: 720 }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>
              Documentation
            </Eyebrow>
            <h1
              id="docs-heading"
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
              Build AI agent UIs in Angular
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                maxWidth: '52ch',
              }}
            >
              A suite of MIT-licensed libraries for streaming agent interfaces.
              Pick your backend to get started.
            </p>
          </div>
        </Container>
      </Section>

      {/* Step 1 — backend */}
      <Section surface="canvas" tight ariaLabelledBy="backend-heading">
        <Container>
          <StepLabel id="backend-heading">Step 1 · Pick your backend</StepLabel>
          <div style={gridStyle}>
            {BACKENDS.map((b) => (
              <Link key={b.href} href={b.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={forkCardStyle}>
                  <h3 style={cardTitleStyle}>{b.title}</h3>
                  <p style={{ ...cardBlurbStyle, marginBottom: 16 }}>{b.blurb}</p>
                  <code
                    style={{
                      display: 'block',
                      fontFamily: tokens.typography.fontMono,
                      fontSize: 13,
                      color: tokens.colors.textSecondary,
                      background: tokens.surfaces.surfaceDim,
                      border: `1px solid ${tokens.surfaces.border}`,
                      borderRadius: tokens.radius.md,
                      padding: '8px 12px',
                      marginBottom: 16,
                    }}
                  >
                    {b.install}
                  </code>
                  <span style={ctaStyle}>Quickstart →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Not sure which to use?{' '}
            <Link href="/docs/choosing-an-adapter" style={helperLinkStyle}>
              Choosing an adapter →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 2 — generative UI */}
      <Section surface="canvas" tight ariaLabelledBy="genui-heading">
        <Container>
          <StepLabel id="genui-heading">Step 2 · Generative UI</StepLabel>
          <div style={gridStyle}>
            {GENERATIVE_UI.map((g) => (
              <Link key={g.href} href={g.href} style={{ textDecoration: 'none' }}>
                <Card padding="lg" hoverable style={forkCardStyle}>
                  <Eyebrow tone="accent" style={{ marginBottom: 8 }}>
                    {g.vendor}
                  </Eyebrow>
                  <h3 style={cardTitleStyle}>{g.title}</h3>
                  <p style={{ ...cardBlurbStyle, marginBottom: 16 }}>{g.blurb}</p>
                  <span style={ctaStyle}>Get started →</span>
                </Card>
              </Link>
            ))}
          </div>
          <p style={helperStyle}>
            Which fits my use case?{' '}
            <Link
              href="/docs/render/concepts/json-render-vs-a2ui"
              style={helperLinkStyle}
            >
              json-render vs A2UI →
            </Link>
          </p>
        </Container>
      </Section>

      {/* Step 3 — chat */}
      <Section surface="canvas" tight ariaLabelledBy="chat-heading">
        <Container>
          <StepLabel id="chat-heading">Step 3 · Chat UI</StepLabel>
          <Link
            href="/docs/chat/getting-started/introduction"
            style={{ textDecoration: 'none' }}
          >
            <Card padding="lg" hoverable>
              <h3 style={cardTitleStyle}>Chat</h3>
              <p style={cardBlurbStyle}>
                Drop-in chat components — message list, input, streaming, tool
                calls, interrupts, subagents. Renders A2UI &amp; json-render
                surfaces inline.
              </p>
            </Card>
          </Link>
        </Container>
      </Section>

      {/* Supporting libraries */}
      <Section surface="canvas" tight ariaLabelledBy="supporting-heading">
        <Container>
          <StepLabel id="supporting-heading">Supporting libraries</StepLabel>
          <div style={gridStyle}>
            {SUPPORTING.map((s) => (
              <Link key={s.href} href={s.href} style={{ textDecoration: 'none' }}>
                <Card hoverable style={{ height: '100%' }}>
                  <h3 style={{ ...cardTitleStyle, fontSize: 16, marginBottom: 4 }}>
                    {s.title}
                  </h3>
                  <p style={cardBlurbStyle}>{s.blurb}</p>
                </Card>
              </Link>
            ))}
          </div>
        </Container>
      </Section>

      {/* Search prompt */}
      <Section surface="tinted" tight ariaLabelledBy="search-prompt-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
            <h2
              id="search-prompt-heading"
              style={{
                fontFamily: tokens.typography.h3.family,
                fontSize: 22,
                lineHeight: 1.3,
                fontWeight: 600,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 12,
              }}
            >
              Looking for something specific?
            </h2>
            <p
              style={{
                fontFamily: tokens.typography.body.family,
                fontSize: tokens.typography.body.size,
                lineHeight: tokens.typography.body.line,
                color: tokens.colors.textSecondary,
                margin: 0,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              Press <Pill variant="neutral">⌘K</Pill> to search the docs.
            </p>
          </div>
        </Container>
      </Section>
    </>
  );
}
```

- [ ] **Step 2: Lint the changed files**

Run:
```bash
npx nx lint website
```
Expected: PASS (no lint errors). If the linter flags the unused `LibraryId`/`docsConfig` import — note the new file does **not** import `docsConfig` anymore, which is intentional; there should be no unused-import error because the old imports are gone.

- [ ] **Step 3: Typecheck the website**

Run:
```bash
npx tsc --noEmit -p apps/website/tsconfig.json
```
Expected: PASS. Confirms the `as const` style objects and token references typecheck against React's `CSSProperties`.

---

## Task 3: Verify end-to-end and commit

**Files:** none (verification + commit)

- [ ] **Step 1: Run the landing-page e2e test**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts -g "start-here funnel"
```
Expected: PASS. The dev server auto-starts via the `webServer` config in `apps/website/playwright.config.ts`.

- [ ] **Step 2: Run the full docs e2e file to confirm no regressions**

Run:
```bash
cd apps/website && npx playwright test e2e/docs.spec.ts
```
Expected: PASS for all blocks (landing page, slug page, search). The slug-page and search tests were not modified and should still pass.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/docs/page.tsx apps/website/e2e/docs.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): docs landing page backend-first funnel

Rebuild /docs as an evaluator-first start-here path: pick backend
(LangGraph/AG-UI) -> generative UI (A2UI/json-render) -> Chat ->
supporting libraries -> search.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Manual verification (browser)

After the e2e passes, confirm visually with the preview tooling:

- [ ] Start the dev server and open `/docs`.
- [ ] Confirm the five sections render top to bottom: hero → Step 1 backend fork (two accent cards with install snippets) → Step 2 generative-UI fork (two accent cards with vendor eyebrows) → Step 3 Chat card → Supporting (Licensing, Telemetry) → tinted ⌘K search prompt.
- [ ] Hover a fork card to confirm the `hoverable` lift.
- [ ] Click each card/link and confirm it lands on the expected route.
- [ ] Resize narrow to confirm the `auto-fit` grids collapse to one column.

---

## Self-Review (completed during planning)

- **Spec coverage:** Hero ✓ (Task 2). Step 1 backend fork + install snippets + "Choosing an adapter" helper ✓. Step 2 generative-UI fork (A2UI→a2ui intro, json-render→render intro) + "json-render vs A2UI" helper ✓. Step 3 Chat ✓. Supporting (Licensing, Telemetry) ✓. Search prompt ✓. All 7 libraries homed ✓. Server component, no copy buttons ✓. Test assertions ✓ (Task 1). No spec requirement left without a task.
- **Placeholder scan:** No TBD/TODO; all code blocks complete; no "add validation/error handling" hand-waves.
- **Type consistency:** Interface names (`Backend`, `GenerativeUi`, `SupportingLib`) and array names (`BACKENDS`, `GENERATIVE_UI`, `SUPPORTING`) are consistent between definition and use. `StepLabel` signature matches every call site. Test hrefs match the `href` values in the content arrays exactly.
