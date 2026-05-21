# Stripe Checkout (PR B-Stripe) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the placeholder `/contact?source=pricing_tier_<slug>` CTAs on `/pricing` with real Stripe-hosted Checkout for the three buyable tiers (Indie, Developer Seat, App Deployment). One-time 12-month payments; no subscriptions. Token minting is handled by the existing `apps/minting-service/` webhook handler — out of scope here.

**Architecture:** A single source-of-truth config file (`pricing/tiers.config.ts`) drives both the website's PricingGrid and an idempotent Node script (`scripts/stripe/sync-products.ts`) that creates/updates Stripe products + prices and writes their IDs to `pricing/tiers.generated.ts`. A new Next.js Route Handler at `/api/checkout/session` accepts `POST { tier, quantity? }`, calls `stripe.checkout.sessions.create`, and 303-redirects to the hosted Checkout URL. Success returns to a new `/thanks` page; cancel returns to `/pricing`. The pricing grid swaps its `<Button href>` anchors on paid tiers for `<form action="/api/checkout/session" method="post">` so clicks POST and get the 303.

**Tech Stack:** Next.js 16 App Router (Route Handlers, Server Components), `stripe` 22.0.2 (already in root `package.json`), TypeScript, `@ngaf/design-tokens`, Vitest.

**Reference:** Spec at `docs/superpowers/specs/2026-05-20-stripe-checkout-design.md`.

---

## File map

