# Pricing Rebuild + Sitewide MIT Qualification (PR B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the public-facing posture changes that accompany the `@ngaf/chat` relicense (PR A). Rebuild `/pricing` to a 5-tier model with FAQ + commercial-use / evaluation / OSS notes, qualify the homepage hero eyebrow + footer link + bottom bar, rewrite root `README.md` license paragraph and root `COMMERCIAL.md`.

**Architecture:** All website changes follow existing patterns (inline styles via `@ngaf/design-tokens`, `Card`/`Section`/`Container`/`Eyebrow` primitives, `trackCtaClick` for tracked anchors). The CompareTable row shape extends from boolean-per-tier to a discriminated value type so cells can hold either a checkmark/dash or a short text label (e.g., "1 dev", "unlimited"). Stripe Checkout is **not** in this PR; purchase CTAs link to `/contact?source=pricing_tier_<slug>`.

**Tech Stack:** Next.js 16 (App Router, RSC + 'use client'), React 19, TypeScript, `@ngaf/design-tokens`, Vitest + React Testing Library (`@vitest-environment jsdom`).

**Reference:** Spec at `docs/superpowers/specs/2026-05-20-pricing-rebuild-and-mit-qualification-design.md`.

---

## File map

- **Modify:** `apps/website/src/lib/analytics/events.ts` — extend `CtaId` union with 6 new literals: `pricing_tier_community`, `pricing_tier_indie`, `pricing_tier_developer_seat`, `pricing_tier_app_deployment`, `pricing_tier_enterprise`, `footer_licensing`, `footer_licensing_bottom`.
- **Modify:** `apps/website/src/components/pricing/PricingGrid.tsx` — 2 plans → 5 tiers, click tracking.
- **Modify:** `apps/website/src/components/pricing/CompareTable.tsx` — 4 cols → 5 cols; cell value type widened to `boolean | string`; new 9-row data.
- **Create:** `apps/website/src/components/pricing/PricingFAQ.tsx` — semantic `<details>`/`<summary>` 7-Q&A.
- **Create:** `apps/website/src/components/pricing/PricingFAQ.spec.tsx` — render + structure tests.
- **Modify:** `apps/website/src/app/pricing/page.tsx` — metadata, header/subhead, integrate notes + FAQ + final OSS clarification.
- **Modify:** `apps/website/src/components/landing/Hero.tsx` — eyebrow text only.
- **Modify:** `apps/website/src/components/shared/Footer.tsx` — Resources column link relabel + href; bottom bar text + `cta_id`.
- **Modify:** `COMMERCIAL.md` (root) — full rewrite.
- **Modify:** `README.md` (root) — drop MIT badge; rewrite license paragraph.

Total: 9 modified, 2 created.

---

## Task 1: Add new CtaId literals

**Files:**
- Modify: `apps/website/src/lib/analytics/events.ts`

- [ ] **Step 1: Read the current `CtaId` union**

Run from repo root: `grep -n "CtaId\|hero_install\|home_why_pilot" apps/website/src/lib/analytics/events.ts`

Confirm the union currently extends through `'home_why_pilot_to_prod'` and includes hero pill literals like `'hero_proof_pill'`.

- [ ] **Step 2: Extend the union**

Use Edit on `apps/website/src/lib/analytics/events.ts`. Find:

```ts
  // Why this exists section
  | 'home_why_pilot_to_prod'
```

Replace with:

```ts
  // Why this exists section
  | 'home_why_pilot_to_prod'
  // Pricing tier CTAs
  | 'pricing_tier_community'
  | 'pricing_tier_indie'
  | 'pricing_tier_developer_seat'
  | 'pricing_tier_app_deployment'
  | 'pricing_tier_enterprise'
  // Footer licensing links
  | 'footer_licensing'
  | 'footer_licensing_bottom'
```

- [ ] **Step 3: Type-check**

Run from repo root: `npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -E "events\.ts|CtaId" || echo "ok"`
Expected: `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/lib/analytics/events.ts
git commit -m "$(cat <<'EOF'
chore(website): extend CtaId union for pricing + footer licensing CTAs

Adds 5 pricing_tier_* literals and 2 footer_licensing* literals so the
5-tier pricing grid and the relabeled footer Licensing link can fire
strictly-typed trackCtaClick events.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Update Hero eyebrow text

**Files:**
- Modify: `apps/website/src/components/landing/Hero.tsx`

- [ ] **Step 1: Apply the edit**

Use Edit on `apps/website/src/components/landing/Hero.tsx`:

- `old_string`: `              Agent UI for Angular · MIT`
- `new_string`: `              Agent UI for Angular · MIT framework`

- [ ] **Step 2: Verify**

Run: `grep -c "Agent UI for Angular · MIT framework" apps/website/src/components/landing/Hero.tsx`
Expected: `1`.

Run: `grep -c "Agent UI for Angular · MIT$" apps/website/src/components/landing/Hero.tsx || echo "ok no bare MIT"`
Expected: `ok no bare MIT`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/landing/Hero.tsx
git commit -m "$(cat <<'EOF'
docs(website): hero eyebrow — qualify "MIT" to "MIT framework"

@ngaf/chat is no longer MIT in future versions; the framework as a
whole is still MIT for every library except chat. Eyebrow now reads
"Agent UI for Angular · MIT framework" so the implication doesn't
extend to chat.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Rewrite PricingGrid for 5 tiers

**Files:**
- Modify: `apps/website/src/components/pricing/PricingGrid.tsx`

- [ ] **Step 1: Replace the PLANS array and add click tracking**

The current file imports `tokens`, `Container`, `Section`, `Card`, `Button`, `Eyebrow` and exports `PricingGrid` with a 2-plan `PLANS` array. Replace the file with the following content. Read it carefully — only the imports, the `Plan` interface, the `PLANS` array, and the `<Button>` `onClick` are changing meaningfully. The `Section`/`Container`/`Card`/`Button` markup pattern stays identical.

```tsx
'use client';

