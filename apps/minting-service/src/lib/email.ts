// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Resend } from 'resend';
import type { MintableTier } from './tier.js';

export interface LicenseEmailVars {
  tier: MintableTier;
  seats: number;
  token: string;
  expiresAt: Date;
  /** Stripe customer id; used to mint a portal link inline in the email. */
  stripeCustomerId: string;
}

/**
 * Public URL where the buyer can reach the Stripe Customer Portal for
 * their subscription. Reads from PORTAL_BASE_URL when set (e.g. on
 * preview deploys), otherwise points at the production threadplane.ai
 * host.
 */
function portalUrl(stripeCustomerId: string): string {
  const base = process.env['PORTAL_BASE_URL'] ?? 'https://threadplane.ai';
  return `${base}/api/portal/session?customer_id=${encodeURIComponent(stripeCustomerId)}`;
}

export interface RenderedEmail {
  subject: string;
  text: string;
  html: string;
}

/**
 * Pure: render the subject / text / html for a license delivery email.
 */
export function renderLicenseEmail(vars: LicenseEmailVars): RenderedEmail {
  const seatWord = vars.seats === 1 ? 'seat' : 'seats';
  const subject = `Your Threadplane license — ${vars.tier} (${vars.seats} ${seatWord})`;
  const expiresIso = vars.expiresAt.toISOString();

  const portal = portalUrl(vars.stripeCustomerId);
  const text = `Thanks for your Threadplane license purchase.

Paste the token below into your @threadplane/chat configuration. Your subscription
renews automatically on ${expiresIso.slice(0, 10)}; manage or cancel it via
the link at the bottom of this email.

-----BEGIN THREADPLANE LICENSE-----
${vars.token}
-----END THREADPLANE LICENSE-----

Tier: ${vars.tier}
Seats: ${vars.seats}
Expires: ${expiresIso}

Installation:
  // application bootstrap
  provideChat({
    license: process.env['THREADPLANE_LICENSE'],
  });

  // .env
  THREADPLANE_LICENSE=<paste token above>

Manage subscription: ${portal}
Docs: https://threadplane.ai/docs/licensing
Questions: reply to this email.

-- The Threadplane team
`;

  const html = `<p>Thanks for your Threadplane license purchase.</p>
<p>Paste the token below into your <code>@threadplane/chat</code> configuration. Your subscription renews automatically on ${escapeHtml(expiresIso.slice(0, 10))}; <a href="${escapeHtml(portal)}">manage or cancel</a> any time.</p>
<pre style="white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">-----BEGIN THREADPLANE LICENSE-----
${escapeHtml(vars.token)}
-----END THREADPLANE LICENSE-----</pre>
<p><strong>Tier:</strong> ${escapeHtml(vars.tier)}<br>
<strong>Seats:</strong> ${vars.seats}<br>
<strong>Expires:</strong> ${escapeHtml(expiresIso)}</p>
<p><strong>Installation:</strong></p>
<pre style="font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">provideChat({
  license: process.env['THREADPLANE_LICENSE'],
});

// .env
THREADPLANE_LICENSE=&lt;paste token above&gt;</pre>
<p><a href="${escapeHtml(portal)}">Manage subscription</a> &middot; <a href="https://threadplane.ai/docs/licensing">Docs</a> &middot; Questions: reply to this email.</p>
<p>-- The Threadplane team</p>
`;

  return { subject, text, html };
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Send a license email via Resend. Throws on Resend errors so the caller
 * (webhook handler) can fail the request and trigger Stripe retry.
 */
export async function sendLicenseEmail(args: {
  resendApiKey: string;
  from: string;
  to: string;
  vars: LicenseEmailVars;
}): Promise<{ resendId: string }> {
  const resend = new Resend(args.resendApiKey);
  const rendered = renderLicenseEmail(args.vars);
  const result = await resend.emails.send({
    from: args.from,
    to: args.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  if (!result.data?.id) {
    throw new Error('Resend send returned no id');
  }
  return { resendId: result.data.id };
}

export interface RevocationEmailVars {
  tier: MintableTier;
}

export function renderRevocationEmail(vars: RevocationEmailVars): RenderedEmail {
  const subject = `Your Threadplane license has been revoked`;

  const text = `Your Threadplane ${vars.tier} license has been revoked because the
underlying payment was refunded.

The token previously delivered will fail signature checks at boot and
@threadplane/chat will fall back to a noncommercial-use warning.

If you believe this is in error, reply to this email.

-- The Threadplane team
`;

  const html = `<p>Your Threadplane <strong>${escapeHtml(vars.tier)}</strong> license has been revoked because the underlying payment was refunded.</p>
<p>The token previously delivered will fail signature checks at boot and <code>@threadplane/chat</code> will fall back to a noncommercial-use warning.</p>
<p>If you believe this is in error, reply to this email.</p>
<p>-- The Threadplane team</p>
`;

  return { subject, text, html };
}

export async function sendRevocationEmail(args: {
  resendApiKey: string;
  from: string;
  to: string;
  vars: RevocationEmailVars;
}): Promise<{ resendId: string }> {
  const resend = new Resend(args.resendApiKey);
  const rendered = renderRevocationEmail(args.vars);
  const result = await resend.emails.send({
    from: args.from,
    to: args.to,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
  if (result.error) {
    throw new Error(`Resend send failed: ${result.error.message}`);
  }
  if (!result.data?.id) {
    throw new Error('Resend send returned no id');
  }
  return { resendId: result.data.id };
}