- **Create:** `pricing/tiers.config.ts` — typed source of truth for the 5 tiers (3 stripeBuyable). Imported by PricingGrid and the sync script.
- **Create:** `pricing/tiers.generated.ts` — script output, committed; maps tier slugs to Stripe price IDs.
- **Create:** `scripts/stripe/sync-products.ts` — idempotent products/prices sync. Identifies products by `metadata.ngaf_tier_slug`.
- **Create:** `scripts/stripe/sync-products.spec.ts` — unit tests against a `Stripe` stub.
- **Create:** `apps/website/src/lib/stripe.ts` — small wrapper that constructs the Stripe client with the right API version and refuses to load if `STRIPE_SECRET_KEY` doesn't start with `sk_`.
- **Create:** `apps/website/src/lib/stripe.spec.ts` — covers the `sk_` guard.
- **Create:** `apps/website/src/app/api/checkout/session/route.ts` — POST handler.
- **Create:** `apps/website/src/app/api/checkout/session/route.spec.ts` — covers happy path + `400` for invalid tier + quantity clamping.
- **Create:** `apps/website/src/app/thanks/page.tsx` — server component, copy-only.
- **Create:** `apps/website/src/app/thanks/page.spec.tsx` — covers rendered copy.
- **Modify:** `apps/website/src/components/pricing/PricingGrid.tsx` — paid-tier `<Button>` → `<form action="/api/checkout/session">`. Community + Enterprise CTAs unchanged. Reads tier data from `pricing/tiers.config.ts` instead of inlining it.
- **Modify:** `apps/website/src/components/pricing/PricingGrid.spec.tsx` — if exists; otherwise no change.
- **Modify:** `apps/website/src/lib/analytics/events.ts` — add `marketing:checkout_started` event (and `checkout_succeeded` for the thanks page).
- **Modify:** `apps/website/package.json` — add `stripe` to `dependencies` (pnpm workspace already has it at root, but website's own package.json should declare what it imports).
- **Modify:** `apps/website/.env.example` (create if absent) — document `STRIPE_SECRET_KEY` env name; no value.
- **Modify:** `.env.example` (root) — same.

No changes to `libs/chat`, `libs/licensing`, `apps/minting-service`, the cockpit, or examples.

---

## Task 1: Create `pricing/tiers.config.ts` source of truth

**Files:**
- Create: `pricing/tiers.config.ts`

- [ ] **Step 1: Write the file**

Create `pricing/tiers.config.ts`:

```ts
// SPDX-License-Identifier: MIT
/**
 * Single source of truth for /pricing tier display and Stripe product sync.
 * Read by:
 *   - apps/website/src/components/pricing/PricingGrid.tsx (display)
 *   - scripts/stripe/sync-products.ts (Stripe-side products + prices)
 *
 * Stripe products are identified by `metadata.ngaf_tier_slug = slug`. Never
 * rely on product name to match — names are display copy and may change.
 */
export type TierSlug =
  | 'community'
  | 'indie'
  | 'developer_seat'
  | 'app_deployment'
  | 'enterprise';

export interface TierConfig {
  readonly slug: TierSlug;
  readonly name: string;
  /** USD cents. null for free / custom. */
  readonly priceCents: number | null;
  readonly displayPrice: string;
  readonly displayPeriod: string;
  readonly features: readonly string[];
  /** false → community (npm), enterprise (sales). true → real Stripe product + price. */
  readonly stripeBuyable: boolean;
  /** Highlighted card in the PricingGrid. */
  readonly highlight: boolean;
  /** Checkout `adjustable_quantity` enabled. Only Developer Seat today. */
  readonly adjustableQuantity?: boolean;
  /** Default quantity passed to Stripe Checkout when the buyer doesn't override. */
  readonly defaultQuantity?: number;
}

export const TIERS: readonly TierConfig[] = [
  {
    slug: 'community',
    name: 'Community / Noncommercial',
    priceCents: null,
    displayPrice: 'Free',
    displayPeriod: 'forever',
    features: [
      'Personal, student, academic, nonprofit, demo',
      'Source access',
      'Noncommercial use',
      'Commercial evaluation (30 days)',
      'License: PolyForm Noncommercial 1.0.0',
    ],
    stripeBuyable: false,
    highlight: false,
  },
  {
    slug: 'indie',
    name: 'Indie Commercial',
    priceCents: 14900,
    displayPrice: '$149',
    displayPeriod: '/year',
    features: [
      '1 developer',
      '1 commercial app',
      'Unlimited end users',
      'Commercial license',
      'Best for: solo devs, indie products, consultants with one app',
    ],
    stripeBuyable: true,
    highlight: false,
  },
  {
    slug: 'developer_seat',
    name: 'Developer Seat',
    priceCents: 29900,
    displayPrice: '$299',
    displayPeriod: '/developer/year',
    features: [
      'Commercial use',
      'Unlimited end users',
      'Dev / staging / production',
      'Apps owned by your org',
      'Best for: startups & growing teams',
    ],
    stripeBuyable: true,
    highlight: true,
    adjustableQuantity: true,
    defaultQuantity: 1,
  },
  {
    slug: 'app_deployment',
    name: 'App Deployment',
    priceCents: 149900,
    displayPrice: '$1,499',
    displayPeriod: '/app/year',
    features: [
      'Unlimited developers',
      '1 production app',
      'Unlimited end users',
      'Procurement-friendly',
      'Best for: agencies, CI/CD-heavy teams',
    ],
    stripeBuyable: true,
    highlight: false,
  },
  {
    slug: 'enterprise',
    name: 'Enterprise',
    priceCents: null,
    displayPrice: 'Custom',
    displayPeriod: 'starting at $10k/year',
    features: [
      'Custom contract & SLA',
      'Procurement support',
      'Security review',
      'Multi-app licensing',
      'Priority + private support channel',
    ],
    stripeBuyable: false,
    highlight: false,
  },
];

export const BUYABLE_TIERS = TIERS.filter((t) => t.stripeBuyable);

export function getTier(slug: TierSlug): TierConfig {
  const t = TIERS.find((x) => x.slug === slug);
  if (!t) throw new Error(`Unknown tier slug: ${slug}`);
  return t;
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit pricing/tiers.config.ts 2>&1 | tail -5`
Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add pricing/tiers.config.ts
git commit -m "$(cat <<'EOF'
feat(pricing): add tiers.config.ts source of truth

Five-tier definition consumed by both the website's PricingGrid and the
Stripe products/prices sync script. Stripe products are matched by
metadata.ngaf_tier_slug, never by display name.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Create `pricing/tiers.generated.ts` stub

**Files:**
- Create: `pricing/tiers.generated.ts`

This file is *normally* written by `scripts/stripe/sync-products.ts`, but to ship a working website before the sync runs, we commit an empty stub that the route handler can detect and 503 on.

- [ ] **Step 1: Write the stub**

Create `pricing/tiers.generated.ts`:

```ts
// SPDX-License-Identifier: MIT
// Generated by scripts/stripe/sync-products.ts. Do not edit by hand.
// Each entry maps a tier slug → Stripe price ID. Empty until the sync
// script has been run against a Stripe account.
import type { TierSlug } from './tiers.config';

export const STRIPE_PRICE_IDS: Partial<Record<Exclude<TierSlug, 'community' | 'enterprise'>, string>> = {
  // Populated by `pnpm tsx scripts/stripe/sync-products.ts`.
};
```

- [ ] **Step 2: Commit**

```bash
git add pricing/tiers.generated.ts
git commit -m "$(cat <<'EOF'
feat(pricing): seed tiers.generated.ts as empty Stripe-IDs map

Populated by scripts/stripe/sync-products.ts. The /api/checkout/session
route detects an empty map and 503s with "checkout not yet configured."
EOF
)"
```

---

## Task 3: Add `stripe` to website package.json + write `lib/stripe.ts` guard

**Files:**
- Modify: `apps/website/package.json`
- Create: `apps/website/src/lib/stripe.ts`

- [ ] **Step 1: Confirm Stripe is in the root pnpm workspace**

Run: `grep '"stripe"' package.json`
Expected: `"stripe": "^22.0.2"` (already present per pre-plan survey).

- [ ] **Step 2: Add the dep to apps/website**

Use Edit on `apps/website/package.json`. Find the `dependencies` block. Add `"stripe": "^22.0.2"` in alphabetical order. (If website's package.json doesn't have a `dependencies` block, add one.)

Run: `pnpm install` from repo root.
Expected: `Dependencies: ...` summary line, exit 0.

- [ ] **Step 3: Create the wrapper**

Create `apps/website/src/lib/stripe.ts`:

```ts
// SPDX-License-Identifier: MIT
import Stripe from 'stripe';

/**
 * Returns a configured Stripe client.
 *
 * Refuses to load if STRIPE_SECRET_KEY is missing or doesn't begin with
 * `sk_` (the Stripe convention for secret keys; `sk_test_` for test mode,
 * `sk_live_` for live mode). This is the only Stripe environment check we
 * do — the key itself encodes test vs live.
 */
export function getStripe(): Stripe {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not set');
  }
  if (!key.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY does not look like a Stripe secret key (must begin with "sk_")');
  }
  return new Stripe(key, { apiVersion: '2025-09-30.clover' });
}
```

- [ ] **Step 4: Write spec**

Create `apps/website/src/lib/stripe.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getStripe } from './stripe';

describe('getStripe', () => {
  const originalKey = process.env['STRIPE_SECRET_KEY'];

  beforeEach(() => {
    delete process.env['STRIPE_SECRET_KEY'];
  });

  afterEach(() => {
    if (originalKey === undefined) delete process.env['STRIPE_SECRET_KEY'];
    else process.env['STRIPE_SECRET_KEY'] = originalKey;
  });

  it('throws when STRIPE_SECRET_KEY is not set', () => {
    expect(() => getStripe()).toThrow(/not set/);
  });

  it('throws when STRIPE_SECRET_KEY does not start with sk_', () => {
    process.env['STRIPE_SECRET_KEY'] = 'pk_test_garbage';
    expect(() => getStripe()).toThrow(/must begin with "sk_"/);
  });

  it('returns a Stripe client with a valid sk_test_ key', () => {
    process.env['STRIPE_SECRET_KEY'] = 'sk_test_1234567890abcdef';
    const stripe = getStripe();
    expect(stripe).toBeTruthy();
  });
});
```

- [ ] **Step 5: Run tests**

From `apps/website/`: `npx vitest run src/lib/stripe.spec.ts 2>&1 | tail -8`
Expected: `Tests 3 passed (3)`.

- [ ] **Step 6: Commit**

```bash
git add apps/website/package.json apps/website/src/lib/stripe.ts apps/website/src/lib/stripe.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): add Stripe client wrapper with sk_ guard

getStripe() refuses to load if STRIPE_SECRET_KEY is missing or doesn't
begin with sk_. The key encodes test vs live mode, so we don't need
explicit mode detection elsewhere.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Create `/api/checkout/session` route handler

**Files:**
- Create: `apps/website/src/app/api/checkout/session/route.ts`

- [ ] **Step 1: Write the route**

Create `apps/website/src/app/api/checkout/session/route.ts`:

```ts
// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '../../../../lib/stripe';
import { TIERS, type TierSlug } from '../../../../../../../pricing/tiers.config';
import { STRIPE_PRICE_IDS } from '../../../../../../../pricing/tiers.generated';

const BUYABLE_SLUGS = new Set<TierSlug>(['indie', 'developer_seat', 'app_deployment']);

interface RequestBody {
  tier?: string;
  quantity?: number;
}

function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

export async function POST(req: NextRequest) {
  let body: RequestBody;
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }
  } else {
    const form = await req.formData();
    body = {
      tier: typeof form.get('tier') === 'string' ? (form.get('tier') as string) : undefined,
      quantity: form.get('quantity') ? Number(form.get('quantity')) : undefined,
    };
  }

  const tier = body.tier;
  if (typeof tier !== 'string' || !BUYABLE_SLUGS.has(tier as TierSlug)) {
    return NextResponse.json({ error: 'Invalid or unbuyable tier' }, { status: 400 });
  }
  const tierSlug = tier as Exclude<TierSlug, 'community' | 'enterprise'>;

  const priceId = STRIPE_PRICE_IDS[tierSlug];
  if (!priceId) {
    return NextResponse.json(
      { error: 'Checkout not yet configured for this tier. Run scripts/stripe/sync-products.ts.' },
      { status: 503 },
    );
  }

  const tierConfig = TIERS.find((t) => t.slug === tierSlug);
  if (!tierConfig) {
    return NextResponse.json({ error: 'Tier missing from config' }, { status: 500 });
  }

  const rawQuantity = body.quantity ?? tierConfig.defaultQuantity ?? 1;
  const quantity = Math.max(1, Math.min(100, Math.floor(rawQuantity)));

  const origin = getOrigin(req);
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    line_items: [
      {
        price: priceId,
        quantity,
        ...(tierConfig.adjustableQuantity
          ? { adjustable_quantity: { enabled: true, minimum: 1, maximum: 100 } }
          : {}),
      },
    ],
    success_url: `${origin}/thanks?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    metadata: { ngaf_tier_slug: tierSlug },
    payment_intent_data: { metadata: { ngaf_tier_slug: tierSlug } },
  });

  if (!session.url) {
    return NextResponse.json({ error: 'Stripe did not return a checkout URL' }, { status: 502 });
  }

  return NextResponse.redirect(session.url, { status: 303 });
}
```

