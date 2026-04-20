// SPDX-License-Identifier: PolyForm-Noncommercial-1.0.0
import { Resend } from 'resend';
import type { MintableTier } from './tier.js';

export interface LicenseEmailVars {
  tier: MintableTier;
  seats: number;
  token: string;
  expiresAt: Date;
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
  const subject = `Your Cacheplane license — ${vars.tier} (${vars.seats} ${seatWord})`;
  const expiresIso = vars.expiresAt.toISOString();

  const text = `Thanks for subscribing to Cacheplane.

Your license token is below. Set it as the CACHEPLANE_LICENSE
environment variable in your application:

-----BEGIN CACHEPLANE LICENSE-----
${vars.token}
-----END CACHEPLANE LICENSE-----

Tier: ${vars.tier}
Seats: ${vars.seats}
Expires: ${expiresIso}

Installation:
  export CACHEPLANE_LICENSE="<paste token above>"

Or in a .env file:
  CACHEPLANE_LICENSE=<paste token above>

Docs: https://cacheplane.dev/docs/licensing
Questions: reply to this email.

-- The Cacheplane team
`;

  const html = `<p>Thanks for subscribing to Cacheplane.</p>
<p>Your license token is below. Set it as the <code>CACHEPLANE_LICENSE</code> environment variable in your application:</p>
<pre style="white-space:pre-wrap;word-break:break-all;font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">-----BEGIN CACHEPLANE LICENSE-----
${escapeHtml(vars.token)}
-----END CACHEPLANE LICENSE-----</pre>
<p><strong>Tier:</strong> ${escapeHtml(vars.tier)}<br>
<strong>Seats:</strong> ${vars.seats}<br>
<strong>Expires:</strong> ${escapeHtml(expiresIso)}</p>
<p><strong>Installation:</strong></p>
<pre style="font-family:monospace;font-size:12px;background:#f4f4f4;padding:12px;border-radius:4px">export CACHEPLANE_LICENSE="&lt;paste token above&gt;"</pre>
<p>Docs: <a href="https://cacheplane.dev/docs/licensing">cacheplane.dev/docs/licensing</a><br>
Questions: reply to this email.</p>
<p>-- The Cacheplane team</p>
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
