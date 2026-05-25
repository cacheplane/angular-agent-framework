// SPDX-License-Identifier: MIT
import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '../../../../lib/stripe';

/**
 * Mint a Stripe Customer Portal session URL for a buyer who just completed
 * Checkout. We accept the Checkout session id (passed back via the
 * success_url query param) and resolve the customer id from it.
 *
 * No durable-auth dependency: the buyer holds the Checkout session id in
 * their /thanks URL for the lifetime of that browser context. Beyond that,
 * the portal is reachable via the "Manage subscription" link that ships
 * in their license email — that link contains the customer id directly.
 *
 * For a hard ongoing-access story (forgotten URL, lost email), we'll add a
 * "look up my subscription by email" magic-link flow in a follow-up.
 */
function getOrigin(req: NextRequest): string {
  const forwardedHost = req.headers.get('x-forwarded-host');
  const host = forwardedHost ?? req.headers.get('host') ?? 'localhost:3000';
  const proto = req.headers.get('x-forwarded-proto') ?? (host.startsWith('localhost') ? 'http' : 'https');
  return `${proto}://${host}`;
}

interface RequestBody {
  /** Checkout Session id (cs_test_… / cs_live_…). Preferred input. */
  session_id?: string;
  /** Stripe customer id (cus_…). Used when we already know it (e.g. email link). */
  customer_id?: string;
}

async function resolveCustomerId(
  body: RequestBody,
  stripe: ReturnType<typeof getStripe>,
): Promise<string | null> {
  if (body.customer_id && /^cus_[A-Za-z0-9]+$/.test(body.customer_id)) {
    return body.customer_id;
  }
  if (body.session_id && /^cs_(test|live)_[A-Za-z0-9]+$/.test(body.session_id)) {
    const session = await stripe.checkout.sessions.retrieve(body.session_id);
    const customer = session.customer;
    if (typeof customer === 'string') return customer;
    if (customer && 'id' in customer) return customer.id;
  }
  return null;
}

async function readBody(req: NextRequest): Promise<RequestBody> {
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    try {
      return (await req.json()) as RequestBody;
    } catch {
      return {};
    }
  }
  const form = await req.formData();
  const session_id = form.get('session_id');
  const customer_id = form.get('customer_id');
  return {
    session_id: typeof session_id === 'string' ? session_id : undefined,
    customer_id: typeof customer_id === 'string' ? customer_id : undefined,
  };
}

export async function POST(req: NextRequest) {
  const stripe = getStripe();
  const body = await readBody(req);
  const customerId = await resolveCustomerId(body, stripe);
  if (!customerId) {
    return NextResponse.json(
      { error: 'Pass session_id (Checkout) or customer_id (cus_…)' },
      { status: 400 },
    );
  }

  const origin = getOrigin(req);
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/thanks`,
  });

  if (!portal.url) {
    return NextResponse.json({ error: 'Stripe did not return a portal URL' }, { status: 502 });
  }

  return NextResponse.redirect(portal.url, { status: 303 });
}

/**
 * GET handler so the buyer can click a plain link from their license email
 * or the /thanks page and land on the portal. Same params as POST, via
 * query string.
 */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const body: RequestBody = {
    session_id: url.searchParams.get('session_id') ?? undefined,
    customer_id: url.searchParams.get('customer_id') ?? undefined,
  };
  const stripe = getStripe();
  const customerId = await resolveCustomerId(body, stripe);
  if (!customerId) {
    return NextResponse.json(
      { error: 'Pass session_id or customer_id as a query param' },
      { status: 400 },
    );
  }

  const origin = getOrigin(req);
  const portal = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${origin}/thanks`,
  });

  if (!portal.url) {
    return NextResponse.json({ error: 'Stripe did not return a portal URL' }, { status: 502 });
  }

  return NextResponse.redirect(portal.url, { status: 303 });
}