(The pricing config and generated map sit at repo root, so the relative path is `../../../../../../../pricing/`. If Next.js's compiler dislikes that import depth, swap to a `paths` alias `@pricing/*` in `tsconfig.json`. Keep that change scoped: add the alias only if you hit a real error.)

- [ ] **Step 2: Write spec**

Create `apps/website/src/app/api/checkout/session/route.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

const stripeCreate = vi.fn();

vi.mock('../../../../lib/stripe', () => ({
  getStripe: () => ({ checkout: { sessions: { create: stripeCreate } } }),
}));

vi.mock('../../../../../../../pricing/tiers.generated', () => ({
  STRIPE_PRICE_IDS: {
    indie: 'price_test_indie',
    developer_seat: 'price_test_seat',
    app_deployment: 'price_test_app',
  },
}));

import { POST } from './route';

function makeReq(body: unknown): NextRequest {
  return new NextRequest('http://localhost:3000/api/checkout/session', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

describe('POST /api/checkout/session', () => {
  beforeEach(() => {
    stripeCreate.mockReset();
    stripeCreate.mockResolvedValue({ url: 'https://checkout.stripe.com/c/pay/cs_test_abc' });
  });

  it('returns 400 for unknown tier', async () => {
    const res = await POST(makeReq({ tier: 'bogus' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for community tier (not Stripe-buyable)', async () => {
    const res = await POST(makeReq({ tier: 'community' }));
    expect(res.status).toBe(400);
  });

  it('returns 400 for enterprise tier (not Stripe-buyable)', async () => {
    const res = await POST(makeReq({ tier: 'enterprise' }));
    expect(res.status).toBe(400);
  });

  it('returns 303 redirect to Stripe for indie', async () => {
    const res = await POST(makeReq({ tier: 'indie' }));
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toBe('https://checkout.stripe.com/c/pay/cs_test_abc');
    expect(stripeCreate).toHaveBeenCalledTimes(1);
    const args = stripeCreate.mock.calls[0]?.[0];
    expect(args.mode).toBe('payment');
    expect(args.line_items[0].price).toBe('price_test_indie');
    expect(args.line_items[0].quantity).toBe(1);
    expect(args.metadata.ngaf_tier_slug).toBe('indie');
  });

  it('enables adjustable_quantity only for developer_seat', async () => {
    await POST(makeReq({ tier: 'developer_seat', quantity: 3 }));
    const args = stripeCreate.mock.calls[0]?.[0];
    expect(args.line_items[0].quantity).toBe(3);
    expect(args.line_items[0].adjustable_quantity).toEqual({ enabled: true, minimum: 1, maximum: 100 });
  });

  it('clamps quantity to [1, 100]', async () => {
    await POST(makeReq({ tier: 'developer_seat', quantity: 9999 }));
    expect(stripeCreate.mock.calls[0]?.[0].line_items[0].quantity).toBe(100);

    stripeCreate.mockClear();
    await POST(makeReq({ tier: 'developer_seat', quantity: 0 }));
    expect(stripeCreate.mock.calls[0]?.[0].line_items[0].quantity).toBe(1);
  });

  it('returns 502 if Stripe returns no URL', async () => {
    stripeCreate.mockResolvedValueOnce({ url: null });
    const res = await POST(makeReq({ tier: 'indie' }));
    expect(res.status).toBe(502);
  });
});
```

- [ ] **Step 3: Run the spec**

From `apps/website/`: `npx vitest run src/app/api/checkout/session/route.spec.ts 2>&1 | tail -10`
Expected: 7 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/api/checkout/session/route.ts apps/website/src/app/api/checkout/session/route.spec.ts
git commit -m "$(cat <<'EOF'
feat(website): add /api/checkout/session route handler

POST with { tier } returns a 303 redirect to Stripe-hosted Checkout for
the three buyable tiers (indie / developer_seat / app_deployment).
Community and Enterprise return 400. Quantity is clamped to [1, 100]
and adjustable_quantity is enabled only for Developer Seat. Returns
503 when STRIPE_PRICE_IDS is empty (sync-products hasn't run yet).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Create the `/thanks` page

**Files:**
- Create: `apps/website/src/app/thanks/page.tsx`
- Create: `apps/website/src/app/thanks/page.spec.tsx`

- [ ] **Step 1: Write the page**

Create `apps/website/src/app/thanks/page.tsx`:

```tsx
// SPDX-License-Identifier: MIT
import { tokens } from '@ngaf/design-tokens';
import { Container } from '../../components/ui/Container';
import { Section } from '../../components/ui/Section';
import { Eyebrow } from '../../components/ui/Eyebrow';
import { Button } from '../../components/ui/Button';
import { createPageMetadata } from '../../lib/site-metadata';

export const metadata = createPageMetadata({
  title: 'Payment received — Threadplane',
  description: 'Your @ngaf/chat license token will be emailed shortly.',
  pathname: '/thanks',
  type: 'website',
});

export default function ThanksPage() {
  return (
    <Section surface="canvas" ariaLabelledBy="thanks-heading">
      <Container>
        <div style={{ textAlign: 'center', maxWidth: 640, margin: '0 auto' }}>
          <Eyebrow tone="accent" style={{ marginBottom: 16 }}>Payment received</Eyebrow>
          <h1
            id="thanks-heading"
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
            Thanks for your purchase.
          </h1>
          <p
            style={{
              fontFamily: tokens.typography.bodyLg.family,
              fontSize: tokens.typography.bodyLg.size,
              lineHeight: tokens.typography.bodyLg.line,
              color: tokens.colors.textSecondary,
              margin: '0 auto 24px',
            }}
          >
            Your <code style={{ fontFamily: tokens.typography.fontMono }}>@ngaf/chat</code> license token will be emailed to the address on your receipt within a few minutes. Paste it into your app's <code style={{ fontFamily: tokens.typography.fontMono }}>provideChat()</code> config to activate.
          </p>
          <p
            style={{
              fontFamily: tokens.typography.body.family,
              fontSize: 13,
              lineHeight: 1.6,
              color: tokens.colors.textMuted,
              margin: '0 auto 32px',
            }}
          >
            If you don't see the email within 10 minutes, check spam or contact us.
          </p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <Button variant="primary" size="md" href="/docs/chat/getting-started/installation">
              Installation docs
            </Button>
            <Button variant="ghost" size="md" href="/contact">
              Contact support
            </Button>
          </div>
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 2: Write spec**

Create `apps/website/src/app/thanks/page.spec.tsx`:

```tsx
// SPDX-License-Identifier: MIT
// @vitest-environment jsdom
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import ThanksPage from './page';

vi.mock('../../components/ui/Container', () => ({
  Container: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../components/ui/Section', () => ({
  Section: ({ children }: { children: React.ReactNode }) => <section>{children}</section>,
}));
vi.mock('../../components/ui/Eyebrow', () => ({
  Eyebrow: ({ children }: { children: React.ReactNode }) => <span>{children}</span>,
}));
vi.mock('../../components/ui/Button', () => ({
  Button: ({ children, href }: { children: React.ReactNode; href?: string }) =>
    <a href={href}>{children}</a>,
}));

describe('ThanksPage', () => {
  it('renders the payment-received heading', () => {
    render(<ThanksPage />);
    expect(screen.getByRole('heading', { level: 1, name: 'Thanks for your purchase.' })).toBeTruthy();
  });

  it('mentions provideChat() activation', () => {
    render(<ThanksPage />);
    expect(screen.getByText(/provideChat\(\)/)).toBeTruthy();
  });

  it('links to installation docs and contact', () => {
    render(<ThanksPage />);
    expect(screen.getByRole('link', { name: 'Installation docs' }).getAttribute('href'))
      .toBe('/docs/chat/getting-started/installation');
    expect(screen.getByRole('link', { name: 'Contact support' }).getAttribute('href'))
      .toBe('/contact');
  });
});
```

- [ ] **Step 3: Run spec**

From `apps/website/`: `npx vitest run src/app/thanks/page.spec.tsx 2>&1 | tail -8`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/app/thanks/page.tsx apps/website/src/app/thanks/page.spec.tsx
git commit -m "$(cat <<'EOF'
feat(website): add /thanks page for Checkout success returns

Tells buyers their @ngaf/chat license token will be emailed within a
few minutes, links to installation docs and support. Static server
component; reads no query params at runtime — Stripe handles the
session_id reconciliation via webhook in the minting service.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Refactor PricingGrid to read from tiers.config + POST form for paid tiers

**Files:**
- Modify: `apps/website/src/components/pricing/PricingGrid.tsx`

- [ ] **Step 1: Read current state**

Run: `cat apps/website/src/components/pricing/PricingGrid.tsx | head -120`
Confirm the file currently has an inline `PLANS` array with 5 entries and uses `<Button href="...">` for every CTA.

- [ ] **Step 2: Replace the file**

Write `apps/website/src/components/pricing/PricingGrid.tsx` with:

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
import { TIERS, type TierConfig } from '../../../../../pricing/tiers.config';

interface PlanCta {
  readonly cta: string;
  readonly ctaId: CtaId;
  /** Set for tiers that route to Stripe via a POST form. */
  readonly stripeBuyable?: boolean;
  /** Set for tiers that link directly (community = npm, enterprise = /contact). */
  readonly ctaHref?: string;
  readonly ctaExternal?: boolean;
}

const CTAS: Record<TierConfig['slug'], PlanCta> = {
  community: {
    cta: 'Start free',
    ctaId: 'pricing_tier_community',
    ctaHref: 'https://www.npmjs.com/package/@ngaf/chat',
    ctaExternal: true,
  },
  indie: {
    cta: 'Buy indie license',
    ctaId: 'pricing_tier_indie',
    stripeBuyable: true,
  },
  developer_seat: {
    cta: 'Buy developer seat',
    ctaId: 'pricing_tier_developer_seat',
    stripeBuyable: true,
  },
  app_deployment: {
    cta: 'License an app',
    ctaId: 'pricing_tier_app_deployment',
    stripeBuyable: true,
  },
  enterprise: {
    cta: 'Contact sales',
    ctaId: 'pricing_tier_enterprise',
    ctaHref: '/contact?source=pricing_tier_enterprise',
  },
};

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
          {TIERS.map((tier) => {
            const cta = CTAS[tier.slug];
            return (
              <Card
                key={tier.slug}
                padding="lg"
                surface={tier.highlight ? 'dim' : 'white'}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  border: tier.highlight
                    ? `2px solid ${tokens.colors.accent}`
                    : `1px solid ${tokens.surfaces.border}`,
                }}
              >
                <Eyebrow tone="accent" style={{ marginBottom: 12 }}>{tier.name}</Eyebrow>
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
                  {tier.displayPrice}
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
                  {tier.displayPeriod}
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
                  {tier.features.map((feature) => (
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
                {cta.stripeBuyable ? (
                  <form action="/api/checkout/session" method="post">
                    <input type="hidden" name="tier" value={tier.slug} />
                    <Button
                      type="submit"
                      variant={tier.highlight ? 'primary' : 'ghost'}
                      size="md"
                      onClick={() =>
                        trackCtaClick({
                          surface: 'pricing',
                          destination_url: '/api/checkout/session',
                          cta_id: cta.ctaId,
                          cta_text: cta.cta,
                        })
                      }
                      style={{ width: '100%' }}
                    >
                      {cta.cta}
                    </Button>
                  </form>
                ) : (
                  <Button
                    variant={tier.highlight ? 'primary' : 'ghost'}
                    size="md"
                    href={cta.ctaHref!}
                    {...(cta.ctaExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    onClick={() =>
                      trackCtaClick({
                        surface: 'pricing',
                        destination_url: cta.ctaHref!,
                        cta_id: cta.ctaId,
                        cta_text: cta.cta,
                      })
                    }
                  >
                    {cta.cta}
                  </Button>
                )}
              </Card>
            );
          })}
        </div>
      </Container>
    </Section>
  );
}
```

- [ ] **Step 3: Type-check + lint**

From repo root:
```
npx tsc -p apps/website/tsconfig.json --noEmit 2>&1 | grep -i PricingGrid | grep -v TS6305 || echo "ok"
npx nx run website:lint 2>&1 | grep -iE "PricingGrid|error " || echo "ok"
```
Both expect `ok`.

- [ ] **Step 4: Commit**

```bash
git add apps/website/src/components/pricing/PricingGrid.tsx
git commit -m "$(cat <<'EOF'
feat(website): pricing grid posts to Stripe Checkout for paid tiers

- Tier data now sourced from pricing/tiers.config.ts (single source of
  truth shared with the Stripe sync script).
- Paid tiers (Indie / Developer Seat / App Deployment) submit a POST
  form to /api/checkout/session which 303-redirects to Stripe-hosted
  Checkout.
- Community keeps the npm link; Enterprise keeps /contact.
- Tracking events unchanged.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: Create `scripts/stripe/sync-products.ts` idempotent sync

**Files:**
- Create: `scripts/stripe/sync-products.ts`
- Create: `scripts/stripe/sync-products.spec.ts`

- [ ] **Step 1: Write the script**

Create `scripts/stripe/sync-products.ts`:

```ts
// SPDX-License-Identifier: MIT
/**
 * Idempotent Stripe products + prices sync.
 *
 * Reads pricing/tiers.config.ts and ensures each `stripeBuyable: true` tier
 * has a Stripe product (matched by metadata.ngaf_tier_slug) and exactly one
 * active one-time price. Writes the resulting price IDs to
 * pricing/tiers.generated.ts.
 *
 * Usage:
 *   STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe/sync-products.ts
 *
 * Re-running is safe: products are matched by metadata, prices are reused if
 * the unit_amount matches, otherwise the old price is archived and a new one
 * created.
 */
import Stripe from 'stripe';
import fs from 'node:fs';
import path from 'node:path';
import { BUYABLE_TIERS, type TierConfig } from '../../pricing/tiers.config';

const METADATA_KEY = 'ngaf_tier_slug';

async function findOrCreateProduct(stripe: Stripe, tier: TierConfig): Promise<Stripe.Product> {
  // Stripe doesn't support metadata search on products in the standard list API
  // (it would need /v1/products/search), so we paginate and filter.
  const search = await stripe.products.search({
    query: `metadata['${METADATA_KEY}']:'${tier.slug}'`,
    limit: 1,
  });
  const existing = search.data[0];
  if (existing) {
    if (existing.name !== tier.name || existing.active === false) {
      return stripe.products.update(existing.id, { name: tier.name, active: true });
    }
    return existing;
  }
  return stripe.products.create({
    name: tier.name,
    metadata: { [METADATA_KEY]: tier.slug },
  });
}

async function findOrCreatePrice(
  stripe: Stripe,
  product: Stripe.Product,
  tier: TierConfig,
): Promise<Stripe.Price> {
  if (tier.priceCents === null) {
    throw new Error(`Tier ${tier.slug} has null priceCents but is marked stripeBuyable`);
  }
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 10 });
  const match = prices.data.find(
    (p) => p.unit_amount === tier.priceCents && p.currency === 'usd' && p.type === 'one_time',
  );
  if (match) return match;

  // Archive any active prices that don't match (one active price per tier).
  for (const stale of prices.data) {
    await stripe.prices.update(stale.id, { active: false });
  }

  return stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: tier.priceCents,
    metadata: { [METADATA_KEY]: tier.slug },
  });
}