import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Card } from '../ui/Card';
import { Button } from '../ui/Button';
import { Eyebrow } from '../ui/Eyebrow';
import { trackCtaClick } from '../../lib/analytics/client';
import type { CtaId } from '../../lib/analytics/events';

interface Plan {
  name: string;
  price: string;
  period: string;
  features: readonly string[];
  highlight: boolean;
  cta: string;
  ctaHref: string;
  ctaId: CtaId;
  ctaExternal?: boolean;
}

const PLANS: readonly Plan[] = [
  {
    name: 'Community / Noncommercial',
    price: 'Free',
    period: 'forever',
    features: [
      'Personal, student, academic, nonprofit, demo',
      'Source access',
      'Noncommercial use',
      'Commercial evaluation (30 days)',
      'License: PolyForm Noncommercial 1.0.0',
    ],
    highlight: false,
    cta: 'Start free',
    ctaHref: 'https://www.npmjs.com/package/@ngaf/chat',
    ctaId: 'pricing_tier_community',
    ctaExternal: true,
  },
  {
    name: 'Indie Commercial',
    price: '$149',
    period: '/year',
    features: [
      '1 developer',
      '1 commercial app',
      'Unlimited end users',
      'Commercial license',
      'Best for: solo devs, indie products, consultants with one app',
    ],
    highlight: false,
    cta: 'Buy indie license',
    ctaHref: '/contact?source=pricing_tier_indie',
    ctaId: 'pricing_tier_indie',
  },
  {
    name: 'Developer Seat',
    price: '$299',
    period: '/developer/year',
    features: [
      'Commercial use',
      'Unlimited end users',
      'Dev / staging / production',
      'Apps owned by your org',
      'Best for: startups & growing teams',
    ],
    highlight: true,
    cta: 'Buy developer seat',
    ctaHref: '/contact?source=pricing_tier_developer_seat',
    ctaId: 'pricing_tier_developer_seat',
  },
  {
    name: 'App Deployment',
    price: '$1,499',
    period: '/app/year',
    features: [
      'Unlimited developers',
      '1 production app',
      'Unlimited end users',
      'Procurement-friendly',
      'Best for: agencies, CI/CD-heavy teams',
    ],
    highlight: false,
    cta: 'License an app',
    ctaHref: '/contact?source=pricing_tier_app_deployment',
    ctaId: 'pricing_tier_app_deployment',
  },
  {
    name: 'Enterprise',
    price: 'Custom',
    period: 'starting at $10k/year',
    features: [
      'Custom contract & SLA',
      'Procurement support',
      'Security review',
      'Multi-app licensing',
      'Priority + private support channel',
    ],
    highlight: false,
    cta: 'Contact sales',
    ctaHref: '/contact?source=pricing_tier_enterprise',
    ctaId: 'pricing_tier_enterprise',
  },
];

