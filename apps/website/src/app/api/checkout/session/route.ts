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