function renderGeneratedFile(idsBySlug: Record<string, string>): string {
  const entries = Object.entries(idsBySlug)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `  ${k}: ${JSON.stringify(v)},`)
    .join('\n');
  return `// SPDX-License-Identifier: MIT
// Generated by scripts/stripe/sync-products.ts. Do not edit by hand.
import type { TierSlug } from './tiers.config';

export const STRIPE_PRICE_IDS: Partial<Record<Exclude<TierSlug, 'community' | 'enterprise'>, string>> = {
${entries}
};
`;
}

export async function syncProducts(stripe: Stripe): Promise<Record<string, string>> {
  const idsBySlug: Record<string, string> = {};
  for (const tier of BUYABLE_TIERS) {
    const product = await findOrCreateProduct(stripe, tier);
    const price = await findOrCreatePrice(stripe, product, tier);
    idsBySlug[tier.slug] = price.id;
    // eslint-disable-next-line no-console
    console.log(`✓ ${tier.slug}: product=${product.id} price=${price.id} (${tier.priceCents}¢)`);
  }
  return idsBySlug;
}

async function main(): Promise<void> {
  const key = process.env['STRIPE_SECRET_KEY'];
  if (!key || !key.startsWith('sk_')) {
    throw new Error('STRIPE_SECRET_KEY must be set and begin with sk_');
  }
  const stripe = new Stripe(key, { apiVersion: '2025-09-30.clover' });
  const ids = await syncProducts(stripe);
  const outPath = path.join(process.cwd(), 'pricing', 'tiers.generated.ts');
  fs.writeFileSync(outPath, renderGeneratedFile(ids));
  // eslint-disable-next-line no-console
  console.log(`\nWrote ${outPath}`);
}