export function PricingGrid() {
  return (
    <Section surface="canvas">
      <Container>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
            gap: 16,
            maxWidth: 1200,
            margin: '0 auto',
          }}
        >
          {PLANS.map((plan) => (
            <Card
              key={plan.name}
              padding="lg"
              surface={plan.highlight ? 'dim' : 'white'}
              style={{
                display: 'flex',
                flexDirection: 'column',
                border: plan.highlight
                  ? `2px solid ${tokens.colors.accent}`
                  : `1px solid ${tokens.surfaces.border}`,
              }}
            >
              <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{plan.name}</Eyebrow>
              <p
                style={{
                  fontFamily: tokens.typography.fontSerif,
                  fontWeight: 700,
                  fontSize: 40,
                  color: tokens.colors.textPrimary,
                  lineHeight: 1,
                  marginBottom: 4,
                  marginTop: 0,
                }}
              >
                {plan.price}
              </p>
              <p
                style={{
                  fontFamily: tokens.typography.body.family,
                  fontSize: 13,
                  color: tokens.colors.textMuted,
                  marginBottom: 16,
                  marginTop: 0,
                }}
              >
                {plan.period}
              </p>
              <ul
                style={{
                  listStyle: 'none',
                  padding: 0,
                  margin: '0 0 20px 0',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 8,
                  flex: 1,
                }}
              >
                {plan.features.map((feature) => (
                  <li
                    key={feature}
                    style={{
                      fontFamily: tokens.typography.body.family,
                      fontSize: 14,
                      lineHeight: 1.5,
                      color: tokens.colors.textSecondary,
                      paddingLeft: 16,
                      position: 'relative',
                    }}
                  >
                    <span
                      aria-hidden="true"
                      style={{
                        position: 'absolute',
                        left: 0,
                        color: tokens.colors.accent,
                      }}
                    >
                      ✓
                    </span>
                    {feature}
                  </li>
                ))}
              </ul>
              <Button
                variant={plan.highlight ? 'primary' : 'ghost'}
                size="md"
                href={plan.ctaHref}
                {...(plan.ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                onClick={() =>
                  trackCtaClick({
                    surface: 'pricing',
                    destination_url: plan.ctaHref,
                    cta_id: plan.ctaId,
                    cta_text: plan.cta,
                  })
                }
              >
                {plan.cta}
              </Button>
            </Card>
          ))}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Type-check + lint**

Run from repo root:
```
npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i PricingGrid || echo "ok"
npx nx run website:lint 2>&1 | grep -iE "PricingGrid|error " || echo "ok"
```
Expected: `ok` for both.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/pricing/PricingGrid.tsx
git commit -m "$(cat <<'EOF'
feat(website): pricing grid — 2 tiers → 5 tiers with click tracking

Community / Indie Commercial / Developer Seat (highlighted) /
App Deployment / Enterprise. Each card shows 5 features, a price,
a period, and a tracked CTA. Paid-tier CTAs route to /contact with
a source parameter until Stripe Checkout lands in a separate PR.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Rewrite CompareTable across 5 tiers

**Files:**
- Modify: `apps/website/src/components/pricing/CompareTable.tsx`

- [ ] **Step 1: Replace the file**

Write `apps/website/src/components/pricing/CompareTable.tsx` with this content. The shape change: each row holds `cells: Record<TierKey, boolean | string>`; the renderer handles both. The wrapper already had `overflow-x-auto` so mobile horizontal scroll still works without further changes.

```tsx
'use client';
import { tokens } from '@ngaf/design-tokens';

type TierKey = 'community' | 'indie' | 'seat' | 'app' | 'enterprise';

interface Row {
  feature: string;
  cells: Record<TierKey, boolean | string>;
}

const TIERS: { key: TierKey; label: string }[] = [
  { key: 'community', label: 'Community' },
  { key: 'indie', label: 'Indie' },
  { key: 'seat', label: 'Developer Seat' },
  { key: 'app', label: 'App Deployment' },
  { key: 'enterprise', label: 'Enterprise' },
];

const ROWS: Row[] = [
  {
    feature: 'License model',
    cells: {
      community: 'PolyForm NC 1.0.0',
      indie: 'Commercial',
      seat: 'Commercial',
      app: 'Commercial',
      enterprise: 'Commercial + custom',
    },
  },
  {
    feature: 'Commercial production use',
    cells: { community: false, indie: true, seat: true, app: true, enterprise: true },
  },
  {
    feature: 'Developers',
    cells: { community: 'Unlimited (noncommercial)', indie: '1', seat: 'Per seat', app: 'Unlimited', enterprise: 'Unlimited' },
  },
  {
    feature: 'Apps covered',
    cells: { community: 'Unlimited (noncommercial)', indie: '1', seat: 'All apps owned by your org', app: '1', enterprise: 'Multi-app' },
  },
  {
    feature: 'End users',
    cells: { community: 'Unlimited', indie: 'Unlimited', seat: 'Unlimited', app: 'Unlimited', enterprise: 'Unlimited' },
  },
  {
    feature: 'Environments (dev / staging / prod)',
    cells: { community: false, indie: true, seat: true, app: true, enterprise: true },
  },
  {
    feature: 'Support',
    cells: { community: 'Community', indie: 'Email', seat: 'Email', app: 'Email', enterprise: 'Priority + private channel' },
  },
  {
    feature: 'SLA',
    cells: { community: false, indie: false, seat: false, app: false, enterprise: true },
  },
  {
    feature: 'Security review',
    cells: { community: false, indie: false, seat: false, app: false, enterprise: true },
  },
];

const Check = () => <span style={{ color: tokens.colors.accent }}>✓</span>;
const X = () => <span style={{ color: tokens.colors.textMuted }}>—</span>;

function renderCell(value: boolean | string): React.ReactNode {
  if (typeof value === 'boolean') return value ? <Check /> : <X />;
  return <span style={{ color: tokens.colors.textSecondary, fontSize: 13 }}>{value}</span>;
}

export function CompareTable() {
  return (
    <section className="px-8 py-8 max-w-6xl mx-auto overflow-x-auto">
      <div
        style={{
          background: tokens.surfaces.surface,
          border: `1px solid ${tokens.surfaces.border}`,
          borderRadius: 12,
          overflow: 'hidden',
        }}
      >
        <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: 760 }}>
          <thead>
            <tr style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}`, background: 'rgba(255,255,255,0.55)' }}>
              <th
                className="text-left py-3 px-4 font-mono text-xs uppercase"
                style={{ color: tokens.colors.textMuted }}
              >
                Feature
              </th>
              {TIERS.map((t) => (
                <th
                  key={t.key}
                  className="text-center py-3 px-4 font-mono text-xs uppercase"
                  style={{ color: tokens.colors.accent }}
                >
                  {t.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ROWS.map((row) => (
              <tr
                key={row.feature}
                style={{ borderBottom: `1px solid ${tokens.colors.accentBorder}` }}
                onMouseEnter={(e) => (e.currentTarget.style.background = tokens.colors.accentSurface)}
                onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
              >
                <td className="py-3 px-4" style={{ color: tokens.colors.textSecondary }}>
                  {row.feature}
                </td>
                {TIERS.map((t) => (
                  <td key={t.key} className="py-3 px-4 text-center">
                    {renderCell(row.cells[t.key])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i CompareTable || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/pricing/CompareTable.tsx
git commit -m "$(cat <<'EOF'
feat(website): compare table — 4 cols → 5 cols, text-or-bool cells

Adds Indie tier; widens cell value type so rows like Developers /
Apps covered / Support / License model can carry short text labels
instead of just check/dash. Mobile horizontal scroll preserved via
the existing overflow-x-auto wrapper.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create PricingFAQ component

**Files:**
- Create: `apps/website/src/components/pricing/PricingFAQ.tsx`

- [ ] **Step 1: Create the file**

Write `apps/website/src/components/pricing/PricingFAQ.tsx`:

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../ui/Container';
import { Section } from '../ui/Section';
import { Eyebrow } from '../ui/Eyebrow';

interface QA {
  q: string;
  a: string;
}

const ITEMS: readonly QA[] = [
  {
    q: 'Is @ngaf/chat open source?',
    a: '@ngaf/chat is source-available under the PolyForm Noncommercial License 1.0.0. Because commercial use requires a license, it is not OSI open source.',
  },
  {
    q: 'Can I use it for free?',
    a: 'Yes. Personal, educational, nonprofit, academic, demo, open-source, and evaluation use are free under the noncommercial license.',
  },
  {
    q: 'Can I use it at work?',
    a: 'You can evaluate it at work for 30 days. Production use in a commercial product, internal tool, SaaS app, or client deliverable requires a commercial license.',
  },
  {
    q: 'Do my end users need licenses?',
    a: 'No. Commercial licenses are for the developers, organization, or production application using @ngaf/chat, depending on the plan.',
  },
  {
    q: 'Can I modify the source?',
    a: 'Yes, for permitted noncommercial use under the PolyForm Noncommercial license, or for commercial production use under a paid Threadplane license.',
  },
  {
    q: 'Can I redistribute it?',
    a: 'You may bundle it inside a larger licensed application. You may not redistribute it as a standalone package or as part of a competing component library, SDK, template kit, app builder, or design system.',
  },
  {
    q: 'What happens to older MIT versions?',
    a: 'Versions previously released under MIT remain available under their original license terms. The new license applies only to future versions where the license change is introduced.',
  },
];

export function PricingFAQ() {
  return (
    <Section surface="canvas" ariaLabelledBy="pricing-faq-heading">
      <Container>
        <div id="faq" style={{ maxWidth: 760, margin: '0 auto' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 12 }}>FAQ</Eyebrow>
          <h2
            id="pricing-faq-heading"
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 24,
              letterSpacing: '-0.015em',
            }}
          >
            Licensing FAQ
          </h2>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ITEMS.map((item) => (
              <details
                key={item.q}
                style={{
                  border: `1px solid ${tokens.surfaces.border}`,
                  borderRadius: 8,
                  background: tokens.surfaces.surface,
                  padding: '12px 16px',
                }}
              >
                <summary
                  style={{
                    fontFamily: tokens.typography.body.family,
                    fontSize: 16,
                    fontWeight: 600,
                    color: tokens.colors.textPrimary,
                    cursor: 'pointer',
                    listStyle: 'revert',
                  }}
                >
                  {item.q}
                </summary>
                <p
                  style={{
                    fontFamily: tokens.typography.body.family,
                    fontSize: tokens.typography.body.size,
                    lineHeight: tokens.typography.body.line,
                    color: tokens.colors.textSecondary,
                    margin: '8px 0 0',
                  }}
                >
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i PricingFAQ || echo "ok"`
Expected: `ok`.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/pricing/PricingFAQ.tsx
git commit -m "$(cat <<'EOF'
feat(website): pricing FAQ section — 7 Q&As as semantic <details>

Server component (no client interactivity needed) using native
<details>/<summary>. Anchor target #faq lets the footer Licensing
link deep-link into the FAQ.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Add Vitest spec for PricingFAQ

**Files:**
- Create: `apps/website/src/components/pricing/PricingFAQ.spec.tsx`

- [ ] **Step 1: Create the file**

Write `apps/website/src/components/pricing/PricingFAQ.spec.tsx`:

```tsx
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { PricingFAQ } from './PricingFAQ';

// Layout primitives are not under test here; stub them so the test
// focuses on the FAQ content + structure.
vi.mock('../ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));

const EXPECTED_QUESTIONS = [
  'Is @ngaf/chat open source?',
  'Can I use it for free?',
  'Can I use it at work?',
  'Do my end users need licenses?',
  'Can I modify the source?',
  'Can I redistribute it?',
  'What happens to older MIT versions?',
];

describe('PricingFAQ', () => {
  it('renders the FAQ heading', () => {
    render(<PricingFAQ />);
    expect(
      screen.getByRole('heading', { level: 2, name: 'Licensing FAQ' }),
    ).toBeTruthy();
  });

  it('renders all 7 questions as <summary> elements inside <details>', () => {
    const { container } = render(<PricingFAQ />);
    const summaries = container.querySelectorAll('details > summary');
    expect(summaries.length).toBe(7);
    const texts = Array.from(summaries, (s) => s.textContent);
    expect(texts).toEqual(EXPECTED_QUESTIONS);
  });

  it('exposes an #faq anchor for footer deep-linking', () => {
    const { container } = render(<PricingFAQ />);
    expect(container.querySelector('#faq')).toBeTruthy();
  });

  it('renders the open-source clarification answer', () => {
    render(<PricingFAQ />);
    expect(
      screen.getByText(/source-available under the PolyForm Noncommercial License 1\.0\.0/i),
    ).toBeTruthy();
  });
});
```

- [ ] **Step 2: Run the spec**

Run from `apps/website/`: `npx vitest run src/components/pricing/PricingFAQ.spec.tsx 2>&1 | tail -10`
Expected: `Tests  4 passed (4)`. Exit code 0.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/components/pricing/PricingFAQ.spec.tsx
git commit -m "$(cat <<'EOF'
test(website): cover PricingFAQ — heading, 7 questions, #faq anchor

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Update /pricing page — header, subhead, notes, FAQ integration

**Files:**
- Modify: `apps/website/src/app/pricing/page.tsx`

- [ ] **Step 1: Replace the file**

Write `apps/website/src/app/pricing/page.tsx`:

```tsx
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { PricingGrid } from '../../components/pricing/PricingGrid';
import { CompareTable } from '../../components/pricing/CompareTable';
import { CompatibilityMatrix } from '../../components/pricing/CompatibilityMatrix';
import { PricingFAQ } from '../../components/pricing/PricingFAQ';
import { LeadForm } from '../../components/pricing/LeadForm';
import { FinalCTA } from '../../components/landing/FinalCTA';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Pricing — Agent UI for Angular',
  description:
    '@ngaf/chat is free for noncommercial use under PolyForm Noncommercial 1.0.0. Commercial production use requires a Threadplane license. Other libraries remain MIT.',
  pathname: '/pricing',
  type: 'website',
});

function SmallNote({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: tokens.typography.body.family,
        fontSize: 13,
        lineHeight: 1.6,
        color: tokens.colors.textMuted,
        textAlign: 'center',
        margin: '0 auto',
        maxWidth: 720,
      }}
    >
      {children}
    </p>
  );
}

export default function PricingPage() {
  return (
    <>
      <Section surface="canvas" ariaLabelledBy="pricing-heading">
        <Container>
          <div style={{ textAlign: 'center', maxWidth: 760, margin: '0 auto' }}>
            <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Pricing</Eyebrow>
            <h1
              id="pricing-heading"
              style={{
                fontFamily: tokens.typography.h1.family,
                fontWeight: 700,
                fontSize: tokens.typography.h1.size,
                lineHeight: tokens.typography.h1.line,
                color: tokens.colors.textPrimary,
                margin: 0,
                marginBottom: 16,
                letterSpacing: '-0.02em',
              }}
            >
              Pricing for production AI chat interfaces
            </h1>
            <p
              style={{
                fontFamily: tokens.typography.bodyLg.family,
                fontSize: tokens.typography.bodyLg.size,
                lineHeight: tokens.typography.bodyLg.line,
                color: tokens.colors.textSecondary,
                margin: 0,
              }}
            >
              <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> is free for noncommercial use. Commercial production use requires a Threadplane license. Other libraries in the framework remain MIT.
            </p>
          </div>
        </Container>
      </Section>

      <PricingGrid />

      <Section surface="canvas">
        <Container>
          <SmallNote>
            A license is required when <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> is used in a commercial product, SaaS app, internal business tool, paid client project, or production application operated by or for a for-profit entity.
          </SmallNote>
        </Container>
      </Section>

      <CompareTable />

      <Section surface="canvas">
        <Container>
          <SmallNote>
            Commercial evaluation is free for 30 days. A paid license is required before production deployment.
          </SmallNote>
        </Container>
      </Section>

      <Section surface="canvas">
        <Container>
          <Eyebrow style={{ marginBottom: 12 }}>Compatibility</Eyebrow>
          <h2
            style={{
              fontFamily: tokens.typography.h2.family,
              fontSize: tokens.typography.h2.size,
              lineHeight: tokens.typography.h2.line,
              fontWeight: 700,
              color: tokens.colors.textPrimary,
              margin: 0,
              marginBottom: 24,
              letterSpacing: '-0.015em',
            }}
          >
            Works with your agent stack
          </h2>
          <CompatibilityMatrix />
        </Container>
      </Section>

      <PricingFAQ />

      <Section surface="canvas">
        <Container>
          <SmallNote>
            Because commercial use requires a license, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> is source-available rather than OSI open source. Threadplane keeps ecosystem packages (<code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/render</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/agent</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/langgraph</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/ag-ui</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/a2ui</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/licensing</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/telemetry</code>, <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/design-tokens</code>) permissively MIT-licensed.
          </SmallNote>
        </Container>
      </Section>

      <LeadForm />
      <FinalCTA />
    </>
  );
}
```

Note: The existing pricing page had a "Compatibility" `Eyebrow` + `h2` + `CompatibilityMatrix` block inline. That structure is preserved (sandwiched between the evaluation note and the FAQ) so the existing `CompatibilityMatrix` keeps rendering with its header. The PR does not modify `CompatibilityMatrix` itself.

If the original file has additional Sections you can't see in the visible 60 lines above (e.g., custom outro copy after `CompatibilityMatrix`), preserve them — but the layout above is the canonical pre-FAQ structure already. Confirm by reading the full original file before replacing.

- [ ] **Step 2: Type-check + lint**

Run from repo root:
```
npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i "pricing/page" || echo "ok"
npx nx run website:lint 2>&1 | grep -iE "pricing/page|error " || echo "ok"
```
Expected: `ok` for both.

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/app/pricing/page.tsx
git commit -m "$(cat <<'EOF'
feat(website): pricing page — new header, notes, FAQ integration

- Header: "Pricing for production AI chat interfaces"
- Subhead names the chat NC license + clarifies other libs stay MIT
- Adds commercial-use note (below grid), evaluation note (between
  matrix and FAQ), OSS clarification (below FAQ)
- Integrates PricingFAQ between CompatibilityMatrix and LeadForm
- Metadata description updated for SEO

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Update Footer — Licensing link + bottom bar

**Files:**
- Modify: `apps/website/src/components/shared/Footer.tsx`

- [ ] **Step 1: Resources column "MIT License" link → "Licensing"**

The current block (around lines 286-297) reads:

```tsx
            <a href="https://github.com/cacheplane/angular-agent-framework/blob/main/LICENSE"
              target="_blank" rel="noopener noreferrer"
              className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onClick={() => trackExternalLinkClick('https://github.com/cacheplane/angular-agent-framework/blob/main/LICENSE', {
                surface: 'footer',
                cta_id: 'footer_mit_license',
                cta_text: 'MIT License',
              })}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              MIT License
            </a>
```

Replace it with:

```tsx
            <Link href="/pricing#faq" className="transition-colors" style={{ color: tokens.colors.textSecondary }}
              onClick={() => trackFooterCta('Licensing', '/pricing#faq')}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textSecondary)}>
              Licensing
            </Link>
```

(Switches from external `<a>` to internal `<Link>` since `/pricing#faq` is local. `trackFooterCta` is already defined in the file and produces the cta_id `footer_licensing` via the slug-from-label rule. Verify by checking the existing `trackFooterCta` helper.)

Actually — confirm the helper. Read the file: `grep -n "trackFooterCta" apps/website/src/components/shared/Footer.tsx | head -5`. Expected: helper defined around line 99, called with `(label, href)` and slugifies label into `footer_<slug>`. With label `'Licensing'`, the cta_id becomes `'footer_licensing'`, which we just added to the `CtaId` union in Task 1.

- [ ] **Step 2: Bottom-bar "MIT License" → "Licensing"**

Current block (around lines 304-309):

```tsx
        <div className="mt-12 pt-8 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-xs"
          style={{ borderTop: `1px solid ${tokens.surfaces.border}`, color: tokens.colors.textMuted }}>
          <span>&copy; {new Date().getFullYear()} Agent UI for Angular. All rights reserved.</span>
          <span>MIT License &middot; <Link href="/pricing" className="transition-colors"
            onClick={() => trackFooterCta('Pricing Bottom', '/pricing')}
            onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
            onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textMuted)}>Pricing</Link></span>
        </div>
```

Replace the `<span>MIT License &middot; ...</span>` content with:

```tsx
          <span>
            <Link
              href="/pricing#faq"
              className="transition-colors"
              onClick={() => trackFooterCta('Licensing Bottom', '/pricing#faq')}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textMuted)}
            >
              Licensing
            </Link>
            &nbsp;&middot;&nbsp;
            <Link
              href="/pricing"
              className="transition-colors"
              onClick={() => trackFooterCta('Pricing Bottom', '/pricing')}
              onMouseEnter={(e) => (e.currentTarget.style.color = tokens.colors.accent)}
              onMouseLeave={(e) => (e.currentTarget.style.color = tokens.colors.textMuted)}
            >
              Pricing
            </Link>
          </span>
```

The slugified label `'Licensing Bottom'` produces `'footer_licensing_bottom'`, which we added to the `CtaId` union in Task 1.

- [ ] **Step 3: Type-check + lint**

```
npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i Footer || echo "ok"
npx nx run website:lint 2>&1 | grep -iE "Footer|error " || echo "ok"
```
Expected: `ok` for both.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/shared/Footer.tsx
git commit -m "$(cat <<'EOF'
feat(website): footer — replace "MIT License" with "Licensing" → /pricing#faq

The whole framework is no longer MIT (chat is dual-licensed). Resources
column link relabeled Licensing, targets /pricing#faq. Bottom bar now
shows "Licensing · Pricing" instead of "MIT License · Pricing".
Tracking ids footer_licensing and footer_licensing_bottom.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Rewrite root COMMERCIAL.md

**Files:**
- Modify: `COMMERCIAL.md` (repo root)

- [ ] **Step 1: Replace the file content**

Write `COMMERCIAL.md` at the repo root with this exact content:

```markdown
# Licensing

Most libraries in this repository — `@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens` — are released under the **MIT License**. Free for any use, commercial or noncommercial, with attribution. See [`LICENSE`](./LICENSE).

## `@ngaf/chat`

Starting with the next published version, `@ngaf/chat` is dual-licensed:

- **PolyForm Noncommercial 1.0.0** for free noncommercial use (personal, hobby, student, academic, nonprofit, public demos, OSI-licensed open source, 30-day commercial evaluation).
- **Threadplane commercial license** for commercial production use.

Historical MIT releases of `@ngaf/chat` remain under their original terms.

See [`libs/chat/LICENSE.md`](./libs/chat/LICENSE.md), [`libs/chat/LICENSE-COMMERCIAL.md`](./libs/chat/LICENSE-COMMERCIAL.md), and [`libs/chat/COMMERCIAL-USE.md`](./libs/chat/COMMERCIAL-USE.md) for the full terms.

## Minting Service

The ThreadPlane minting service (`apps/minting-service/`) is a proprietary internal service and is not covered by the MIT License. See `apps/minting-service/LICENSE` for its terms.

## Questions

- Website: <https://threadplane.ai>
- Pricing: <https://threadplane.ai/pricing>
- Sales: <https://threadplane.ai/contact>
```

- [ ] **Step 2: Verify**

```bash
grep -c "Starting with the next published version" COMMERCIAL.md   # 1
grep -c "Minting Service" COMMERCIAL.md                            # 1
grep -c "are released under the \*\*MIT License\*\*" COMMERCIAL.md # 1
```

- [ ] **Step 3: Commit**

```bash
git add COMMERCIAL.md
git commit -m "$(cat <<'EOF'
docs: rewrite root COMMERCIAL.md to lead with @ngaf/chat dual-license

Replaces the all-MIT framing with: most libs MIT, @ngaf/chat dual
(PolyForm-NC OR Threadplane-Commercial), minting service untouched.
Updates Questions contact links to threadplane.ai/{pricing,contact}.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 10: Update root README.md

**Files:**
- Modify: `README.md` (repo root)

- [ ] **Step 1: Read the relevant section**

Run: `sed -n '15,22p;130,142p' README.md`
Confirm: line ~18 has a `<img alt="License: MIT" ...>` badge; lines ~130-140 contain the paragraph that claims "all libraries in this repository are released under the MIT License".

- [ ] **Step 2: Drop the MIT badge**

Use Edit. The current badge line on or around line 18 looks like one of these patterns (verify before editing):

```
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
```

or

```
<img src="https://img.shields.io/badge/License-MIT-yellow.svg" alt="License: MIT" />
```

Delete that single line. Leave the line above and below untouched.

- [ ] **Step 3: Rewrite the license paragraph**

Find the existing paragraph that begins approximately:

```
**MIT** — free for any use
```

or:

```
All libraries in this repository are released under the MIT License.
```

Replace the full paragraph (one or two sentences) with:

```markdown
Most libraries in this repository (`@ngaf/render`, `@ngaf/agent`, `@ngaf/langgraph`, `@ngaf/ag-ui`, `@ngaf/a2ui`, `@ngaf/licensing`, `@ngaf/telemetry`, `@ngaf/design-tokens`) are released under the **MIT License** — free for any use, including commercial, with attribution.

**`@ngaf/chat`** is the exception. Future versions are licensed under **PolyForm Noncommercial 1.0.0 OR a Threadplane commercial license**. Historical npm releases remain MIT. See [`libs/chat/LICENSE.md`](./libs/chat/LICENSE.md), [`libs/chat/COMMERCIAL-USE.md`](./libs/chat/COMMERCIAL-USE.md), and [`COMMERCIAL.md`](./COMMERCIAL.md) for details.
```

- [ ] **Step 4: Verify**

```bash
! grep -q "License: MIT" README.md && echo "OK: MIT badge gone"
grep -c "PolyForm Noncommercial 1.0.0 OR a Threadplane commercial license" README.md  # 1
grep -c "Most libraries in this repository" README.md                                    # 1
! grep -q "all libraries in this repository are released under the MIT License" README.md && echo "OK: old all-MIT claim gone"
```

- [ ] **Step 5: Commit**

```bash
git add README.md
git commit -m "$(cat <<'EOF'
docs: root README — qualify license paragraph for @ngaf/chat exception

Drops the all-MIT badge (no single badge captures a per-lib split)
and rewrites the license paragraph to name @ngaf/chat explicitly as
PolyForm-NC OR Threadplane-Commercial, while keeping the other 8
libraries' MIT framing intact.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 11: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full website test suite**

Run from `apps/website/`: `npx vitest run 2>&1 | tail -8`
Expected: same pre-PR baseline plus the new 4 PricingFAQ tests. No regressions.

- [ ] **Step 2: Lint**

Run from repo root: `npx nx run website:lint 2>&1 | tail -5`
Expected: `Successfully ran target lint for project website`.

- [ ] **Step 3: Build**

Run from repo root: `npx nx build website 2>&1 | tail -10`
Expected: `Successfully ran target build for project website`.

- [ ] **Step 4: DOM verification**

Start the dev server (or use the running one) and reload `/pricing` and `/`. Then via preview eval or playwright:

```js
// /pricing checks
const tiers = [...document.querySelectorAll('[data-ui="eyebrow"]')].map(e => e.textContent);
// Should include: 'Community / Noncommercial', 'Indie Commercial', 'Developer Seat', 'App Deployment', 'Enterprise'

const ctas = [...document.querySelectorAll('a[href^="/contact?source=pricing_tier_"]')].map(a => a.href);
// Should be 4: indie, developer_seat, app_deployment, enterprise

const npmCta = document.querySelector('a[href*="npmjs.com/package/@ngaf/chat"]');
// Should exist

const faqs = document.querySelectorAll('details > summary');
// Should be 7

// / checks
const heroEyebrow = document.querySelector('h1#hero-heading')?.previousElementSibling?.textContent;
// Should be 'AGENT UI FOR ANGULAR · MIT FRAMEWORK' (eyebrow is uppercase via CSS)

const footerLicensing = [...document.querySelectorAll('footer a')].find(a => a.textContent.trim() === 'Licensing');
// Should exist; href should end with '/pricing#faq'
```

- [ ] **Step 5: Scope check**

```bash
# No library code changes
git diff --name-only origin/main..HEAD | grep '^libs/' | head    # expect empty
# No cockpit changes
git diff --name-only origin/main..HEAD | grep '^cockpit/' | head # expect empty
# No example changes
git diff --name-only origin/main..HEAD | grep '^examples/' | head # expect empty
```

- [ ] **Step 6: Mark PR description**

When opening the PR, include in the description:
- The 5 tier names and prices.
- The 7 FAQ questions.
- The before/after hero eyebrow.
- A note: Stripe Checkout wiring lands in PR B-Stripe.

---

## Self-review

**Spec coverage:**
- Spec § /pricing page header/subhead → Task 7 Step 1. ✓
- Spec § Tier cards (5 tiers, prices, features, CTAs, highlight on Developer Seat) → Task 3 Step 1. ✓
- Spec § Commercial-use note → Task 7 Step 1. ✓
- Spec § Evaluation note → Task 7 Step 1. ✓
- Spec § OSS clarification → Task 7 Step 1. ✓
- Spec § FAQ 7 Q&As → Tasks 5 + 6. ✓
- Spec § CompareTable 5 cols × 9 rows → Task 4 Step 1. ✓
- Spec § Hero eyebrow → Task 2. ✓
- Spec § Footer Resources link → Task 8 Step 1. ✓
- Spec § Footer bottom bar → Task 8 Step 2. ✓
- Spec § Root COMMERCIAL.md rewrite → Task 9. ✓
- Spec § Root README.md badge drop + paragraph rewrite → Task 10. ✓
- Spec § Analytics CtaId union additions → Task 1. ✓
- Spec § PricingFAQ spec.tsx → Task 6. ✓
- Spec § Acceptance criterion #10 (existing tests still pass) → Task 11 Step 1. ✓

**Placeholder scan:** Every code block is fully written. The only conditional path is Task 10's "verify before editing" for the MIT badge syntax — both common patterns are documented inline.

**Type consistency:** `CtaId` literals declared in Task 1 are consumed in Tasks 3 (5 pricing literals) and Task 8 (2 footer literals via the slug-from-label rule in `trackFooterCta`). `Plan.ctaId` typed against `CtaId` ensures the grid won't ship with a typo. `TierKey` in Task 4 is consistent across `TIERS`, `ROWS.cells`, and the renderer.

Plan complete.
