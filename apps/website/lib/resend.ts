import { Resend } from 'resend';

/** Lazy-init Resend client — returns null when API key is missing (dev without keys). */
let _resend: Resend | null = null;
function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

export const AUDIENCE_ID = process.env.RESEND_AUDIENCE_ID || '';
export const FROM = process.env.RESEND_FROM || 'Angular Agent Framework <hello@cacheplane.io>';
export const NOTIFY_TO = process.env.RESEND_NOTIFY_TO || 'hello@cacheplane.io';

/** Send an email via Resend. No-ops when API key is missing. */
export async function sendEmail(opts: { from: string; to: string; subject: string; html: string; scheduledAt?: string }) {
  const client = getResend();
  if (!client) {
    console.info('[resend] skipped (no API key):', opts.subject);
    return;
  }
  await client.emails.send({
    from: opts.from,
    to: opts.to,
    subject: opts.subject,
    html: opts.html,
    ...(opts.scheduledAt ? { scheduledAt: opts.scheduledAt } : {}),
  });
}

/** Add a contact to the Resend audience. Fails silently. */
export async function addToAudience(email: string, firstName?: string) {
  if (!AUDIENCE_ID) return;
  const client = getResend();
  if (!client) return;
  try {
    await client.contacts.create({
      audienceId: AUDIENCE_ID,
      email,
      firstName: firstName || undefined,
    });
  } catch (err) {
    console.error('[resend] addToAudience failed:', err);
  }
}