if (require.main === module) {
  main().catch((err: unknown) => {
    // eslint-disable-next-line no-console
    console.error(err);
    process.exit(1);
  });
}
```

- [ ] **Step 2: Write spec**

Create `scripts/stripe/sync-products.spec.ts`:

```ts
// SPDX-License-Identifier: MIT
import { describe, expect, it, vi } from 'vitest';
import type Stripe from 'stripe';
import { syncProducts } from './sync-products';

function stubStripe(opts: {
  productSearch?: Stripe.Product[];
  priceList?: Stripe.Price[];
} = {}): Stripe {
  const products = {
    search: vi.fn().mockResolvedValue({ data: opts.productSearch ?? [] }),
    create: vi.fn().mockImplementation(({ name }: { name: string }) =>
      Promise.resolve({ id: `prod_new_${name.replace(/\W+/g, '_')}`, name, active: true })),
    update: vi.fn().mockImplementation((id: string, body: Stripe.ProductUpdateParams) =>
      Promise.resolve({ id, ...body, active: true })),
  };
  const prices = {
    list: vi.fn().mockResolvedValue({ data: opts.priceList ?? [] }),
    create: vi.fn().mockImplementation((body: Stripe.PriceCreateParams) =>
      Promise.resolve({ id: `price_new_${body.unit_amount}`, ...body })),
    update: vi.fn().mockImplementation((id: string) => Promise.resolve({ id, active: false })),
  };
  return { products, prices } as unknown as Stripe;
}

describe('syncProducts', () => {
  it('creates a new product and price when none exist', async () => {
    const stripe = stubStripe();
    const ids = await syncProducts(stripe);
    expect(Object.keys(ids).sort()).toEqual(['app_deployment', 'developer_seat', 'indie']);
    expect(ids.indie.startsWith('price_new_14900')).toBe(true);
  });

  it('reuses an existing product and matching active price', async () => {
    const existingIndieProduct = {
      id: 'prod_existing_indie',
      name: 'Indie Commercial',
      active: true,
    } as Stripe.Product;
    const existingIndiePrice = {
      id: 'price_existing_indie',
      product: 'prod_existing_indie',
      unit_amount: 14900,
      currency: 'usd',
      type: 'one_time',
      active: true,
    } as Stripe.Price;
    const stripe = stubStripe({
      productSearch: [existingIndieProduct],
      priceList: [existingIndiePrice],
    });
    const ids = await syncProducts(stripe);
    expect(ids.indie).toBe('price_existing_indie');
  });

  it('archives a stale price when unit_amount no longer matches and creates a new one', async () => {
    const staleIndiePrice = {
      id: 'price_stale_indie',
      product: 'prod_existing_indie',
      unit_amount: 9900,
      currency: 'usd',
      type: 'one_time',
      active: true,
    } as Stripe.Price;
    const existingIndieProduct = {
      id: 'prod_existing_indie',
      name: 'Indie Commercial',
      active: true,
    } as Stripe.Product;
    const stripe = stubStripe({
      productSearch: [existingIndieProduct],
      priceList: [staleIndiePrice],
    });
    const ids = await syncProducts(stripe);
    expect(ids.indie.startsWith('price_new_14900')).toBe(true);
    // Archive call was made
    // @ts-expect-error vitest mock typing
    expect(stripe.prices.update).toHaveBeenCalledWith('price_stale_indie', { active: false });
  });
});
```

- [ ] **Step 3: Run the spec**

Run: `npx vitest run scripts/stripe/sync-products.spec.ts 2>&1 | tail -10`
Expected: 3 passed.

- [ ] **Step 4: Commit**

```bash
git add scripts/stripe/sync-products.ts scripts/stripe/sync-products.spec.ts
git commit -m "$(cat <<'EOF'
feat(stripe): idempotent products + prices sync script

Reads pricing/tiers.config.ts and ensures each stripeBuyable tier has a
Stripe product (matched by metadata.ngaf_tier_slug) and exactly one
active one-time USD price. Writes pricing/tiers.generated.ts with the
resulting price IDs. Re-runnable; stale prices are archived when
unit_amount changes.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 8: Wire up new analytics events + env example

**Files:**
- Modify: `apps/website/src/lib/analytics/events.ts`
- Modify: `apps/website/.env.example` (create if absent)
- Modify: `.env.example` (root)

- [ ] **Step 1: Add checkout event types**

Find the `EventType` union in `apps/website/src/lib/analytics/events.ts`. (If no such union exists, the codebase uses a different shape — read the file first.)

Add two new literal members:

```
  | 'marketing:checkout_started'
  | 'marketing:checkout_succeeded'
```

If the file uses an enum or constants object instead of a union, add the corresponding entries. The existing PR-B pricing CTAs use `trackCtaClick` only; these new events are *additional* signals (started: server-side could log in the route; succeeded: client-side on the /thanks page if we add tracking later).

- [ ] **Step 2: Document env vars**

Create or extend `apps/website/.env.example`:

```env
# Stripe — see scripts/stripe/sync-products.ts and src/app/api/checkout/session/route.ts
STRIPE_SECRET_KEY=sk_test_…
```

Extend root `.env.example` similarly (append, do not overwrite existing lines).

- [ ] **Step 3: Commit**

```bash
git add apps/website/src/lib/analytics/events.ts apps/website/.env.example .env.example
git commit -m "$(cat <<'EOF'
chore(website): add checkout analytics events + Stripe env example

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 9: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Full test suite**

From `apps/website/`: `npx vitest run 2>&1 | tail -8`
From repo root: `npx vitest run scripts/stripe/sync-products.spec.ts 2>&1 | tail -8`
Expected: all green; PR-B baseline + the new specs from Tasks 3, 4, 5, 7.

- [ ] **Step 2: Lint**

From repo root: `npx nx run website:lint 2>&1 | tail -5`
Expected: `Successfully ran target lint for project website`.

- [ ] **Step 3: Build**

From repo root: `npx nx build website 2>&1 | tail -10`
Expected: `Successfully ran target build for project website`. The build must succeed even though `pricing/tiers.generated.ts` is empty — the route returns 503 at runtime, not at build time.

- [ ] **Step 4: Scope check**

```bash
git diff --name-only origin/main..HEAD | grep -vE '^(apps/website/|pricing/|scripts/stripe/|docs/superpowers/|\.env\.example)' | head
```
Expected: empty.

- [ ] **Step 5: Dry-run the sync script (optional, requires STRIPE_SECRET_KEY)**

If you have a Stripe test-mode secret available:
```
STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/stripe/sync-products.ts
```
Expected: three `✓` lines, then `Wrote pricing/tiers.generated.ts`. **Do not commit the generated file's populated form yet** — the full Stripe setup happens during the operational smoke test after PR merges. Revert with `git checkout -- pricing/tiers.generated.ts` before opening the PR.

---

## Self-review

**Spec coverage:**
- Spec § "Pricing source of truth" → Task 1. ✓
- Spec § "Stripe price IDs file" → Task 2 + Task 7 Step 1 (`renderGeneratedFile`). ✓
- Spec § `lib/stripe.ts` + `sk_` guard → Task 3. ✓
- Spec § `/api/checkout/session` route → Task 4. ✓
- Spec § `/thanks` page → Task 5. ✓
- Spec § PricingGrid form swap → Task 6. ✓
- Spec § `scripts/stripe/sync-products.ts` idempotent sync → Task 7. ✓
- Spec § new analytics event names → Task 8 Step 1. ✓
- Spec § env example → Task 8 Step 2. ✓
- Spec acceptance criteria 1–9 → Task 9. ✓
- Spec § Smoke test runbook → not in the plan; that's operational (post-merge), runs from the spec.

**Placeholder scan:** No TBD/TODO. Every code block is fully written. The tsconfig `paths` alias fallback in Task 4 Step 1 is a documented conditional ("if Next.js's compiler dislikes that import depth"); the relative path is the primary approach.

**Type consistency:** `TierSlug`, `TierConfig`, `BUYABLE_TIERS`, `STRIPE_PRICE_IDS` are consistent across Task 1, Task 2, Task 4, Task 6, Task 7. `CtaId` literals (`pricing_tier_*`) already exist in `events.ts` from PR B. `getStripe()` is consistent across Task 3 (definition), Task 4 (usage), Task 7 (script uses `new Stripe` directly with the same `apiVersion`).

Plan complete.
